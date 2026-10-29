import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { agentAnswer } from "../agent.js";
import { agentFace } from "../club/faces.js";
import "./messages.css";

// Your agent, as a chat: write to it and it answers from what it knows about you (agent answers.js, past Llama Guard on
// your server, every number checked). The conversation is kept in this browser only; Clear forgets it here.
const KEY = "serve.chat.v1";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const keep = (ms) => { try { localStorage.setItem(KEY, JSON.stringify(ms.slice(-100))); } catch { /* private mode */ } };
const HELLO = { from: "agent", text: "Hi! Tell me when you want to play, how a game went, or ask me anything about your week." };

export default function Messages() {
  const [ms, setMs] = useState(read), [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { keep(ms); end.current?.scrollIntoView({ block: "end" }); }, [ms, busy]);
  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText(""); setBusy(true);
    setMs((x) => [...x, { from: "you", text: t, at: Date.now() }]);
    try {
      const r = await agentAnswer(t, {});
      setMs((x) => [...x, { from: "agent", text: r.refused ? "I can't help with that one." : r.text, at: Date.now() }]);
    } catch (err) {
      setMs((x) => [...x, { from: "agent", text: `I couldn't answer just now (${err.message}).`, at: Date.now(), failed: true }]);
    }
    setBusy(false);
  };
  const shown = ms.length ? ms : [HELLO];
  return (
    <div className="page msg-chat">
      <header className="mc-head">
        <img className="mc-face" src={agentFace("you")} alt="" />
        <b>Your agent</b>
        {ms.length > 0 && <button className="link" onClick={() => setMs([])}>Clear</button>}
      </header>
      <ol className="mc-list">
        {shown.map((m, i) => <li key={i} className={`mc-msg ${m.from}${m.failed ? " failed" : ""}`}><p>{m.text}</p></li>)}
        {busy && <li className="mc-msg agent"><p className="mc-dots"><span className="dots"><i /><i /><i /></span></p></li>}
        <li ref={end} aria-hidden="true" />
      </ol>
      <form className="mc-send" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message your agent" maxLength={500} aria-label="Message your agent" />
        <button className="send" aria-label="Send" disabled={!text.trim() || busy}><Icon name="up" size={20} /></button>
      </form>
    </div>
  );
}
