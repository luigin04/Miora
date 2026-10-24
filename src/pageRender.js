// ─────────────────────────────────────────────────────────────────────────────
// Shared page rendering — the single source of truth for how an album page
// looks, used by BOTH the editor (what the customer sees while designing) and
// the print PDF (what Layal sends to the printer).
//
// Why this exists: the old PDF path re-drew pages a second, different way
// (html2canvas for photos + jsPDF Helvetica for text). That lost every custom
// font, broke Arabic shaping, ignored text rotation and stretched photos,
// because html2canvas does not support `object-fit`. Now the editor and the
// PDF are built from the same style functions below, and the PDF is
// rasterized by the browser's own layout engine (an SVG <foreignObject>
// snapshot), so the printed page is the same rendering as the on-screen page,
// just at print resolution.
//
// This file intentionally has NO imports and NO JSX so it can be loaded on its
// own (it's exercised directly by the PDF fidelity test in /scripts).
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE_W = 400;
export const PAGE_H = 520;

// Print resolution. Pages are designed in a 400x520 logical space; at 6x the
// raster is 2400x3120 px, which on the 210mm-wide PDF page is ≈290 dpi —
// effectively full print resolution for text, stickers and shapes. (Photo
// detail is still bounded by the stored photo itself — see README.)
export const PRINT_SCALE = 6;

// Physical PDF page size: 210mm wide, height derived from the 400:520 design
// ratio so the artwork fills each page edge-to-edge. If the print supplier has
// a specific trim size, change PDF_PAGE_WIDTH_MM only.
export const PDF_PAGE_WIDTH_MM = 210;
export const PDF_PAGE_HEIGHT_MM = PDF_PAGE_WIDTH_MM * (PAGE_H / PAGE_W);

export const DEFAULT_TEXT_COLOR = "#4A3068";

// Every font the editor offers MUST be in this stylesheet — a font that isn't
// loaded silently falls back to a device font, which differs between the
// customer's phone and the admin's computer. (Noto Nastaliq Urdu was missing.)
export const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700" +
  "&family=Noto+Sans+Arabic:wght@300;400;500;600;700" +
  "&family=Noto+Nastaliq+Urdu:wght@400;700" +
  "&family=Londrina+Solid:wght@400;900" +
  "&family=Playfair+Display:wght@400;600;700" +
  "&family=Dancing+Script:wght@400;600;700" +
  "&family=Pacifico&family=Amatic+SC:wght@400;700" +
  "&family=Caveat:wght@400;600;700&family=Lobster" +
  "&family=Comfortaa:wght@300;400;700&family=Markazi+Text:wght@400;500" +
  "&display=swap";

// Arabic glyphs typed into a Latin-only font (e.g. Pacifico) fall back to this
// web font instead of whatever Arabic font the current device happens to have,
// so Arabic looks the same on every device and in the PDF.
const ARABIC_FALLBACK = "Noto Sans Arabic";
export const PAGE_BASE_FONT = "Quicksand";

export function fontFamilyFor(fontName) {
  const f = fontName || PAGE_BASE_FONT;
  return `'${f}','${ARABIC_FALLBACK}',sans-serif`;
}

// Font families a page needs embedded to render identically.
export function fontsUsedByPage(page) {
  const set = new Set([PAGE_BASE_FONT, ARABIC_FALLBACK]);
  (page?.elements || []).forEach(el => { if (el.type === "text") set.add(el.font || PAGE_BASE_FONT); });
  return set;
}

// ── Style builders (React-style objects: numbers mean px) ───────────────────

// The page box. Every inheritable text property is pinned here, so the page
// renders the same no matter what it's nested in (editor in Arabic or English
// UI, admin panel, or the isolated PDF snapshot).
export function pageStyle(page) {
  return {
    width: PAGE_W, height: PAGE_H, position: "relative", overflow: "hidden",
    background: (page && page.background) || "#ffffff",
    fontFamily: fontFamilyFor(PAGE_BASE_FONT), fontSize: 16, fontWeight: "normal",
    fontStyle: "normal", color: DEFAULT_TEXT_COLOR, lineHeight: "normal",
    letterSpacing: "normal", wordSpacing: "normal", textAlign: "left",
    textTransform: "none", whiteSpace: "normal", direction: "ltr",
    WebkitTextSizeAdjust: "100%",
  };
}

export function elementBoxStyle(el) {
  return {
    position: "absolute", left: el.x || 0, top: el.y || 0, width: el.w || 0, height: el.h || 0,
    transform: `rotate(${el.rotation || 0}deg)`, userSelect: "none",
  };
}

export const imageStyle = {
  width: "100%", height: "100%", objectFit: "cover", borderRadius: 2,
  display: "block", pointerEvents: "none",
};

export function stickerBoxStyle(el) {
  return {
    width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: Math.min(el.w || 0, el.h || 0) * 0.7, lineHeight: 1, pointerEvents: "none",
  };
}

export const stickerImageStyle = {
  width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none",
};

// Text is rendered with dir="auto" (set on the element) so its direction comes
// from the text itself, not from the UI language the customer had selected.
function textFontStyle(el) {
  return {
    fontFamily: fontFamilyFor(el.font), fontSize: el.fontSize || 18,
    color: el.color || DEFAULT_TEXT_COLOR,
    fontWeight: el.bold ? "bold" : "normal", fontStyle: el.italic ? "italic" : "normal",
    textAlign: "center", padding: 4,
  };
}

export function textStyle(el) {
  return {
    ...textFontStyle(el),
    width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    wordBreak: "break-word", pointerEvents: "none", whiteSpace: "pre-wrap",
  };
}

