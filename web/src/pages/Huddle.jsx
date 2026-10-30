import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import TasteQuestion from "../components/TasteQuestion.jsx";
import TrustBadge from "../components/TrustBadge.jsx";
import * as H from "../huddle.js";
import { AGENT_URL } from "../agent.js";
import { cap, pct, FACTOR, WHY } from "../huddle.js";
import "./huddle.css";

// Huddle: getting a game together with real people. Each person's agent answers for them the way they would (it
// learns how they like to play from a few answers), the agents agree a time and a place, a venue's agent is asked for
// a price, and everyone says yes once (agent src/members/huddle.js). Three tabs: get a game, courts and prices near
// you (quiet hours, what a venue's agent would take), and how you play (what your agent has learned).
const params = () => new URLSearchParams(location.hash.split("?")[1] || "");
// the person's own words from the home box, kept for this visit so How you play can offer them as limits
const saidWords = () => { const s = params().get("say"); try { if (s) sessionStorage.setItem("serve.said", s); return s || sessionStorage.getItem("serve.said") || ""; } catch { return s || ""; } };
const TABS = [["game", "Get a game"], ["courts", "Courts & prices"], ["taste", "How you play"]];
const setParam = (k, v) => { const p = params(); if (v == null) p.delete(k); else p.set(k, v); location.hash = `/huddle${p.toString() ? `?${p}` : ""}`; };

export default function Huddle() {
  saidWords(); // keep the home box's words for this visit
  const [tab, setTab] = useState(() => params().get("tab") || "game");
  const [me, setMe] = useState(null), [err, setErr] = useState("");
  const load = () => H.mine().then(setMe, (e) => setErr(e.message));
  useEffect(() => { load(); const on = () => setTab(params().get("tab") || "game"); addEventListener("hashchange", on); return () => removeEventListener("hashchange", on); }, []);
  return (
    <div className="page huddle">
      <header className="hd-head">
        <h1 className="h1">Games</h1>
        <p className="hd-sub">Your agent and theirs work out when and where. You say yes once.</p>
      </header>
      <div className="seg hd-tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} aria-checked={tab === k} onClick={() => setParam("tab", k === "game" ? null : k)}>{l}</button>)}
      </div>
      {err && <p className="join-err" role="alert">{err}</p>}
      {me && !me.taste.home && <ShareHome onDone={load} />}
      {me && tab === "game" && <GameTab me={me} reload={load} />}
      {me && tab === "courts" && <CourtsTab me={me} />}
      {me && tab === "taste" && <TasteTab me={me} reload={load} />}
      {!me && !err && <p className="muted">Asking your agent…</p>}
    </div>
  );
}

function ShareHome({ onDone }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [place, setPlace] = useState("");
  return (
    <div className="hd-note">
      <Icon name="pin" size={20} />
      <div><b>Where do you usually play from?</b><p>Your rough area (about 1 km, never an address) lets the agents find courts in the middle of the group and work out each person's trip.</p>
        {err && <p className="join-err" role="alert">{err}</p>}</div>
      <div className="hd-home-acts">
        <button className="btn primary sm" disabled={busy} onClick={async () => { setBusy(true); setErr(""); try { await H.shareHome(); onDone(); } catch (e) { setErr(`${e.message} Or type your area below.`); } setBusy(false); }}>{busy ? "Asking…" : "Use my location"}</button>
        <form onSubmit={async (e) => { e.preventDefault(); if (!place.trim()) return; setBusy(true); setErr(""); try { await H.call("/api/huddle/home", { place }); onDone(); } catch (x) { setErr(x.message); } setBusy(false); }}>
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="or type it: Xinyi District, Taipei" aria-label="Your area" /><button className="btn ghost sm" disabled={busy || !place.trim()}>Set</button>
        </form>
      </div>
    </div>
  );
}

