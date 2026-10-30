# Serve, checked by Bruno's agent (new2)

56 HTTP requests to 127.0.0.1:8899, about 5 minutes. Scripts in `work_new2/`.

## What I checked and how
- Discovery: `/`, `/.well-known/agent.json`, `/.well-known/agent-card.json`, `/privacy`, `/api`, `/a2a`, `/api/privacy` all returned `404 {"error":"not found"}`. Only `/api/status`, `/api/trust/chain`, `/a2a/keys.json`, `/a2a/agents`, the member cards and `/a2a/ext/likely/v1` turned up.
- Chain: I recomputed `sha256(JSON.stringify([n,at,kind,who,d,prev]))` over all entries myself. The links hold.
- Signatures: `/a2a/keys.json` lists one Ed25519 key. The chain's `"heads":[]` is empty in both fetches. The member card JWS (`kid serve-fdbc86e9a90ad8ee`) failed to verify under RFC 8785 JCS, under plain JSON.stringify, or with empties stripped.
- Game: sent A2A `SendMessage` (header `A2A-Version: 1.0`) to members, with no account.

## Verdict on each claim
| Claim | Verdict |
|-|-|
| Agents meet and negotiate | **Holds.** Tomás and Kenji accepted Sat 31 Oct 09:00. Ravi, Yuki and Aisha declined. Hana "did not answer". |
| Preferences never leave the member's agent | **Partly holds.** `serve.likely` returns only a band (`maybe`). I could not check what the server itself keeps. |
| Signed hash chain anyone can verify | **Not verifiable.** The hashes link, but nothing is signed (`heads: []`); the operator could rewrite it. |

## How far the game got
Tomás accepted 09:00 at a venue id I made up (`riverside-sports-centre`). He then held it for 30 min (`{"held":true,"until":1793326662160}`). No booking step, venue list or signup (`POST /api/players {}` returns `[]` with 200). Club location unknown. Shared only `from:"bruno-agent"`, sport, format, times.

## Problems, ranked
1. **Trust heads are never signed.** `GET /api/trust/chain` returns `"heads":[]` though `how` says heads are signed. The signature claim can't be checked.
2. **Card signature does not verify.** Hana's card JWS failed under JCS and under plain JSON. The canonicalization isn't documented.
3. **No privacy policy or data-retention statement anywhere.** `/privacy` and `/api/privacy` return 404.
4. **Venue is never checked.** Any id matching `^[A-Za-z0-9_:./-]{1,128}$` is accepted, and there's no venue list or location, so "Sat 09:00" has no real place attached.
5. **No auth, and tasks are readable by id.** `GetTask {"id":"4ecfe49f…"}` returns the full proposal history to any caller. `securitySchemes:{}` means anyone can write as any `from`.
6. **Hold is hard to use.** `ref` must be the contextId, not the task id. Using the task id returns `{"held":false,"reason":"a hold belongs to its own talk"}`.
7. **Hana's opaque failure.** A valid proposal returns `TASK_STATE_FAILED "Hana's agent did not answer."` (`/api/status`: `llm.ready:false`).
8. **No discovery entry.** Root and well-known paths return 404. `/a2a/agents` is unlinked.

## Fixes
Sign and publish trust heads. Document the card canonicalization and test it against JCS. Serve `/.well-known/agent-card.json` and a root index that links agents, schemas, venues and the privacy policy. Validate venues against a published list with coordinates. Require caller identity and restrict GetTask to the task's creator. Add a booking step after hold.

**Recommendation to Bruno:** don't sign up yet. Tomás has tentatively agreed to Saturday 09:00, but the venue and the trust record are unverified.
