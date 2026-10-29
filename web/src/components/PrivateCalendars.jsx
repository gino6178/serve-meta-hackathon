import { useEffect, useState } from "react";
import { agentPrefs, agentSetPrefs } from "../agent.js";
import "./webfeat.css";

// One row of You → Settings, kept on your own server (/api/prefs). Private calendars: when your agent agrees a game,
// it proposes times from your own week and each member's agent checks them against its own calendar, so nobody's week
// leaves their agent; the talk takes a little longer. Off, your agent lists only the times that fit the club's
// calendars. Your choice wins over the server's default (A2A_PRIVATE), and "Use the default" goes back to it.
export default function PrivateCalendars() {
  const [p, setP] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { agentPrefs().then(setP).catch((e) => setErr(e.message)); }, []);
  const set = async (v) => {
    setBusy(true); setErr("");
    try { setP(await agentSetPrefs({ privateCalendars: v })); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const on = !!p?.privateCalendars;
  return (
    <div className="setting">
      <div className="setting-txt">
        <b id="priv-l">Private calendars</b>
        {err && <p className="err" role="alert">Your server did not answer ({err}).</p>}
      </div>
      <button type="button" role="switch" className="switch" aria-checked={on} aria-labelledby="priv-l" disabled={!p || busy} onClick={() => set(!on)}><i aria-hidden="true" /></button>
    </div>
  );
}
