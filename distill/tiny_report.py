"""submission/results/tiny.json from the tiny models' runs: distill/tiny_times.py's and distill/tiny_mod.py's results and
distill/tiny_bench.mjs's sizes and CPU times.
  python distill/tiny_report.py times_results.json mod_results.json bench.json submission/results/tiny.json
"""
import json, sys

T, M, B, OUT = sys.argv[1:5]
t, m, b = (json.load(open(f, encoding="utf8")) for f in (T, M, B))
pick = lambda d, ks: {k: d[k] for k in ks if k in d}
cols = ["cases", "answered", "answered_share", "disagreement_answered", "disagreement_over_all", "with_student"]
out = {
    "about": "The tiny layer (agent/src/agents/tiny.js, A2A_TINY; agent/src/feed/tiny_text.js via feed/moderation.js prefilter, FEED_TINY), both off by default. docs/tiny_models.md.",
    "cpu": b["cpu"],
    "times": {
        "data": "real teacher labels: Muse Glimmer's choices on the student's teacher sets (simulated club members); test = seed 7, 500 cases x 3 answers; decider = the one-pass decider's 196 cases, graded against `full`",
        "size_kb": b["times"]["file_kb"], "model": t["model"], "latency_ms": pick(b["times"], ["ms_p50", "ms_p95", "ms_max", "calls"]), "js_vs_trainer_max_abs_diff": b["times"]["parity_max_abs_diff"],
        "agreement_with_glimmer_all_cases": {"test": t["test"]["agreement_all"], "decider": t["decider"]["agreement_all"],
                                             "reference": {"glimmer_with_itself_test": t["test"].get("glimmer_self_agreement"), "glimmer_full2_vs_full_decider": t["decider"].get("glimmer_full2_agreement"),
                                                           "first_listed_test": t["test"]["first_listed_agreement"], "first_listed_decider": t["decider"]["first_listed_agreement"],
                                                           "student_1b_test": 0.895, "student_1b_decider": 0.633, "student_source": "docs/decision_model.md (bf16, each answer / vs full)"}},
        "stated_preference_decider": t["decider"].get("stated_preference"),
        "thresholds": t["thresholds"],
        "served_threshold": {"test": pick(t["at_strict_threshold"]["test"], cols), "decider": pick(t["at_strict_threshold"]["decider"], cols)} if "at_strict_threshold" in t else None,
        "crc_threshold_5pct_over_all_cases": {"test": pick(t["at_crc_threshold"]["test"], cols), "decider": pick(t["at_crc_threshold"]["decider"], cols)} if "at_crc_threshold" in t else None,
        "coverage_at_fixed_disagreement_oracle": t["coverage_at_fixed_disagreement_oracle"],
        "other_sets_at_served": t["other_sets"] if t["thresholds"]["served"] == t["thresholds"].get("crc_all_cases") else "see distill/tiny_times.py output",
        "notes": ["with_student: the bf16 1B student's saved probabilities (sure at 0.6 with its reading of which times work right); Glimmer calls are those the student leaves (the decider and A2A_AGREE tiers not counted)",
                  "cascade agreement: the tiny layer where it answers, the student where sure, else Glimmer (test: its first answer graded against the other two; decider: full2 against full)"],
    },
    "moderation": {
        "data": "simulated: synthetic comments (templates and Muse Glimmer-written chat), labeled by Prompt Guard 2, code, Llama Guard 3 1B and Muse Glimmer's feed.standard",
        "size_kb": b["text"]["file_kb"], "weights_kb": b["text"]["weights_kb"], "latency_ms": pick(b["text"], ["ms_p50", "ms_p95", "ms_max", "calls"]), "js_vs_trainer_mismatches": f'{b["text"]["parity_mismatches"]} of {b["text"]["of"]}',
        "labels": m["labels"], "model": m["model"], "thresholds": m["thresholds"], "test_held_out": m["test"], "train": m["train"],
    },
}
json.dump(out, open(OUT, "w", encoding="utf8"), indent=1, ensure_ascii=False)
print("wrote", OUT)
