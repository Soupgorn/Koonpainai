import { PDF_LIMITS } from "./config";
let library: Promise<typeof import("pdfjs-dist")> | undefined;
export async function getPdfLibrary() {
  library ??= import("pdfjs-dist")
    .then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
      return pdfjs;
    })
    .catch((error) => {
      library = undefined;
      throw error;
    });
  return library;
}
export async function openPdf(data: ArrayBuffer) {
  const pdfjs = await getPdfLibrary();
  return pdfjs.getDocument({
    data,
    cMapUrl: "/vendor/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/vendor/pdfjs/standard_fonts/",
    wasmUrl: "/vendor/pdfjs/wasm/",
    stopAtErrors: true,
    maxImageSize: PDF_LIMITS.maxCanvasPixels,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
}
