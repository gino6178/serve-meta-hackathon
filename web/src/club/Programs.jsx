import { useState } from "react";
import { agentFetch } from "../agent.js";

// A club's program on its page (agent members/programs.js): gentle games for older adults, children's sessions run by
// a teacher or volunteer, a charity tournament. The server holds every rule; this shows them and asks.
export const KINDS = [
  ["club", "Club", "Members post games"],
  ["seniors", "Gentle games", "Older adults: doubles, daytime, 60 min"],
  ["youth", "Children", "A teacher or volunteer runs it; private"],
  ["charity", "Charity cup", "A tournament for a cause"],
];
const call = async (path, body) => {
  const r = await agentFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.refused) throw new Error(j.why || j.error || `The server answered ${r.status}.`);
  return j;
};
async function shareText(text) {
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e?.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(text); } catch { window.prompt("Copy this", text); }
}

export default function Program({ c, onChange }) {
  if (c.kind === "seniors") return <Gentle g={c.gentle} />;
  if (c.kind === "youth") return <Children c={c} onChange={onChange} />;
  if (c.kind === "charity") return <Charity c={c} onChange={onChange} />;
  return null;
}

function Gentle({ g }) {
  return (
    <section className="panel pg pg-gentle" aria-label="Gentle games">
      <b>Gentle games</b>
      <p>Every game here is doubles for racket sports, {g.minutes} minutes, starting {g.from} to {g.last}, {g.spots} players at most. Your agent keeps to it.</p>
    </section>
  );
}

