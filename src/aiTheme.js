// Theme packs, page layouts and photo frames for AI Powered Design.
// Stickers are real image stickers (SVG/PNG in /public/stickers); backgrounds are CSS so they
// render identically in the editor and the printed PDF.

const S = (pack, names) => names.map(n => `/stickers/${pack}/${n}.svg`);
const P = (names) => names.map(n => `/stickers/sticker-${n}.png`);
const dots = (bg, dot, size = 22, r = 2.4) =>
  `radial-gradient(circle, ${dot} ${r}px, transparent ${r + 0.4}px) 0 0/${size}px ${size}px, ` +
  `radial-gradient(circle, ${dot} ${r}px, transparent ${r + 0.4}px) ${size / 2}px ${size / 2}px/${size}px ${size}px, ${bg}`;
const grid = (bg, line, size = 26) =>
  `linear-gradient(${line} 1px, transparent 1px) 0 0/${size}px ${size}px, linear-gradient(90deg, ${line} 1px, transparent 1px) 0 0/${size}px ${size}px, ${bg}`;

export const THEMES = {
  bees: {
    label: ["Bees & polka dots", "نحل ونقاط"], emoji: "🐝",
    colors: { accent: "#E09A12", dark: "#1F1B16", soft: "#FFF8E6" },
    titleFont: "Dancing Script",
    backgrounds: ["#FFF8E6", dots("#FFF8E6", "#F7D46A"), "#ffffff", dots("#F5C02E", "rgba(255,255,255,.75)"), dots("#1F1B16", "rgba(255,255,255,.85)", 22, 2.2)],
    stickers: S("bees", ["bee", "bee-kiss", "bee-happy", "honeycomb", "honeycomb-small", "sunflower", "honey-jar", "heart", "balloon", "balloon-dark"]),
  },
  iraq: {
    label: ["Iraq", "العراق"], emoji: "🇮🇶",
    colors: { accent: "#B9583B", dark: "#1F4E9C", soft: "#F4E7CF" },
    titleFont: "Playfair Display",
    backgrounds: ["#FFF9EE", dots("#F4E7CF", "rgba(31,78,156,.45)", 20, 1.6), grid("#F1E2C6", "rgba(185,88,59,.18)", 28), "#ffffff", dots("#1F4E9C", "rgba(242,207,107,.9)", 22, 2.2)],
    stickers: S("iraq", ["flag", "palm", "dates", "istikan", "kleicha", "rosette", "rosette-sand", "ishtar-gate", "malwiya", "tuktuk", "kebab", "plane"]),
  },
  dubai: {
    label: ["Dubai", "دبي"], emoji: "🏙️",
    colors: { accent: "#F07B5A", dark: "#14243F", soft: "#EFDDBD" },
    titleFont: "Playfair Display",
    backgrounds: ["#FFFAF0", dots("#EFDDBD", "rgba(201,162,74,.75)"), dots("#2BB3C0", "rgba(255,255,255,.75)"), dots("#FCE6DC", "rgba(240,123,90,.55)", 20, 2), "#ffffff"],
    stickers: [...S("dubai", ["burj-khalifa", "burj-al-arab", "dubai-frame", "museum-future", "ain-dubai", "camel", "dallah", "abra", "lantern", "uae-flag", "desert-sun", "palm-island", "shopping-bag", "sunglasses", "karak", "butterfly", "palm"]),
               ...P(["burjkhalifa_teal", "dubai_badge_burjalarab", "dubai_luggage_tag_blue", "dubai_postage_stamp_scene", "uae_camel_postage_stamp", "uae_fireworks", "dubai_chocolate_bar"])],
  },
  paris: {
    label: ["Paris", "باريس"], emoji: "🗼",
    colors: { accent: "#D9707F", dark: "#2B2D42", soft: "#FCEEF1" },
    titleFont: "Dancing Script",
    backgrounds: ["#FFF9FA", dots("#FCEEF1", "rgba(217,112,127,.45)", 20, 1.8), "#ffffff", grid("#F7F3EC", "rgba(43,45,66,.08)", 24)],
    stickers: P(["eiffel_tower_gold", "eiffel_tower_pink_sketch", "eiffel_tower_postage_stamp", "eiffel_tower_watercolor", "arc_de_triomphe_watercolor", "baguettes_bundle", "beret_pink",
                 "croissant_flat", "croissant_watercolor", "macaron_pink", "i_love_paris", "bonjour_script", "paris_bicycle", "paris_metro_sign", "paris_postmark_stamp", "paris_script_heart", "tulip_bouquet", "paris_airport_stamp"]),
  },
  jordan: {
    label: ["Jordan", "الأردن"], emoji: "🇯🇴",
    colors: { accent: "#C0392B", dark: "#1E3A2B", soft: "#F3E9DA" },
    titleFont: "Playfair Display",
    backgrounds: ["#FFFAF2", dots("#F3E9DA", "rgba(192,57,43,.4)", 20, 1.7), "#ffffff", grid("#F6EEE2", "rgba(30,58,43,.10)", 26)],
    stickers: P(["petra_treasury_bold", "petra_treasury_flat", "petra_treasury_lineart", "jerash_amphitheater", "jerash_columns_flat", "jordan_camels_desert", "jordan_coffee_cup",
                 "jordan_embroidery_pattern", "jordan_flag_bunting", "wadi_rum_canyon", "jordan_map_outline"]),
  },
  birthday: {
    label: ["Birthday", "عيد ميلاد"], emoji: "🎂",
    colors: { accent: "#E0465E", dark: "#3A2B5C", soft: "#FFF1F4" },
    titleFont: "Londrina Solid",
    backgrounds: ["#FFF7F9", dots("#FFF1F4", "rgba(224,70,94,.35)", 20, 2), "#ffffff", dots("#FFF3C4", "rgba(58,43,92,.3)", 20, 1.8)],
    stickers: S("birthday", ["balloon", "balloon-dark", "heart", "star", "sunflower", "bee"]),
  },
  love: {
    label: ["Love & wedding", "حب وزفاف"], emoji: "💕",
    colors: { accent: "#C0506A", dark: "#4A3068", soft: "#FFF0F5" },
    titleFont: "Dancing Script",
    backgrounds: ["#FFF8FB", dots("#FFF0F5", "rgba(192,80,106,.3)", 22, 1.8), "#ffffff", "#FBF6FF"],
    stickers: [...S("love", ["heart", "heart-red", "heart-dark", "butterfly", "butterfly-pink", "star"]), ...P(["tulip_bouquet", "paris_script_heart"])],
  },
  travel: {
    label: ["Travel", "سفر"], emoji: "✈️",
    colors: { accent: "#2B8FB3", dark: "#1D3349", soft: "#EAF5F9" },
    titleFont: "Playfair Display",
    backgrounds: ["#FBFDFE", dots("#EAF5F9", "rgba(43,143,179,.4)", 20, 1.8), "#ffffff", grid("#F7F4EE", "rgba(29,51,73,.08)", 26)],
    stickers: S("travel", ["plane", "palm", "sun", "sunglasses", "camel", "star", "heart"]),
  },
};

