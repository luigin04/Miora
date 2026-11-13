// Miora AI Powered Design — streaming proxy to Claude (Opus 5.5 by default).
// Edge Function + streamed response = no 10s function limit; Claude can take its time.
// Prompts live here (server side); the browser only sends photos/descriptions.
const API = "https://api.anthropic.com/v1/messages";

const DESCRIBE = `You are the photo editor for Miora, a premium printed photo-album studio.
For each photo return JSON only:
{"photos":[{"id":"..","desc":"<max 16 words: who/what/activity/mood>","place":"<short place/event label consistent across photos of the same place>","food":true|false,"people":<number of people>,"highlight":true|false,"faces":"top|middle|bottom|none"}]}
"highlight": standout photo worth a full page (iconic landmark, great group shot, emotional moment) — at most 1 in 5. Never guess names.`;

const PLAN = `You are Miora's senior album designer. Design a beautiful, story-driven printed album.

You receive: the customer's theme, photo descriptions (in upload/time order, with orientation), the sticker packs
(by name) and the page layout catalogue. You return the full page-by-page design.

Design rules (follow strictly):
- Use EVERY photo id exactly once. Never repeat a photo.
- Max 3 photos per page. Alternate calm pages (1–2 photos) and busy pages (3) — never more than two 3-photo pages in a row.
- Keep photos of the same place / event / outfit together on the same or consecutive pages. Food photos stay together.
- Tell the story in a sensible order (usually chronological: arrival/beginning first, farewell/ending last).
- Highlight photos get a 1-photo page. Match orientation: landscape photos fit "2b" (stacked) or wide slots; portraits fit the others.
- Start each chapter with a short warm title (max 5 words) on a layout that has a title slot. No invented names.
- Stickers: pick from the chosen pack only, by exact name. 2–4 per page, relevant to the page content
  (e.g. food page → food stickers, landmark page → that landmark), vary them, don't repeat the same sticker on facing pages.
- background: an index into the pack's backgrounds (0 = calmest). Mostly 0, use the patterned ones for variety (about 1 in 3 pages).
- Choose themeKey from the allowed list (use the customer's choice if given).
Return JSON only:
{"themeKey":"..","title":"<album title, max 6 words>","subtitle":"<optional short line>",
 "pages":[{"layout":"2a","ids":["p3","p4"],"title":"<only on chapter-opening pages>","stickers":["bee","honeycomb"],"background":0}]}`;

const env = (n) => (globalThis.Netlify && Netlify.env.get(n)) || "";
const clean = (v) => String(v || "").trim().replace(/^["']|["']$/g, "");

export default async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const keys = ["MIORA_CLAUDE_KEY", ["MIORA", "NETLIFY", "AI"].join("_"), "ANTHROPIC_API_KEY"].map(n => clean(env(n)));
  const KEY = keys.find(v => v.startsWith("sk-ant-")) || "";
  if (!KEY) return Response.json({ error: "No Anthropic API key configured" }, { status: 500 });
  const MODEL = clean(env("MIORA_AI_MODEL")) || "claude-opus-5-5";
  let body; try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }

  let system, content, max_tokens;
  if (body.action === "describe") {
    system = DESCRIBE; max_tokens = 3000; content = [];
    for (const im of (body.images || []).slice(0, 16)) {
      const data = String(im.data || "").replace(/^data:image\/\w+;base64,/, "");
      if (!data || data.length > 400000) continue;
      content.push({ type: "text", text: `id: ${im.id}${im.ratio ? ` (aspect ${im.ratio})` : ""}` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    }
    content.push({ type: "text", text: "Describe every photo above. JSON only." });
  } else if (body.action === "plan") {
    system = PLAN; max_tokens = 16000;
    const text = JSON.stringify({ customerTheme: body.theme || "", customerThemeKey: body.themeKey || "auto",
      language: body.lang === "ar" ? "Arabic titles" : "English titles", allowedThemeKeys: body.themeKeys || [],
      packs: body.packs || {}, layouts: body.layouts || {}, photos: (body.items || []).slice(0, 400) });
    content = [{ type: "text", text: text.slice(0, 400000) }];
  } else return Response.json({ error: "unknown action" }, { status: 400 });

  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens, stream: true, system, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) return Response.json({ error: `Claude API ${r.status}: ${(await r.text()).slice(0, 300)}`, model: MODEL }, { status: 502 });
  return new Response(r.body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
};

export const config = { path: "/api/ai" };
