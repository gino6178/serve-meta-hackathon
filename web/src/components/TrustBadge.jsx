// A person's two records (agent src/members/trust.js): do they show up, and does their agent keep the yeses it gives
// for them. "new" until there are three games or three yeses to count; a flag when the agent asked too many people's
// agents or its key failed a signature check. range says how sure the show-up figure is, in words ("likely 78-96%"):
// recent games count most, and a short record gives a wide range.
export default function TrustBadge({ t, compact = false }) {
  if (!t) return null;
  const show = t.newShow ? "" : t.rate >= 0.9 ? "good" : t.rate >= 0.75 ? "ok" : "low";
  const agent = t.flag ? "low" : t.newAgent ? "" : t.kept >= 0.8 ? "good" : "low";
  return (
    <span className={`trust${compact ? " sm" : ""}`}>
      <span className={`tr-pill ${show}`} title={`Shows up: from the other players' one-tap check after each game, recent games counting most${t.range ? ` (${t.range})` : ""}`}>{t.show.replace(/^shows up /, "Shows up ")}{!compact && t.range && !t.newShow ? ` · ${t.range}` : ""}</span>
      <span className={`tr-pill ${agent}`} title="How often the person agreed when their agent said yes for them">{t.agent.replace(/^agent/, "Agent")}</span>
    </span>
  );
}
