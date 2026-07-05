// Groq Whisper transcription of an extracted audio file.

import { readFile } from "node:fs/promises";

export async function transcribe(audioPath: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const bytes = await readFile(audioPath);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "audio/mp4" }), "audio.m4a");
  form.append("model", "whisper-large-v3");
  form.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}
