"""Publication-style figures for the technical deck (video/deck/build_report_deck.cjs embeds them, one per slide).
Every value is read from submission/results/ or is a number the technical report states; 95% intervals are the
result files' own where they have them, otherwise Wilson intervals on the stated counts.
   python video/deck/figures.py        -> video/deck/figs/<name>.png (and .pdf)
"""
import json, math, os, sys
import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RES = os.path.join(ROOT, "submission", "results")
OUT = os.path.join(os.path.dirname(__file__), "figs")
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, os.path.expanduser("~/.claude/skills/nature-figure/scripts"))
try:
    from audit_panel_alignment import require_matplotlib_panel_alignment
except Exception:  # the gate is optional when the skill is not installed
    require_matplotlib_panel_alignment = None

# one style for every figure: slide-sized, so text is 12-14 pt at the size it is shown
mpl.rcParams.update({
    "font.family": "sans-serif", "font.sans-serif": ["Arial", "DejaVu Sans"], "font.size": 13,
    "axes.titlesize": 14, "axes.titleweight": "bold", "axes.titlelocation": "left", "axes.labelsize": 13,
    "xtick.labelsize": 12, "ytick.labelsize": 12, "legend.fontsize": 12, "legend.frameon": False,
    "axes.spines.right": False, "axes.spines.top": False, "axes.linewidth": 1.0, "xtick.major.width": 1.0,
    "ytick.major.width": 1.0, "pdf.fonttype": 42, "svg.fonttype": "none", "figure.dpi": 100,
})
INK, GREY, LIGHT, GREEN, RED, BLUE, AMBER = "#1A1A1A", "#8A8A92", "#D9DCDB", "#0A7F44", "#C8382E", "#2F6FD0", "#B26A00"
W, H = 11.0, 4.6  # inches, the slide's figure area
WHITE = dict(facecolor="white", edgecolor="none", pad=1.5)


def wilson(k, n, z=1.96):
    if n == 0: return (0, 0)
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); r = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((c - r) / d, (c + r) / d)


def load(name):
    with open(os.path.join(RES, name), encoding="utf-8") as f: return json.load(f)


def panel(ax, letter):
    ax.text(-0.08, 1.08, letter, transform=ax.transAxes, fontsize=16, fontweight="bold", va="bottom", ha="left")


def save(fig, name, aligned=False):
    if aligned and require_matplotlib_panel_alignment:
        fig.canvas.draw()
        require_matplotlib_panel_alignment(fig, json_out=os.path.join(OUT, f"{name}.alignment.json"), tolerance_pt=1.5, gutter_tolerance_pt=1.5, strict=False)
    fig.savefig(os.path.join(OUT, f"{name}.png"), dpi=220, bbox_inches="tight", pad_inches=0.15, facecolor="white")
    fig.savefig(os.path.join(OUT, f"{name}.pdf"), bbox_inches="tight", pad_inches=0.15, facecolor="white")
    plt.close(fig)
    print("wrote", name)


def hbar_ci(ax, labels, vals, lo=None, hi=None, colors=None, fmt="{:.1f}", xlabel="", xmax=None):
    y = np.arange(len(labels))[::-1]
    colors = colors or [GREY] * len(labels)
    ax.barh(y, vals, color=colors, height=0.6, zorder=2)
    if lo is not None:
        ax.errorbar(vals, y, xerr=[np.array(vals) - np.array(lo), np.array(hi) - np.array(vals)], fmt="none", ecolor=INK, elinewidth=1.2, capsize=4, zorder=3)
    for yy, v, h in zip(y, vals, hi if hi is not None else vals):
        ax.text(h + (xmax or max(vals)) * 0.015, yy, fmt.format(v), va="center", fontsize=12, color=INK)
    ax.set_yticks(y, labels); ax.set_xlabel(xlabel)
    if xmax: ax.set_xlim(0, xmax)
    ax.tick_params(axis="y", length=0); ax.spines["left"].set_visible(False)


