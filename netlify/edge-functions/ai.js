// Miora AI Powered Design — streaming proxy to Claude (Opus 5.5 by default).
// Edge Function + streamed response = no 10s limit; Claude can think and take its time.
// All prompts live here (server side); the browser only sends photos / descriptions / page briefs.
const API = "https://api.anthropic.com/v1/messages";

const DESCRIBE = `You are the photo editor for Miora, a premium printed photo-album studio.
Look carefully at each photo. Return JSON only:
{"photos":[{"id":"..","desc":"<max 18 words: who, what, activity, mood, notable objects>",
 "place":"<short place/event label; use the SAME label for photos of the same place/event, e.g. 'airport', 'Burj Khalifa top', 'cake table', 'beach'>",
 "food":true|false,"people":<int>,"highlight":true|false,
 "faces":"<where faces are: top|middle|bottom|left|right|spread|none>",
 "mood":"<one word>","colors":"<2 dominant colours>"}]}
"highlight" = a standout photo that deserves a full page (iconic landmark with people, great group shot, emotional or funny moment). About 1 in 6. Never guess names.`;

const OUTLINE = `You are Miora's art director. Plan a printed photo album as a story.
You get photo descriptions (upload/time order, with aspect ratio), the customer's theme and allowed theme packs.
Rules:
- Every photo id exactly once. Max 3 photos per page.
- Group photos of the same place / event / outfit together (same page or consecutive pages). Food photos together.
- Sensible story order (chronological: beginning first, farewell last).
- Pacing: alternate calm pages (1–2 photos) and busy pages (3). Never more than two 3-photo pages in a row. Highlights get their own page.
  For N photos aim for roughly N/2 pages.
- Chapters: one per place/event/day. Warm short titles (max 5 words), no invented names. If photos look like a trip over several days,
  give each chapter a badge like {"top":"DAY","big":"3","bottom":"17 JAN"} only when the dates are clear, otherwise omit badge.
- Pick themeKey from allowed keys (customer's choice wins if given). Album title max 6 words; optional subtitle.
Think it through, then return JSON only:
{"themeKey":"..","title":"..","subtitle":"..","chapters":[{"title":"..","badge":null,"pages":[["p0","p1"],["p2"]]}]}`;

