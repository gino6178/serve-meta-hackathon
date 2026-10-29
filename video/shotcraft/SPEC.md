# Serve demo film: design spec (video-shotcraft, autonomous mode)

## 0. Product brief

- **Product**: Serve, an agent that gets you playing in any ball sport. Each player's agent agrees games with the other
  players' agents (A2A); the player says yes once. Built on Muse Glimmer (Meta's open-weights model) on an RTX 3090.
- **Film's job**: the Meta Global AI Developer Hackathon demo video (rules: 3 minutes at most). Judges score Impact
  30%, Use of Meta AI 25%, Technical depth 20%, Demo 25%. Their reviews asked to see the real product running, real
  players, honest speed-ups, and less "sports analysis".
- **Audience**: Meta engineering directors, PMs, researchers. English on screen.
- **Must show**: the problem; the real app (asking the agent, the invite, a friend with no account joining, "Game on",
  agents negotiating word for word, clubs on a real map); the Meta models that carry it; safety, measured; who else it
  serves; real usage; the close.
- **Data**: test accounts on this machine only (Mia, Leo), the demo club's labelled simulated members, real
  OpenStreetMap courts (NTU Gymnasium). No personal data. Numbers only as measured (the deck's).

## Decision table (requirement → what the film does)

| Requirement | Decision |
|---|---|
| ≤ 3 min | About 2:27 (4,423 frames at 30 fps, the close held 45 frames) |
| Real product, not mock-ups | The live segment is screen recordings of the running app (record_live.mjs) against the real gateway code, Muse Glimmer and Llama Guard on the GPU server |
| Speed-ups visible | Every slice faster than 1× carries a "N× speed" pill in the frame's bottom band |
| No sports analysis | The one video shot is an auto-cut clip to share, labelled "not a coach, not a sports analyzer"; the planner's tool is shown as check_limits |
| Honest numbers | 93/93 attacks with 37 of 42 unsafe messages refused beside it; live counts dated 29 Oct |
| Music optional | Two renders from one timeline: with and without music (`bgm` prop) |

## 1. Visual direction (styleframe skipped)

Skipped because the product has a strict design system (web/src/theme.css) and the deck already uses it. Tokens:
white `#ffffff` / surface `#f5f5f6`, ink `#0a0a0b`, secondary `#5c5f66`, the agent green `#0a7f44` (the only
accent), near-blue `#1f6fd6` (the friend's phone), red `#d1352b` (failures only); system-ui / Segoe UI, 650–800
weights, tight tracking (−0.02 to −0.045em); radii 18–34. Motion personality: "friendly community" preset
(entries ~26f, bezier(0.25,0.46,0.45,0.94), small overshoot) with the cards' own tuned springs kept.

## 2. Feature → shot mapping (Gallery cards; demos read in full, parameters kept)

| Feature | Card · style | Demo source |
|---|---|---|
| The problem (group chat) | list-stack-press | demos/ui-entrance/list-stack-press/ListStackPress.tsx |
| Brand | letterspace-materialize | demos/opening/letterspace-materialize/LetterspaceMaterialize.tsx |
| Fine-tune and cascade (40 s → 0.9 s, 89.5%) | blur-slide | demos/typography/blur-slide/BlurSlide.tsx |
| Auto-cut clip to share | push-in on footage (own) | src/serve/AutoClip.tsx |
| The product, at a glance | radial-ripple-phone-chips | demos/effects/radial-ripple-phone-chips/RadialRipplePhoneChips.tsx |
| The real app (5 recordings) | brand-frame-snap (frame + window drop + one-frame flip, 2 flips) | demos/effects/brand-frame-snap/BrandFrameSnap.tsx |
| Meta models | card-stack | demos/ui-entrance/card-stack/CardStack.tsx |
| Safety, measured | slam-entrance-moves · score-slam | demos/effects/slam-entrance-moves/ScoreSlam.tsx |
| Who else it serves | vertical-word-roll-blur-cycle | demos/typography/vertical-word-roll-blur-cycle/VerticalWordRollBlurCycle.tsx |
| Real usage | card-flip-reveal | demos/transition/card-flip-reveal/CardFlipReveal.tsx |
| Close | logo-shrink-wordmark-lockup | demos/outro/logo-shrink-wordmark-lockup/LogoShrinkWordmarkLockup.tsx |

Cut on purpose: gauge-readout (the cascade shot carries the numbers). The 40% → 26% stat now sits in the cold open.

## 3. Storyboard and frame timeline (30 fps, 4,423 frames, 2:27; the table below predates the second review, see STORYBOARD_zh.md for current timings)

| # | From | Frames | Shot | Main motion | Sound |
|---|---|---|---|---|---|
| 1 | 0 | 205 | Cold open: the chat piles up, "Games booked: 0"; "People don't quit the game. They quit organizing it."; 40% → 26% with its source | stack-press, counter roll, blur reveal | pop ×6, swoosh ×2 |
| 2 | 205 | 96 | "serve" drawn in; "Play more. Manage less." | synchronous stroke | soft transition, sparkle |
| 3 | 301 | 156 | Phone with real screens; chips "Your week, agreed agent to agent", "One yes from you"; "Built on Muse Glimmer, on my RTX 3090" | rings, scroll, chip pops | whoosh-big, pops |
| 4 | 457 | 2806 | Live, in three acts, each opened by a 1.5 s card. Act 1, cold start: ask (Glimmer at 10×, Llama Guard at 8×), Leo joins with no account, Leo and Mia side by side, "Game on". Act 2, A2A: Plan my week (16×), agreed, one yes in Messenger (1.5×), Hana's counter-offer marked. Act 3: courts (Prompt Guard 2 then Glimmer, 14×), clubs (4×). A pill in the top band names the Meta model at work | frame, act cards, split, mark, model pill | snap, swooshes on cards, keyboard, clicks, pop on the mark |
| 5 | 3263 | 150 | Auto-cut clip to share (CC BY footage); not a coach, not a sports analyzer | push-in | soft transition |
| 6 | 3413 | 165 | Six Meta models, Glimmer at the centre; the other nine named | card stack → fan → lift | swoosh, whoosh-fast, snap |
| 7 | 3578 | 225 | Teacher 40 s → student fine-tuned here 0.9 s → cascade 89.5% agreement; 54–67% fewer Glimmer answers | blur-slide columns | swoosh ×3 |
| 8 | 3803 | 165 | 93 / 93 attacks stopped; Rule of Two; 37 of 42 unsafe refused; disclosure budget 97.6% → 32.4% | score-slam (big hit 1) | impact |
| 9 | 3968 | 150 | Live since 29 October: 8 players, 2 clubs, 7 joins | card flips | swoosh ×3 |
| 10 | 4118 | 180 | Built for your club / a school club / older adults / a charity cup / any ball sport | word roll | swoosh ×4 |
| 11 | 4298 | 132 + 45 hold | Logo lockup, motto, "Built Oct 28 – Nov 4, 2026, 900+ commits", repository | collapse, heal, lockup (big hit 2) | whoosh → impact → sparkle |

Source files: src/serve/*.tsx; timeline and sound table: src/Main.tsx; live slices: src/serve/live.ts.

## Restructure (judges' feedback on the 2:09 cut)

- Intro cut to about 15 s: the stat joins the cold open, the separate stat shot is gone.
- The live segment is three acts with cards, so a judge can follow cold start → A2A → courts; Messenger and the
  Prompt Guard court search are now in the film, matching the deck's video slide.
- The model pill answers "which Meta model is doing this" during every slow wait.
- New shots for the auto-cut clip (framed as sharing, not analysis) and the fine-tune and cascade (technical depth).

## Notes after the independent review

- **Captions** sit in a taller bottom band of the live frame (112 px, 46 px white type), never over the app; the
  "Game on" slice zooms 2× on the toast. Speed pills sit at the band's right.
- **Audio offset**: impact-deep-whoosh peaks 17 frames after it starts, so both big hits are cued 17 frames early
  (Main.tsx) and land on the slam (safety, frame 15) and the brake (close, frame 37). The riser was dropped: its
  loudest moment came early, inside Live Numbers. Music at 0.24; pops and reel swooshes raised.
- **Live Numbers** keeps the card's dark fronts on purpose: each flip turns a dark question into a white answer.
  The live dot is green (red stays for failures).
- **Claims**: "8 people, me included"; the US and NZ surveys named apart; the planner caption says the demo club's
  members are simulated.
- **Two renders**: out/serve-promo.mp4 (music) and out/serve-promo-nobgm.mp4 (effects only), from one timeline.