# 1. the pain
def fig_pain():
    fig, (a, b) = plt.subplots(1, 2, figsize=(W, H), gridspec_kw={"width_ratios": [1, 1.6], "wspace": 0.55})
    a.bar(["18 to 21", "26 to 49"], [40, 26], color=[GREY, RED], width=0.55, zorder=2)
    for x, v in enumerate([40, 26]): a.text(x, v + 1, f"{v}%", ha="center", fontsize=13)
    a.set_ylabel("Play a sport (%)"); a.set_ylim(0, 50); a.set_xlabel("Age (years)"); a.set_title("Who plays, by age"); panel(a, "a")
    hbar_ci(b, ["Times hard to fit around\nother commitments", "No way to keep\nthe habit going", "No regular people\nto play with"], [64.2, 21.3, 10.2], colors=[RED, GREY, GREY], xlabel="Adults naming the barrier (%)", xmax=80)
    b.set_title("What stops adults playing regularly"); panel(b, "b")
    save(fig, "pain", aligned=False)


# 2. agent testing, round by round
def fig_rounds():
    r = np.arange(6, 26)
    bugs = [5, 9, 10, 10, 13, 6, 19, 16, 11, 8, 9, 7, 10, 9, 9, 2, 2, 3, 4, 0]
    clean = [2, 1, 2, 1, 1, 2, 1, 2, 2, 2, 2, 2, 1, 1, 2, 4, 4, 3, 4, 6]
    fig, (a, b) = plt.subplots(2, 1, figsize=(W, H + 0.6), sharex=True, gridspec_kw={"hspace": 0.35})
    for ax in (a, b): ax.axvspan(20.5, 25.5, color="#EEF5F0", zorder=0)
    a.bar(r, bugs, color=[RED if x < 21 else "#E79A93" for x in r], width=0.7, zorder=2)
    a.set_ylabel("Bugs reported"); a.set_ylim(0, 22); a.set_title("Bugs reported per round"); panel(a, "a")
    a.text(23, 18, "core flows only\n(from round 21)", ha="center", fontsize=11, color=GREEN)
    b.plot(r, clean, "-o", color=GREEN, lw=2, ms=6, zorder=3)
    b.set_ylim(0, 7.2); b.set_yticks(range(0, 7)); b.set_ylabel("Clean reports (of 6)"); b.set_xlabel("Testing round")
    b.set_title("Testers whose report came back clean"); panel(b, "b"); b.set_xticks(r)
    b.text(24.4, 6.55, "6 of 6 in round 25", ha="right", va="center", fontsize=12, color=GREEN)
    save(fig, "rounds", aligned=True)


# 3. every tester session from the logs
def fig_swarm():
    d = json.load(open(os.path.join(ROOT, "video/shotcraft/public/swarm/sessions.json"), encoding="utf-8"))["sessions"]
    ss = sorted(d, key=lambda s: (s["round"], s["who"]))
    fig, ax = plt.subplots(figsize=(W, H + 0.8))
    xs, ys, cs = [], [], []
    for i, s in enumerate(ss):
        for t, _m, _p, st in s["steps"]:
            xs.append(t / 60); ys.append(i); cs.append(GREEN if st < 400 else AMBER if st < 500 else RED)
    ax.scatter(xs, ys, c=cs, s=4, marker="s", linewidths=0, rasterized=True)
    ticks, labels, last = [], [], None
    for i, s in enumerate(ss):
        if s["round"] != last:
            ax.axhline(i - 0.5, color="#EEEEEE", lw=0.6, zorder=0)
            if s["round"] % 3 == 1: ticks.append(i); labels.append(f"round {s['round']}")
            last = s["round"]
    ax.set_yticks(ticks, labels); ax.invert_yaxis(); ax.set_xlim(0, 13); ax.set_xlabel("Minutes since the session began")
    ax.set_ylabel(f"Tester sessions (n = {len(ss)})"); ax.tick_params(axis="y", length=0)
    from matplotlib.lines import Line2D
    ax.legend([Line2D([], [], marker="s", ls="", color=GREEN, ms=7), Line2D([], [], marker="s", ls="", color=AMBER, ms=7)],
              ["2xx answered", "4xx refused, not found or invalid"], loc="upper right", bbox_to_anchor=(1, -0.1), ncol=2)
    save(fig, "swarm")