// ---- get a game ----
function GameTab({ me, reload }) {
  const p = params(), [open, setOpen] = useState(p.get("id"));
  const pin = p.get("date") ? { date: p.get("date"), start: p.get("start"), place: p.get("place") } : null;
  useEffect(() => { const on = () => setOpen(params().get("id")); addEventListener("hashchange", on); return () => removeEventListener("hashchange", on); }, []);
  return (
    <div className="hd-game">
      {open ? <HuddleView id={open} onChange={reload} onBack={() => { setParam("id", null); reload(); }} /> : <Ask me={me} pin={pin} club={p.get("club")} sport={p.get("sport")} onStarted={(h) => { reload(); setParam("id", h.id); }} />}
      {me.huddles.length > 0 && (
        <section className="hd-list" aria-label="Your games being worked out">
          <h2 className="h3">Games your agent is arranging</h2>
          <ul>{me.huddles.map((h) => (
            <li key={h.id}><button className={open === h.id ? "on" : ""} onClick={() => setParam("id", h.id)}>
              <span className={`hd-status s-${h.status}`}>{STATUS[h.status]}{h.ask ? " · needs you" : ""}</span>
              <b>{cap(h.sport)}, {h.need} players{h.club ? ` · ${h.club}` : ""}</b>
              <span>{h.pick ? `${h.pick.when} · ${h.pick.where}` : h.mine ? "You asked" : `${h.host} asked`}</span>
            </button></li>
          ))}</ul>
        </section>
      )}
      <Needs />
    </div>
  );
}
// what the agents keep running into: once a kind has happened in three huddles, it goes to the club's ideas (the
// community loop), where members vote and the change is built and checked like any other (agent members/needs.js)
function Needs() {
  const [n, setN] = useState(null);
  useEffect(() => { H.needs().then((r) => setN(r.needs), () => {}); }, []);
  const seen = (n || []).filter((x) => x.huddles || x.sent);
  if (!seen.length) return null;
  return (
    <section className="panel hd-needs" aria-label="What the agents asked Serve to change">
      <h2 className="h3">What the agents asked Serve to change</h2>
      <p className="hd-fine">When agents keep hitting the same wall in different huddles, they put it to the club as an idea. Members vote; the change is built and checked through the same gates as members' own ideas.</p>
      <ul>{seen.map((x) => <li key={x.kind}><span>{x.text}</span><em>{x.sent ? "Sent to the club's ideas" : `${x.huddles} of ${x.of} huddles`}</em></li>)}</ul>
    </section>
  );
}
// when to play, as the form offers it (and as read from what someone typed to their agent)
const ymdIn = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"], DAYNAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WHEN = {
  any: { label: "Any time this week" },
  weekend: { label: "This weekend", v: { days: ["Sat", "Sun"] } },
  evenings: { label: "Weekday evenings", v: { days: WEEKDAYS, parts: ["evening"] } },
  mornings: { label: "Weekday mornings", v: { days: WEEKDAYS, parts: ["early", "morning"] } },
  ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((i) => { const d = ymdIn(i), dn = DAYNAMES[new Date(d + "T12:00").getDay()]; return [`day${i}`, { label: i === 0 ? "Today" : i === 1 ? `Tomorrow (${dn})` : `${dn} ${d.slice(8)}`, v: { days: [d] } }]; })),
};
// a price named in their words: "under NT$200", "200元以下", "below 200 each"
const eachFromText = (t) => { const m = String(t).match(/(?:under|below|less than|max|up to|<)\s*(?:NT\$|\$)?\s*(\d{2,4})|(\d{2,4})\s*(?:元|塊)?\s*(?:以下|以內)/i); return m ? +(m[1] || m[2]) : null; };
function whenFromText(t) {
  const part = /morning|早上/i.test(t) ? ["early", "morning"] : /afternoon|下午/i.test(t) ? ["afternoon"] : /evening|tonight|night|晚上/i.test(t) ? ["evening"] : null;
  const d = DAYNAMES.findIndex((n) => new RegExp(`\\b${n}`, "i").test(t));
  if (d >= 0) for (let i = 0; i < 7; i++) { const ymd = ymdIn(i); if (new Date(ymd + "T12:00").getDay() === d) { WHEN.said = { label: `${DAYNAMES[d]} ${ymd.slice(8)}${part ? `, ${part.at(-1)}` : ""} (as you said)`, v: { days: [ymd], ...(part ? { parts: part } : {}) } }; return "said"; } }
  if (/today|tonight|今天/i.test(t)) { WHEN.said = { label: `Today${part ? `, ${part.at(-1)}` : ""} (as you said)`, v: { days: [ymdIn(0)], ...(part ? { parts: part } : {}) } }; return "said"; }
  if (/weekend|週末|周末/i.test(t)) { if (part) { WHEN.said = { label: `This weekend, ${part.at(-1)} (as you said)`, v: { days: ["Sat", "Sun"], parts: part } }; return "said"; } return "weekend"; }
  if (part) return part[0] === "evening" ? "evenings" : part[0] === "afternoon" ? "any" : "mornings";
  return "any";
}
const STATUS = { talking: "Agents talking", asking: "Agreed, asking", on: "Game on", stuck: "No time found", cancelled: "Called off" };

