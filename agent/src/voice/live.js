// The live voice agent: talk to your agent, and it talks back, both ways at once.
//   Hearing: the app streams the microphone (16-bit mono PCM at 24 kHz) over a WebSocket to /api/voice/live; the
//   gateway relays it to Meta's Muse Voice Transcribe (realtime, ENDPOINTING mode: the model finds where each turn ends,
//   in any of its 25 languages, code-switching included), with the key kept on the server (META_API_KEY).
//   Answering: each finished turn goes to your agent (answer.js, Muse Glimmer on your own GPU, every number checked
//   against the facts), and the reply comes back as text and as speech, made on the server with Kokoro.
//   Barge-in: the transcriber says when you start speaking (speechStart); the app stops the agent's voice at once and
//   the gateway drops any reply still on its way, so you can cut it off the way you would a person.
// A session ends after VOICE_MAX_S seconds (180) or when the app closes it. Transcription costs $0.18 an hour of audio.
import { spawn } from "node:child_process";
import path from "node:path";
import { WebSocketServer } from "ws";

const ASR = process.env.VOICE_ASR_URL || "wss://api.meta.ai/v1/asr/realtime";
const MAX_S = +(process.env.VOICE_MAX_S || 180);
export const ready = () => !!process.env.META_API_KEY;

// ---- speech: one Kokoro worker, kept loaded ----
let worker = null, waiting = new Map(), seq = 0, buf = "";
function tts() {
  if (worker) return worker;
  const py = process.env.VOICE_TTS_PYTHON;
  if (!py) return null;
  worker = spawn(py, [path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "tts_worker.py")], { stdio: ["pipe", "pipe", "ignore"], env: process.env });
  worker.stdout.on("data", (c) => { buf += c; for (let i; (i = buf.indexOf("\n")) >= 0;) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { const j = JSON.parse(l); waiting.get(j.id)?.(j); waiting.delete(j.id); } catch { /* not a reply */ } } });
  worker.on("exit", () => { worker = null; for (const f of waiting.values()) f({ error: "the speech worker stopped" }); waiting.clear(); });
  return worker;
}
// a reply as speech: a WAV, or null when there is no speech worker
export function speak(text) {
  const w = tts();
  if (!w) return Promise.resolve(null);
  const id = ++seq, lang = /[㐀-鿿]/.test(text) ? "zh" : "en";
  return new Promise((ok) => { waiting.set(id, (j) => ok(j.wav ? Buffer.from(j.wav, "base64") : null)); w.stdin.write(JSON.stringify({ id, text, lang }) + "\n"); setTimeout(() => { if (waiting.delete(id)) ok(null); }, 20000); });
}

// a reply in sentences (Chinese full stops too), short ones joined to the next
export function sentences(text) {
  const out = [];
  for (const p of String(text).match(/[^.!?。！？]+[.!?。！？]*/g) || []) { const t = p.trim(); if (!t) continue; if (out.length && out.at(-1).length < 24) out[out.length - 1] += ` ${t}`; else out.push(t); }
  return out;
}

// ---- one session: the app's socket, the transcriber's socket ----
// answer(text, ctx) -> { text } is the agent's reply; ctx is what the app sent at the start (its facts, the history)
export function session(app, { answer, connect = (u) => new WebSocket(u), speakFn = speak }) {
  const say = (o) => { if (app.readyState === 1) app.send(JSON.stringify(o)); };
  let ctx = { app: null, history: [] }, turn = 0, open = false, closed = false;
  const asr = connect(ASR);
  asr.binaryType = "arraybuffer";
  const stop = setTimeout(() => end("the session's time is up"), MAX_S * 1000);
  function end(why) {
    if (closed) return; closed = true; clearTimeout(stop);
    try { if (asr.readyState === 1) asr.send(JSON.stringify({ type: "endStream" })); asr.close(); } catch { /* gone */ }
    say({ type: "end", why }); try { app.close(); } catch { /* gone */ }
  }
  asr.onopen = () => asr.send(JSON.stringify({ authorization: { accessToken: `Bearer ${process.env.META_API_KEY}` }, audioEncoding: "PCM_24KHZ", model: "muse-voice-transcribe-1.0", mode: "ENDPOINTING" }));
  asr.onerror = () => end("the transcriber could not be reached");
  asr.onclose = () => end("the transcriber closed");
  asr.onmessage = async (e) => {
    if (typeof e.data !== "string") return;
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (!m.type && m.sessionId) { open = true; return say({ type: "ready" }); }
    if (m.type === "error") return end(m.message || "the transcriber failed");
    if (m.type === "speechStart") { turn++; return say({ type: "speechStart" }); } // barge-in: the app stops speaking
    if (m.type === "transcript" && !m.final) return say({ type: "partial", text: m.transcript });
    if (m.type !== "speechComplete") return;
    const text = String(m.transcript || "").trim();
    if (!text) return;
    const mine = ++turn;
    say({ type: "you", text });
    let reply = null;
    try { reply = await answer(text, ctx); } catch { reply = { text: "Sorry, I couldn't answer that just now." }; }
    if (mine !== turn || closed) return; // you spoke again meanwhile: this answer is dropped
    ctx.history = [...ctx.history, { role: "user", content: text }, { role: "assistant", content: reply.text }].slice(-8);
    say({ type: "agent", text: reply.text, checked: reply.checked ?? null });
    // spoken a sentence at a time, so the first is heard while the rest are still being made
    for (const part of sentences(reply.text)) {
      const wav = await speakFn(part);
      if (mine !== turn || closed || app.readyState !== 1) return;
      if (wav) app.send(wav);
    }
  };
  app.on("message", (data, binary) => {
    if (!binary) { try { const m = JSON.parse(String(data)); if (m.type === "start") ctx = { app: m.app || null, history: [] }; if (m.type === "stop") end("you ended it"); } catch { /* not JSON */ } return; }
    if (open && asr.readyState === 1) asr.send(data);
  });
  app.on("close", () => end("the app closed"));
  return { end };
}

// the route: an HTTP upgrade on /api/voice/live, allowed by authorize(req, url)
export function attach(server, { authorize, answer }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
  server.on("upgrade", (req, socket, head) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname !== "/api/voice/live") return socket.destroy();
    if (!ready() || !authorize(req, u)) { socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); return socket.destroy(); }
    wss.handleUpgrade(req, socket, head, (ws) => session(ws, { answer }));
  });
}
