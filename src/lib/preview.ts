/** UI previews never authorize server writes or represent authenticated access. */
export function isUiPreviewEnabled() {
  return process.env.NODE_ENV === "development" || process.env.ENABLE_UI_PREVIEW === "true";
}
