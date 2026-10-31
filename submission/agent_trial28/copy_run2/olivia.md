# Olivia's agent, local copy, run 2 (saved from the tester's reply; it could not write the file itself)

- Demo sign-in "Olivia Test", home 25.0330, 121.5654, sport badminton, limits Mon-Fri 18:00-22:00, 5 km, NT$150, delegation on with newPeople false, open off.
- Agent key registered. Over the agent key, a loosened limits POST and a loosened delegation POST were both refused (needs: "person").
- Invite file read at the first check. Join returned "Asked"; the organiser accepted about 30 s later, delivered as the notice "Tom said yes: you're in Thursday hoops."
- Her agent was offered the club's game (basketball, Thu 5 Nov 19:00, Riverside courts, host Tom). agentMay said "Ask your person: the host is new", so the agent did not say yes.

Findings as reported:
- BUG 1: the club game went and the club changed with no notice to her. (Triage: the game was called off by Tom while she was not in it, so no call-off notice is right; the club passing to her when Tom left Serve was silent: fixed, the new organiser is told.)
- BUG 2: a basketball game was offered to a badminton-only player. (Triage: intended since this round; it is a game in her own club. The yes was still held for her person by the new-host rule.)
- MINOR 1: the "Tom said yes" notice was taken by the first agent read and not shown again.
- MINOR 2: a revoked key got "unknown-peer". (Fixed: it now says the key was revoked by its person.)

VERDICT: 0 BLOCKER, 2 BUG
