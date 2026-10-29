import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { agentBodyRead, agentBodyReport, agentBodyContext, agentHealthImport } from "../agent.js";
import { useBody, seedBody, addEntries, mergeImport, bodyInput } from "../club/body.js";
import { autopilotInput } from "../tasks.js";
import { go } from "../App.jsx";
import "./body.css";

// Body: you tell your agent what hurts or how you feel (here, in Messenger or as a voice note) and it keeps your words. Your health app's
// export (Apple Health, Google Fit, or a GPX, TCX or CSV from any app) fills in your workouts, routes, heart rate and
// sleep; the agent links them to your booked games and works out your load. From all of it the agent decides, by
// code with the reasons shown: doubles first while a knee is sore, shorter games for a sore back, one game fewer in
// a week far over your usual load, a check-in two days later, and when it is worth seeing a physio. What it knows is
// found by meaning for this week's plan (Meta's DRAMA on your server, recent notes weighted more: agent body/context.js),
// and every rule shows the notes it comes from. It records; it does not diagnose.
const SRC = { body: ["chat", "You said"], health: ["heart", "Games and health app"], game: ["clock", "From your watch"], said: ["memory", "You told your agent"] };
const ACT = { limit: ["verify", "Limit"], cap: ["clock", "Game length"], physio: ["warn", "See a physio"], load: ["goals", "Load"], learned: ["heart", "From your watch"], follow: ["chat", "Check-in"] };
const SPORTS = ["badminton", "running", "tennis", "pickleball", "basketball"]; // fixed colour slots, by sport
const colorOf = (s) => (SPORTS.includes(s) ? `var(--vz-${SPORTS.indexOf(s) + 1})` : "var(--vz-other)");
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const day = (iso) => new Date(iso.length > 10 ? iso : `${iso}T12:00:00`);
const short = (iso) => { const d = day(iso); return `${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
const TREND = { new: "new", better: "getting better", worse: "getting worse", same: "about the same" };

export default function Body() {
  const store = useBody();
  const [club, setClub] = useState(null);
  const [org, setOrg] = useState(null), [err, setErr] = useState("");
  const [text, setText] = useState(""), [sending, setSending] = useState(false), [said, setSaid] = useState(null);
  const [sel, setSel] = useState(null), [ctx, setCtx] = useState(null);
  useEffect(() => { fetch("/data/club.json").then((r) => r.json()).then((c) => { seedBody(c); setClub(c); }).catch(() => setErr("The club data could not be loaded.")); }, []);
  const input = useMemo(() => club && bodyInput(club, autopilotInput().history), [club, store]);
  useEffect(() => {
    if (!input) return;
    let live = true;
    agentBodyReport({ ...input, summary: false }).then((r) => { if (live) { setOrg(r.org); setErr(""); } }).catch((e) => live && setErr(`Your agent is offline (${e.message}).`));
    agentBodyContext(input).then((r) => live && setCtx(r)).catch(() => live && setCtx(null));
    return () => { live = false; };
  }, [input]);

  const send = async (t = text) => {
    if (!t.trim() || !input) return;
    setSending(true); setSaid({ text: t, reply: null });
    try {
      const r = await agentBodyRead({ ...input, text: t });
      if (r.entries.length) addEntries(r.entries);
      setSaid({ text: t, reply: r.reply, by: r.by, n: r.entries.length });
      setText("");
      const k = r.entries[0]; if (k) setSel(`${k.part}${k.side ? ":" + k.side : ""}`);
    } catch (e) { setSaid({ text: t, reply: `Your agent is offline (${e.message}).`, by: "error" }); }
    setSending(false);
  };
  const asked = useRef(false); // said on the agent home: filed as soon as the page has the data
  useEffect(() => { const m = /[?&]say=([^&]+)/.exec(location.hash); if (input && m && !asked.current) { asked.current = true; send(decodeURIComponent(m[1])); } }, [input]);

  const parts = org?.parts || [];
  const cur = parts.find((p) => p.key === sel) || parts.find((p) => p.active) || parts[0];

  return (
    <div className="page body-page">
      <header className="report-head">
        <div>
          <span className="tag">Your body · found by meaning with Meta's DRAMA</span>
          <h1 className="h1">What your agent knows about your body</h1>
        </div>
        <div className="cta-row">
          <a className="btn" href="#bd-report"><Icon name="table" size={18} />Body report</a>
          <button className="btn primary" onClick={() => go("autopilot?run=1")}><Icon name="spark" size={18} />Plan my week around it</button>
        </div>
      </header>
      {err && <p className="bd-err" role="alert"><Icon name="warn" size={16} />{err}</p>}

      <div className="bd-top">
        <div className="bd-side">
          <section className="panel bd-tell" aria-labelledby="tell-h">
            <h2 id="tell-h" className="panel-h">Tell your agent</h2>
            <form onSubmit={(e) => { e.preventDefault(); send(); }}>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="How you feel, where it hurts, since when" aria-label="What hurts"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button className="btn primary sm" disabled={sending || !text.trim()}>{sending ? "Filing…" : "Tell"}</button>
            </form>
            {said && (
              <div className="bd-said" aria-live="polite">
                <p className="bd-you">{said.text}</p>
                {said.reply ? <div className="bd-agent">{said.reply.split("\n").map((l, i) => <p key={i}>{l}</p>)}
                  {said.by !== "error" && <span className="tiny muted">{said.by === "model" ? "Read by Muse Glimmer, checked by code" : "Read by the word list"}</span>}</div>
                  : <p className="bd-agent working"><span className="dots"><i /><i /><i /></span>Muse Glimmer is reading it</p>}
              </div>
            )}
          </section>

          <section className="panel bd-ctx" aria-labelledby="ctx-h">
            <h2 id="ctx-h" className="panel-h">What matters this week</h2>
            {ctx?.top?.length ? (
              <ul className="bd-notes">
                {ctx.top.filter((n) => !/load|^Week of/i.test(n.text)).map((n) => <li key={n.id}><span className={`bd-src ${n.kind}`}><Icon name={SRC[n.kind]?.[0] || "info"} size={15} /></span>
                  <span><span>{n.text}</span><span className="tiny muted">{SRC[n.kind]?.[1]} · {short(n.on)}</span></span>
                  <span className="bd-sim" title={`Similarity to this week's plan: ${n.raw} (DRAMA), ${n.score} after its age`}>{n.score.toFixed(2)}</span></li>)}
              </ul>
            ) : <p className="muted small">{ctx ? "Nothing yet: tell your agent how you feel." : err ? "This shows once your agent is reachable." : "Loading…"}</p>}
            {ctx && <span className="bd-by"><Icon name="memory" size={13} />{ctx.by === "drama" ? "Meta DRAMA · by meaning" : "By words"} · {ctx.all.length} notes</span>}
          </section>
        </div>

        <section className="panel bd-rules" aria-labelledby="do-h">
          <h2 id="do-h" className="panel-h">This week's rules</h2>
          {(ctx?.rules || org?.actions?.filter((a) => a.kind !== "follow"))?.length ? (
            <ul className="bd-acts">
              {(ctx?.rules || org.actions.filter((a) => a.kind !== "follow")).map((a, i) => <li key={i} className={a.kind}><span className="bd-act-ic"><Icon name={ACT[a.kind]?.[0] || "info"} size={16} /></span>
                <span><b>{ACT[a.kind]?.[1]}</b><span>{a.text}</span>
                  {a.cites?.length ? <span className="bd-cites">{a.cites.map((c) => <span key={c.id} className="bd-cite" title={c.text}><Icon name={SRC[c.kind]?.[0] || "info"} size={12} />{SRC[c.kind]?.[1]}, {short(c.on)}</span>)}</span>
                    : <span className="tiny muted">Why: {a.why}</span>}</span></li>)}
            </ul>
          ) : <p className="muted small">{org ? "No limits this week." : err ? "This shows once your agent is reachable." : "Loading…"}</p>}
          {org?.followUps?.filter((f) => !f.due).map((f) => <p key={f.key} className="bd-follow small"><Icon name="chat" size={14} />I'll ask about your {f.name} on {short(f.date)}.</p>)}
        </section>
      </div>

      <section className="panel bd-log" aria-labelledby="log-h">
        <h2 id="log-h" className="panel-h">Your body log, the last two weeks</h2>
        {parts.length ? <ul className="bd-parts">{parts.map((p) => <PartRow key={p.key} p={p} today={org.today} on={cur?.key === p.key} pick={() => setSel(p.key)} />)}</ul>
          : <p className="muted small">Nothing logged yet.</p>}
      </section>

      <HealthData store={store} />
    </div>
  );
}

