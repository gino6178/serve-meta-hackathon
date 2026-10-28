"""Build scenes/msg.html: three short Messenger moments (#book, #knee, #score) from the end-to-end test's real
conversation (agent/test/e2e.mjs writes it; the style is scenes/pocket.html's). The words are the agent's own.
  python make_msg.py build/pocket_transcript.json"""
import json, re, sys, html, os

HERE = os.path.dirname(os.path.abspath(__file__))
t = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "build", "pocket_transcript.json"), encoding="utf-8"))
clean = lambda s: re.sub(r"\s*\[(?:F|E)\d+\]", "", s).replace(" (training)", "").strip()
agent = [x for x in t if x["from"] == "agent"]
find = lambda p: next(x for x in agent if x["text"].startswith(p))
said = lambda p: next(x["text"] for x in t if x["from"] == "player" and x["text"].startswith(p))
lines = lambda s, n: "<br>".join([html.escape(l) for l in clean(s).split("\n") if l.strip()][:n])

ask = find("Lined up")
SEG = {
    "book": {"h1": "One yes,<br>and it's booked", "feat": ["Agreed with three players' agents first", "Nothing is booked until you say yes"],
             "S": [(300, "me", html.escape(said("Line up"))), (1100, "bot", html.escape(clean(find("On it")["text"]).split(". I'll")[0] + ".")),
                   (2900, "bot", lines(ask["text"], 1), ask["buttons"]), (4700, "me", html.escape(ask["buttons"][0])), (5500, "bot", lines(find("Booked:")["text"], 3))]},
    "knee": {"h1": "What hurts becomes<br>a rule for your week", "feat": ["Filed by Muse Glimmer", "It plans around it; it never gives medical advice"],
             "S": [(300, "me", html.escape(said("My right knee"))), (1300, "bot", lines(find("Logged: right knee, sore 3/5 (after")["text"], 2)),
                   (3600, "me", "📎 serve_sample_health_export.zip"), (4500, "bot", lines(find("Read your")["text"], 2))]},
    "score": {"h1": "A scoreboard photo,<br>checked by code", "feat": ["Read on your server by Muse Glimmer", "Checked against the game's rules, then filed"],
              "S": [(300, "me", "📷 scoreboard photo"), (1200, "bot", html.escape(find("Got your photo")["text"])),
                    (2600, "bot", html.escape(find("I read")["text"]), find("I read")["buttons"]), (4600, "me", "I'm KENJI"), (5400, "bot", html.escape(find("Filed:")["text"]))]},
}
style = re.search(r"<style>.*?</style>", open(os.path.join(HERE, "scenes", "pocket.html"), encoding="utf-8").read(), re.S).group(0)
page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Messenger moments</title>
{style}</head>
<body>
<div class="wash"></div>
<div class="phone"><div class="screen">
  <div class="bar"></div>
  <div class="head"><span class="back">‹</span><div class="ava"><svg viewBox="0 0 64 64"><path d="M10 48 C 22 8, 42 8, 54 30" /><circle cx="54" cy="30" r="5" /></svg></div>
    <div><b>Serve</b><span>Your agent · active now</span></div><img class="ms" src="messenger.svg" alt=""></div>
  <div class="log" id="log"></div>
  <div class="input">Aa</div>
</div></div>
<div class="note">Real replies through the Messenger webhook, from the end-to-end test</div>
<div class="side">
  <div class="tag"><img src="messenger.svg" alt="">Facebook Messenger</div>
  <h1 id="h1"></h1>
  <div class="feat" id="f0"><i></i><div><b id="b0"></b></div></div>
  <div class="feat" id="f1"><i></i><div><b id="b1"></b></div></div>
</div>
<script>
const SEG = {json.dumps(SEG, ensure_ascii=False)};
const g = SEG[location.hash.slice(1)] || SEG.book;
document.getElementById("h1").innerHTML = g.h1;
g.feat.forEach((f, i) => document.getElementById("b" + i).textContent = f);
const log = document.getElementById("log");
const add = (el) => {{ log.appendChild(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on"))); }};
for (const [t, kind, text, btns] of g.S) {{
  if (kind === "bot") setTimeout(() => {{ const ty = document.createElement("div"); ty.className = "typing"; ty.id = "ty"; ty.innerHTML = "<i></i><i></i><i></i>"; add(ty); }}, Math.max(0, t - 650));
  setTimeout(() => {{
    document.getElementById("ty")?.remove();
    const el = document.createElement("div"); el.className = `msg ${{kind}}`; el.innerHTML = text; add(el);
    if (btns) {{ const q = document.createElement("div"); q.className = "qr"; q.innerHTML = btns.map((b) => `<span>${{b}}</span>`).join(""); add(q); }}
  }}, t);
}}
setTimeout(() => document.getElementById("f0").classList.add("on"), 1200);
setTimeout(() => document.getElementById("f1").classList.add("on"), 3800);
</script>
</body></html>
"""
open(os.path.join(HERE, "scenes", "msg.html"), "w", encoding="utf-8").write(page)
print("wrote scenes/msg.html")
