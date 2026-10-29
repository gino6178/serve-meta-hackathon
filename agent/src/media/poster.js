// The art behind a matchup poster: two of the club's agent mascots facing off with the sport's gear, made once with
// Meta's Muse Image (muse-image-1.0, on the Meta Model API with META_API_KEY) and kept in data/posters/ for that
// challenge. Only the sport and the format go into the prompt: never a name, a note or anything a member wrote. The
// poster's words (who, when, where, the stake) are drawn on it by the app, so the picture holds no text to get wrong.
import fs from "node:fs";
import path from "node:path";
import { record } from "../core/ledger.js";

const DIR = () => path.resolve(process.env.POSTER_DIR || "data/posters");
const SPORTS = { badminton: "badminton rackets and a shuttlecock", tennis: "tennis rackets and a ball", pickleball: "pickleball paddles and a ball", basketball: "a basketball", "table tennis": "table tennis bats and a ball", volleyball: "a volleyball" };
export const ready = () => !!process.env.META_API_KEY;
const fileOf = (id, sport, format) => path.join(DIR(), `${String(id).replace(/[^\w-]/g, "").slice(0, 40)}-${sport.replace(/\W/g, "")}-${format}.png`);
export const prompt = (sport, format) => `A bold sports matchup poster illustration, portrait: ${format === "doubles" ? "two pairs of" : "two"} small, cheerful round robot mascots facing each other across a ${sport} court, holding ${SPORTS[sport]}, dramatic arena lights, confetti, a vivid green and blue palette, flat vector style with soft shading. Leave the top third and the bottom fifth calm and plain for titles. No text, no letters, no numbers, no logos, no people.`;

const making = new Map();
// the art's file for one challenge, made the first time it is asked for; the same challenge never costs twice
export async function art({ id, sport = "badminton", format = "singles" }) {
  if (!SPORTS[sport]) sport = "badminton";
  format = format === "doubles" ? "doubles" : "singles";
  const file = fileOf(id, sport, format);
  if (fs.existsSync(file)) return { file, made: false };
  if (!ready()) throw Object.assign(new Error("Posters need the Meta Model API (META_API_KEY on the server)."), { code: 503 });
  if (making.has(file)) return making.get(file);
  const job = (async () => {
    const t0 = Date.now();
    const r = await fetch("https://api.meta.ai/v1/images/generations", {
      method: "POST", headers: { authorization: `Bearer ${process.env.META_API_KEY}`, "content-type": "application/json" }, signal: AbortSignal.timeout(180000),
      body: JSON.stringify({ model: "muse-image-1.0", prompt: prompt(sport, format), n: 1, size: "1024x1280", output_format: "png", response_format: "b64_json" }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.data?.[0]?.b64_json) throw Object.assign(new Error(`Muse Image: ${j.error?.message || r.status}`), { code: 502 });
    fs.mkdirSync(DIR(), { recursive: true });
    fs.writeFileSync(file, Buffer.from(j.data[0].b64_json, "base64"));
    record({ site: "poster.art", model: "muse-image-1.0", prompt: 0, cached: 0, output: 0, reasoning: 0, seconds: +((Date.now() - t0) / 1000).toFixed(2), images: 1, marker: true });
    return { file, made: true };
  })().finally(() => making.delete(file));
  making.set(file, job);
  return job;
}