// one part: its entries as dots over the last 14 days, each with its level
function PartRow({ p, today, on, pick }) {
  const days = Array.from({ length: 14 }, (_, i) => { const d = day(today); d.setDate(d.getDate() - 13 + i); return d.toISOString().slice(0, 10); });
  return (
    <li className={on ? "on" : ""}>
      <button onClick={pick} aria-label={`${p.name}: select`}>
        <span className="bd-pn"><b>{cap(p.name)}</b><span className="tiny muted">{TREND[p.trend]}{p.physio ? " · worth seeing a physio" : ""}</span></span>
        <span className="bd-dots" aria-hidden="true">
          {days.map((d) => { const e = [...p.entries].reverse().find((x) => x.at.slice(0, 10) === d); return <i key={d} className={e ? `l${e.kind === "fine" ? 0 : e.level}` : ""} title={e ? `${short(d)}: ${e.kind === "fine" ? "fine" : `${e.kind} ${e.level}/5`}` : short(d)}>{e ? (e.kind === "fine" ? "✓" : e.level) : ""}</i>; })}
        </span>
        <span className={`bd-lv l${p.latest.kind === "fine" ? 0 : p.latest.level}`}>{p.latest.kind === "fine" ? "fine" : `${p.latest.level}/5`}</span>
      </button>
    </li>
  );
}