export function textEditorStyle(el) {
  return {
    ...textFontStyle(el),
    width: "100%", height: "100%", border: "none", background: "transparent",
    outline: "none", resize: "none", cursor: "text",
  };
}

// ── Rasterizer ───────────────────────────────────────────────────────────────
// Takes a mounted page DOM node and returns a canvas of it at `scale`x,
// rendered by the browser itself via SVG <foreignObject>. Fonts and images are
// inlined first because an SVG drawn as an image may not load external files.

const CSS_RESET = "*{margin:0;padding:0;box-sizing:border-box}"; // mirrors public/index.html

const dataUrlCache = new Map();

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function urlToDataUrl(url) {
  if (!url || url.startsWith("data:")) return url;
  const abs = new URL(url, document.baseURI).href;
  if (!dataUrlCache.has(abs)) {
    dataUrlCache.set(abs, (async () => {
      const res = await fetch(abs, { mode: "cors" });
      if (!res.ok) throw new Error(`Failed to load ${abs} (${res.status})`);
      return blobToDataUrl(await res.blob());
    })());
  }
  try { return await dataUrlCache.get(abs); }
  catch (e) { dataUrlCache.delete(abs); throw e; }
}

const fontCssCache = new Map();

// Fetches the Google Fonts stylesheet (the exact same URL the site loads, so
// the exact same font files) and returns @font-face rules for the requested
// families with every font file inlined as a data URL. All weights/subsets of
// a used family are kept so the browser picks the same face as in the editor.
export async function buildEmbeddedFontCss(families, cssUrl = FONT_CSS_URL) {
  const key = cssUrl + "|" + [...families].sort().join(",");
  if (fontCssCache.has(key)) return fontCssCache.get(key);
  const p = (async () => {
    const res = await fetch(cssUrl, { mode: "cors" });
    if (!res.ok) throw new Error(`Font stylesheet failed to load (${res.status})`);
    const css = await res.text();
    const blocks = css.match(/@font-face\s*{[^}]*}/g) || [];
    const wanted = new Set([...families].map(f => f.toLowerCase()));
    const out = [];
    for (const block of blocks) {
      const fam = (block.match(/font-family:\s*['"]?([^;'"]+)['"]?\s*;/) || [])[1];
      if (!fam || !wanted.has(fam.trim().toLowerCase())) continue;
      let inlined = block;
      const urls = [...block.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(m => m[1]);
      for (const u of urls) {
        const abs = new URL(u, cssUrl).href;
        inlined = inlined.split(u).join(await urlToDataUrl(abs));
      }
      out.push(inlined);
    }
    return out.join("\n");
  })();
  fontCssCache.set(key, p);
  try { return await p; } catch (e) { fontCssCache.delete(key); throw e; }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Page snapshot failed to render"));
    img.src = src;
  });
}

export async function rasterizePage(node, {
  scale = PRINT_SCALE, width = PAGE_W, height = PAGE_H,
  background = "#ffffff", fontFamilies, fontCssUrl = FONT_CSS_URL,
} = {}) {
  const clone = node.cloneNode(true);
  // Inline every image (photos are already data URLs; stickers and template
  // covers are site files) so the snapshot is fully self-contained.
  const imgs = Array.from(clone.querySelectorAll("img"));
  await Promise.all(imgs.map(async img => {
    const src = img.getAttribute("src");
    if (src && !src.startsWith("data:")) img.setAttribute("src", await urlToDataUrl(src));
  }));
  // The snapshot sits at the origin regardless of where the node was mounted.
  clone.style.position = "relative";
  clone.style.left = "0px";
  clone.style.top = "0px";
  clone.style.margin = "0px";

  const fontCss = fontFamilies && fontFamilies.size ? await buildEmbeddedFontCss(fontFamilies, fontCssUrl) : "";
  const html = new XMLSerializer().serializeToString(clone);
  const styleText = (CSS_RESET + "\n" + fontCss).replace(/]]>/g, "]]]]><![CDATA[>");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">` +
    `<style><![CDATA[${styleText}]]></style>${html}</div>` +
    `</foreignObject></svg>`;

  const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  if (img.decode) { try { await img.decode(); } catch { /* drawImage below still works */ } }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  const paint = () => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  paint();
  // Safari sometimes paints <foreignObject> images before their embedded
  // resources have decoded; a second paint after a short pause fixes it.
  if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
    await new Promise(r => setTimeout(r, 300));
    paint();
  }
  return canvas;
}

// Builds the print PDF: one full-bleed page per album page.
// `jsPDF` is passed in (rather than imported) to keep this file dependency-free.
export async function exportPagesToPdf(jsPDF, pages, nodes, { title = "Miora Album", onProgress, fontCssUrl } = {}) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [PDF_PAGE_WIDTH_MM, PDF_PAGE_HEIGHT_MM], compress: true });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < pages.length; i++) {
    const node = nodes[i];
    if (!node) throw new Error(`Page ${i + 1} was not rendered`);
    const canvas = await rasterizePage(node, {
      background: pages[i].background || "#ffffff",
      fontFamilies: fontsUsedByPage(pages[i]),
      ...(fontCssUrl ? { fontCssUrl } : {}),
    });
    const jpeg = canvas.toDataURL("image/jpeg", 0.95);
    canvas.width = canvas.height = 0; // free the bitmap before the next page
    if (i > 0) pdf.addPage([PDF_PAGE_WIDTH_MM, PDF_PAGE_HEIGHT_MM], "portrait");
    pdf.addImage(jpeg, "JPEG", 0, 0, w, h, undefined, "NONE");
    onProgress && onProgress(i + 1, pages.length);
  }
  pdf.setProperties({ title, creator: "Miora by Layal" });
  return pdf;
}
