# local copy only: the round-28 fixes over HTTP, as members would hit them
import json, urllib.request, datetime, time
B = "http://localhost:8898"
def call(m, p, body=None, s=None):
    r = urllib.request.Request(B + p, method=m, data=json.dumps(body).encode() if body is not None else None, headers={"content-type": "application/json", "x-tester": "e2e", **({"x-serve-session": s} if s else {})})
    try:
        with urllib.request.urlopen(r, timeout=120) as f: return f.status, json.loads(f.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
demo = lambda n: call("POST", "/api/auth/demo", {"name": n})[1]["session"]
lily = demo("Lily Test")
ben, mia, cy = demo("Ben Test"), demo("Mia Test"), demo("Cy Test")
me = lambda s: call("GET", "/api/me", s=s)[1]["member"]["id"]
ok = []
def check(name, cond, info=""): ok.append(cond); print("PASS" if cond else "FAIL", name, "" if cond else info)
at = {"lat": 25.04, "lon": 121.55}
club = call("POST", "/api/clubs", {"name": "E2E doubles", "sport": "badminton", "about": "x", "where": "Daan Sports Center", "at": at, "privacy": "private"}, lily)[1]["club"]["id"]
code = call("GET", f"/api/clubs/{club}/invite", s=lily)[1]["code"]
for s in (ben, mia, cy):
    r = call("POST", "/api/clubs/join", {"code": code}, s)[1]
    call("POST", "/api/clubs/answer", {"club": club, "member": me(s), "yes": True}, lily)
day = (datetime.date.today() + datetime.timedelta(days=(3 - datetime.date.today().weekday()) % 7 or 7)).isoformat()
post = call("POST", "/api/feed/post", {"text": "Thursday doubles, 2 spots", "room": club, "invite": {"sport": "badminton", "day": day, "start": "19:00", "where": "Daan Sports Center", "at": at, "spots": 2, "each": 100}}, lily)[1]
pid = post["post"]["id"]
check("a private club's game has no share link", post["post"]["invite"]["shareUrl"] is None, post["post"]["invite"].get("shareUrl"))
call("GET", "/api/feed/notices", s=lily)
call("POST", "/api/feed/join", {"post": pid, "on": True}, mia)
n = call("GET", "/api/feed/notices", s=lily)[1]["notices"]
check("the host hears who joined", any(x["kind"] == "joined" and x["text"].startswith("Mia is in") for x in n), n)
call("POST", "/api/feed/join", {"post": pid, "on": True}, ben); call("POST", "/api/feed/join", {"post": pid, "on": True}, cy)
# (2 spots: Mia and Ben fill it, Cy goes on the waitlist)
for s, who, k in ((mia, "Mia", 1), (ben, "Ben", 1), (cy, "Cy (waitlist)", 0)):
    n = call("GET", "/api/feed/notices", s=s)[1]["notices"]
    check(f"{who} hears Game on {k} time(s)", sum(x["kind"] == "gameon" for x in n) == k, n)
w = call("POST", "/api/feed/join", {"post": pid, "on": True}, mia)[1]
check("Mia, already in, stays in (a full game)", "error" not in w, w)
call("POST", "/api/feed/join", {"post": pid, "on": False}, mia)
w = call("POST", "/api/feed/join", {"post": pid, "on": True}, mia)[1]
check("Mia rejoining a full game goes on the waitlist", w.get("waitlisted") is True, w)
call("GET", "/api/feed/notices", s=ben); call("GET", "/api/feed/notices", s=mia); call("GET", "/api/feed/notices", s=cy)
call("POST", "/api/members/leave", {}, lily)
for s, who in ((ben, "Ben"), (cy, "Cy"), (mia, "Mia (waitlist)")):
    n = call("GET", "/api/feed/notices", s=s)[1]["notices"]
    check(f"{who} is told the game is off when the host leaves", sum(x["kind"] == "called-off" and "Lily left Serve" in x["text"] for x in n) == 1, n)
    if who == "Ben": check("the next member is told the club is theirs", any("yours to run" in x["text"] for x in n), n)
call("POST", "/api/clubs/join", {"club": club, "on": False}, ben)
n = call("GET", "/api/feed/notices", s=mia)[1]["notices"]
check("leaving the club hands it on, and the next member is told", any(x["text"].startswith("Ben left E2E doubles, so it's yours to run now") for x in n), n)
for s in (ben, mia, cy): call("POST", "/api/members/leave", {}, s)
print(f"{sum(ok)} of {len(ok)} passed")