const segsOf = (w) => Object.keys(w.sports).length;

const baseCache = new Map();
function HealthData({ store }) {
  const [busy, setBusy] = useState(null), [fail, setFail] = useState("");
  const run = async (file) => {
    if (!file) return;
    setBusy({ name: file.name, steps: [], working: "Sending to your server" }); setFail("");
    try {
      const r = await agentHealthImport(file, (e) => setBusy((b) => b && (e.type === "step" ? { ...b, steps: [...b.steps, e] } : { ...b, working: e.step })));
      mergeImport(r);
      setBusy(null);
    } catch (e) { setFail(e.message); setBusy(null); }
  };
  const sample = async () => {
    const b = await fetch("/data/sample/serve_sample_health_export.zip").then((r) => r.blob());
    run(new File([b], "serve_sample_health_export.zip", { type: "application/zip" }));
  };
  const last = store.imports[0];
  return (
    <section className="bd-health" aria-labelledby="hd-h">
      <h2 id="hd-h" className="sec-label">Your health app</h2>
      <div className="bd-health-grid">
        <div className="panel">
          <h3 className="panel-h">Bring in your workouts</h3>
          <ul className="bd-src">
            <li><b>Apple Health</b><span className="tiny muted">On iPhone: Health, your picture, Export All Health Data. Choose the export.zip here, or share it to Serve in Messenger.</span></li>
            <li><b>Google Fit</b><span className="tiny muted">Google Takeout, Fit: the zip with your activities and daily metrics.</span></li>
            <li><b>Any app</b><span className="tiny muted">One GPX, TCX or CSV file from Strava, Garmin, Huawei, Samsung or a spreadsheet.</span></li>
          </ul>
          <div className="cta-row">
            <label className="btn primary sm"><input type="file" accept=".zip,.xml,.gpx,.tcx,.csv" hidden onChange={(e) => run(e.target.files?.[0])} disabled={!!busy} /><Icon name="plus" size={16} />Choose a file</label>
            <button className="btn sm" onClick={sample} disabled={!!busy}>Try the sample export</button>
          </div>
        </div>
        <div className="panel" aria-live="polite">
          <h3 className="panel-h">{busy ? `Reading ${busy.name}` : "What your agent filed"}</h3>
          {busy ? (
            <ul className="bd-steps">{busy.steps.map((s, i) => <li key={i}><Icon name="check" size={14} /><span><b>{s.step}</b><span className="tiny muted">{s.detail}</span></span></li>)}<li className="working"><span className="dots"><i /><i /><i /></span>{busy.working}</li></ul>
          ) : last ? (
            <>
              <p className="small"><b>{last.source}</b> · {last.file}<br /><span className="muted">{last.counts.workouts} workouts ({last.counts.routes} with a GPS route), {last.counts.days} days of steps, heart rate and sleep · {last.added} new</span></p>
              <p className="tiny muted">{store.workouts.length} workouts and {store.days.length} days on this device. Imported {new Date(last.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.</p>
            </>
          ) : <p className="muted small">Nothing imported yet.</p>}
          {fail && <p className="bd-err small" role="alert">{fail}</p>}
        </div>
      </div>
    </section>
  );
}
