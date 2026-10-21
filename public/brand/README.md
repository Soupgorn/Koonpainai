# Koonpinai brand assets

The source is `koonpinai-mark.svg`, a hand trace of the user-approved pastel-blue peeking penguin. Navy outlines, white face, paired eyes/highlights, warm beak, flippers and horizontal rail follow the supplied reference. The branding board itself is never used as an app asset. Flat fills replace screenshot shading for clean scaling.

Run `node scripts/generate-brand.mjs` from the repository root to reproduce all derived vectors, PNGs and ICO frames with the existing canvas dependency. `scripts/brand-wordmark.svg` contains outlined Kodchasan 600 lettering, originally converted from the application's already-installed font; generation needs no network or font installation. The UI wordmark is accessible live text using the same font.

`koonpinai-logo.svg` and `koonpinai-logo-dark.svg` use navy lettering on light grounds; `koonpinai-logo-light.svg` uses white lettering on dark grounds. Marks have transparent canvases. Navy, white and black single-ink contour variants retain the same geometry. The blue square icon is for home screens; the maskable version extends its solid ground to every corner and keeps the mascot inside the central safe circle.

`provenance.json` records the reference, source hash and raster exports. Kodchasan is licensed under the accompanying SIL Open Font License. No generated image model, embedded screenshot, extra accessories or old K mark is used.
