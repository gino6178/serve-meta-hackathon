import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";
import RealMap from "../components/RealMap.jsx";
import Feed from "../club/Feed.jsx";
import { InviteComposer } from "./Social.jsx";
import { agentFetch } from "../agent.js";
import { knownPlace, myPlace } from "../where.js";
import ClubSuggest from "../components/ClubSuggest.jsx";
import "./clubs.css";

// Clubs members start themselves (agent members/clubs.js): the clubs near you on a real map, your own first, a club of
// your own in a few taps, and each club with its own games and posts (#/club?room=<id>). The demo club stays at
// #/club?tab=feed.
const SPORTS = ["badminton", "tennis", "pickleball", "table tennis", "basketball", "volleyball", "soccer", "squash", "running"];
const call = async (path, body) => {
  const r = await agentFetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.refused) throw new Error(j.why || j.error || `The server answered ${r.status}.`);
  return j;
};
const roomOf = () => new URLSearchParams(location.hash.split("?")[1] || "").get("room");

export default function Clubs() {
  const [room, setRoom] = useState(roomOf);
  useEffect(() => { const on = () => setRoom(roomOf()); addEventListener("hashchange", on); return () => removeEventListener("hashchange", on); }, []);
  return room ? <ClubRoom id={room} /> : <ClubsHome />;
}

function ClubsHome() {
  const [clubs, setClubs] = useState(null), [err, setErr] = useState(""), [starting, setStarting] = useState(false);
  const load = async () => {
    const p = knownPlace() || await myPlace();
    try { setClubs((await call(`/api/clubs${p ? `?lat=${p.lat}&lon=${p.lon}` : ""}`)).clubs); } catch (e) { setErr(e.message); setClubs([]); }
  };
  useEffect(() => { load(); }, []);
  const open = (c) => { location.hash = `/club?room=${c.id}`; };
  return (
    <div className="page clubs">
      <header className="cl-head"><h1 className="h1">Clubs</h1><button className="btn primary sm" onClick={() => setStarting((x) => !x)}><Icon name="plus" size={16} />Start a club</button></header>
      {starting && <StartClub onDone={(c) => { setStarting(false); if (c) open(c); }} />}
      <ClubSuggest />
      <RealMap courts={false} height={260} marks={(clubs || []).map((c) => ({ id: c.id, name: c.name, lat: c.at.lat, lon: c.at.lon, mine: c.joined }))} onMark={(p) => open(p)} />
      {err && <p className="join-err" role="alert">{err}</p>}
      <ul className="cl-list">
        {(clubs || []).map((c) => (
          <li key={c.id}><a href={`#/club?room=${c.id}`}>
            <span className="cl-sport">{c.sport}</span>
            <span className="cl-main"><b>{c.name}{c.privacy === "private" && <span className="cl-lock"> · Private</span>}</b><span>{c.members} member{c.members === 1 ? "" : "s"}{c.km != null ? ` · ${c.km} km` : ""}{c.joined ? " · joined" : ""}</span></span>
            <Icon name="next" size={16} />
          </a></li>
        ))}
        <li><a href="#/club?tab=feed">
          <span className="cl-sport">demo</span>
          <span className="cl-main"><b>Riverside Sports Club</b><span>The demo club, with simulated members</span></span>
          <Icon name="next" size={16} />
        </a></li>
      </ul>
      {clubs && !clubs.length && !err && <p className="cl-empty">No clubs near you yet. Start the first one.</p>}
    </div>
  );
}

