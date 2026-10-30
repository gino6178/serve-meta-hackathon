import { useState } from "react";
import { answer } from "../huddle.js";

// The agent's quick question: two games that pull different ways, pick one. What it learned comes back as a sentence,
// and the next question (if it still needs one) follows. Used on the agent home and on the Huddle page.
export default function TasteQuestion({ q, onAnswered }) {
  const [busy, setBusy] = useState(false), [said, setSaid] = useState(""), [err, setErr] = useState("");
  if (!q) return null;
  const pick = async (k) => {
    setBusy(true); setErr("");
    try { const r = await answer(q, k); setSaid(r.line); onAnswered?.(r); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const opt = (k, o) => (
    <button className="tq-opt" disabled={busy} onClick={() => pick(k)}>
      <span className="tq-k">{k.toUpperCase()}</span>
      <span className="tq-txt">{o.text.split(" · ").map((x, i) => <span key={i} className={i === 0 ? "tq-when" : ""}>{x}</span>)}</span>
    </button>
  );
  return (
    <div className="tq">
      <p className="tq-ask"><b>{q.ask}</b><span>{q.n < q.of ? ` ${q.n + 1} of ${q.of}` : ""}</span></p>
      <div className="tq-pair">{opt("a", q.a)}{opt("b", q.b)}</div>
      <div className="tq-foot">
        <button className="btn ghost sm" disabled={busy} onClick={() => pick("either")}>Either is fine</button>
        {said && <p className="tq-said" role="status">{said}</p>}
        {err && <p className="join-err" role="alert">{err}</p>}
      </div>
    </div>
  );
}
