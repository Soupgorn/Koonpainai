const configuredMegabytes = Number(process.env.NEXT_PUBLIC_PDF_MAX_MB ?? 10);
export const PDF_LIMITS = {
  maxBytes:
    (Number.isFinite(configuredMegabytes)
      ? Math.min(50, Math.max(1, configuredMegabytes))
      : 10) *
    1024 *
    1024,
  maxPages: 20,
  maxCanvasPixels: 14_000_000,
  timeoutMs: 180_000,
};
export async function validatePdfFile(
  file: File,
  maxBytes = PDF_LIMITS.maxBytes,
): Promise<void> {
  if (
    !/\.pdf$/i.test(file.name) ||
    (file.type && file.type !== "application/pdf")
  )
    throw new Error(
      "Choose a PDF timetable, not an image or another file type.",
    );
  if (file.size > maxBytes)
    throw new Error(
      `This PDF exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit. Choose a smaller export.`,
    );
  if (
    file.size < 5 ||
    new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== "%PDF-"
  )
    throw new Error(
      "This file does not have a valid PDF header. Export it again as a PDF.",
    );
}