// ---- children's sessions ----
function Children({ c, onChange }) {
  const mine = c.mine, [err, setErr] = useState("");
  return (
    <section className="panel pg" aria-label="Children's sessions">
      <b>Children's sessions</b>
      {mine ? <Organiser c={c} onChange={onChange} setErr={setErr} /> : !c.plan && <p className="muted">The organiser's plan for the next session shows here.</p>}
      {c.plan && <Plan plan={c.plan} />}
      {err && <p className="join-err" role="alert">{err}</p>}
    </section>
  );
}
function Organiser({ c, onChange, setErr }) {
  const [names, setNames] = useState((c.roster || []).join(", ")), [edit, setEdit] = useState(!(c.roster || []).length);
  const [here, setHere] = useState(() => new Set(c.roster || [])), [busy, setBusy] = useState(false);
  const [s, setS] = useState({ day: "Sat", start: "09:00", end: "11:00", courts: 2, perCourt: 4, minutes: 15 });
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const run = async (f) => { setBusy(true); setErr(""); try { onChange((await f()).club); } catch (e) { setErr(e.message); } setBusy(false); };
  const saveRoster = () => run(async () => { const r = await call("/api/clubs/roster", { club: c.id, names }); setHere(new Set(r.club.roster)); setEdit(false); return r; });
  const toggle = (k) => setHere((x) => { const y = new Set(x); y.has(k) ? y.delete(k) : y.add(k); return y; });
  if (edit) return (
    <div className="pg-form">
      <label className="pg-l">Your group's first names, only you see them<textarea rows={3} value={names} onChange={(e) => setNames(e.target.value)} placeholder="Mia, Leo, Kai…" /></label>
      <button className="btn primary sm" disabled={busy} onClick={saveRoster}>Save the list</button>
    </div>
  );
  return (
    <div className="pg-form">
      <span className="pg-l">Who came today <button className="link" onClick={() => setEdit(true)}>Edit the list</button></span>
      <div className="pg-chips">{(c.roster || []).map((k) => <button key={k} className={here.has(k) ? "on" : ""} aria-pressed={here.has(k)} onClick={() => toggle(k)}>{k}</button>)}</div>
      <div className="pg-row">
        <label>Day<input value={s.day} onChange={set("day")} maxLength={12} /></label>
        <label>From<input type="time" value={s.start} onChange={set("start")} /></label>
        <label>To<input type="time" value={s.end} onChange={set("end")} /></label>
        <label>Courts<input type="number" min={1} max={12} value={s.courts} onChange={set("courts")} /></label>
        <label>Each court<input type="number" min={2} max={12} value={s.perCourt} onChange={set("perCourt")} /></label>
        <label>Turns of (min)<input type="number" min={5} max={60} value={s.minutes} onChange={set("minutes")} /></label>
      </div>
      <button className="btn primary sm" disabled={busy || !here.size} onClick={() => run(() => call("/api/clubs/session", { club: c.id, present: [...here], ...s }))}>Share out the courts</button>
    </div>
  );
}
function Plan({ plan }) {
  return (
    <div className="pg-plan">
      <p className="pg-note">{plan.note} <button className="btn ghost sm" onClick={() => shareText(plan.note)}>Send to parents</button></p>
      <ol className="pg-rot">
        {plan.rotations.map((r) => (
          <li key={r.at}><b>{r.at}</b>{r.courts.map((g, i) => <span key={i}>Court {i + 1}: {g.join(", ")}</span>)}{r.resting.length > 0 && <em>Resting: {r.resting.join(", ")}</em>}</li>
        ))}
      </ol>
      <p className="tiny muted">Everyone plays {Math.min(...Object.values(plan.played))} to {Math.max(...Object.values(plan.played))} minutes.</p>
    </div>
  );
}

// ---- charity tournament ----
function Charity({ c, onChange }) {
  const [lv, setLv] = useState(c.entry?.level || 3), [pledge, setPledge] = useState(c.entry?.pledge ?? 100), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [d, setD] = useState({ courts: 2, start: "09:00", minutes: 20 });
  const run = async (f) => { setBusy(true); setErr(""); try { onChange((await f()).club); } catch (e) { setErr(e.message); } setBusy(false); };
  return (
    <section className="panel pg" aria-label="Charity tournament">
      <b>For {c.cause}</b>
      <p className="pg-total"><span>{c.entrants} player{c.entrants === 1 ? "" : "s"}</span><span>{c.pledged.toLocaleString()} pledged</span></p>
      <p className="tiny muted">A pledge is your promise to the cause; you give it to them directly. Serve handles no money.</p>
      {!c.draw && (
        <div className="pg-row">
          <label>Your level<select value={lv} onChange={(e) => setLv(+e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}{n === 1 ? " new" : n === 5 ? " strong" : ""}</option>)}</select></label>
          <label>You pledge<input type="number" min={0} max={100000} value={pledge} onChange={(e) => setPledge(e.target.value)} /></label>
          <button className="btn primary sm" disabled={busy} onClick={() => run(() => call("/api/clubs/enter", { club: c.id, level: lv, pledge }))}>{c.entry ? "Update my entry" : "Enter"}</button>
          {c.entry && <button className="btn ghost sm" disabled={busy} onClick={() => run(() => call("/api/clubs/enter", { club: c.id, on: false }))}>Withdraw</button>}
        </div>
      )}
      {c.mine && !c.draw && (
        <div className="pg-row">
          <label>Courts<input type="number" min={1} max={12} value={d.courts} onChange={(e) => setD({ ...d, courts: e.target.value })} /></label>
          <label>Starts<input type="time" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} /></label>
          <label>Match (min)<input type="number" min={10} max={60} value={d.minutes} onChange={(e) => setD({ ...d, minutes: e.target.value })} /></label>
          <button className="btn primary sm" disabled={busy || c.entrants < 4} onClick={() => run(() => call("/api/clubs/draw", { club: c.id, ...d }))}>Make the draw</button>
        </div>
      )}
      {c.draw && <Draw draw={c.draw} />}
      {err && <p className="join-err" role="alert">{err}</p>}
    </section>
  );
}
function Draw({ draw }) {
  const team = Object.fromEntries(draw.teams.map((t) => [t.id, t.players.join(" & ")]));
  return (
    <div className="pg-plan">
      <p><b>The draw</b> · {draw.teams.length} teams, {draw.matches.length} match{draw.matches.length === 1 ? "" : "es"}, {draw.start} to {draw.end}{draw.waiting.length ? ` · waiting for a partner: ${draw.waiting.join(", ")}` : ""}</p>
      <ol className="pg-rot">{draw.matches.map((m, i) => <li key={i}><b>{m.at}</b><span>Court {m.court}: {team[m.a]} v {team[m.b]}</span></li>)}</ol>
    </div>
  );
}
