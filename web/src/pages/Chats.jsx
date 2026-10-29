import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import Mark from "../components/Mark.jsx";
import { useTasks } from "../tasks.js";
import { agentFace } from "../club/faces.js";
import "./chats.css";

// Agent chats: every conversation your agent had with other members' agents, the way Messenger shows a chat. Your agent
// on the right, theirs on the left, round by round, each message with what it meant (proposes, agrees, a counter-offer,
// declines) and whether code checked it against everyone's calendar. Nothing here is a summary: these are the messages
// the agents sent each other over A2A, as the jobs streamed them in.
const initials = (n = "") => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const first = (n = "") => n.split(" ")[0];
const INTENT = { propose: "Proposes", counter: "Counter-offer", accept: "Agrees", decline: "Declines", none: "No answer" };
const JOB = { autopilot: "Planning your week", play: "A game you asked for", game: "Want a game?", match: "Your best match", talk: "Agent to agent" };
const when = (t) => { const d = new Date(t), h = (Date.now() - t) / 36e5; return h < 24 ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };

export default function Chats({ club }) {
  const tasks = useTasks();
  const byId = useMemo(() => Object.fromEntries((club?.members || []).map((m) => [m.id, m])), [club]);
  // one chat per job and game: the messages your agent and theirs sent each other
  const chats = useMemo(() => tasks.filter((t) => t.messages?.length).flatMap((t) => {
    const g = {};
    t.messages.forEach((m) => (g[m.game ?? 0] ||= []).push(m));
    return Object.entries(g).map(([k, ms]) => ({ id: `${t.id}:${k}`, t, ms, deal: t.result?.agreed?.[+k] || (Object.keys(g).length === 1 ? t.result?.agreed?.[0] : null), who: [...new Set(ms.flatMap((m) => [m.from, ...(Array.isArray(m.to) ? m.to : [m.to])]).filter((x) => x && x !== "you"))].map((id) => byId[id] || { id, name: id }), at: ms.at(-1).at || t.at }));
  }).sort((a, b) => b.at - a.at), [tasks, byId]);
  const [sel, setSel] = useState(null);
  const cur = chats.find((c) => c.id === sel) || chats[0];
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [cur?.id, cur?.ms.length]);

  if (!chats.length) return (
    <div className="page chats-empty">
      <span className="ch-face lg"><Mark size={30} /></span>
      <h1 className="h1">No agent chats yet</h1>
      <p className="muted">When your agent agrees a game with other members' agents, every message shows up here.</p>
      <a className="btn primary" href="#/autopilot?run=1"><Icon name="spark" size={18} />Plan my week</a>
    </div>
  );
  return (
    <div className="page chats">
      <aside className="ch-list" aria-label="Agent chats">
        <h1 className="ch-title">Agent chats</h1>
        <ul>
          {chats.map((c) => (
            <li key={c.id}>
              <button className={c.id === cur?.id ? "on" : ""} onClick={() => setSel(c.id)}>
                <span className="ch-stack">{c.who.slice(0, 3).map((m) => (agentFace(m.id) ? <img key={m.id} className="ch-face pic" src={agentFace(m.id)} alt="" /> : <span key={m.id} className="ch-face">{initials(m.name)}</span>))}</span>
                <span className="ch-row"><b>{c.who.map((m) => `${first(m.name)}'s`).join(", ")} agent{c.who.length > 1 ? "s" : ""}</b>
                  <span className="ch-last">{c.ms.at(-1).from === "you" ? "Your agent: " : ""}{c.ms.at(-1).text}</span></span>
                <span className="ch-time">{when(c.at)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {cur && (
        <section className="ch-thread" aria-label="Conversation">
          <header className="ch-head">
            <span className="ch-stack">{cur.who.slice(0, 3).map((m) => (agentFace(m.id) ? <img key={m.id} className="ch-face pic" src={agentFace(m.id)} alt="" /> : <span key={m.id} className="ch-face">{initials(m.name)}</span>))}</span>
            <span className="ch-row"><b>{cur.who.map((m) => first(m.name)).join(", ")}</b><span className="ch-sub">{JOB[cur.t.kind] || "Agent to agent"}</span></span>
            <span className="ch-badge"><Icon name="verify" size={14} />Agent Cards verified</span>
          </header>
          <ol className="ch-msgs">
            {cur.ms.map((m, i) => {
              const mine = m.from === "you", who = byId[m.from], round = m.round || 1, newRound = i > 0 && round !== (cur.ms[i - 1].round || 1);
              return [
                newRound && <li key={`r${i}`} className="ch-sep">Round {round}</li>,
                <li key={i} className={`ch-msg ${mine ? "mine" : "theirs"}`}>
                  {!mine && (agentFace(m.from) ? <img className="ch-face sm pic" src={agentFace(m.from)} alt="" /> : <span className="ch-face sm">{initials(who?.name || m.from)}</span>)}
                  <div>
                    {!mine && <span className="ch-name">{first(who?.name || m.from)}'s agent</span>}
                    <p className="ch-bubble">{m.text}</p>
                    <span className={`ch-intent ${m.intent}`}>{INTENT[m.intent] || m.intent}{m.intent === "counter" && m.when ? ` · ${m.when}` : ""}{m.checked === true ? <><Icon name="check" size={12} />fits everyone</> : m.checked === false ? " · doesn't fit" : ""}{m.tier === "quick" ? " · Llama 3.2 1B" : m.tier === "agent" ? " · Muse Glimmer" : ""}</span>
                  </div>
                  {mine && <img className="ch-face sm pic" src={agentFace("you")} alt="" />}
                </li>,
              ];
            })}
            {cur.deal && <li className="ch-done"><Icon name="check" size={16} />Agreed: {cur.deal.day} {cur.deal.start} at {cur.deal.venue.name}{cur.t.state === "needs" ? " · waiting for your yes" : ""}</li>}
            {cur.t.booking?.state === "confirmed" && <li className="ch-done"><Icon name="check" size={16} />Game on: {cur.t.booking.option.day} {cur.t.booking.option.start}</li>}
            <li ref={end} aria-hidden="true" />
          </ol>
        </section>
      )}
    </div>
  );
}
