"""The decision model's input, built by code from the facts of one member decision (shared by training, evaluation and
the serving worker, so the three see the same tokens).

One forward pass reads it and returns, in parallel:
  - for every listed time, P(works) at that line's "works?" marker (the logits of " yes" against " no");
  - at the last position, a distribution over the declared options only (single-token letters): A yes to the proposed
    time (only offered when it works), B, C, ... ask for one of the times that work, Z can't play this week.
The prompt is token ids put together segment by segment, so the marker positions are known exactly. The times that
work (by code) are said after every marker, so the model's own reading of each time is made before it sees code's.
`short`: only the proposed time and the times that work are listed (what Muse Glimmer itself is shown, and about half
the tokens, for the CPU); otherwise every listed time.
"""
import json, re

LETTERS = "BCDEFGHIJKLM"

def line(text, trip):
    """A listed time in few tokens: day, date, start-end and venue from the agent's words, and the member's own trip."""
    t = re.sub(r"\s*\([^()]*\)\s*$", "", text)          # (trips: ...) in process, (X's trip N min) over A2A
    t = re.sub(r", court \d+$", "", t)
    return f"{t}, trip {trip} min" if trip is not None else t

def options(case, order="time"):
    """The declared options for this decision: [(letter, kind, time id or None)]. The times that work get their letters
    in time order (B the soonest), when the offers carry their date and start; the lines above keep the proposer's
    order, and its ids."""
    works = set(case["works"]); cur = case["cur"]
    out = []
    if cur in works: out.append(("A", "accept", cur))
    alts = [x for x in case["offers"] if x["id"] in works and x["id"] != cur]
    if order == "time" and all(x.get("date") and x.get("start") for x in alts): alts = sorted(alts, key=lambda x: (x["date"], x["start"]))
    alts = [x["id"] for x in alts]
    for i, t in enumerate(alts[:len(LETTERS)]): out.append((LETTERS[i], "counter", t))
    out.append(("Z", "decline", None))
    return out

def listed(case, short):
    works = set(case["works"])
    return [x for x in case["offers"] if not short or x["id"] == case["cur"] or x["id"] in works]

def segments(case, short=False, order="time"):
    """[(text, role)]: role 'marker:<id>' for the token where that time's works? is read."""
    them = case["name"]
    segs = [(f"{case['profile']}\nGame: {case['sport']} {case['format']}, {case['minutes']} minutes. Proposed: {case['cur']}.", None)]
    for x in listed(case, short):
        segs.append((f"\n{x['id']} {line(x['text'], x.get('trip'))}: works", None))
        segs.append(("?", f"marker:{x['id']}"))
    opts = options(case, order)
    say = {"accept": lambda t: f"yes to {t}", "counter": lambda t: t, "decline": lambda t: f"{them} can't play this week"}
    tail = (f"\nBy {them}'s calendar and rules these work: {', '.join(f'{l} = {say[k](t)}' for l, k, t in opts if k != 'decline') or 'none'}. "
            f"Z = {them} can't play this week.\nAnswer:")
    segs.append((tail, None))
    return segs

class Builder:
    """Token ids for a case, with the marker and answer positions (Llama 3 chat format, no system turn)."""
    def __init__(self, tok, order="time"):
        self.order = order  # the options' letters: "time" (soonest first) or "listed" (the proposer's order)
        enc = lambda s: tok.encode(s, add_special_tokens=False)
        self.enc = enc
        self.pre = enc("<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n")
        self.post = enc("<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n")
        self.yes, self.no = enc(" yes")[0], enc(" no")[0]
        assert len(enc(" yes")) == 1 and len(enc(" no")) == 1
        self.letter = {}
        for l in "A" + LETTERS + "Z":
            ids = enc(l); assert len(ids) == 1, l; self.letter[l] = ids[0]

    def build(self, case, short=False):
        ids = list(self.pre); markers = []
        for text, role in segments(case, short, self.order):
            ids += self.enc(text)
            if role: markers.append((role[7:], len(ids) - 1))
        ids += self.post
        return {"ids": ids, "markers": markers, "answer": len(ids) - 1, "options": options(case, self.order)}

def from_case(c):
    """The fields the prompt needs, from a distill/cases.mjs case (training and evaluation)."""
    m = c["member"]
    prof = (f"You are {m['name']}'s agent. {m['name']} plays {'singles or doubles' if m['prefers'] == 'any' else m['prefers']}, level {m['level']}. "
            f"Free: {', '.join(m['free'])}.{(' Health limit: ' + m['limit'] + '.') if m.get('limit') else ''} {m.get('agent') or ''}")
    return {"profile": prof, "name": m["name"].split(" ")[0], "sport": c["sport"], "format": c["format"], "minutes": c["minutes"], "cur": c["cur"],
            "offers": [{"id": x["id"], "text": x["text"], "trip": x.get("trip"), "date": x["slot"]["date"], "start": "%02d:%02d" % divmod(x["start"], 60)} for x in c["offers"]], "works": c["works"]}

def label_of(c, dec):
    """Glimmer's decision on a case as an option: the time id it asked for, the proposed time's id for a yes, 'decline',
    or None (no answer)."""
    if not dec or dec.get("intent") in (None, "none"): return None
    if dec["intent"] == "accept": return c["cur"]
    if dec["intent"] == "decline": return "decline"
    for x in c["offers"]:
        if x["slot"]["date"] == dec["date"] and "%02d:%02d" % divmod(x["start"], 60) == dec["start"]: return x["id"]
    return None

def structured_view(c, decision=None):
    """A second view of the same decision, as JSON facts (for the LLM-JEPA objective): the member's calendar and hard
    rules as code holds them, the times that work, and the answer."""
    m = c["member"]
    v = {"free": m["free"], "rules": m.get("rules") or {}, "habits": (m.get("agent") or "").replace("A simulated member. ", ""), "works": c["works"], "decision": decision}
    return json.dumps(v, separators=(",", ":"))