# 4. holds and fairness
def fig_holds():
    fig, (a, b) = plt.subplots(1, 2, figsize=(W, H), gridspec_kw={"wspace": 0.45})
    ks, n = [11, 0], 12
    lo, hi = zip(*[wilson(k, n) for k in ks])
    v = [k / n * 100 for k in ks]
    a.bar(["Without holds", "With holds"], v, color=[RED, GREEN], width=0.55, zorder=2)
    a.errorbar([0, 1], v, yerr=[np.array(v) - np.array(lo) * 100, np.array(hi) * 100 - np.array(v)], fmt="none", ecolor=INK, capsize=5, lw=1.2)
    for x, (k, vv, h) in enumerate(zip(ks, v, hi)): a.text(x, h * 100 + 3, f"{k} of {n}", ha="center", fontsize=12)
    a.set_ylabel("Pairs of talks that booked\none member twice (%)"); a.set_ylim(0, 110); a.set_title("Two talks at once for one member"); panel(a, "a")
    hbar_ci(b, ["Minimax (Serve)", "Shortest total trip", "Nash product"], [0.73, 0.59, 0.58], colors=[GREEN, GREY, GREY], fmt="{:.2f}", xlabel="Fairness score of the booked games", xmax=0.9)
    b.set_title("Venue rule, 12 simulated games"); panel(b, "b")
    save(fig, "holds")


# 5. ranking by the chance everyone says yes
def fig_ranking():
    d = load("rank_calls.json")
    fig, (a, b) = plt.subplots(1, 2, figsize=(W, H), gridspec_kw={"width_ratios": [1.5, 1], "wspace": 0.4})
    x = np.arange(2); wd = 0.36
    for k, (key, lab, col) in enumerate([("counts", "Most players free (before)", GREY), ("prob", "Chance all say yes (now)", GREEN)]):
        v = [d[f][key]["firstKeepsEveryone"] * 100 for f in ("singles", "doubles")]
        lo = [d[f][key]["ci"][0] * 100 for f in ("singles", "doubles")]; hi = [d[f][key]["ci"][1] * 100 for f in ("singles", "doubles")]
        a.bar(x + (k - 0.5) * wd, np.array(v) - 50, wd, bottom=50, color=col, label=lab, zorder=2)
        a.errorbar(x + (k - 0.5) * wd, v, yerr=[np.array(v) - lo, np.array(hi) - v], fmt="none", ecolor=INK, capsize=4, lw=1.1)
        for xx, vv, hh in zip(x + (k - 0.5) * wd, v, hi): a.text(xx, hh + 1, f"{vv:.1f}", ha="center", fontsize=11)
    a.set_xticks(x, ["Singles", "Doubles"]); a.set_ylim(50, 100); a.set_ylabel("First time proposed keeps\nevery player's rules (%)")
    a.legend(loc="upper center", bbox_to_anchor=(0.5, -0.12), ncol=2); a.set_title("3,000 simulated requests each"); panel(a, "a")
    v = [d["doubles"][k]["modelChoicesPerRequest"] for k in ("counts", "prob")]
    b.bar(["Before", "Now"], v, color=[GREY, GREEN], width=0.55, zorder=2)
    for xx, vv in enumerate(v): b.text(xx, vv + 0.008, f"{vv:.3f}", ha="center", fontsize=12)
    b.set_ylabel("Model choices per doubles request"); b.set_ylim(0, 0.32); b.set_title("Fewer choices left to a model"); panel(b, "b")
    save(fig, "ranking")


# 6. value of information
def fig_voi():
    g = load("voi_sim.json")["games"]
    keys = [("none", "No question"), ("random", "A random question"), ("likeliest", "The likeliest pair"), ("voi", "Value of information")]
    fig, ax = plt.subplots(figsize=(W * 0.8, H))
    hbar_ci(ax, [l for _, l in keys], [g[k]["rate"] * 100 for k, _ in keys], [g[k]["ci"][0] * 100 for k, _ in keys], [g[k]["ci"][1] * 100 for k, _ in keys],
            colors=[GREY, GREY, GREY, GREEN], xlabel="Game found after one question and one talk (%)", xmax=62)
    ax.set_title("20,000 simulated requests per strategy (8 players, 6 times)")
    save(fig, "voi")


