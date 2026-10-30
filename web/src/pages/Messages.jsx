import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { agentAnswer, agentFetch, agentInviteDraft } from "../agent.js";
import { agentFace } from "../club/faces.js";
import { feedApi } from "../club/feedApi.js";
import { intentOf } from "../tasks.js";
import { myPlace } from "../where.js";
import ClubSuggest from "../components/ClubSuggest.jsx";
import { shareInvite } from "../invite.js";
import "./clubs.css";
import "./messages.css";

// Your agent, as a chat: write to it and it answers from what it knows about you (agent answer.js, past Llama Guard on
// your server, every number checked). Say you want a game ("Saturday morning doubles, need 3") and it drafts the
// invite (agent play.js inviteDraft): the sport, the day and time, how many, the nearest court; on your yes it posts it
// in your club for that sport (else the shared feed), and shows who has joined. The conversation stays in this browser.
const KEY = "serve.chat.v1";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const keep = (ms) => { try { localStorage.setItem(KEY, JSON.stringify(ms.slice(-100))); } catch { /* private mode */ } };
const HELLO = { from: "agent", text: "Hi! Tell me what you want to play and when, and I'll post it and find people. Or ask me anything about your week." };
const DAYNAME = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : d);
const wantsGame = (t) => intentOf(t) === "play" || /(想|要|來|去)?打(羽球|羽毛球|網球|桌球|籃球|排球|匹克球|球)|揪|缺.{0,3}人|有人.{0,6}打|一起打|need \d|looking for (players|people)|anyone (up )?for/i.test(t);

export default function Messages() {
  const [ms, setMs] = useState(read), [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { keep(ms); end.current?.scrollIntoView({ block: "end" }); }, [ms, busy]);
  // a message from the home page's box (#/messages?say=…) is sent at once
  useEffect(() => {
    const say = new URLSearchParams(location.hash.split("?")[1] || "").get("say");
    if (say) { history.replaceState(null, "", "#/messages"); ask(say); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const add = (m) => setMs((x) => [...x, { at: Date.now(), ...m }]);
  const ask = async (t) => {
    if (!t || busy) return;
    setBusy(true); add({ from: "you", text: t });
    try {
      // a game you want becomes an invite to post (the app's words first, else the server says so: { play: true })
      const r = wantsGame(t) ? { play: true } : await agentAnswer(t, {});
      if (r.play) {
        const d = await agentInviteDraft(t, await myPlace());
        add({ from: "agent", kind: "draft", draft: d.draft, text: "Here's the invite. Change how many, then post it:" });
      } else add({ from: "agent", text: r.refused ? "I can't help with that one." : r.text });
    } catch (err) { add({ from: "agent", text: `I couldn't answer just now (${err.message}).`, failed: true }); }
    setBusy(false);
  };
  const send = (e) => { e.preventDefault(); const t = text.trim(); setText(""); ask(t); };
  // the draft at index i, posted: in the member's club for the sport if they are in one, else the shared feed
  const post = async (i, d) => {
    setMs((x) => x.map((m, k) => (k === i ? { ...m, kind: "drafted" } : m)));
    try {
      const cs = await agentFetch("/api/clubs").then((r) => r.json()).then((j) => (j.clubs || []).filter((c) => c.joined)).catch(() => []);
      const club = cs.find((c) => c.sport === d.sport) || null;
      const r = await feedApi.post(d.text || "", null, { sport: d.sport, day: d.day, start: d.start, where: d.where, spots: d.spots, ...(d.at ? { at: d.at } : {}) }, club?.id || null);
      add({ from: "agent", kind: "posted", post: r.post.id, room: club?.id || null, text: `Posted${club ? ` in ${club.name}` : " in the club feed"}. I'll show who joins here.` });
    } catch (err) { add({ from: "agent", text: `I couldn't post it (${err.message}).`, failed: true }); }
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
        <li className="mc-suggest"><ClubSuggest /></li>
        {shown.map((m, i) => (
          <li key={i} className={`mc-msg ${m.from}${m.failed ? " failed" : ""}`}>
            <div className="mc-bubble">
              <p>{m.text}</p>
              {m.kind === "draft" && <Draft d={m.draft} onChange={(d) => setMs((x) => x.map((y, k) => (k === i ? { ...y, draft: d } : y)))} onPost={() => post(i, m.draft)} onCancel={() => setMs((x) => x.map((y, k) => (k === i ? { ...y, kind: "dropped", text: "OK, not posted." } : y)))} />}
              {m.kind === "posted" && <Joined id={m.post} />}
            </div>
          </li>
        ))}
        {busy && <li className="mc-msg agent"><div className="mc-bubble"><p className="mc-dots"><span className="dots"><i /><i /><i /></span></p></div></li>}
        <li ref={end} aria-hidden="true" />
      </ol>
      <form className="mc-send" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Saturday morning doubles, need 3" maxLength={500} aria-label="Message your agent" />
        <button className="send" aria-label="Send" disabled={!text.trim() || busy}><Icon name="up" size={20} /></button>
      </form>
    </div>
  );
}

// the invite the agent drafted: everything at a glance, how many players to change, then post
function Draft({ d, onChange, onPost, onCancel }) {
  const n = (k) => onChange({ ...d, spots: Math.min(12, Math.max(1, d.spots + k)) });
  return (
    <div className="mc-draft">
      <b>{d.sport[0].toUpperCase() + d.sport.slice(1)}{d.format !== "any" ? ` ${d.format}` : ""}</b>
      <span>{DAYNAME(d.day)} · {d.start}</span>
      <span>{d.where}</span>
      <div className="mc-spots" aria-label="Players needed">
        <button type="button" onClick={() => n(-1)} aria-label="One fewer">−</button>
        <span>{d.spots} more player{d.spots === 1 ? "" : "s"}</span>
        <button type="button" onClick={() => n(1)} aria-label="One more">+</button>
      </div>
      <div className="mc-act"><button className="btn primary sm" onClick={onPost}>Post it</button><button className="btn ghost sm" onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

// who has joined a posted invite, asked again every half minute while the chat is open
function Joined({ id }) {
  const [p, setP] = useState(null), [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    const ask = () => feedApi.one(id).then((r) => live && setP(r.post || r)).catch(() => {});
    // and at once when a notice arrives (a game that just filled)
    ask(); const t = setInterval(ask, 30000); addEventListener("serve:notices", ask);
    return () => { live = false; clearInterval(t); removeEventListener("serve:notices", ask); };
  }, [id]);
  const v = p?.invite;
  if (!v) return null;
  const share = async () => { if ((await shareInvite(id, `${v.sport} ${v.day} ${v.start}: join me on Serve`)) === "copied") setCopied(true); };
  return (
    <div className="mc-joined">
      {v.full ? <span className="mc-gameon"><b>Game on.</b> {v.spots === 1 ? "The spot is taken" : `All ${v.spots} spots are taken`}: {v.names.join(", ")}.</span>
        : <span>{v.going ? `${v.going} of ${v.spots} joined: ${v.names.join(", ")}` : `0 of ${v.spots} joined yet`}</span>}
      {!v.full && <button className="btn ghost sm" onClick={share}>{copied ? "Link copied" : "Share link"}</button>}
    </div>
  );
}
