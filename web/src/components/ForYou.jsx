import { useEffect, useState } from "react";
import TasteQuestion from "./TasteQuestion.jsx";
import TrustBadge from "./TrustBadge.jsx";
import * as H from "../huddle.js";
import { cap, pct, WHY } from "../huddle.js";
import "../pages/huddle.css";
import { agentFetch } from "../agent.js";
const feedJoin = (post, on) => agentFetch("/api/feed/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ post, on }) }).then((r) => r.json());

// The member's own agent, working without being asked (agent src/members/huddle.js today): a game the agents agreed
// that waits for their yes, the question it still needs, games near them that fit how they play, a quiet hour a venue
// would sell cheap, and a nudge to get a game going in their club. Shown on the agent home for a signed-in member.
export default function ForYou() {
  const [r, setR] = useState(null), [said, setSaid] = useState({}), [busy, setBusy] = useState(false);
  const load = () => H.today().then(setR, () => setR({ cards: [], failed: true }));
  useEffect(() => { load(); const on = () => load(); addEventListener("serve:notices", on); return () => removeEventListener("serve:notices", on); }, []);
  useEffect(() => { if (!r?.looking) return; const t = setTimeout(load, 5000); return () => clearTimeout(t); }, [r?.looking]);
  if (!r || r.failed) return null;
  const note = (k, line) => setSaid((s) => ({ ...s, [k]: line }));
  const [last, setLast] = useState("");
  const act = async (k, fn) => { setBusy(true); try { const x = await fn(); note(k, x.line || "Done."); setLast(x.line || "Done."); load(); } catch (e) { note(k, e.message); setLast(e.message); } setBusy(false); };
  const t = r.taste;
  return (
    <section className="fy" aria-labelledby="fy-h">
      <div className="fy-head"><img src="/agents/you.png" alt="" />
        <div><b id="fy-h">Your agent, for you</b><p>{t.answers ? t.summary : "It learns how you like to play from a few answers, then answers for you when friends' agents ask."}</p></div>
        <a className="btn ghost sm" href="#/huddle?tab=taste">How you play</a>
      </div>
      {last && <p className="fy-last" role="status">{last}</p>}
      {!r.home && (
        <div className="fy-card needs"><span className="fy-kick">To find courts near you</span><p>Share your rough area (about 1 km, never an address) and your agent can look for games and quiet courts around you.</p>
          <div className="cta-row"><button className="btn primary sm" disabled={busy} onClick={() => act("home", H.shareHome)}>Share my area</button></div>{said.home && <p className="tq-said">{said.home}</p>}</div>
      )}
      {r.cards.map((c, i) => {
        if (c.kind === "huddle") { const h = c.huddle, pk = h.pick; return (
          <div key={i} className="fy-card needs"><span className="fy-kick">Needs your yes</span>
            <p>Your agent and {h.host}'s agreed <b>{h.sport} {pk.when}</b> at {pk.where}{pk.each ? `, NT$${pk.each} each` : ", a free court"}. {h.players.filter((x) => x.answer === "yes").map((x) => x.name).join(", ")} already said yes.</p>
            <div className="cta-row"><button className="btn primary sm" disabled={busy} onClick={() => act(i, () => H.reply(h.id, true))}>Yes, I'm in</button>
              {WHY.slice(0, 3).map(([k, l]) => <button key={k} className="btn ghost sm" disabled={busy} onClick={() => act(i, () => H.reply(h.id, false, k))}>{l}</button>)}
              <a className="link" href={`#/huddle?id=${h.id}`}>See the talk</a></div>
            {said[i] && <p className="tq-said">{said[i]}</p>}
          </div>); }
        if (c.kind === "mine") return (
          <div key={i} className="fy-card"><span className="fy-kick">Your games</span>
            <ul className="fy-mine">{c.games.map((g) => <li key={g.post}><b>{cap(g.sport)} {g.when}</b><span>{g.where}{g.club ? ` · ${g.club}` : ""} · {g.agreed ? `agreed; ${g.going} of ${g.spots} said yes, waiting for the rest` : g.waiting ? "you're on the waitlist" : g.mine ? `${g.going} of ${g.spots} joined` : `with ${g.host}, ${g.going} of ${g.spots} in`}</span>
              {g.agreed ? <a className="link" href={`#/huddle?id=${g.huddle}`}>See it</a> : !g.mine && <button className="link" disabled={busy} onClick={() => act(`m${g.post}`, async () => { await feedJoin(g.post, false); return { line: g.waiting ? "Off the waitlist." : "You've left that game." }; })}>{g.waiting ? "Leave the waitlist" : "Can't make it"}</button>}</li>)}</ul>
            {Object.entries(said).filter(([k]) => k.startsWith("m")).map(([k, v]) => <p key={k} className="tq-said">{v}</p>)}
          </div>);
        if (c.kind === "attend") return <Attend key={c.attend.key} a={c.attend} onDone={load} />;
        if (c.kind === "question") return (
          <div key={i} className="fy-card"><span className="fy-kick">Help your agent answer for you</span><TasteQuestion q={c.question} onAnswered={() => setTimeout(load, 900)} /></div>);
        if (c.kind === "game") { const g = c.game; return (
          <div key={i} className="fy-card"><span className="fy-kick">A game near you{g.club ? ` · ${g.club}` : ""}</span>
            <p><b>{cap(g.sport)} {g.when}</b> at {g.where}, with {g.host}. {g.left} spot{g.left > 1 ? "s" : ""} left{g.each > 0 ? `, NT$${g.each} each` : ""}.</p>
            <div className="fy-why">{g.why.map((w) => <span key={w}>{w}</span>)}</div>
            <div className="fy-host"><span>{g.host}:</span><TrustBadge t={g.hostTrust} compact />{g.gate?.minShow ? <em>Gate: shows up {Math.round(g.gate.minShow * 100)}%+</em> : null}</div>
            <div className="cta-row"><button className="btn primary sm" disabled={busy} onClick={() => act(i, () => H.game(g.post, true))}>Join</button>
              <button className="btn ghost sm" disabled={busy} onClick={() => act(i, () => H.game(g.post, false, "time"))}>Not a good time</button>
              <button className="btn ghost sm" disabled={busy} onClick={() => act(i, () => H.game(g.post, false, "place"))}>Too far</button></div>
            {said[i] && <p className="tq-said">{said[i]}</p>}
          </div>); }
        if (c.kind === "deal") { const d = c.deal; return (
          <div key={i} className="fy-card"><span className="fy-kick">A quiet hour, cheaper</span>
            <p>{d.place.name} is usually only {pct(d.busy)} full on <b>{d.when}</b>. Its agent would take <b>NT${d.price}</b> instead of NT${d.list} for a court ({d.off}% off), NT${d.each} each for four.</p>
            <p className="hd-fine">A sample price: the venue hasn't joined Serve yet.</p>
            <div className="cta-row"><a className="btn primary sm" href={`#/huddle?sport=${encodeURIComponent(d.sport)}&date=${d.date}&start=${d.start}&place=${encodeURIComponent(d.place.id)}`}>Get a game then</a><a className="link" href="#/huddle?tab=courts">All courts near you</a></div>
          </div>); }
        if (c.kind === "alone") return (
          <div key={i} className="fy-card"><span className="fy-kick">Nobody near you yet</span>
            <p>Nobody within about 5 km who plays {c.alone.sport} has let other agents ask theirs yet. Post a game and share its link: the first friend needs no account. Or start a club and invite people.</p>
            <div className="cta-row"><a className="btn primary sm" href="#/social">Post a game</a><a className="btn ghost sm" href="#/club">Start a club</a>{!c.alone.open && <a className="link" href="#/huddle?tab=taste">Let nearby people ask you</a>}</div>
          </div>);
        if (c.kind === "club") return (
          <div key={i} className="fy-card"><span className="fy-kick">{c.club.name}</span>
            <p>Want a {c.club.sport} game this week? Your agent asks the other {c.club.members - 1} members' agents and finds who fits, and when.</p>
            <div className="cta-row"><a className="btn primary sm" href={`#/huddle?club=${c.club.id}`}>Get a game together</a></div>
          </div>);
        return null;
      })}
    </section>
  );
}

// after a game: one tap per player, came or didn't (their show-up record), and whether they played at the level they said
function Attend({ a, onDone }) {
  const [came, setCame] = useState(Object.fromEntries(a.players.map((p) => [p.id, "came"]))), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  return (
    <div className="fy-card needs"><span className="fy-kick">After your game · {a.when}</span>
      <p>Who came? It builds everyone's show-up record, the one other agents check before letting someone in.</p>
      <ul className="fy-attend">{a.players.map((p) => (
        <li key={p.id}><span>{p.name}</span>
          <div className="seg sm" role="radiogroup" aria-label={`Did ${p.name} come`}>{[["came", "Came"], ["missed", "Didn't come"]].map(([k, l]) => <button key={k} role="radio" aria-checked={came[p.id] === k} onClick={() => setCame({ ...came, [p.id]: k })}>{l}</button>)}</div></li>
      ))}</ul>
      {err && <p className="join-err" role="alert">{err}</p>}
      <div className="cta-row"><button className="btn primary sm" disabled={busy} onClick={async () => { setBusy(true); try { await H.attend(a.key, came); onDone(); } catch (e) { setErr(e.message); } setBusy(false); }}>Send</button></div>
    </div>
  );
}
