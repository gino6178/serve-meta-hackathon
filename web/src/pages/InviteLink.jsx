import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";
import { AGENT_URL } from "../agent.js";
import { useMember } from "../members.js";
import { feedApi } from "../club/feedApi.js";
import { pendingInvite } from "../invite.js";
import { Join } from "./Social.jsx";
import "./invite.css";

// #/invite?id=...: a game someone shared as a link. Anyone sees the game and the spots left (never who is going);
// signing in joins it, also after a Facebook or Instagram login that left the page (pendingInvite).
const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);

export default function InviteLink() {
  const id = new URLSearchParams(location.hash.split("?")[1] || "").get("id") || "";
  const [m] = useMember();
  const [v, setV] = useState(null), [err, setErr] = useState(null), [state, setState] = useState(null);

  useEffect(() => {
    fetch(`${AGENT_URL}/api/invite?id=${encodeURIComponent(id)}`).then((r) => r.json()).then((j) => (j.invite ? setV(j.invite) : setErr(j.error || "That game is not open any more.")), () => setErr("The server did not answer."));
  }, [id]);

  const join = async () => {
    setState("joining");
    try { await feedApi.join(id, true); pendingInvite.clear(); setState("in"); }
    catch (e) { pendingInvite.clear(); setState(null); setErr(e.message); }
  };
  // back from signing in with this game remembered: join it straight away
  useEffect(() => { if (m && v && !v.full && pendingInvite.get() === id && !state) join(); }, [m, v]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err && !v) return <div className="page invite-link"><section className="il-card"><p>{err}</p><a className="btn ghost" href="#/club">See open games</a></section></div>;
  if (!v || m === undefined) return <div className="page invite-link"><p className="muted">Loading…</p></div>;
  const left = v.spots - v.going;
  return (
    <div className="page invite-link">
      <section className="il-card">
        <span className="il-from">{v.host} invited you</span>
        <h1 className="il-what">{cap(v.sport)}</h1>
        <p className="il-when"><b>{v.day}</b> {v.start}</p>
        <p className="il-where"><Icon name="pin" size={14} />{v.at ? <a href={`https://www.openstreetmap.org/?mlat=${v.at.lat}&mlon=${v.at.lon}#map=17/${v.at.lat}/${v.at.lon}`} target="_blank" rel="noreferrer">{v.where}</a> : v.where}</p>
        <p className="il-spots">{v.full ? "This game is full." : `${left} spot${left === 1 ? "" : "s"} left of ${v.spots}`}</p>
        {state === "in" ? <><p className="il-in">You're in. {v.host} sees it now.</p><a className="btn primary" href="#/club">Open Serve</a></>
          : m ? <button className="btn primary" disabled={v.full || state === "joining"} onClick={join}>{state === "joining" ? "Joining…" : "Join this game"}</button>
          : !v.full && <p className="il-note">Sign in once to join. Your agent can find the next game for you after that.</p>}
        {err && <p className="join-err" role="alert">{err}</p>}
      </section>
      {!m && !v.full && <div onClickCapture={() => pendingInvite.set(id)}><Join next={`/invite?id=${encodeURIComponent(id)}`} /></div>}
    </div>
  );
}
