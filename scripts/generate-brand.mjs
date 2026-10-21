// Deterministic exports of the approved, hand-traced mascot. No remote assets or credentials.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
const brand = new URL('../public/brand/', import.meta.url);
const icons = new URL('../public/icons/', import.meta.url);
await mkdir(icons, { recursive: true });
const mark = await readFile(new URL('koonpinai-mark.svg', brand), 'utf8');
const body = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const word = body(await readFile(new URL('./brand-wordmark.svg', import.meta.url), 'utf8'));
const svg = (viewBox, content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`;
for (const [name, ink] of [['logo','#1E2A44'],['logo-light','#FFFFFF'],['logo-dark','#1E2A44']]) {
  const lockup=svg('0 0 390 100',`<g transform="translate(0 8) scale(.8)">${body(mark)}</g><g transform="translate(175 17) scale(.8)">${word.replaceAll('#1E2A44',ink).replaceAll('#1e2a44',ink)}</g>`);
  await writeFile(new URL(`koonpinai-${name}.svg`,brand),lockup);
}
// Transparent, single-ink contour variants retain face openings and eye highlights.
for (const [name,ink] of [['monochrome','#1E2A44'],['white','#FFFFFF'],['black','#000000']]) {
  const mono=body(mark).replace(/fill="#(?:B6D7F1|F5C578)"/g,'fill="none"').replace(/fill="#FFF"/g,'fill="none"').replace(/#(?:1E2A44|17263D)/g,ink);
  await writeFile(new URL(`koonpinai-mark-${name}.svg`,brand),svg('0 0 200 100',mono));
}
const app=svg('0 0 512 512',`<rect width="512" height="512" rx="108" fill="#3E79C8"/><g transform="translate(66 153) scale(1.9)">${body(mark)}</g>`);
const maskable=svg('0 0 512 512',`<rect width="512" height="512" fill="#3E79C8"/><g transform="translate(96 176) scale(1.6)">${body(mark)}</g>`);
await writeFile(new URL('koonpinai-app-icon.svg',brand),app);
async function png(source,size,path) {
  const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');
  const img=await loadImage(Buffer.from(source));
  ctx.drawImage(img,0,0,size,size);
  const buffer=canvas.toBuffer('image/png');
  await writeFile(path,buffer);
  return buffer;
}
// Favicons use the same face geometry, centered on a transparent square.
const small=svg('0 0 200 200',`<g transform="translate(0 44)">${body(mark)}</g>`);
const frames=[];
for(const size of [16,32,48,64]) frames.push({size,data:await png(small,size,new URL(`favicon-${size}x${size}.png`,icons))});
for(const size of [192,512]) await png(app,size,new URL(`icon-${size}x${size}.png`,icons));
await png(app,512,new URL('koonpinai-app-icon-512.png',brand));
await png(maskable,512,new URL('icon-maskable-512x512.png',icons));
await png(app,180,new URL('../apple-touch-icon.png',brand));
const header=Buffer.alloc(6+16*frames.length);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
let offset=header.length;
frames.forEach(({size,data},i)=>{const n=6+16*i;header[n]=size;header[n+1]=size;header.writeUInt16LE(1,n+4);header.writeUInt16LE(32,n+6);header.writeUInt32LE(data.length,n+8);header.writeUInt32LE(offset,n+12);offset+=data.length;});
await writeFile(new URL('../favicon.ico',brand),Buffer.concat([header,...frames.map(f=>f.data)]));
const exports = ['brand/koonpinai-app-icon-512.png', ...(await readdir(icons)).filter(f=>f.endsWith('.png')).map(f=>'icons/'+f), 'apple-touch-icon.png', 'favicon.ico'];
const provenance = { source: 'User-approved pastel-blue peeking penguin, hand-traced as true vector paths.', reference_attachment: 'codex-clipboard-07fb5a8f-7c9a-489e-90bf-a793551f615d.png', master: 'public/brand/koonpinai-mark.svg', master_sha256: createHash('sha256').update(mark).digest('hex'), wordmark: 'Outlined Kodchasan 600; exact Koonpinai name; accompanying SIL Open Font License.', generator: 'node scripts/generate-brand.mjs', rasters: await Promise.all(exports.map(async f=>({ file: 'public/'+f, sha256: createHash('sha256').update(await readFile(new URL('../public/'+f,import.meta.url))).digest('hex') }))) };
await writeFile(new URL('provenance.json',brand),JSON.stringify(provenance,null,2)+'\n');
console.log('Generated Koonpinai SVG lockups, monochromes, PNG icons, multi-size ICO and provenance.');
