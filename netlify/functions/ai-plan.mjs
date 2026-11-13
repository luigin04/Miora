// Miora AI Powered Design — server side. The Anthropic key lives only in Netlify env (ANTHROPIC_API_KEY).
// action "describe": short descriptions for a batch of small thumbnails (vision).
// action "plan": groups all described photos into ordered chapters with titles + theme stickers.
const API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.MIORA_AI_MODEL || "claude-haiku-5-5";

const DESCRIBE_PROMPT = `You help design printed photo albums. For each photo, return JSON only:
{"photos":[{"id":"<id>","desc":"<max 14 words: who/what, activity>","place":"<short place or scene label, e.g. 'airport', 'beach', 'birthday cake table', 'restaurant'>","food":true|false,"highlight":true|false}]}
"highlight" = a standout photo worth a full page (great group shot, iconic landmark, emotional moment). Keep at most 1 in 6 as highlight. Never guess names.`;

const PLAN_PROMPT = `You are Miora's album designer. Given photo descriptions (in upload/time order) and a theme, organise the album.
Rules:
- Every photo id appears exactly once.
- Photos from the same place/event/outfit stay together in one chapter; food photos stay together.
- Keep chapters in a sensible story order (usually chronological: arrival first, farewell last).
- Chapter titles: short, warm, max 5 words, no names you were not given.
- stickers: 10-14 single emoji that fit the theme (e.g. Dubai: 🐪🌴🏙️☀️🕌🛍️✈️🌊☕✨).
- palette: 3 hex colours matching the theme (background tint, accent, dark text).
Return JSON only: {"title":"<album title>","palette":["#..","#..","#.."],"stickers":["..."],"chapters":[{"title":"..","ids":["p0","p1"]}]}`;

async function callClaude(system, content, maxTokens) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw new Error(`Claude API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const text = (j.content || []).map(c => c.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in model reply");
  return JSON.parse(m[0]);
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: "ANTHROPIC_API_KEY not set" });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: "bad json" }); }
  try {
    if (body.action === "describe") {
      const imgs = (body.images || []).slice(0, 16);
      if (!imgs.length) return json(400, { error: "no images" });
      const content = [];
      for (const im of imgs) {
        const data = String(im.data || "").replace(/^data:image\/\w+;base64,/, "");
        if (data.length > 400000) continue; // thumbnails only
        content.push({ type: "text", text: `id: ${im.id}` });
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
      }
      content.push({ type: "text", text: "Describe every photo above. JSON only." });
      return json(200, await callClaude(DESCRIBE_PROMPT, content, 2000));
    }
    if (body.action === "plan") {
      const items = (body.items || []).slice(0, 400);
      const lines = items.map(p => `${p.id} | ${p.place || ""} | ${p.desc || ""}${p.food ? " | food" : ""}`).join("\n");
      const text = `Theme / occasion: ${String(body.theme || "family memories").slice(0, 200)}\nLanguage for titles: ${body.lang === "ar" ? "Arabic" : "English"}\n\nPhotos:\n${lines}`;
      return json(200, await callClaude(PLAN_PROMPT, [{ type: "text", text }], 4000));
    }
    return json(400, { error: "unknown action" });
  } catch (e) {
    return json(502, { error: String(e.message || e) });
  }
};

// Reached at /.netlify/functions/ai-plan
