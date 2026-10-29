// Where the player is, for finding courts near them: the browser asks once (the player can say no), and the answer is
// kept for this tab's session only, rounded to about 100 m. Without it, searches stay around the club's own area.
const KEY = "serve.near.v1";
export function knownPlace() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; }
}
export function myPlace({ timeoutMs = 8000 } = {}) {
  const known = knownPlace();
  if (known) return Promise.resolve(known);
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((ok) => {
    navigator.geolocation.getCurrentPosition((p) => {
      const at = { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: "where you are" };
      try { sessionStorage.setItem(KEY, JSON.stringify(at)); } catch { /* private mode */ }
      ok(at);
    }, () => ok(null), { timeout: timeoutMs, maximumAge: 10 * 60000 });
  });
}
