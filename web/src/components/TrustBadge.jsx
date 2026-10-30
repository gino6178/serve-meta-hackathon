// A person's two records (agent src/members/trust.js): do they show up, and does their agent keep the yeses it gives
// for them. "new" until there are three games or three yeses to count; a flag when the agent asked too many people's
// agents or its key failed a signature check.
export default function TrustBadge({ t, compact = false }) {
  if (!t) return null;
  const show = t.newShow ? "" : t.rate >= 0.9 ? "good" : t.rate >= 0.75 ? "ok" : "low";
  const agent = t.flag ? "low" : t.newAgent ? "" : t.kept >= 0.8 ? "good" : "low";
  return (
    <span className={`trust${compact ? " sm" : ""}`}>
      <span className={`tr-pill ${show}`} title="Shows up: from the other players' one-tap check after each game">{t.show.replace(/^shows up /, "Shows up ")}</span>
      <span className={`tr-pill ${agent}`} title="How often the person agreed when their agent said yes for them">{t.agent.replace(/^agent keeps (\d+)% of its yeses$/, "Agent right $1%").replace(/^agent new$/, "Agent new").replace(/^asks too many agents$/, "Agent paused").replace(/^signature problems$/, "Agent checking")}</span>
    </span>
  );
}
