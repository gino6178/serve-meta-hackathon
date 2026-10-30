// Serve's own A2A extensions (A2A v1.0, spec 4.6): a proposal and a hold, each a versioned URI under the public address
// (PUBLIC_URL, else the gateway's base) that a member's card declares with required: true; a client matches them by path. A client that does not name both in A2A-Extensions is refused by
// the SDK with ExtensionSupportRequiredError (JSON-RPC -32008) before any agent reads its message; the one a message
// uses is said back as activated. serve.likely (match/likely.js) stays optional.
export const PROPOSAL_PATH = "/a2a/ext/proposal/v1", HOLD_PATH = "/a2a/ext/hold/v1";
// the paths Serve's client always activates when a card declares them (client.js send)
export const REQUIRED_PATHS = [PROPOSAL_PATH, HOLD_PATH];
const DOCS = {
  [PROPOSAL_PATH]: { name: "serve.proposal", version: 1, request: "a data part {kind: 'serve.proposal', sport, format, minutes, proposal: {id?, date, start, venue?, court?}, choices: [...]}, facts only",
    answer: "a 'decision' artifact {intent: accept|counter|decline, date?, start?, works?, tier} and the agent's sentence; or TASK_STATE_FAILED with the reason",
    description: "Agree a game time: accept, counter with one of the listed times, or decline." },
  [HOLD_PATH]: { name: "serve.hold", version: 1, request: "a data part {kind: 'serve.hold', action: hold|release|book, ref (the talk's contextId, which the message must share), date, start, minutes, mandate?}",
    answer: "a 'hold' artifact {held, until?, reason?}: a time this agent said works in that talk is held for 30 minutes",
    description: "Hold a time this agent said works in a talk, while the player decides; released on request, given way to the booking." },
};
// what a card declares (capabilities.extensions)
export const declare = (base) => REQUIRED_PATHS.map((p) => ({ uri: `${base}${p}`, description: DOCS[p].description, required: true, params: { version: DOCS[p].version, kind: DOCS[p].name } }));
// what is served at an extension's URI
export const describe = (p) => DOCS[p] || null;
// the header a raw JSON-RPC request to a Serve agent at this base carries (Serve's client sends it itself)
export const header = (base) => ({ "A2A-Extensions": REQUIRED_PATHS.map((p) => `${base}${p}`).join(",") });
// the extension a data part of this kind uses
export const pathOf = (kind) => (kind === "serve.proposal" ? PROPOSAL_PATH : kind === "serve.hold" ? HOLD_PATH : null);
