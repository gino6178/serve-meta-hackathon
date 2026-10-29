// The live voice agent (voice/live.js) against a stand-in for Muse Voice Transcribe's realtime socket: the handshake,
// the audio relayed, a finished turn answered in text and speech, and a reply dropped when the player speaks again
// before it is ready (barge-in). No network, no key, no model.   node --test test/voice_unit.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";

process.env.META_API_KEY = "test-key";

// the stand-in transcriber: checks the handshake, counts audio, and plays the turns a test gives it
const asr = new WebSocketServer({ port: 0 });
let script = [], hello = null, audio = 0;
asr.on("connection", (s) => {
  s.on("message", (d, binary) => {
    if (!binary) { const m = JSON.parse(String(d)); if (m.authorization) { hello = m; s.send(JSON.stringify({ sessionId: "s1" })); } return; }
    audio += d.length;
    if (audio >= 7680 && script.length) for (const [ms, ev] of script.splice(0)) setTimeout(() => s.send(JSON.stringify(ev)), ms);
  });
});
after(() => asr.close());
await new Promise((ok) => asr.on("listening", ok));
process.env.VOICE_ASR_URL = `ws://127.0.0.1:${asr.address().port}`;
const live = await import("../src/voice/live.js");

// the app's side of the socket
function fakeApp() {
  const h = {}, got = [];
  return { got, readyState: 1, send: (x) => got.push(typeof x === "string" ? JSON.parse(x) : { audio: x.length }), on: (k, f) => (h[k] = f), close() { this.readyState = 3; }, emit: (k, ...a) => h[k]?.(...a) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = Buffer.alloc(3840); // 80 ms of 24 kHz 16-bit audio

test("a turn: handshake, audio relayed, the reply in text and in speech", async () => {
  const app = fakeApp();
  script = [[0, { type: "speechStart", turnId: 1, audioProcessedMs: 100 }], [10, { type: "transcript", transcript: "when is my", final: false, audioProcessedMs: 200 }], [20, { type: "speechComplete", turnId: 1, transcript: "When is my next game?", audioProcessedMs: 900 }]];
  const s = live.session(app, { answer: async (t, ctx) => ({ text: `Thursday at 19:00 (${t.length} chars, ${ctx.app?.who})`, checked: true }), connect: (u) => new WebSocket(u), speakFn: async () => Buffer.alloc(1234) });
  app.emit("message", Buffer.from(JSON.stringify({ type: "start", app: { who: "app" } })), false);
  await wait(150);
  assert.deepEqual({ token: hello.authorization.accessToken, enc: hello.audioEncoding, model: hello.model, mode: hello.mode }, { token: "Bearer test-key", enc: "PCM_24KHZ", model: "muse-voice-transcribe-1.0", mode: "ENDPOINTING" });
  app.emit("message", frame, true); app.emit("message", frame, true);
  await wait(250);
  const kinds = app.got.map((m) => m.type || "audio");
  assert.deepEqual(kinds, ["ready", "speechStart", "partial", "you", "agent", "audio"]);
  assert.equal(app.got.find((m) => m.type === "you").text, "When is my next game?");
  assert.match(app.got.find((m) => m.type === "agent").text, /^Thursday at 19:00 \(21 chars, app\)$/);
  assert.equal(app.got.at(-1).audio, 1234);
  s.end("done");
});

test("barge-in: the player speaks again before the reply is ready, and that reply is dropped", async () => {
  const app = fakeApp();
  audio = 0;
  script = [[0, { type: "speechComplete", turnId: 1, transcript: "Plan my week", audioProcessedMs: 500 }], [40, { type: "speechStart", turnId: 2, audioProcessedMs: 600 }]];
  const s = live.session(app, { answer: async () => { await wait(120); return { text: "Here is your week." }; }, connect: (u) => new WebSocket(u), speakFn: async () => Buffer.alloc(10) });
  await wait(100);
  app.emit("message", frame, true); app.emit("message", frame, true);
  await wait(300);
  const kinds = app.got.map((m) => m.type || "audio");
  assert.ok(kinds.includes("you") && kinds.includes("speechStart"));
  assert.ok(!kinds.includes("agent") && !kinds.includes("audio"), "the stale reply never reaches the app");
  s.end("done");
});

test("a reply is spoken a sentence at a time; short ones go with the next", () => {
  assert.deepEqual(live.sentences("No game is booked in the next 7 days. Today is Thursday. Want me to line one up?"), ["No game is booked in the next 7 days.", "Today is Thursday. Want me to line one up?"]);
  assert.deepEqual(live.sentences("你下一場球是星期四晚上七點，跟 Leo 打雙打。要我幫你排嗎？"), ["你下一場球是星期四晚上七點，跟 Leo 打雙打。", "要我幫你排嗎？"]);
});
