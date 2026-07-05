// Gemini: tagging + summarization (text and vision) and 768-dim embeddings.

import { log } from "./log.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
// gemini-embedding-001 (text-embedding-004 was shut down by Google on
// 2026-01-14). Its native size is 3072 dims; we request 768 via MRL truncation
// to match the vector(768) column, then re-normalize (required for truncated
// dims so cosine distance behaves correctly).
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMS = 768;

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

function genModel(): string {
  // gemini-2.0-flash was shut down by Google on 2026-06-01.
  // 2.5-flash-lite is its like-for-like replacement (same price tier, GA,
  // multimodal). Override with the GEMINI_MODEL env var when Google rotates
  // models again — no code change needed.
  return process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
}

export interface TagSummary {
  tags: string[];
  summary: string;
}

const INSTRUCTIONS = `You organize a personal inspiration library.
Respond with STRICT JSON only — no markdown fences, no preamble, no trailing text.
Exactly this shape: {"tags": ["..."], "summary": "..."}
Rules:
- "tags": 3 to 6 tags, all lowercase, each a single word or a short hyphenated phrase (e.g. "interior-design"), no hashtag symbols, no duplicates.
- "summary": one or two plain-language sentences on what this is and why it might be worth revisiting.`;

// Strip fences / preamble and pull the first {...} block out of a response.
function parseJsonLoose(raw: string): TagSummary {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("no JSON object in model response");
  }
  const parsed = JSON.parse(s.slice(start, end + 1)) as {
    tags?: unknown;
    summary?: unknown;
  };
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-"))
        .filter((t) => t.length > 0 && t.length <= 40)
        .slice(0, 6)
    : [];
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  if (tags.length === 0 && !summary) throw new Error("empty tags and summary");
  return { tags: Array.from(new Set(tags)), summary };
}

type Part =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

async function generate(parts: Part[]): Promise<string> {
  const res = await fetch(
    `${BASE}/models/${genModel()}:generateContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const out = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("");
  if (!out) throw new Error("Gemini returned no text");
  return out;
}

async function tagWithRetry(parts: Part[]): Promise<TagSummary> {
  try {
    return parseJsonLoose(await generate(parts));
  } catch (first) {
    log("Gemini tag/summary parse failed, retrying once", String(first));
    return parseJsonLoose(await generate(parts)); // one retry, then let it throw
  }
}

export async function tagAndSummarize(contextText: string): Promise<TagSummary> {
  const prompt = `${INSTRUCTIONS}\n\nContent to organize:\n"""\n${contextText.slice(0, 12000)}\n"""`;
  return tagWithRetry([{ text: prompt }]);
}

export async function tagAndSummarizeImage(
  imageUrl: string,
  contextText: string
): Promise<TagSummary> {
  // Fetch the image bytes so Gemini can look at it directly.
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 18 * 1024 * 1024) {
    throw new Error("image too large for vision tagging");
  }
  const parts: Part[] = [
    { inline_data: { mime_type: mime, data: buf.toString("base64") } },
    {
      text: `${INSTRUCTIONS}\n\nOrganize the attached image.${
        contextText ? ` Extra context:\n"""\n${contextText.slice(0, 4000)}\n"""` : ""
      }`,
    },
  ];
  return tagWithRetry(parts);
}

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(
    `${BASE}/models/${EMBED_MODEL}:embedContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: EMBED_DIMS,
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini embed ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values;
  if (!values || values.length !== EMBED_DIMS) {
    throw new Error(`embedding missing or wrong size (${values?.length ?? 0})`);
  }
  // Truncated (non-3072) gemini-embedding-001 vectors are not unit-length;
  // normalize so cosine distance in pgvector is meaningful.
  const norm = Math.sqrt(values.reduce((acc, v) => acc + v * v, 0));
  if (!isFinite(norm) || norm === 0) throw new Error("embedding norm is zero");
  return values.map((v) => v / norm);
}
