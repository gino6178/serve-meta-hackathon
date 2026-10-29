import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { liveVoiceUrl } from "../agent.js";
import "./livetalk.css";

// Talk with your agent, both ways at once (agent voice/live.js): the microphone streams to your server, which relays it
// to Meta's Muse Voice Transcribe in real time; when you finish a sentence your agent answers on Muse Glimmer, and its
// reply comes back as words and as a voice. Start speaking while it talks and it stops to listen (barge-in).
const PROC = `class Pcm extends AudioWorkletProcessor { process(i) { const c = i[0] && i[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; } } registerProcessor("pcm", Pcm);`;

export default function LiveTalk({ facts, onClose }) {
  const [state, setState] = useState("connecting"), [partial, setPartial] = useState(""), [log, setLog] = useState([]), [err, setErr] = useState("");
  const ws = useRef(null), ctx = useRef(null), playing = useRef(null), queue = useRef([]), stream = useRef(null), end = useRef(null);
  // the agent's voice comes a sentence at a time: each plays after the one before; barge-in drops them all
  const stopVoice = () => { queue.current = []; try { playing.current?.stop(); } catch { /* done */ } playing.current = null; };
  const playNext = () => {
    const ac = ctx.current, buf = queue.current.shift();
    if (!buf) { playing.current = null; setState((s) => (s === "speaking" ? "listening" : s)); return; }
    const s = ac.createBufferSource(); s.buffer = buf; s.connect(ac.destination); s.onended = () => { if (playing.current === s) playNext(); };
    playing.current = s; s.start(); setState("speaking");
  };
  useEffect(() => {
    let live = true, pending = [];
    (async () => {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
        const ac = ctx.current = new AudioContext({ sampleRate: 24000 });
        await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([PROC], { type: "application/javascript" })));
        const src = ac.createMediaStreamSource(stream.current), node = new AudioWorkletNode(ac, "pcm");
        src.connect(node);
        const sock = ws.current = new WebSocket(liveVoiceUrl());
        sock.binaryType = "arraybuffer";
        sock.onopen = () => sock.send(JSON.stringify({ type: "start", app: facts }));
        // 80 ms frames of 16-bit PCM at 24 kHz
        node.port.onmessage = (e) => {
          pending.push(e.data);
          let n = pending.reduce((a, b) => a + b.length, 0);
          if (n < 1920 || sock.readyState !== 1) return;
          const pcm = new Int16Array(n); let o = 0;
          for (const b of pending) for (let i = 0; i < b.length; i++) pcm[o++] = Math.max(-1, Math.min(1, b[i])) * 0x7fff;
          pending = []; sock.send(pcm.buffer);
        };
        sock.onmessage = async (e) => {
          if (typeof e.data !== "string") {
            queue.current.push(await ac.decodeAudioData(e.data.slice(0)));
            if (!playing.current) playNext();
            return;
          }
          const m = JSON.parse(e.data);
          if (m.type === "ready") setState("listening");
          if (m.type === "speechStart") { stopVoice(); setState("hearing"); }
          if (m.type === "partial") setPartial(m.text);
          if (m.type === "you") { setPartial(""); setLog((l) => [...l, { who: "you", text: m.text }]); setState("thinking"); }
          if (m.type === "agent") setLog((l) => [...l, { who: "agent", text: m.text, checked: m.checked }]);
          if (m.type === "end") { if (live) setState("ended"); }
        };
        sock.onerror = () => live && setErr("Your server could not open the live line.");
        sock.onclose = () => live && setState((s) => (s === "connecting" ? "failed" : "ended"));
      } catch (e) { if (live) { setErr(e.name === "NotAllowedError" ? "The microphone was not allowed." : e.message); setState("failed"); } }
    })();
    return () => { live = false; stopVoice(); try { ws.current?.send(JSON.stringify({ type: "stop" })); ws.current?.close(); } catch { /* gone */ } stream.current?.getTracks().forEach((t) => t.stop()); ctx.current?.close(); };
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [log, partial]);
  const label = { connecting: "Connecting…", listening: "Listening", hearing: "Listening", thinking: "Thinking", speaking: "Speaking", ended: "Ended", failed: "Couldn't start" }[state];
  return (
    <div className="lt-scrim" role="dialog" aria-modal="true" aria-label="Talk with your agent">
      <div className="lt">
        <div className={`lt-orb ${state}`}><img src="/agents/you.png" alt="" /></div>
        <p className="lt-state" aria-live="polite">{label}</p>
        <ol className="lt-log">
          {log.map((l, i) => <li key={i} className={l.who}><p>{l.text}</p></li>)}
          {partial && <li className="you partial"><p>{partial}</p></li>}
          <li ref={end} aria-hidden="true" />
        </ol>
        {err && <p className="lt-err" role="alert">{err}</p>}
        <p className="lt-by">Muse Voice Transcribe · Muse Glimmer on your server · start speaking to interrupt</p>
        <button className="lt-end" onClick={onClose} aria-label="End"><Icon name="close" size={24} /></button>
      </div>
    </div>
  );
}