# 7. canary rollback
def fig_canary():
    fig, ax = plt.subplots(figsize=(6.0, 2.9))
    k1, k2, n = round(0.006 * 20000), round(0.22 * 20000), 20000
    labels = ["z-test,\nevery look", "Anytime-valid\ne-process (Serve)"]
    vals = [22, 0.6]; ci = [wilson(k2, n), wilson(k1, n)]
    hbar_ci(ax, labels, vals, [c[0] * 100 for c in ci], [c[1] * 100 for c in ci], colors=[RED, GREEN], xlabel="Harmless changes rolled back (%)", xmax=28)
    ax.set_title("Harmless changes rolled back")
    save(fig, "canary")


# 8. the 1B's threshold curve
def fig_threshold():
    th = [0, 0.5, 0.6, 0.7, 0.8, 0.9]
    hard_ans, hard_agr = [100, 96.9, 73.0, 50.0, 34.2, 27.6], [60.7, 61.2, 68.4, 75.5, 75.0, 75.5]
    test_ans, test_agr = [100, 99.0, 96.0, 92.6, 87.4, 78.4], [89.4, 89.6, 89.9, 90.7, 90.9, 90.0]
    fig, (a, b) = plt.subplots(1, 2, figsize=(W, H), sharey=True, gridspec_kw={"wspace": 0.12})
    for ax, ans, agr, self_, ttl, letter in [(a, test_ans, test_agr, 88.3, "Ordinary choices (n = 500)", "a"), (b, hard_ans, hard_agr, 73.5, "Hardest choices (n = 196)", "b")]:
        ax.axvline(0.6, color=LIGHT, lw=6, zorder=0)
        ax.plot(th, ans, "-o", color=GREEN, lw=2, ms=6, label="share it answers")
        ax.plot(th, agr, "-s", color=BLUE, lw=2, ms=6, label="agreement with Glimmer")
        ax.axhline(self_, color=GREY, ls="--", lw=1.2); ax.text(0.02, self_ + 3.5, f"Glimmer vs itself {self_}%", fontsize=11, color=GREY, bbox=WHITE)
        ax.set_xlabel("Confidence threshold"); ax.set_title(ttl); ax.set_ylim(0, 105); panel(ax, letter); ax.set_xticks(th)
        ax.text(0.64, 101, "served (0.6)", ha="left", va="bottom", fontsize=11, color=INK)
    a.set_ylabel("%"); a.legend(loc="lower left", bbox_to_anchor=(0, 0.12))
    save(fig, "threshold", aligned=True)


# 9. calibration
def fig_calibration():
    c = load("student_calibration.json")["sets"]["test"]["calibration"]
    bins = [x for x in c["bins"] if x["n"] >= 5]
    fig, ax = plt.subplots(figsize=(W * 0.62, H + 0.4))
    ax.plot([0.5, 1], [0.5, 1], ls="--", color=GREY, lw=1.2, label="perfect calibration")
    for x in bins:
        lo, hi = wilson(round(x["agreement"] * x["n"]), x["n"])
        ax.errorbar(x["confidence"], x["agreement"], yerr=[[x["agreement"] - lo], [hi - x["agreement"]]], fmt="o", color=GREEN, ms=4 + 10 * math.sqrt(x["n"] / 404), capsize=4, lw=1.2)
        above = x["agreement"] >= x["confidence"]
        ax.text(x["confidence"] + 0.03, (hi + 0.02) if above else (lo - 0.02), f"n = {x['n']}", ha="left", va="bottom" if above else "top", fontsize=10, color=GREY)
    ax.set_xlim(0.5, 1.02); ax.set_ylim(0.3, 1.02); ax.set_xlabel("The 1B's confidence (bin mean)"); ax.set_ylabel("Agreement with Glimmer")
    ax.set_title(f"Reliability, 500 held-out cases; ECE {c['ece']:.3f}"); ax.legend(loc="upper left")
    save(fig, "calibration")


