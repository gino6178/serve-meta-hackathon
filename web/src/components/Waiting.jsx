// Shows that something is happening whenever the person is waiting on the server, so a slow answer never looks like a
// crash. watchFetch() wraps window.fetch once: a request counts only when it starts within 1.5 s of a tap, a key or a
// submit (so background polls never show it), and the indicator appears after 250 ms. After 3 s it counts the seconds;
// after 12 s it says it is still working (the agent, when the request is an agent's job) and how long a full answer
// can take. A server that can't be reached reads as that, in plain words, not as the browser's "Failed to fetch".
import { useEffect, useState } from "react";
import "./waiting.css";

const GESTURE_MS = 1500, SHOW_MS = 250;
let lastGesture = 0, open = 0, since = 0, agentOpen = 0;
const subs = new Set();
const tell = () => subs.forEach((f) => f(open > 0 ? since : 0));
// the plain posts, comments and clubs are not the agent's work
const NOT_AGENT = /\/api\/(feed|clubs)(\/|\?|$)/;
export const UNREACHABLE = "Can't reach Serve right now — try again in a moment.";
// the browser's own words for a server it could not reach ("Failed to fetch", "NetworkError…", "Load failed")
const unreachable = (e) => { if (e?.name === "TypeError") { const x = new TypeError(UNREACHABLE); x.cause = e; throw x; } throw e; };

export function watchFetch() {
  if (window.__serveWaiting) return;
  window.__serveWaiting = true;
  for (const ev of ["pointerdown", "keydown", "submit"]) addEventListener(ev, () => { lastGesture = Date.now(); }, true);
  const real = window.fetch.bind(window);
  window.fetch = (...args) => {
    const url = String(args[0]?.url || args[0] || "");
    if (!/\/api\//.test(url)) return real(...args);
    if (Date.now() - lastGesture > GESTURE_MS) return real(...args).catch(unreachable);
    const agent = !NOT_AGENT.test(url);
    if (agent) agentOpen++;
    if (open++ === 0) { since = Date.now(); tell(); }
    const done = () => { if (agent) agentOpen--; if (--open === 0) tell(); };
    return real(...args).then((r) => {
      // a streamed answer (NDJSON) keeps the indicator until the stream ends
      if (!r.body || !/ndjson|event-stream/.test(r.headers.get("content-type") || "")) { done(); return r; }
      const [a, b] = r.body.tee(), rd = b.getReader();
      (async () => { try { for (;;) if ((await rd.read()).done) break; } catch { /* closed */ } done(); })();
      return new Response(a, { status: r.status, statusText: r.statusText, headers: r.headers });
    }, (e) => { done(); unreachable(e); });
  };
}

export default function Waiting() {
  const [from, setFrom] = useState(0), [now, setNow] = useState(Date.now());
  useEffect(() => { subs.add(setFrom); return () => subs.delete(setFrom); }, []);
  useEffect(() => { if (!from) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [from]);
  const ms = from ? now - from : 0;
  if (!from || ms < SHOW_MS) return null;
  const s = Math.floor(ms / 1000);
  const text = s < 3 ? "Working" : s < 12 ? `Working · ${s} s` : agentOpen > 0 ? `Your agent is still working · ${s} s. A full answer can take up to a minute.` : `Still working… (${s} s)`;
  return (
    <>
      <div className="wait-bar" aria-hidden="true" />
      <div className="wait-pill" role="status" aria-live="polite">
        <span className="wait-dots" aria-hidden="true"><i /><i /><i /></span>
        <span>{text}</span>
      </div>
    </>
  );
}