function Ask({ me, pin, club: clubId, sport: sport0, onStarted }) {
  const club0 = me.clubs.find((c) => c.id === clubId) || me.clubs[0] || null;
  const [who, setWho] = useState(club0 ? `club:${club0.id}` : "pick"), [picked, setPicked] = useState([]);
  const [sport, setSport] = useState(params().get("sport") || sport0 || club0?.sport || me.taste.sports[0] || "badminton"), [need, setNeed] = useState(() => Math.max(2, +params().get("need") || 4));
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [nearby, setNearby] = useState(!me.clubs.length || (club0?.members ?? 0) < 4), [minShow, setMinShow] = useState(0), [agentMin, setAgentMin] = useState(true);
  const [whenK, setWhenK] = useState(() => whenFromText(params().get("say") || "")), fill = params().get("fill");
  if (!me.clubs.length && !me.taste.home) return (
    <div className="panel hd-empty"><b>Your agent gets games with people in your clubs, and with people nearby who are open to it.</b><p>Join a club near you, or share your rough area, then come back: the agents will find who fits and when.</p><a className="btn primary sm" href="#/club">Find a club</a></div>
  );
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await H.start({ sport, need, ...(who.startsWith("club:") ? { club: who.slice(5) } : who === "pick" ? { invite: picked } : {}), nearby, gate: { minShow, agentMin: agentMin ? 0.8 : 0 }, ...(pin ? { pin, hostYes: true } : {}), ...(fill ? { fill } : !pin && WHEN[whenK]?.v ? { when: WHEN[whenK].v } : {}), ...(eachFromText(params().get("say") || "") != null ? { wantEach: eachFromText(params().get("say")) } : {}) }); onStarted(r.huddle); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form className="panel hd-ask" onSubmit={go}>
      <h2 className="h3">Get a game together</h2>
      {pin && <p className="hd-pin"><Icon name="clock" size={16} />At the time you picked: {new Date(`${pin.date}T12:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}, {pin.start}</p>}
      <div className="hd-row">
        <label>Sport<select value={sport} onChange={(e) => setSport(e.target.value)}>{H.SPORTS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Players, you included
          <span className="hd-step"><button type="button" aria-label="Fewer" onClick={() => setNeed(Math.max(2, need - 1))}>−</button><b>{need}</b><button type="button" aria-label="More" onClick={() => setNeed(Math.min(12, need + 1))}>+</button></span>
        </label>
      </div>
      {fill && <p className="hd-pin"><Icon name="spark" size={16} />Filling the open spots of the game you posted: its time and place stay.</p>}
      {params().get("say") && <p className="hd-said">You asked your agent: “{params().get("say")}”</p>}
      {!pin && !fill && <label className="hd-when">When
        <select value={whenK} onChange={(e) => setWhenK(e.target.value)}>{Object.entries(WHEN).map(([k, w]) => <option key={k} value={k}>{w.label}</option>)}</select>
      </label>}
      <fieldset className="hd-who"><legend>With whom</legend>
        {me.clubs.map((c) => (
          <label key={c.id} className={who === `club:${c.id}` ? "on" : ""}><input type="radio" name="who" checked={who === `club:${c.id}`} onChange={() => setWho(`club:${c.id}`)} />
            <span><b>Anyone in {c.name}</b><em>{c.members - 1} other{c.members === 2 ? "" : "s"}: the agents pick who fits best</em></span></label>
        ))}
        <label className={who === "pick" ? "on" : ""}><input type="radio" name="who" checked={who === "pick"} onChange={() => setWho("pick")} /><span><b>People I pick</b><em>Everyone you pick has to agree</em></span></label>
        {me.taste.home && <label className={who === "none" ? "on" : ""}><input type="radio" name="who" checked={who === "none"} onChange={() => { setWho("none"); setNearby(true); }} /><span><b>Only people nearby</b><em>Strangers within about 5 km who let agents ask theirs</em></span></label>}
      </fieldset>
      {me.taste.home && <label className="hd-check"><input type="checkbox" checked={nearby} onChange={(e) => setNearby(e.target.checked)} /><span><b>Also ask people nearby</b><em>Within about 5 km, who said other agents may ask theirs</em></span></label>}
      <fieldset className="hd-gate"><legend>Who gets in</legend>
        <div className="seg sm" role="radiogroup" aria-label="Shows up at least">
          {[[0, "Anyone"], [0.75, "Shows up 75%+"], [0.9, "Shows up 90%+"]].map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={minShow === k} onClick={() => setMinShow(k)}>{l}</button>)}
        </div>
        <label className="hd-check"><input type="checkbox" checked={agentMin} onChange={(e) => setAgentMin(e.target.checked)} /><span><b>Only reliable agents answer for their person</b><em>An agent that keeps under 80% of its yeses can't say yes for them: they're asked themself</em></span></label>
        <p className="hd-fine">Below the show-up rate, people go on the waitlist. New people (under three games) are let in. Serve never asks anyone for a deposit.</p>
      </fieldset>
      {who === "pick" && (
        <div className="hd-people">
          {me.people.length ? me.people.map((x) => (
            <button type="button" key={x.id} className={picked.includes(x.id) ? "on" : ""} aria-pressed={picked.includes(x.id)} onClick={() => setPicked(picked.includes(x.id) ? picked.filter((y) => y !== x.id) : [...picked, x.id])}>
              {x.name.split(" ")[0]}{x.knows && <i title="Their agent knows how they like to play">✓</i>}
            </button>
          )) : <p className="muted">Nobody else is in your clubs yet.</p>}
        </div>
      )}
      <p className="hd-how">Each person's agent answers for them from what it has learned: the time, how far, the price, a quiet court. Nobody shares a calendar or an address.</p>
      {err && <p className="join-err" role="alert">{err}</p>}
      <button className="btn primary" disabled={busy || (who === "pick" && !picked.length && !nearby)}><Icon name="spark" size={18} />{busy ? "Starting…" : "Let the agents work it out"}</button>
    </form>
  );
}

function HuddleView({ id, onBack, onChange = () => {} }) {
  const [h, setH] = useState(null), [err, setErr] = useState(""), [said, setSaid] = useState(""), [busy, setBusy] = useState(false), [why, setWhy] = useState(false);
  const end = useRef(null);
  const load = () => H.one(id).then((r) => setH(r.huddle), (e) => setErr(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (h?.status !== "talking") return; const t = setInterval(load, 1500); return () => clearInterval(t); }, [h?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [h?.talk?.length]);
  const answer = async (yes, w = null) => { setBusy(true); try { const r = await H.reply(id, yes, w); setH(r.huddle); setSaid(r.line); setWhy(false); onChange(); } catch (e) { setErr(e.message); } setBusy(false); };
  if (err) return <div className="panel"><button className="link" onClick={onBack}>Back</button><p className="join-err" role="alert">{err}</p></div>;
  if (!h) return <div className="panel"><p className="muted">Opening…</p></div>;
  const pk = h.pick;
  return (
    <section className="panel hd-one" aria-label="The agents' talk">
      <div className="hd-one-head">
        <button className="link hd-back" onClick={onBack}><Icon name="back" size={16} />New game</button>
        <span className={`hd-status s-${h.status}`}>{STATUS[h.status]}</span>
      </div>
      <h2 className="h3">{cap(h.sport)}, {h.need} players{h.club ? ` · anyone in ${h.club}` : ""}</h2>
      {h.found && h.status !== "on" && (
        <div className="hd-found"><span className="fy-kick">Already open nearby</span><p><b>{cap(h.found.sport)} {h.found.when}</b> at {h.found.where}, with {h.found.host}: {h.found.left} spot{h.found.left > 1 ? "s" : ""} left.</p>
          <TrustBadge t={h.found.hostTrust} compact /><a className="link" href="#/">Join it from your agent's cards</a></div>
      )}
      {pk && (
        <div className="hd-pick">
          <div className="hd-pick-main"><b>{pk.when}</b><span>{pk.where}</span></div>
          <ul className="hd-facts">
            <li>{pk.kind === "venue" ? <>{pk.each ? `NT$${pk.each} each` : ""}{pk.off ? <em> · {pk.off}% under list</em> : null}</> : "Free public court"}</li>
            <li>Usually {pct(pk.busy)} full then</li>
            {pk.km != null && <li>Your trip {pk.km} km</li>}
          </ul>
          {pk.sample && <p className="hd-fine">The venue hasn't joined Serve yet: its list price is a sample, and nothing is paid here.</p>}
          <ul className="hd-players">{h.players.map((x, i) => <li key={i} className={x.answer === "yes" ? "yes" : ""}>{x.answer === "yes" ? <Icon name="check" size={14} /> : <i className="hd-wait" />}<span>{x.name}{x.host ? " (asked)" : x.direct ? " (asked directly)" : ""}</span>{x.name !== "You" && <TrustBadge t={x.trust} compact />}</li>)}</ul>
          {h.waitlist?.length > 0 && <p className="hd-fine">Waitlist: {h.waitlist.join(", ")}.</p>}
          {h.status === "asking" && !h.ask && h.waiting?.length > 0 && <p className="hd-fine">Waiting for {h.waiting.join(", ")}{h.due ? `: they have until ${new Date(h.due).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}, then the next player gets the spot` : ""}.</p>}
          {h.ask && (
            <div className="hd-yes">
              <p><b>{h.mine ? "The agents found a time." : "Your agent said yes for you."}</b> Are you in?{h.due ? <span className="hd-fine"> Answer by {new Date(h.due).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}, or your place goes to the next player.</span> : null}</p>
              <div className="cta-row"><button className="btn primary" disabled={busy} onClick={() => answer(true)}>Yes, I'm in</button><button className="btn ghost sm" disabled={busy} onClick={() => setWhy(!why)}>I can't</button></div>
              {why && <div className="hd-why" role="group" aria-label="Why not">{WHY.map(([k, l]) => <button key={k} className="btn ghost sm" disabled={busy} onClick={() => answer(false, k)}>{l}</button>)}</div>}
            </div>
          )}
          {h.status === "on" && h.post && <a className="btn ghost sm" href="#/social">See it in the feed</a>}
        </div>
      )}
      {said && <p className="hd-learned" role="status"><Icon name="memory" size={16} />{said}</p>}
      <ol className="hd-talk">
        {h.talk.map((l, i) => (
          <li key={i} className={`t-${l.from}${l.venue ? " t-venue" : ""}${l.agreed ? " t-agreed" : ""}${l.gate ? ` t-gate g-${l.gate}` : ""}`}>
            <span className="hd-who-l">{l.from === "me" ? "Your agent" : `${l.who}'s agent`}{l.yes === true ? " · yes" : l.yes === false ? " · no" : ""}</span>
            <p>{l.text}</p>
          </li>
        ))}
        {h.status === "talking" && <li className="t-host t-typing"><span className="hd-who-l">Agents</span><p><i /><i /><i /></p></li>}
        <li ref={end} aria-hidden="true" />
      </ol>
      {h.mine && ["talking", "asking", "stuck"].includes(h.status) && <button className="link hd-cancel" onClick={async () => { const r = await H.cancel(id).catch((e) => setErr(e.message)); if (r) { setH(r.huddle); onChange(); } }}>Call it off</button>}
    </section>
  );
}