# 10. one decision as the 1B reads it (case s009)
def fig_case():
    fig, (a, b) = plt.subplots(1, 2, figsize=(W, H - 0.4), gridspec_kw={"wspace": 0.55})
    names, pw = ["t1 (asked)", "t2", "t3", "t4", "t5"], [0.0, 1.0, 1.0, 1.0, 1.0]
    hbar_ci(a, names, pw, colors=[RED, GREEN, GREEN, GREEN, GREEN], fmt="{:.1f}", xlabel="P(works) at the marker", xmax=1.2)
    a.text(0.16, 4, "breaks the member's rule", va="center", fontsize=11, color=RED)
    a.set_title("Its reading of each time"); panel(a, "a")
    opts, pr = ["t2", "t3", "t4", "t5", "can't play"], [0.673, 0.318, 0.008, 0.001, 0.0001]
    hbar_ci(b, opts, pr, colors=[GREEN, GREY, GREY, GREY, GREY], fmt="{:.3f}", xlabel="Probability (softmax over valid letters)", xmax=0.85)
    b.axvline(0.6, color=INK, ls="--", lw=1.2); b.text(0.62, 3.4, "threshold 0.6", fontsize=11, bbox=WHITE)
    b.set_title("Its choice: t2, as Glimmer chose twice"); panel(b, "b")
    save(fig, "case")


# 11. three training rounds and round 4's variants
def fig_rounds_1b():
    fig, (a, b) = plt.subplots(1, 2, figsize=(W, H), gridspec_kw={"width_ratios": [1, 1.5], "wspace": 0.5})
    labs, v = ["1. private\ncalendars", "2. + asked\ntimes", "3. letters in\ntime order"], [58.7, 69.4, 69.4]
    lo, hi = zip(*[wilson(round(x / 100 * 196), 196) for x in v])
    a.bar(labs, np.array(v) - 40, bottom=40, color=[GREY, GREY, GREEN], width=0.6, zorder=2)
    a.errorbar(range(3), v, yerr=[np.array(v) - np.array(lo) * 100, np.array(hi) * 100 - np.array(v)], fmt="none", ecolor=INK, capsize=4, lw=1.1)
    a.axhline(73.5, color=GREY, ls="--", lw=1.2); a.text(-0.4, 80, "Glimmer vs itself 73.5%", fontsize=11, color=GREY, bbox=WHITE)
    a.set_ylim(40, 85); a.set_ylabel("Agreement on the hardest (%)"); a.set_title("Rounds 1 to 3 (3B student)"); panel(a, "a")
    var = [("1b_v3 (served)", 68.5, 13.2), ("rerun baseline", 71.5, 15.6), ("order augmentation", 69.9, 1.6), ("+ more teacher answers", 73.0, 11.6), ("+ soft labels, T = 2", 66.3, 14.4)]
    for name, agr, flip in var:
        col = GREEN if "teacher" in name else (BLUE if "order" in name else GREY)
        b.scatter(flip, agr, s=110, color=col, zorder=3)
        b.annotate(name, (flip, agr), (6, 6), textcoords="offset points", fontsize=11)
    b.axhline(76.7, color=GREY, ls="--", lw=1.2); b.text(0.3, 78.0, "Glimmer vs its majority 76.7%", fontsize=11, color=GREY, bbox=WHITE)
    b.set_xlim(0, 22); b.set_ylim(62, 80); b.set_xlabel("Picks changed when the list is reversed (%)"); b.set_ylabel("Hardest vs Glimmer's majority (%)")
    b.set_title("Round 4 variants (1B, bf16)"); panel(b, "b")
    save(fig, "rounds_1b")


# 12. speed per choice
def fig_speed():
    fig, ax = plt.subplots(figsize=(W * 0.8, H - 0.3))
    labels, v = ["Tiny layer (27.6 KB, CPU)", "Our 1B (int4, CPU)", "One-token decider (GPU)", "Glimmer full answer (GPU)"], [0.00006, 0.9, 0.53, 40]
    y = np.arange(4)[::-1]
    ax.barh(y, v, color=[GREEN, GREEN, GREY, RED], height=0.6, zorder=2); ax.set_xscale("log"); ax.set_xlim(1e-5, 300)
    for yy, vv in zip(y, v): ax.text(vv * 1.4, yy, f"{vv * 1000:.2f} ms" if vv < 0.01 else f"{vv:g} s", va="center", fontsize=12)
    ax.set_yticks(y, labels); ax.tick_params(axis="y", length=0); ax.spines["left"].set_visible(False)
    ax.set_xlabel("Seconds per choice (log scale)"); ax.set_title("Time for one choice between times")
    save(fig, "speed")


