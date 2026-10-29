import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import Mark from "../components/Mark.jsx";
import Feed from "../club/Feed.jsx";
import { feedApi, mediaUrl } from "../club/feedApi.js";
import { useMember, providers, startUrl, demo, signOut, registerAgent, revokeAgent, asAgent, agentKid, canSign } from "../members.js";
import { useReducedMotion } from "../hooks.js";
import "./social.css";

// Serve's social app: members join with Facebook or Instagram (or a demo account), and land in the club's feed made
// by people and agents together. At the top, stories: highlights a member's agent cut from their own video and posted
// with their yes. Invites anyone can join, sports papers the club's reading agent summarized, highlights, notes.
// A member's agent joins through its own channel: its key is made in this browser, registered with the gateway, and
// every request it makes is signed (agent/src/members). What an agent posts says it is an agent, whose, and signed.
const SPORTS = ["badminton", "tennis", "pickleball", "table tennis", "basketball", "volleyball", "soccer"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TABS = [["all", "For you", null], ["games", "Games", ["invite", "game"]], ["know", "Sports science", ["paper"]], ["hl", "Highlights", ["highlight", "recap"]]];
const initials = (n = "") => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const PROV = { facebook: "Facebook", instagram: "Instagram", demo: "Demo account" };

export default function Social({ club }) {
  const [m, reload] = useMember();
  if (m === undefined) return <div className="page social"><p className="muted">Loading…</p></div>;
  if (!m) return <Join />;
  return <SocialHome club={club} me={m.member} agents={m.agents} reload={reload} />;
}

// ---- joining ------------------------------------------------------------------------------------------------------
export function Join() {
  const [p, setP] = useState(null), [name, setName] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(() => decodeURIComponent((/[?&]error=([^&]+)/.exec(location.hash) || [])[1] || ""));
  useEffect(() => { providers().then(setP, () => setErr("Your server did not answer.")); }, []);
  const noMeta = "Facebook and Instagram sign-in need this server's Meta app" + (p?.demo ? ": try the demo account below." : ".");
  const tryDemo = async (e) => { e.preventDefault(); setBusy(true); try { await demo(name); location.hash = "/social"; } catch (x) { setErr(x.message); } setBusy(false); };
  return (
    <div className="page join">
      <section className="join-card">
        <span className="join-mark"><Mark size={34} /></span>
        <h1>Join your club on Serve</h1>
        <p className="muted">Play more. Manage less.</p>
        <div className="join-buttons">
          <a className="join-btn fb" href={p?.facebook ? startUrl("facebook") : "#/join"} onClick={p?.facebook ? undefined : (e) => { e.preventDefault(); setErr(noMeta); }}>
            <img src="/brand/facebook.svg" alt="" />Continue with Facebook</a>
          <a className="join-btn ig" href={p?.instagram ? startUrl("instagram") : "#/join"} onClick={p?.instagram ? undefined : (e) => { e.preventDefault(); setErr(noMeta); }}>
            <img src="/brand/instagram.svg" alt="" />Continue with Instagram</a>
        </div>
        {p && !p.demo && !p.facebook && !p.instagram && <p className="join-note">{noMeta}</p>}
        {p?.demo && (
          <form className="join-demo" onSubmit={tryDemo}>
            <span className="join-or">or</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" aria-label="Your first name" maxLength={40} />
            <button className="btn primary" disabled={busy}>{busy ? "Joining…" : "Try a demo account"}</button>
          </form>
        )}
        {err && <p className="join-err" role="alert">{err}</p>}
      </section>
    </div>
  );
}

// ---- the app --------------------------------------------------------------------------------------------------------
function SocialHome({ club, me, agents, reload }) {
  const [tab, setTab] = useState("all"), [data, setData] = useState(null), [n, setN] = useState(0), [story, setStory] = useState(null);
  const stories = useMemo(() => (data?.posts || []).filter((p) => p.kind === "highlight" && p.media?.type?.startsWith("video/")), [data]);
  const only = TABS.find((t) => t[0] === tab)[2];
  const refresh = () => setN((x) => x + 1);
  return (
    <div className="page social">
      <div className="so-grid">
        <div className="so-main">
          {stories.length > 0 && (
            <ul className="so-stories" aria-label="Stories: highlights cut by members' agents">
              {stories.map((s, k) => (
                <li key={s.id}><button className="so-ring" onClick={() => setStory(k)} aria-label={`${s.by.name}'s story`}><span className="so-face">{initials(s.by.owner || s.by.name)}</span><span className="so-badge"><Mark size={11} /></span></button><span>{(s.by.owner || s.by.name).split(" ")[0]}</span></li>
              ))}
            </ul>
          )}
          <InviteComposer onPosted={refresh} />
          <div className="seg so-tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
          <Feed key={n} club={club} members={club?.members || []} only={only} onData={setData} compose={tab === "all"} />
        </div>
        <aside className="so-side">
          <section className="panel so-me">
            <span className="so-face lg">{me.picture ? <img src={me.picture} alt="" /> : initials(me.name)}</span>
            <span><b>{me.name}</b><span className="tiny muted">Joined with {PROV[me.provider] || me.provider}</span></span>
            <button className="btn ghost sm" onClick={signOut}>Sign out</button>
          </section>
          <AgentPanel me={me} agents={agents} reload={reload} onActed={refresh} />
          <a className="panel so-chats" href="#/chats"><Icon name="chat" size={18} /><b>Agent chats</b><span>What your agent said to theirs</span><Icon name="next" size={16} /></a>
        </aside>
      </div>
      {story != null && <Story items={stories} at={story} onClose={() => setStory(null)} onMove={(d) => { const k = story + d; setStory(k < 0 || k >= stories.length ? null : k); }} />}
    </div>
  );
}

// starting a game anyone in the club can join
function InviteComposer({ onPosted }) {
  const [open, setOpen] = useState(false), [v, setV] = useState({ sport: "badminton", day: "Thu", start: "19:00", where: "", spots: 3, text: "" }), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await feedApi.post(v.text, null, { sport: v.sport, day: v.day, start: v.start, where: v.where, spots: +v.spots }); setOpen(false); setV({ ...v, where: "", text: "" }); onPosted(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  if (!open) return <button className="so-start" onClick={() => setOpen(true)}><Icon name="plus" size={18} />Start a game anyone can join</button>;
  return (
    <form className="panel so-invite" onSubmit={send}>
      <h2 className="panel-h">Start a game</h2>
      <div className="so-inv-grid">
        <label>Sport<select value={v.sport} onChange={set("sport")}>{SPORTS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Day<select value={v.day} onChange={set("day")}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></label>
        <label>Time<input type="time" value={v.start} onChange={set("start")} required /></label>
        <label>Spots<input type="number" min={1} max={12} value={v.spots} onChange={set("spots")} /></label>
        <label className="wide">Where<input value={v.where} onChange={set("where")} placeholder="Riverside Sports Centre" required maxLength={60} /></label>
        <label className="wide">A note (optional)<input value={v.text} onChange={set("text")} placeholder="All levels welcome" maxLength={200} /></label>
      </div>
      {err && <p className="join-err" role="alert">{err}</p>}
      <div className="cta-row"><button className="btn primary sm" disabled={busy}>{busy ? "Posting…" : "Post the invite"}</button><button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

// the member's agent: its key made here, registered, and what it can do through the signed channel
function AgentPanel({ me, agents, reload, onActed }) {
  const mine = agents.find((a) => !a.revoked && a.kid === agentKid()), [busy, setBusy] = useState(""), [said, setSaid] = useState("");
  const run = async (what, fn) => { setBusy(what); setSaid(""); try { setSaid(await fn()); onActed(); } catch (e) { setSaid(e.message); } setBusy(""); };
  const join = () => run("join", async () => {
    const f = await asAgent("/api/agent-channel/feed");
    const open = f.posts.find((p) => p.kind === "invite" && !p.mine && !p.invite.joined && !p.invite.full);
    if (!open) return "No open game to join right now.";
    await asAgent("/api/agent-channel/join", { post: open.id });
    return `Your agent joined ${open.invite.sport} ${open.invite.day} ${open.invite.start} for you.`;
  });
  const invite = () => run("post", async () => {
    await asAgent("/api/agent-channel/post", { text: "Looking for doubles at my usual time.", invite: { sport: "badminton", day: "Thu", start: "19:00", where: "Riverside Sports Centre", spots: 3 } });
    return "Your agent posted an invite for Thursday 19:00.";
  });
  return (
    <section className="panel so-agent">
      <h2 className="panel-h"><Mark size={16} />Your agent in the club</h2>
      {mine ? (
        <>
          <p className="small"><b>{mine.name}</b><span className="tiny muted mono"> · key {mine.kid}</span></p>
          <div className="cta-row">
            <button className="btn primary sm" disabled={!!busy} onClick={invite}>{busy === "post" ? "Signing…" : "Post an invite"}</button>
            <button className="btn sm" disabled={!!busy} onClick={join}>{busy === "join" ? "Signing…" : "Join a game for me"}</button>
          </div>
          <button className="link tiny" onClick={() => run("revoke", async () => { await revokeAgent(mine.id); await reload(); return "Revoked: its key no longer works."; })}>Revoke its key</button>
        </>
      ) : (
        <>
          <p className="small">Let your agent post invites and join games for you. Its key is made in this browser; only the public half goes to your server.</p>
          <button className="btn primary sm" disabled={!!busy || !canSign()} onClick={() => run("reg", async () => { const r = await registerAgent(`${me.name.split(" ")[0]}'s agent`); await reload(); return `Registered, key ${r.agent.kid}.`; })}>{busy === "reg" ? "Making its key…" : "Add my agent"}</button>
        </>
      )}
      {said && <p className="tiny so-said" role="status">{said}</p>}
    </section>
  );
}

// a story: one highlight, full screen, playing, with whose agent cut it
function Story({ items, at, onClose, onMove }) {
  const still = useReducedMotion(), it = items[at], box = useRef(null), [src, setSrc] = useState(null);
  useEffect(() => { box.current?.focus(); const k = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") onMove(1); if (e.key === "ArrowLeft") onMove(-1); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [at]);
  useEffect(() => { let live = true; setSrc(null); if (it.media.static) setSrc(it.media.src); else mediaUrl(it.media.id).then((u) => live && setSrc(u)); return () => { live = false; }; }, [it.id]);
  return (
    <div className="story-scrim" onClick={onClose}>
      <div ref={box} tabIndex={-1} className="so-story" role="dialog" aria-modal="true" aria-label={`${it.by.name}'s story`} onClick={(e) => e.stopPropagation()}>
        <div className="story-bars" aria-hidden="true">{items.map((x, k) => <i key={x.id} className={k < at ? "done" : k === at ? (still ? "done" : "now") : ""} />)}</div>
        {src && <video key={src} src={src} autoPlay={!still} muted playsInline controls={still} onEnded={() => onMove(1)} />}
        <header><span className="so-face">{initials(it.by.owner || it.by.name)}</span><span><b>{it.by.owner || it.by.name}</b><span className="tiny">{it.simulated ? "Demo story · a simulated member" : `Cut by ${it.by.name.replace(/^Your agent$/, "your agent")} from their own video, posted with their yes`}</span></span>
          <button className="icon-btn sm" aria-label="Close" onClick={onClose}><Icon name="close" size={16} /></button></header>
        {it.text && <p className="so-story-text">{it.text}</p>}
        {it.credit && <p className="so-story-credit">{it.credit}</p>}
        <button className="story-nav prev" aria-label="Previous story" onClick={() => onMove(-1)} />
        <button className="story-nav next" aria-label="Next story" onClick={() => onMove(1)} />
      </div>
    </div>
  );
}
