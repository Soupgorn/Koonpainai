import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import type { Worker as OcrWorker } from "tesseract.js";
import { PDF_LIMITS, validatePdfFile } from "./config";
import { getPdfLibrary, openPdf } from "./pdf-client";
import { parseKmitlTimetable } from "./kmitl-parser";
import type {
  ExtractedPage,
  ProcessingOptions,
  ProcessingProgress,
  TextToken,
} from "./types";

export function hasUsableText(tokens: TextToken[]) {
  const text = tokens.map((token) => token.text).join(" ");
  const replacements = (text.match(/[\uFFFD\u0000]/g) ?? []).length;
  const structural =
    (text.match(/\b\d{8}\b/g) ?? []).length >= 2 ||
    /\d{1,2}[:.]\d{2}\s*[-–]/.test(text) ||
    tokens.length >= 30 ||
    text.trim().split(/\s+/).length >= 30;
  return (
    text.trim().length >= 60 &&
    replacements / Math.max(1, text.length) < 0.05 &&
    structural
  );
}
function abortError() {
  return new DOMException("Processing was cancelled.", "AbortError");
}
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => {});
    return Promise.reject(abortError());
  }
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
export async function processPdf(file: File, options: ProcessingOptions = {}) {
  const controller = new AbortController();
  const signal = controller.signal;
  const externalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", externalAbort, { once: true });
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PDF_LIMITS.timeoutMs);
  let loading: PDFDocumentLoadingTask | null = null,
    render: RenderTask | null = null,
    ocr: OcrWorker | null = null;
  let currentPage = 0,
    total = 0;
  const report = (progress: Omit<ProcessingProgress, "page" | "total">) => {
    if (!signal.aborted)
      options.onProgress?.({ ...progress, page: currentPage, total });
  };
  const stop = () => {
    render?.cancel();
    if (ocr) {
      void ocr.terminate().catch(() => {});
      ocr = null;
    }
    if (loading) void loading.destroy().catch(() => {});
  };
  signal.addEventListener("abort", stop, { once: true });
  try {
    await validatePdfFile(file, options.maxBytes);
    if (signal.aborted) throw abortError();
    report({ stage: "opening" });
    loading = await openPdf(await file.arrayBuffer());
    const doc = await abortable(loading.promise, signal);
    total = doc.numPages;
    if (total > PDF_LIMITS.maxPages)
      throw new Error(
        `This PDF has more than ${PDF_LIMITS.maxPages} pages. Export only the timetable pages.`,
      );
    const pdfjs = await getPdfLibrary();
    const pages: ExtractedPage[] = [];
    for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
      currentPage = pageNumber;
      if (signal.aborted) throw abortError();
      report({ stage: "detecting-text" });
      const page = await abortable(doc.getPage(pageNumber), signal);
      const viewport = page.getViewport({ scale: 1 });
      const content = await abortable(page.getTextContent(), signal);
      const tokens: TextToken[] = content.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const transform = pdfjs.Util.transform(
          viewport.transform,
          item.transform,
        );
        const height = Math.max(1, Math.hypot(transform[2], transform[3]));
        return [
          {
            text: item.str,
            x: transform[4],
            y: transform[5] - height,
            width: item.width,
            height,
          },
        ];
      });
      if (hasUsableText(tokens)) {
        pages.push({
          page: pageNumber,
          width: viewport.width,
          height: viewport.height,
          method: "text",
          tokens,
          text: tokens.map((token) => token.text).join(" "),
        });
        page.cleanup();
        continue;
      }
      report({ stage: "rendering" });
      const scale = Math.min(
        3,
        Math.sqrt(
          PDF_LIMITS.maxCanvasPixels / (viewport.width * viewport.height),
        ),
      );
      if (!Number.isFinite(scale) || scale < 0.5)
        throw new Error(
          `Page ${pageNumber} is too large to render safely. Export a standard-size PDF.`,
        );
      const rendered = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(rendered.width);
      canvas.height = Math.ceil(rendered.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context)
        throw new Error(
          "Your browser could not create a page image. Try a current browser.",
        );
      try {
        render = page.render({
          canvasContext: context,
          viewport: rendered,
          canvas,
        });
        await abortable(render.promise, signal);
        render = null;
        if (!ocr) {
          report({ stage: "loading-ocr" });
          const { createWorker, OEM, PSM } = await import("tesseract.js");
          const workerPromise = createWorker(["tha", "eng"], OEM.LSTM_ONLY, {
            workerPath: "/vendor/tesseract/worker.min.js",
            corePath: "/vendor/tesseract/core",
            langPath: "/vendor/tesseract/lang",
            cacheMethod: "none",
            workerBlobURL: false,
            logger: (message) => {
              if (message.status === "recognizing text")
                report({
                  stage: "recognizing",
                  fraction: Math.min(1, Math.max(0, message.progress)),
                });
              else report({ stage: "loading-ocr" });
            },
          });
          // Initialization itself cannot always be interrupted; terminate as soon as it resolves.
          void workerPromise.then(
            (worker) => {
              if (signal.aborted) void worker.terminate().catch(() => {});
            },
            () => {},
          );
          ocr = await abortable(workerPromise, signal);
          await abortable(
            ocr.setParameters({
              tessedit_pageseg_mode: PSM.AUTO,
              preserve_interword_spaces: "1",
              user_defined_dpi: "216",
            }),
            signal,
          );
        }
        report({ stage: "recognizing", fraction: 0 });
        const { data } = await abortable(
          ocr.recognize(canvas, {}, { text: true, blocks: true }),
          signal,
        );
        const words = (data.blocks ?? []).flatMap((block) =>
          block.paragraphs.flatMap((paragraph) =>
            paragraph.lines.flatMap((line) => line.words),
          ),
        );
        const recognized: TextToken[] = words
          .filter((word) => word.text.trim())
          .map((word) => ({
            text: word.text,
            x: word.bbox.x0 / scale,
            y: word.bbox.y0 / scale,
            width: (word.bbox.x1 - word.bbox.x0) / scale,
            height: (word.bbox.y1 - word.bbox.y0) / scale,
            confidence: word.confidence,
          }));
        pages.push({
          page: pageNumber,
          width: viewport.width,
          height: viewport.height,
          method: "ocr",
          tokens: recognized,
          text: data.text,
          confidence: data.confidence,
        });
      } finally {
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
    }
    report({ stage: "parsing" });
    if (signal.aborted) throw abortError();
    return parseKmitlTimetable(pages);
  } catch (error) {
    if (timedOut)
      throw new Error(
        "Processing exceeded three minutes and was stopped. Try fewer pages or a clearer export.",
      );
    if (signal.aborted) throw abortError();
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException")
      throw new Error(
        "This PDF is password-protected. Export an unprotected timetable and try again.",
      );
    if (
      [
        "InvalidPDFException",
        "MissingPDFException",
        "UnknownErrorException",
      ].includes(name)
    )
      throw new Error(
        "This PDF could not be read. It may be damaged. Export a new timetable PDF and try again.",
      );
    if (
      error instanceof Error &&
      /fetch|network|worker|wasm|traineddata|initialize/i.test(error.message)
    )
      throw new Error(
        "The local PDF/OCR engine could not load. Check your connection to this app and try again. Your PDF was not uploaded.",
      );
    throw error instanceof Error
      ? error
      : new Error("The PDF could not be processed. Try a clearer export.");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", externalAbort);
    signal.removeEventListener("abort", stop);
    if (ocr) await ocr.terminate().catch(() => {});
    if (loading) await loading.destroy().catch(() => {});
  }
}