# 13. the tiny layer against the 1B
def fig_tiny():
    fig, ax = plt.subplots(figsize=(W * 0.85, H))
    sys_ = ["Tiny layer\n(27.6 KB)", "Our 1B\n(0.8 GB)", "Glimmer\nvs itself", "First listed\ntime"]
    test, hard = [88.5, 89.5, 88.8, 82.7], [69.4, 63.3, 73.5, 58.2]
    x = np.arange(4); wd = 0.36
    for k, (vals, n, lab, col) in enumerate([(test, 500, "Ordinary choices (n = 500)", GREY), (hard, 196, "Hardest choices (n = 196)", GREEN)]):
        lo, hi = zip(*[wilson(round(v / 100 * n), n) for v in vals])
        ax.bar(x + (k - 0.5) * wd, np.array(vals) - 40, wd, bottom=40, color=col, label=lab, zorder=2)
        ax.errorbar(x + (k - 0.5) * wd, vals, yerr=[np.array(vals) - np.array(lo) * 100, np.array(hi) * 100 - np.array(vals)], fmt="none", ecolor=INK, capsize=3, lw=1)
        for xx, vv, hh in zip(x + (k - 0.5) * wd, vals, hi): ax.text(xx, hh * 100 + 1, f"{vv:.1f}", ha="center", fontsize=10.5)
    ax.set_xticks(x, sys_); ax.set_ylim(40, 100); ax.set_ylabel("Agreement with Glimmer (%)"); ax.legend(loc="upper right", ncol=2)
    ax.set_title("Over all held-out cases")
    save(fig, "tiny")


# 14. the text 1B on the held-out attack set
def fig_text1b():
    fig, ax = plt.subplots(figsize=(W * 0.85, H))
    groups = ["Hostile comments passed", "Hostile comments passed,\nwith an injection", "Bad courts judged \"good\"\nby a poisoned review"]
    data = {"Old serve-1b": [(65, 71), (65, 71), (98, 180)], "New text 1B": [(8, 71), (5, 71), (7, 180)], "Muse Glimmer": [(0, 71), (0, 71), (5, 180)]}
    cols = {"Old serve-1b": RED, "New text 1B": GREEN, "Muse Glimmer": GREY}
    x = np.arange(3); wd = 0.26
    for k, (name, ks) in enumerate(data.items()):
        v = [a / b * 100 for a, b in ks]; lo, hi = zip(*[wilson(a, b) for a, b in ks])
        ax.bar(x + (k - 1) * wd, v, wd, color=cols[name], label=name, zorder=2)
        ax.errorbar(x + (k - 1) * wd, v, yerr=[np.array(v) - np.array(lo) * 100, np.array(hi) * 100 - np.array(v)], fmt="none", ecolor=INK, capsize=3, lw=1)
        for xx, (a_, b_), hh in zip(x + (k - 1) * wd, ks, hi): ax.text(xx, hh * 100 + 2, f"{a_}/{b_}", ha="center", fontsize=10)
    ax.set_xticks(x, groups); ax.set_ylim(0, 110); ax.set_ylabel("Attacks that succeeded (%)"); ax.legend(loc="upper right")
    ax.set_title("446 held-out items, attack templates not used in training; the model alone, no guards in front")
    save(fig, "text1b")


