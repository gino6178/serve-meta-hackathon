import { useEffect, useState } from "react";
import { agentFetch } from "../agent.js";
import { agentFace } from "../club/faces.js";
import { myPlace } from "../where.js";

// Your agent recommends the nearest club you are not in yet (agent members/clubs.js suggest): join in a tap, look at
// it, or not now (that club is not suggested again in this browser).
const KEY = "serve.clubs.skip.v1";
const skipped = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
export default function ClubSuggest({ sport = null }) {
  const [s, setS] = useState(null), [busy, setBusy] = useState(false), [done, setDone] = useState("");
  useEffect(() => {
    let live = true;
    myPlace().then(async (p) => {
      if (!p) return;
      const r = await agentFetch(`/api/clubs/suggest?lat=${p.lat}&lon=${p.lon}${sport ? `&sport=${encodeURIComponent(sport)}` : ""}`).then((x) => x.json()).catch(() => null);
      if (live && r?.club && !skipped().includes(r.club.id)) setS(r);
    });
    return () => { live = false; };
  }, [sport]);
  if (!s) return null;
  const c = s.club;
  const skip = () => { try { localStorage.setItem(KEY, JSON.stringify([...skipped(), c.id].slice(-50))); } catch { /* private mode */ } setS(null); };
  const join = async () => {
    setBusy(true);
    const r = await agentFetch("/api/clubs/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ club: c.id, on: true }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) setDone(`You joined ${c.name}.`);
  };
  return (
    <article className="club-suggest" aria-label="A club near you">
      <img className="cs-face" src={agentFace("you")} alt="" />
      <div className="cs-body">
        <p className="cs-say">{done || <>A club near you: <b>{c.name}</b> · {s.why}</>}</p>
        {!done && <div className="cs-act">
          <button className="btn primary sm" disabled={busy} onClick={join}>Join</button>
          <a className="btn ghost sm" href={`#/club?room=${c.id}`}>See it</a>
          <button className="link" onClick={skip}>Not now</button>
        </div>}
        {done && <a className="link" href={`#/club?room=${c.id}`}>Open the club</a>}
      </div>
    </article>
  );
}
