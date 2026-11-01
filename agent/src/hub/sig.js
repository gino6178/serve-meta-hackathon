// The agent hub's admission signature (hub.js): an HMAC of the agent id under HUB_SECRET, made by whoever admitted the
// agent (the tenants proxy, for a signed-in member) and checked by the hub. Its own file, so importing it starts nothing.
import crypto from "node:crypto";
export const sigOf = (agent, secret) => crypto.createHmac("sha256", secret).update(`serve-hub:${agent}`).digest("base64url").slice(0, 22);