// ---- courts and prices ----
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayOf = (date) => { const [y, m, d] = date.split("-").map(Number); return new Date(y, m - 1, d); };
function CourtsTab({ me }) {
  const [sport, setSport] = useState(me.taste.sports[0] || "badminton"), [r, setR] = useState(null), [err, setErr] = useState("");
  useEffect(() => {
    let live = true, t = null;
    const load = () => H.places(sport).then((x) => { if (!live) return; setR(x); if (x.looking) t = setTimeout(load, 4000); }, (e) => setErr(e.message));
    setR(null); load();
    return () => { live = false; clearTimeout(t); };
  }, [sport, me.taste.home]);
  return (
    <div className="hd-courts">
      <div className="hd-row"><label>Sport<select value={sport} onChange={(e) => setSport(e.target.value)}>{H.SPORTS.map((s) => <option key={s}>{s}</option>)}</select></label></div>
      <p className="hd-fine">How full a place is: an estimate from a typical week there and the games already on Serve. Sports centres' prices are samples until a venue joins Serve; their agent follows a venue's rule: an empty hour sells for less, a full one at the list price. In each grid, darker is busier.</p>
      {err && <p className="join-err" role="alert">{err}</p>}
      {r && !r.home && <p className="muted">Share your area first.</p>}
      {(!r || r.looking) && r?.home !== false && <p className="muted hd-looking"><i className="hd-wait" />Looking at the map around you (OpenStreetMap can take up to a minute)…</p>}
      {r?.places?.map((p) => <Place key={p.id} p={p} sport={sport} />)}
      {r && !r.looking && r.home && !r.places.length && <p className="muted">{r.note || `No ${sport} courts found near you on the map.`}</p>}
    </div>
  );
}
function Place({ p, sport }) {
  const [show, setShow] = useState(false);
  const days = [...new Set(p.grid.map((g) => g.date))], starts = [...new Set(p.grid.map((g) => g.start))].sort();
  const cell = (d, s) => p.grid.find((g) => g.date === d && g.start === s);
  const o = p.offer;
  return (
    <article className="panel hd-place">
      <header><div><span className={`hd-kind k-${p.kind}`}>{p.kind === "venue" ? "Sports centre" : "Public court"}</span><h3>{p.name}</h3></div><span className="hd-km">{p.km} km</span></header>
      <div className="hd-heat" role="table" aria-label={`How full ${p.name} usually is`}>
        <div role="row" className="hh-row hh-head"><span />{starts.map((s) => <span key={s} role="columnheader">{s.slice(0, 2)}</span>)}</div>
        {days.map((d) => (
          <div role="row" className="hh-row" key={d}><span role="rowheader">{DAYS[dayOf(d).getDay()]}</span>
            {starts.map((s) => { const c = cell(d, s); return <span key={s} role="cell" className="hh-c" style={c ? { "--b": c.busy } : undefined} title={c ? `${DAYS[dayOf(d).getDay()]} ${s}: usually ${pct(c.busy)} full` : "past"}>{c ? "" : "·"}</span>; })}
          </div>
        ))}
      </div>
      <p className="hd-quiet">Quietest: {p.quiet.map((q) => `${DAYS[dayOf(q.date).getDay()]} ${q.start} (${pct(q.busy)})`).join(", ")}</p>
      {o && (
        <div className="hd-offer">
          <p><b>{o.off ? `NT$${o.price} instead of NT$${o.list}` : `NT$${o.list}, the list price`}</b> for a court for 90 minutes, {DAYS[dayOf(p.at.date).getDay()]} {p.at.start} ({pct(o.busy)} full usually){o.each ? `, NT$${o.each} each for 4` : ""}. List NT${p.list} an hour. An offer for now: for a game, your agent asks the venue again with that game's players, so the price can move a little.</p>
          <div className="cta-row">
            <a className="btn primary sm" href={`#/huddle?sport=${encodeURIComponent(sport)}&date=${p.at.date}&start=${p.at.start}&place=${encodeURIComponent(p.id)}`}>Get a game then</a>
            <button className="btn ghost sm" onClick={() => setShow(!show)}>{show ? "Hide the talk" : "How the agents got there"}</button>
          </div>
          {show && <ol className="hd-talk sm">{o.lines.map((l, i) => <li key={i} className={l.from === "Your agent" ? "t-me" : "t-venue"}><span className="hd-who-l">{l.from}</span><p>{l.text}</p></li>)}</ol>}
        </div>
      )}
      {p.kind === "public" && <p className="hd-fine">Free to use; the quiet hours are the ones to aim for.</p>}
    </article>
  );
}

