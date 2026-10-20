"use client";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist";
import { openPdf } from "@/lib/pdf/pdf-client";
import { Button } from "./ui/button";

export function PdfPreview({
  file,
  page,
  onPageChange,
}: {
  file: File;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const document = useRef<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState(0);
  const [revision, setRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true,
      task: PDFDocumentLoadingTask | undefined;
    void file
      .arrayBuffer()
      .then(openPdf)
      .then(async (next) => {
        task = next;
        const doc = await task.promise;
        if (!active) {
          await task.destroy();
          return;
        }
        document.current = doc;
        setPages(doc.numPages);
        setRevision((value) => value + 1);
      })
      .catch(() => {
        if (active) {
          setError(
            "The PDF preview could not load. Open the original PDF to compare it.",
          );
          setLoading(false);
        }
      });
    const observer = new ResizeObserver(() =>
      setRevision((value) => value + 1),
    );
    if (container.current) observer.observe(container.current);
    return () => {
      active = false;
      observer.disconnect();
      document.current = null;
      void task?.destroy().catch(() => {});
    };
  }, [file]);
  useEffect(() => {
    const doc = document.current;
    if (!doc || !canvas.current) return;
    let active = true,
      render: RenderTask | undefined;
    void doc
      .getPage(Math.max(1, Math.min(page, doc.numPages)))
      .then(async (pdfPage) => {
        if (!active || !canvas.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const fit = Math.max(
          0.2,
          ((container.current?.clientWidth ?? 400) - 24) / base.width,
        );
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pdfPage.getViewport({ scale: fit * zoom * ratio });
        canvas.current.width = Math.ceil(viewport.width);
        canvas.current.height = Math.ceil(viewport.height);
        canvas.current.style.width = `${viewport.width / ratio}px`;
        canvas.current.style.height = `${viewport.height / ratio}px`;
        const context = canvas.current.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        render = pdfPage.render({
          canvasContext: context,
          viewport,
          canvas: canvas.current,
        });
        await render.promise;
        if (active) {
          setLoading(false);
          setError("");
        }
        pdfPage.cleanup();
      })
      .catch((caught) => {
        if (active && caught?.name !== "RenderingCancelledException") {
          setError(
            "This page could not render. Open the original PDF to inspect it.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [page, zoom, revision]);
  return (
    <div className="pdf-canvas-preview">
      <div className="pdf-preview-controls">
        <div>
          <Button
            variant="ghost"
            size="icon"
            disabled={page <= 1 || !pages}
            aria-label="Previous PDF page"
            onClick={() => {
              setLoading(true);
              onPageChange(page - 1);
            }}
          >
            <ChevronLeft size={16} />
          </Button>
          <span aria-live="polite">
            Page {page} of {pages || "…"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            disabled={page >= pages || !pages}
            aria-label="Next PDF page"
            onClick={() => {
              setLoading(true);
              onPageChange(page + 1);
            }}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <div>
          <Button
            variant="ghost"
            size="icon"
            disabled={zoom <= 1}
            aria-label="Zoom out of PDF"
            onClick={() => {
              setLoading(true);
              setZoom((value) => Math.max(1, value - 0.5));
            }}
          >
            <Minus size={15} />
          </Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            disabled={zoom >= 3}
            aria-label="Zoom into PDF"
            onClick={() => {
              setLoading(true);
              setZoom((value) => Math.min(3, value + 0.5));
            }}
          >
            <Plus size={15} />
          </Button>
        </div>
      </div>
      <div
        className="pdf-canvas-scroll"
        ref={container}
        aria-label="Original PDF page"
        role="region"
        tabIndex={0}
        aria-busy={loading}
      >
        {loading && !error && (
          <p className="pdf-loading" role="status">
            Rendering original page…
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            <AlertCircle size={16} />
            {error}
          </p>
        )}
        <canvas
          ref={canvas}
          aria-label={`Original timetable, page ${page}. Use the editable fields to review extracted text.`}
        />
      </div>
    </div>
  );
}
