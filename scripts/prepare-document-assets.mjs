import { cp, copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const destination = resolve("public/vendor");
const root = (name) => dirname(require.resolve(`${name}/package.json`));
await mkdir(join(destination, "pdfjs"), { recursive: true });
await mkdir(join(destination, "tesseract/core"), { recursive: true });
await mkdir(join(destination, "tesseract/lang"), { recursive: true });
await copyFile(
  join(root("pdfjs-dist"), "build/pdf.worker.min.mjs"),
  join(destination, "pdfjs/pdf.worker.min.mjs"),
);
for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(
    join(root("pdfjs-dist"), directory),
    join(destination, "pdfjs", directory),
    { recursive: true },
  );
}
await copyFile(
  join(root("tesseract.js"), "dist/worker.min.js"),
  join(destination, "tesseract/worker.min.js"),
);
for (const file of await readdir(root("tesseract.js-core"))) {
  if (/^tesseract-core.*\.(wasm|js)$/.test(file))
    await copyFile(
      join(root("tesseract.js-core"), file),
      join(destination, "tesseract/core", file),
    );
}
for (const language of ["eng", "tha"]) {
  await copyFile(
    join(
      root(`@tesseract.js-data/${language}`),
      `4.0.0_best_int/${language}.traineddata.gz`,
    ),
    join(destination, "tesseract/lang", `${language}.traineddata.gz`),
  );
}
console.log(
  "Prepared local PDF.js and Thai/English OCR assets. No document data was accessed.",
);