export function pickThemeKey(text = "", aiKey) {
  if (aiKey && THEMES[aiKey]) return aiKey;
  const s = text.toLowerCase();
  const rules = [["bees", /bee|honey|نحل/], ["iraq", /iraq|baghdad|عراق|بغداد/], ["dubai", /dubai|uae|emirat|دبي|امارات/],
    ["paris", /paris|france|باريس/], ["jordan", /jordan|petra|amman|wadi rum|الأردن|عمان|البتراء/],
    ["birthday", /birthday|bday|turns|عيد ميلاد/], ["love", /wedding|love|engage|anniversary|زفاف|خطوبة|حب/]];
  for (const [k, re] of rules) if (re.test(s)) return k;
  return "travel";
}

// Layouts on the 400×520 page. boxes: [x, y, w, h, rotation, frame]; spots: sticker positions [x, y, size, rot]
// that never overlap the photo boxes; title: [y] when a chapter title fits on the page.
export const LAYOUTS = {
  1: [
    { boxes: [[42, 34, 316, 410, -1.5, "polaroid"]], spots: [[4, 6, 62, -12], [338, 448, 58, 10], [6, 456, 50, 8]], title: 458 },
    { boxes: [[30, 30, 340, 390, 0, "white"]], spots: [[330, 4, 60, 12], [8, 440, 56, -10], [340, 448, 52, 8]], title: 440 },
  ],
  2: [
    { boxes: [[20, 70, 176, 240, -3, "polaroid"], [204, 92, 176, 240, 3, "polaroid"]], spots: [[14, 6, 58, -10], [326, 16, 56, 12], [24, 404, 66, -8], [314, 400, 66, 10]], title: 352 },
    { boxes: [[34, 22, 332, 220, -1.5, "white"], [34, 262, 332, 220, 1.5, "white"]], spots: [[2, 222, 50, -12], [352, 232, 46, 12], [14, 474, 46, 8]], title: null },
    { boxes: [[24, 24, 230, 300, -2, "white"], [176, 236, 200, 260, 4, "polaroid"]], spots: [[278, 30, 70, 10], [20, 360, 64, -10], [30, 450, 50, 8]], title: null },
  ],
  3: [
    { boxes: [[14, 20, 180, 236, -4, "polaroid"], [206, 34, 180, 236, 3, "polaroid"], [102, 278, 196, 230, -1.5, "polaroid"]], spots: [[8, 300, 70, -10], [322, 302, 66, 12], [16, 430, 56, 8], [326, 440, 54, -8]], title: null },
    { boxes: [[14, 52, 214, 290, -2, "polaroid"], [236, 24, 150, 196, 4, "polaroid"], [234, 232, 152, 200, -3, "polaroid"]], spots: [[16, 2, 50, -10], [250, 440, 64, 10], [24, 430, 58, -8]], title: 368 },
    { boxes: [[14, 16, 186, 248, -5, "polaroid"], [200, 112, 186, 248, 4, "polaroid"], [26, 270, 186, 236, -2, "polaroid"]], spots: [[232, 14, 70, 10], [314, 20, 52, -10], [262, 410, 66, 8], [330, 450, 50, -8]], title: null },
  ],
};