# 15. six flow fixes
def fig_fixes():
    fig, (a, b) = plt.subplots(1, 2, figsize=(W, H), gridspec_kw={"width_ratios": [1.5, 1], "wspace": 0.4})
    labs = ["False \"booked\"", "Asker left\nwaiting", "Searches\nthat looped", "Asked again\nafter a no"]
    before, after = [12, 19, 16, 19], [0, 0, 0, 0]
    x = np.arange(4); wd = 0.36
    a.bar(x - wd / 2, before, wd, color=RED, label="Before the fixes", zorder=2); a.bar(x + wd / 2, [0.15] * 4, wd, color=GREEN, label="After", zorder=2)
    for xx, v in zip(x, before): a.text(xx - wd / 2, v + 0.5, str(v), ha="center", fontsize=11); a.text(xx + wd / 2, 0.6, "0", ha="center", fontsize=11, color=GREEN)
    a.set_xticks(x, labs); a.set_ylabel("Runs with the failure (of 160)"); a.set_ylim(0, 23); a.legend(loc="upper left")
    a.set_title("Difficult club, code-only slice (20 requests x 8)"); panel(a, "a")
    k = np.array([1, 4]); wd2 = 0.26
    for j, (name, v, col) in enumerate([("Cooperative club", [0.69, 0.50], GREY), ("Difficult, before", [0.38, 0.25], RED), ("Difficult, after", [0.47, 0.38], GREEN)]):
        b.bar(np.arange(2) + (j - 1) * wd2, v, wd2, color=col, label=name, zorder=2)
        for xx, vv in zip(np.arange(2) + (j - 1) * wd2, v): b.text(xx, vv + 0.015, f"{vv:.2f}", ha="center", fontsize=10)
    b.set_xticks(range(2), ["pass^1", "pass^4"]); b.set_ylabel("Share of requests passed")
    b.set_ylim(0, 1.05); b.legend(loc="upper right", fontsize=10.5, ncol=1); b.set_title("With Muse Glimmer (8 x 4)"); panel(b, "b")
    save(fig, "fixes")


# 16. the upgrades measured since the report, each before and after
def fig_upgrades():
    items = [("Send gate", "opt-outs (%)", 37.7, 26.2, True, "simulated"), ("Preference records", "stale decisions (%)", 95, 17, True, "simulated"),
             ("Tool-call checks", "silent failures passed (%)", 100, 0, True, "fault injected"), ("Courts judged ahead", "wait after a time change (s)", 49.0, 25.7, True, "RTX 3090"),
             ("Stretch round", "doubles games found (%)", 84.1, 85.4, False, "simulated"), ("Tiny layer vs 1B", "hardest (%)", 63.3, 69.4, False, "held out")]
    fig, axs = plt.subplots(2, 3, figsize=(W, H + 1.2), gridspec_kw={"wspace": 0.35, "hspace": 0.75})
    for ax, (name, metric, a_, b_, lower_better, how) in zip(axs.flat, items):
        good = (b_ < a_) if lower_better else (b_ > a_)
        ax.plot([0, 1], [a_, b_], "-", color=GREEN if good else RED, lw=2.5)
        ax.scatter([0, 1], [a_, b_], color=[GREY, GREEN if good else RED], s=70, zorder=3)
        for xx, v in [(0, a_), (1, b_)]: ax.text(xx + (-0.25 if xx == 0 else 0.25), v, f"{v:g}", ha="right" if xx == 0 else "left", va="center", fontsize=11)
        lo, hi = min(a_, b_), max(a_, b_); pad = (hi - lo) * 0.25 + 1
        ax.set_ylim(lo - pad, hi + pad); ax.set_xlim(-1.0, 2.0); ax.set_xticks([0, 1], ["before", "after"]); ax.set_yticks([])
        ax.spines["left"].set_visible(False); ax.set_title(f"{name}", fontsize=13); ax.set_xlabel(f"{metric}\n{how}", fontsize=11)
    save(fig, "upgrades")


# 17. order sensitivity
def fig_order():
    fig, ax = plt.subplots(figsize=(W * 0.8, H - 0.3))
    rows = [("One-token decider, list reversed", 178, 196, RED), ("Glimmer, each member's own order", 24, 60, AMBER), ("Glimmer, asked again in the same order", 52, 196, GREY), ("Our 1B, list reversed", 35, 173, GREEN)]
    v = [k / n * 100 for _, k, n, _ in rows]; ci = [wilson(k, n) for _, k, n, _ in rows]
    hbar_ci(ax, [r[0] for r in rows], v, [c[0] * 100 for c in ci], [c[1] * 100 for c in ci], colors=[r[3] for r in rows], xlabel="Picks that changed (%)", xmax=110)
    ax.set_title("Only the order of the listed times changed (the 196 hardest cases)")
    save(fig, "order")


if __name__ == "__main__":
    for f in [fig_pain, fig_rounds, fig_swarm, fig_holds, fig_ranking, fig_voi, fig_canary, fig_threshold, fig_calibration, fig_case, fig_rounds_1b, fig_speed, fig_tiny, fig_text1b, fig_fixes, fig_upgrades, fig_order]:
        f()
