# PDF fidelity test

Checks that the print PDF matches what the editor shows.

It builds sample pages with the same style functions the app uses
(`src/pageRender.js`) — photos with cover-cropping and rotation, an image
sticker, Pacifico / Playfair / Londrina text, Arabic text, mixed Arabic and
English, and wrapped multi-line captions — then compares:

1. the browser's own rendering of each page at print scale (what the editor shows), with
2. the PDF pipeline's raster, and
3. the image actually embedded in the generated PDF.

The page is hosted inside a `dir="rtl"` body with conflicting inherited styles
on purpose, to prove the design renders the same regardless of the UI language.

## Running

Needs Node with Playwright (Chromium), Python 3 with Pillow and NumPy, poppler-utils,
a checkout of github.com/google/fonts (for the real font files) and a jsPDF 2.5.x UMD build.

```bash
python3 prepare.py <repoRoot> <google-fonts-checkout> <jspdf.umd.min.js> /tmp/fid/serve
(cd /tmp/fid/serve && python3 -m http.server 8765 --bind 127.0.0.1 &)
node run.mjs /tmp/fid/serve /tmp/fid/out
python3 compare.py /tmp/fid/out
```

Last result (Chromium):

```
PDF page size: 210.0 x 273.0 mm
page 1 vs pipeline raster: 2400x3120px  pixels visibly different: 0.0018%
page 1 vs PDF image      : 2400x3120px  pixels visibly different: 0.0800%  (JPEG compression)
page 2 vs pipeline raster: 2400x3120px  pixels visibly different: 0.0000%
page 2 vs PDF image      : 2400x3120px  pixels visibly different: 0.0837%  (JPEG compression)
RESULT: PASS
```