// Bake a photo into its frame (polaroid / white border) at print-friendly resolution, cropped to the box.
export function framePhoto(src, w, h, frame) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = 2.4, W = Math.round(w * k), H = Math.round(h * k);
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const g = c.getContext("2d");
      const pad = frame === "polaroid" ? Math.round(W * 0.045) : frame === "white" ? Math.round(W * 0.025) : 0;
      const padB = frame === "polaroid" ? Math.round(W * 0.14) : pad;
      g.fillStyle = "#fdfdfb"; g.fillRect(0, 0, W, H);
      const bw = W - 2 * pad, bh = H - pad - padB;
      const r = Math.max(bw / img.width, bh / img.height);
      const sw = bw / r, sh = bh / r;
      const sx = (img.width - sw) / 2, sy = Math.max(0, (img.height - sh) * 0.35); // keep faces (upper third)
      g.drawImage(img, sx, sy, sw, sh, pad, pad, bw, bh);
      if (pad) { g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2); }
      resolve(c.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

// Sticker names per pack (what Claude chooses from) → URL
export const stickerName = (url) => url.split("/").pop().replace(/\.(svg|png)$/, "").replace(/^sticker-/, "");
export const PACKS_FOR_AI = Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, {
  label: v.label[0], stickers: v.stickers.map(stickerName), backgrounds: v.backgrounds.length }]));

// Layout catalogue described for Claude. Key = <photos><variant>.
export const LAYOUT_CATALOGUE = {
  "1a": "1 photo, large tilted polaroid; has title slot at bottom",
  "1b": "1 photo, large white frame; has title slot at bottom",
  "2a": "2 portrait polaroids side by side; has title slot",
  "2b": "2 landscape photos stacked; no title slot",
  "2c": "1 big portrait + 1 overlapping polaroid; no title slot",
  "3a": "3 polaroids: two on top, one below; no title slot",
  "3b": "1 big portrait left + 2 small right; has title slot",
  "3c": "3 cascading polaroids; no title slot",
};
export const layoutFor = (key) => {
  const n = +String(key || "")[0];
  const v = "abc".indexOf(String(key || "")[1]);
  return LAYOUTS[n] ? LAYOUTS[n][Math.max(0, v) % LAYOUTS[n].length] : null;
};