// ---- how you play ----
const PARTS = ["early", "morning", "afternoon", "evening"];
// the person's hard limits and their standing yes: set here, by them (their agent can only tighten limits)
const WIN = {
  any: { label: "Any time", v: null },
  evenings: { label: "Weekday evenings (18:00–22:00)", v: [{ days: WEEKDAYS, from: "18:00", to: "22:00" }] },
  mornings: { label: "Weekday mornings (07:00–12:00)", v: [{ days: WEEKDAYS, from: "07:00", to: "12:00" }] },
  weekends: { label: "Weekends (08:00–20:00)", v: [{ days: ["Sat", "Sun"], from: "08:00", to: "20:00" }] },
  both: { label: "Weekday evenings and weekends", v: [{ days: WEEKDAYS, from: "18:00", to: "22:00" }, { days: ["Sat", "Sun"], from: "08:00", to: "20:00" }] },
};
const winKey = (ws) => (!ws?.length ? "any" : Object.keys(WIN).find((k) => JSON.stringify(WIN[k].v) === JSON.stringify(ws.map((w) => ({ days: w.days, from: w.from, to: w.to })))) || "keep");
function Limits({ t, onSaved }) {
  const d = t.delegate;
  const [win, setWin] = useState(winKey(t.windows)), [km, setKm] = useState(t.limitKm ?? ""), [each, setEach] = useState(t.limitEach ?? "");
  const [on, setOn] = useState(!!d?.on), [dEach, setDEach] = useState(d?.maxEach ?? ""), [newPeople, setNewPeople] = useState(!!d?.newPeople);
  const [busy, setBusy] = useState(false), [said, setSaid] = useState(""), [err, setErr] = useState("");
  // what they said in their own words, offered (not saved) as limits
  const words = saidWords(), wWin = /weekday evening|weeknight|平日晚上/i.test(words) ? "evenings" : /weekday morning|平日早上/i.test(words) ? "mornings" : /weekend|週末|周末/i.test(words) ? "weekends" : null, wEach = eachFromText(words);
  const offer = (wWin && wWin !== win) || (wEach != null && String(wEach) !== String(each));
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(""); setSaid("");
    try {
      await H.setLimits({ ...(win === "keep" ? {} : { windows: WIN[win].v }), maxKm: km === "" ? null : +km, maxEach: each === "" ? null : +each });
      const r = await H.setDelegate(on ? { on: true, maxEach: dEach === "" ? null : +dEach, newPeople } : { on: false });
      setSaid("Saved. Nothing outside these is ever agreed for you."); onSaved(r.taste);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form className="panel hd-limits" aria-label="Your limits" onSubmit={save}>
      <h2 className="h3">Your limits</h2>
      <p className="hd-fine">Hard limits: your agent never agrees to a game outside them.</p>
      {offer && <p className="hd-offer">You said “{words.slice(0, 80)}”. <button type="button" className="link" onClick={() => { if (wWin) setWin(wWin); if (wEach != null) setEach(String(wEach)); }}>Use {[wWin && WIN[wWin].label.toLowerCase(), wEach != null && `NT$${wEach} at most`].filter(Boolean).join(", ")}</button>, then Save.</p>}
      <label>Times<select value={win} onChange={(e) => setWin(e.target.value)}>{win === "keep" && <option value="keep">As set before</option>}{Object.entries(WIN).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}</select></label>
      <label>Farthest<span className="hd-unit"><input type="number" min="1" max="30" step="0.5" inputMode="decimal" placeholder="no limit" value={km} onChange={(e) => setKm(e.target.value)} />km</span></label>
      <label>Most per person<span className="hd-unit">NT$<input type="number" min="0" max="5000" step="10" inputMode="numeric" placeholder="no limit" value={each} onChange={(e) => setEach(e.target.value)} /></span></label>
      <h3 className="h4">Your agent saying yes for you</h3>
      <label className="hd-check"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />Let my agent say yes for me, within my limits</label>
      {on && <>
        <label>Only games up to<span className="hd-unit">NT$<input type="number" min="0" max="5000" step="10" inputMode="numeric" placeholder="any price" value={dEach} onChange={(e) => setDEach(e.target.value)} />each</span></label>
        <label className="hd-check"><input type="checkbox" checked={newPeople} onChange={(e) => setNewPeople(e.target.checked)} />Also with people who are new (no record yet)</label>
      </>}
      <button className="btn primary sm" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      {said && <p className="tq-said" role="status">{said}</p>}
      {err && <p className="join-err" role="alert">{err}</p>}
    </form>
  );
}
// a part of the day inside the person's time limits (none set: all of it)
const PART_HOURS = { early: ["06:00", "09:00"], morning: ["09:00", "12:00"], afternoon: ["12:00", "17:00"], evening: ["17:00", "23:00"] };
const inWins = (ws, d, part) => !ws?.length || ws.some((w) => w.days.includes(d) && w.from < PART_HOURS[part][1] && w.to > PART_HOURS[part][0]);
function TasteTab({ me, reload }) {
  const [q, setQ] = useState(null), [t, setT] = useState(me.taste), [busy, setBusy] = useState(false), [mine, setMine] = useState(null), [err, setErr] = useState("");
  const ask = () => H.question().then((r) => setQ(r.question), () => {});
  const [chain, setChain] = useState(null);
  const [explain, setExplain] = useState([]);
  useEffect(() => { ask(); H.trust().then((r) => { setMine(r.trust); setChain(r.chain); setExplain(r.explain || []); }, () => {}); }, []);
  const w = t.weights;
  return (
    <div className="hd-taste">
      <section className="panel">
        <div className="hd-sure"><span style={{ "--p": t.sure }} /><em>{t.answers >= 5 ? "Your agent knows enough to answer for you" : `${t.answers} of 5 answers: your agent still checks with you`}</em></div>
        <p className="hd-summary">{t.summary}</p>
        <TasteQuestion q={q} onAnswered={(r) => { setT(r.taste); setTimeout(ask, 900); }} />
      </section>
      <section className="panel hd-weights" aria-label="What matters to you">
        <h2 className="h3">What matters to you</h2>
        {Object.keys(FACTOR).map((k) => <div key={k} className="hw-row"><span>{FACTOR[k]}</span><span className="hw-bar"><i style={{ width: pct(w[k]) }} /></span><b>{pct(w[k])}</b></div>)}
        <p className="hd-fine">Within about {t.maxKm} km{w.price > 0.2 ? `, aiming under NT$${t.priceCap} each` : ""}.</p>
      </section>
      <Limits t={t} onSaved={(x) => { setT(x); reload(); }} />
      <section className="panel" aria-label="Your times">
        <h2 className="h3">Your times</h2>
        <div className="hd-heat hd-week">
          <div className="hh-row hh-head"><span />{PARTS.map((x) => <span key={x}>{x}</span>)}</div>
          {DAYS.map((d) => <div className="hh-row" key={d}><span>{d}</span>{PARTS.map((x) => inWins(t.windows, d, x) ? <span key={x} className="hh-c good" style={{ "--b": t.grid[`${d} ${x}`] }} title={`${d} ${x}: ${pct(t.grid[`${d} ${x}`])}`} /> : <span key={x} className="hh-c off" title={`${d} ${x}: outside your limits`} />)}</div>)}
        </div>
        <p className="hd-fine">Darker is better for you{t.windows?.length ? "; grey is outside your limits" : ""}. Until you answer, your agent assumes what suits most people who work or study: weekday evenings and weekend mornings.</p>
      </section>
      <section className="panel hd-set" aria-label="Your records">
        <h2 className="h3">What other agents see about you</h2>
        {mine && <TrustBadge t={mine} />}
        {explain.length > 0 && <ul className="hd-lines">{explain.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        <p className="hd-fine">Shows up: after each game the other players tap who came; leaving in the last six hours counts as a late drop. Your agent: how often you said yes when it had said yes for you. Both stay "new" until there are three to count.</p>
        {chain && <Chain c={chain} />}
        <label className="hd-check"><input type="checkbox" checked={!!t.open} onChange={async (e) => { setErr(""); try { const r = await H.setOpen(e.target.checked); setT(r.taste); } catch (x) { setErr(x.message); } }} />
          <span><b>Let people nearby ask my agent</b><em>Other members' agents within about 5 km can ask yours for a game; your agent answers the way you would, and you say yes once</em></span></label>
        {err && <p className="join-err" role="alert">{err}</p>}
      </section>
      <section className="panel hd-set">
        <h2 className="h3">Sports you play</h2>
        <div className="hd-people">{H.SPORTS.map((s) => <button key={s} className={t.sports.includes(s) ? "on" : ""} aria-pressed={t.sports.includes(s)} onClick={async () => { const n = t.sports.includes(s) ? t.sports.filter((x) => x !== s) : [...t.sports, s]; const r = await H.setSports(n); setT(r.taste); reload(); }}>{s}</button>)}</div>
        {t.learned.length > 0 && <><h2 className="h3">What your agent learned lately</h2><ul className="hd-lines">{t.learned.map((l, i) => <li key={i}>{l.text}</li>)}</ul></>}
        <div className="cta-row">
          <button className="btn ghost sm" disabled={busy} onClick={async () => { setBusy(true); await H.shareHome().catch(() => {}); reload(); setBusy(false); }}><Icon name="pin" size={16} />{t.home ? "Update my area" : "Share my area"}</button>
          <button className="btn ghost sm" disabled={busy} onClick={async () => { if (!confirm("Forget what your agent learned about how you play?")) return; const r = await H.reset(); setT(r.taste); ask(); }}>Start over</button>
        </div>
      </section>
    </div>
  );
}

// the member's records on the trust chain (agent members/trust.js): every entry carries the hash of the one before, the
// gateway signs the head each day with its Agent Card key, and anyone can replay it from /api/trust/chain
const KIND = { promise: (d) => (d.kept ? "Your agent said yes for you, and you did too" : "Your agent said yes for you, and you said no"), game: (d) => (d.came ? "The other players say you came" : "The other players say you didn't come"), late: () => "Left a game in its last six hours", asked: (d) => `Your agent asked ${d.n} people nearby`, sig: () => "A request with your agent's key failed its check", seed: () => "Test record", carried: () => "Record from before the chain", left: () => "Left Serve" };
function Chain({ c }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hd-chain">
      <p><span className={c.ok ? "hd-ok" : "hd-bad"}>{c.ok ? "✓ Your records can't be quietly changed" : "✗ Something in the records doesn't check out"}</span></p>
      <p className="hd-fine">Your records are worked out from a chain no one can quietly change: every entry carries the hash of the one before it, and the server signs the chain's end each day with its own key. You appear on it only as {c.subject}, never by name. Anyone can check it at <a href={`${AGENT_URL}/api/trust/chain`} target="_blank" rel="noreferrer">/api/trust/chain</a>.</p>
      <button className="link" onClick={() => setOpen(!open)}>{open ? "Hide the details" : "Details"}</button>
      {open && <p className="hd-fine">{c.ok ? `${c.n} entries on the chain; the last hash is ${String(c.head).slice(0, 12)}…` : c.why}</p>}
      {open && <ol className="hd-lines">{c.entries.map((e) => <li key={e.n}>#{e.n} · {new Date(e.at).toLocaleDateString()} · {(KIND[e.kind] || (() => e.kind))(e.d || {})} <code>{e.hash.slice(0, 10)}</code></li>)}</ol>}
    </div>
  );
}