const DESIGN = `You are Miora's senior scrapbook designer. You design printed album pages by hand, like a human designer in Canva:
every photo, frame, tilt, sticker, washi tape and caption is placed deliberately. Quality bar: premium, playful, never generic.

CANVAS: each page is 400 wide × 520 tall (units are px; 0,0 = top-left). Keep everything inside the page (stickers may bleed off an edge a little).

ELEMENTS you can place (JSON objects in "elements"):
- {"t":"photo","id":"p4","x":..,"y":..,"w":..,"h":..,"rot":-3,"frame":"polaroid|white|plain|camera"}
   polaroid = white frame with thick bottom; white = thin white border; plain = no border (use for full-bleed 0,0,400,520);
   camera = photo shown inside a retro silver digital camera (h is set automatically = w*0.75; use w 220–360, great for landscape photos, max 1 per page).
   Match the photo's aspect ratio roughly (ratio = w/h of the photo). Photos 140–380 wide. Rotation −6..6 (hero shots 0..±2).
- {"t":"sticker","name":"<exact name from the sticker list>","x":..,"y":..,"size":40-110,"rot":-20..20}
- {"t":"tape","style":"dots|stripes|dark|gingham|plain","x":..,"y":..,"w":60-110,"rot":..}  washi tape (height ~15). Use it to "hold" photos at corners/top edge.
- {"t":"title","text":"..","x":..,"y":..,"w":..,"size":24-46,"rot":0} elegant chapter/page title in the theme font.
- {"t":"script","text":"..","x":..,"y":..,"w":..,"size":16-26,"rot":..} handwritten caption (warm, short).
- {"t":"tag","text":"..","x":..,"y":..,"w":..,"rot":..} typewriter paper strip, max 32 chars, e.g. "first stop: snacks, obviously".
- {"t":"pill","text":"..","x":..,"y":..,"w":..,"rot":..} bold label, max 18 chars, e.g. "BEE-DAY GIRL", "YALLA!".
- {"t":"badge","top":"DAY","big":"3","bottom":"17 JAN","x":..,"y":..,"size":60-80,"rot":-5..5} only on chapter-opening pages that have a badge.

DESIGN RULES (this is what makes Miora books great):
1. NEVER cover faces. You are told where faces are in each photo; stickers/tape/text may overlap a photo only at its corners or outer edge.
   Put most stickers in the margins and empty areas between photos.
2. Stickers: "customStickers" were drawn specially for THIS album — use each of them at least once, on the most fitting pages
   (e.g. the name sticker on the cover-like opener, the food sticker on food pages). 3–6 stickers per page (fewer on hero/full-bleed pages). Make them RELEVANT to what's in the photos (food → food stickers, landmark → that
   landmark, baby/birthday → balloons/hearts, flowers → florals/butterflies). Cluster small ones (sparkles, hearts) in a corner instead of spreading
   them evenly. Use different stickers on every page — never reuse a sticker that appears in "recentlyUsed", and vary sizes (one big, some small).
3. Every page has a point of view: a title or a short caption/tag/pill that fits the moment (funny, warm, specific). Chapter-opening pages get the
   chapter title (big) and the badge if given. Don't caption every photo.
4. Vary composition from page to page: overlapping tilted polaroids, a straight hero photo with white frame, two portraits side by side, landscape
   stacks, a camera frame, a full-bleed photo with a short title on it (white text needs a calm area). Never repeat the previous page's arrangement.
5. Use tape on polaroids/white frames often (1–2 pieces at corners or top centre, angled ±10–40°).
6. background: index into the theme's backgrounds (0 = plain/calm). Use patterns for variety (~1 in 3 pages); full-bleed pages ignore it.
7. Leave breathing room: ~12px+ margins, photos don't overlap more than 25%.

EXAMPLE of one good page (2 photos, chapter opener):
{"pageNo":5,"background":2,"elements":[
 {"t":"badge","top":"DAY","big":"2","bottom":"8 JAN","x":300,"y":14,"size":70,"rot":5},
 {"t":"title","text":"on the Tigris","x":20,"y":18,"w":270,"size":36,"rot":0},
 {"t":"photo","id":"p7","x":18,"y":92,"w":176,"h":250,"rot":-3,"frame":"polaroid"},
 {"t":"photo","id":"p8","x":206,"y":112,"w":176,"h":250,"rot":3,"frame":"polaroid"},
 {"t":"tape","style":"dots","x":70,"y":82,"w":80,"rot":-8},{"t":"tape","style":"dots","x":256,"y":102,"w":80,"rot":10},
 {"t":"tag","text":"golden hour on the river","x":30,"y":392,"w":200,"rot":-3},
 {"t":"sticker","name":"palm","x":300,"y":380,"size":96,"rot":6},
 {"t":"sticker","name":"sparkle-gold","x":250,"y":440,"size":30,"rot":0},{"t":"sticker","name":"sparkle-white","x":270,"y":470,"size":18,"rot":0}]}

Think about each page before writing. Return JSON only: {"pages":[{"pageNo":..,"background":..,"elements":[...]}]} — one entry per requested page, same pageNo values.`;

