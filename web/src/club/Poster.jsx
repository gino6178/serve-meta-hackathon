import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { agentFetch } from "../agent.js";

// A matchup poster for a challenge: the art is made once on your server with Meta's Muse Image (agent media/poster.js,
// two of the club's mascots facing off, no words in it), and the words are drawn here from the challenge itself: who,
// the sport, when, the stake. Share it to Instagram or Facebook from the phone's share sheet, or save it.
const W = 1080, H = 1350;
const first = (n = "") => n.split(" ")[0];

export default function Poster({ c, from, club, sport = "badminton", onClose }) {
  const canvas = useRef(null), [state, setState] = useState("loading"), [err, setErr] = useState("");
  useEffect(() => {
    let live = true, url = null;
    (async () => {
      try {
        const r = await agentFetch(`/api/poster/art?id=${encodeURIComponent(c.id)}&sport=${encodeURIComponent(sport)}&format=${c.format}`);
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `The server answered ${r.status}.`);
        url = URL.createObjectURL(await r.blob());
        const img = new Image(); img.src = url; await img.decode();
        if (!live) return;
        draw(canvas.current.getContext("2d"), img);
        setState("ready");
      } catch (e) { if (live) { setErr(e.message); setState("failed"); } }
    })();
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [c.id]);

  function draw(ctx, img) {
    const k = Math.max(W / img.width, H / img.height);
    ctx.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
    const top = ctx.createLinearGradient(0, 0, 0, 520); top.addColorStop(0, "rgba(6,20,14,.86)"); top.addColorStop(1, "rgba(6,20,14,0)");
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, 520);
    const bot = ctx.createLinearGradient(0, H - 420, 0, H); bot.addColorStop(0, "rgba(6,20,14,0)"); bot.addColorStop(1, "rgba(6,20,14,.92)");
    ctx.fillStyle = bot; ctx.fillRect(0, H - 420, W, 420);
    ctx.textAlign = "center"; ctx.fillStyle = "#5fd39a"; ctx.font = "800 46px Segoe UI, system-ui, sans-serif";
    ctx.fillText(/rematch/i.test(c.note || "") ? "REMATCH" : "CHALLENGE", W / 2, 110);
    ctx.fillStyle = "#fff"; ctx.font = "900 120px Segoe UI, system-ui, sans-serif";
    ctx.fillText(`${first(from.name).toUpperCase()} vs YOU`, W / 2, 245, W - 120);
    ctx.font = "600 44px Segoe UI, system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillText(`${sport[0].toUpperCase()}${sport.slice(1)} ${c.format} · ${whenOf(c.when)}`, W / 2, 320, W - 120);
    if (c.stake) { ctx.font = "700 42px Segoe UI, system-ui, sans-serif"; ctx.fillStyle = "#ffd166"; ctx.fillText(c.stake, W / 2, H - 150, W - 120); }
    ctx.font = "600 34px Segoe UI, system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fillText(`${club?.name || "Your club"} · serve`, W / 2, H - 80);
  }
  const blob = () => new Promise((ok) => canvas.current.toBlob(ok, "image/png"));
  const share = async () => {
    const f = new File([await blob()], `serve-${c.id}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], title: `${first(from.name)} vs you` }); return; } catch { /* closed */ } }
    save();
  };
  const save = async () => { const a = document.createElement("a"); a.href = URL.createObjectURL(await blob()); a.download = `serve-${c.id}.png`; a.click(); };
  return (
    <div className="story-scrim" onClick={onClose}>
      <div className="poster-sheet" role="dialog" aria-modal="true" aria-label={`Poster: ${first(from.name)} vs you`} onClick={(e) => e.stopPropagation()}>
        <canvas ref={canvas} width={W} height={H} className={state} aria-hidden="true" />
        {state === "loading" && <p className="poster-wait"><span className="dots"><i /><i /><i /></span>Muse Image is drawing it</p>}
        {state === "failed" && <p className="poster-wait" role="alert">{err}</p>}
        <div className="cta-row">
          <button className="btn primary sm" disabled={state !== "ready"} onClick={share}><Icon name="share" size={16} />Share</button>
          <button className="btn sm" disabled={state !== "ready"} onClick={save}><Icon name="download" size={16} />Save</button>
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
const DAYS = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
// "Sat 10-14" → "Saturday 10:00–14:00"
function whenOf(w = "") { const m = /^(\w{3})\s+(\d{1,2})-(\d{1,2})$/.exec(w); return m ? `${DAYS[m[1]] || m[1]} ${m[2]}:00–${m[3]}:00` : w; }