function StartClub({ onDone }) {
  const [v, setV] = useState({ name: "", sport: "badminton", about: "", where: "", at: null, privacy: "public" }), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { onDone((await call("/api/clubs", v)).club); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form className="panel cl-start" onSubmit={send}>
      <input value={v.name} onChange={set("name")} placeholder="Club name" required minLength={3} maxLength={40} aria-label="Club name" />
      <select value={v.sport} onChange={set("sport")} aria-label="Sport">{SPORTS.map((s) => <option key={s}>{s}</option>)}</select>
      <div className="cl-privacy" role="radiogroup" aria-label="Who can see the club">
        {[["public", "Public", "Anyone sees and joins"], ["private", "Private", "You approve who joins"]].map(([k, l, d]) => (
          <button type="button" key={k} role="radio" aria-checked={v.privacy === k} className={v.privacy === k ? "on" : ""} onClick={() => setV({ ...v, privacy: k })}><b>{l}</b><span>{d}</span></button>
        ))}
      </div>
      <input value={v.about} onChange={set("about")} placeholder="One line about it (optional)" maxLength={160} aria-label="About the club" />
      <span className="cl-where-l">Where you play: tap a court or a spot</span>
      <RealMap sport={v.sport} pick height={220} onPick={(p) => setV((x) => ({ ...x, at: { lat: p.lat, lon: p.lon }, where: p.name || x.where }))} />
      <input value={v.where} onChange={set("where")} placeholder="Name the place" maxLength={60} aria-label="The place's name" />
      {err && <p className="join-err" role="alert">{err}</p>}
      <div className="cta-row"><button className="btn primary sm" disabled={busy || !v.at}>{busy ? "Starting…" : "Start the club"}</button><button type="button" className="btn ghost sm" onClick={() => onDone(null)}>Cancel</button></div>
    </form>
  );
}

function ClubRoom({ id }) {
  const [c, setC] = useState(null), [err, setErr] = useState(""), [n, setN] = useState(0), [busy, setBusy] = useState(false);
  const load = async () => {
    try { const cs = (await call("/api/clubs")).clubs; const x = cs.find((k) => k.id === id); if (!x) throw new Error("This club is no longer here."); setC(x); } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const join = async (on) => { setBusy(true); try { const r = await call("/api/clubs/join", { club: id, on }); if (!r.club) location.hash = "/club"; else setC({ ...c, ...r.club }); } catch (e) { setErr(e.message); } setBusy(false); };
  const answer = async (member, yes) => { try { const r = await call("/api/clubs/answer", { club: id, member, yes }); setC({ ...c, ...r.club }); } catch (e) { setErr(e.message); } };
  const shut = c?.privacy === "private" && !c?.joined;
  if (err) return <div className="page clubs"><a className="link" href="#/club">All clubs</a><p className="join-err" role="alert">{err}</p></div>;
  if (!c) return <div className="page clubs"><p className="muted">Opening the club…</p></div>;
  return (
    <div className="page clubs">
      <a className="link cl-back" href="#/club"><Icon name="back" size={16} />All clubs</a>
      <header className="cl-room-head">
        <div><span className="cl-sport">{c.sport}</span><h1 className="h1">{c.name}</h1>{c.about && <p className="cl-about">{c.about}</p>}
          <p className="cl-meta">{c.members} member{c.members === 1 ? "" : "s"}: {c.names.join(", ")}</p></div>
        {c.joined ? <button className="btn ghost sm" disabled={busy} onClick={() => join(false)}>Leave</button>
          : c.asked ? <button className="btn ghost sm" disabled={busy} onClick={() => join(false)}>Asked · cancel</button>
          : <button className="btn primary sm" disabled={busy} onClick={() => join(true)}>{c.privacy === "private" ? "Ask to join" : "Join"}</button>}
      </header>
      <RealMap courts={false} height={180} marks={[{ id: c.id, name: c.where, lat: c.at.lat, lon: c.at.lon }]} />
      {c.requests?.length > 0 && (
        <section className="panel cl-requests" aria-label="Asked to join">
          <b>Asked to join</b>
          {c.requests.map((r) => <div key={r.id} className="cl-req"><span>{r.name}</span><button className="btn primary sm" onClick={() => answer(r.id, true)}>Let in</button><button className="btn ghost sm" onClick={() => answer(r.id, false)}>No</button></div>)}
        </section>
      )}
      {/* a public club: everyone sees the games and posts, and posting joins; a private one: its members only */}
      {shut ? <p className="cl-empty">A private club: its games and posts are for members. {c.asked ? "The owner will answer your ask." : "Ask to join."}</p> : <>
        <InviteComposer room={c.id} sport={c.sport} highlight={false} onPosted={() => { setN((k) => k + 1); load(); }} />
        <Feed key={n} room={c.id} club={null} members={[]} />
      </>}
    </div>
  );
}