const STICKERS = `You are an illustrator making custom die-cut stickers for one specific printed photo album.
From the album summary, invent 6 stickers that are SPECIFIC to this album (the places, food, objects, occasion, the person's name or age,
a date stamp) — things a generic sticker pack would not have. Mix: 3–4 illustrated objects/landmarks, 1 name/word sticker, 1 badge/stamp.
Style (match a premium scrapbook look): flat vector, bold friendly shapes, 2.5–4px dark outlines (#1F1B16), the album's palette plus 1–2
accents, a thick WHITE die-cut border around the whole silhouette (draw the silhouette first with stroke="#fff" stroke-width="14"
stroke-linejoin="round"), and a soft shadow (same silhouette, fill/stroke rgba(0,0,0,.15), offset 3px down-right) underneath. Small
highlight shines are nice. Keep each SVG under 4 KB, viewBox="0 0 200 200", width="300" height="300", no <script>, no <foreignObject>,
no external images or links, no filters. Text only if short (max 14 chars), font-family="Arial, sans-serif", font-weight="900".
Return JSON only: {"stickers":[{"name":"<kebab-case, e.g. fatima-cake>","about":"<what it shows>","svg":"<svg ...>...</svg>"}]}`;

const env = (n) => (globalThis.Netlify && Netlify.env.get(n)) || "";
const clean = (v) => String(v || "").trim().replace(/^["']|["']$/g, "");

async function callClaude(KEY, MODEL, system, content, max_tokens, thinking) {
  const body = { model: MODEL, max_tokens, stream: true, system, messages: [{ role: "user", content }] };
  if (thinking) body.thinking = { type: "enabled", budget_tokens: thinking };
  return fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
}

export default async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const keys = ["MIORA_CLAUDE_KEY", ["MIORA", "NETLIFY", "AI"].join("_"), "ANTHROPIC_API_KEY"].map(n => clean(env(n)));
  const KEY = keys.find(v => v.startsWith("sk-ant-")) || "";
  if (!KEY) return Response.json({ error: "No Anthropic API key configured" }, { status: 500 });
  const MODEL = clean(env("MIORA_AI_MODEL")) || "claude-opus-5-5";
  let body; try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }

  let system, content, max_tokens, thinking = 0;
  if (body.action === "describe") {
    system = DESCRIBE; max_tokens = 4000; content = [];
    for (const im of (body.images || []).slice(0, 16)) {
      const data = String(im.data || "").replace(/^data:image\/\w+;base64,/, "");
      if (!data || data.length > 500000) continue;
      content.push({ type: "text", text: `id: ${im.id} (aspect ratio ${im.ratio || "?"})` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    }
    content.push({ type: "text", text: "Describe every photo above. JSON only." });
  } else if (body.action === "outline") {
    system = OUTLINE; max_tokens = 16000; thinking = 6000;
    content = [{ type: "text", text: JSON.stringify({ customerTheme: body.theme || "", customerThemeKey: body.themeKey || "auto",
      language: body.lang === "ar" ? "Arabic titles" : "English titles", allowedThemeKeys: body.themeKeys || [], photos: (body.items || []).slice(0, 400) }).slice(0, 300000) }];
  } else if (body.action === "design") {
    system = DESIGN; max_tokens = 24000; thinking = 8000;
    content = [{ type: "text", text: JSON.stringify({ theme: body.theme || {}, recentlyUsed: body.recentlyUsed || [],
      language: body.lang === "ar" ? "Arabic text" : "English text", pages: body.pages || [] }).slice(0, 200000) }];
  } else if (body.action === "stickers") {
    system = STICKERS; max_tokens = 24000; thinking = 4000;
    content = [{ type: "text", text: JSON.stringify({ theme: body.theme || {}, album: body.album || {} }).slice(0, 60000) }];
  } else return Response.json({ error: "unknown action" }, { status: 400 });

  let r = await callClaude(KEY, MODEL, system, content, max_tokens, thinking);
  if (!r.ok && thinking && r.status === 400) {
    const txt = await r.text();
    if (/thinking/i.test(txt)) r = await callClaude(KEY, MODEL, system, content, max_tokens, 0);
    else return Response.json({ error: `Claude API 400: ${txt.slice(0, 300)}`, model: MODEL }, { status: 502 });
  }
  if (!r.ok) return Response.json({ error: `Claude API ${r.status}: ${(await r.text()).slice(0, 300)}`, model: MODEL }, { status: 502 });
  return new Response(r.body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
};

export const config = { path: "/api/ai" };
