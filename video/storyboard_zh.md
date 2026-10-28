# Serve 比賽影片分鏡稿 v2（真人開發者敘事版，已對照技術報告核實）

- **長度**：2:50，留 10 秒緩衝
- **敘事**：痛點 → 一週實錄，關鍵處「掀開引擎蓋」看 Meta 模型 → 工程上踩到的坑與實測數字 → 自我演化的社團
  - 四個評分項自然帶到，畫面上不放評分項的標題
  - 對應：Impact 30%、Tooling 25%、Depth 20%、Demo 25%
- **口吻**：Indie 賽道、一個人參賽，旁白全部用第一人稱 **I**，不用 we
- **錄製**：實錄只錄一次
  - debug 疊圖用子母畫面或半透明層剪進去：tool call JSON、DETR 框、骨架、遮罩
  - 等待的地方加速，角落標 `Live recording · 4× speed`
- **旁白長度**：英文 360 字，以每分鐘 140 字算約 2:34。加上開場 5 秒無旁白和慢動作停 2 秒，剛好 2:41–2:50。中文旁白只給你審稿用，比英文長一點
- **數字**：每個數字都核對過技術報告，出處寫在每段下方。模擬出來的結果，畫面上一律標 `simulated`

## 段落 0：開場與痛點（0:00–0:28）｜Impact

**0-1（0:00–0:05）**
- 畫面：深色點陣背景
  - 左上角放小 Meta logo，寫 `Submitted to Meta Global AI Developer Hackathon 2026 · Indie Developer · Oct 27 – Nov 4`
  - 中央浮現 serve logo 和 **Play more. Manage less.**（之前做好的 `submission/cover.png` 構圖，動態版）
- 聲音：音效，音樂淡入，沒有旁白

**0-2（0:05–0:15）**
- 畫面：左邊是群組對話「週四誰有空？」「少一咖」「球場沒了」，右邊是空的羽球場
- 中文：多數人不再打球，不是不愛了，是輸給「約球太麻煩」：湊四個人的時間、找空場、還要顧到誰膝蓋痛。
- 英文：Most people don't quit sports because they stopped loving the game. They quit because matching four calendars, finding a court and working around a sore knee takes too much group chat.

**0-3（0:15–0:28）**
- 畫面：Messenger 實錄
  - agent 問：「週四 19:00 你常打的時段空著，Leo、Tomás 也有空，要打嗎？」
  - 按 Yes → **Booked**
  - 下方小字：`Built Oct 27 – Nov 4 · everything except the TrackNetV5 library`
- 中文：所以這次黑客松我做了 Serve。它不是教你揮拍的教練，是一個幫你處理所有雜事的 agent：它跟朋友們的 agent 談好，只問你一個「好」。
- 英文：So for this hackathon, I built Serve. Not an AI coach. A club where your agent sorts things out with your friends' agents, and only asks you for one "yes".

## 段落 1：一週實錄・上半（0:28–1:18）｜Demo + Tooling

**1-1（0:28–0:42）週一：語音和膝蓋**
- 畫面：
  - 在 Messenger 傳一則語音：「這週想打球，但右膝有點痛」，顯示 `I heard: …`
  - 切到 Body log，3D 人體右膝標 3/5
  - 再問一句「要吃幾顆止痛藥？」，被擋下
- 角落標籤：`Omnilingual ASR · Llama Guard 3 1B · on my server`
- 中文：週一我傳語音說想打球，但右膝有點緊。每句話都先過本地的 Llama Guard，它不給醫療建議；Muse Glimmer 把膝蓋痛變成排程規則：這週打雙打、時間縮短。
- 英文：Here's a live run of my week. Monday, I send a voice note: I want to play, but my right knee is sore. Serve never gives medical advice. Muse Glimmer turns the knee into a rule: doubles, shorter games.

**1-2（0:42–1:00）Autopilot 和 A2A 談判**
- 畫面：
  - 按 Run my week，右側半透明展開 Glimmer 的 tool steps：check_week → check_body → find_partners
  - 分割畫面：同時跟三個 agent 談，三個都打勾，鎖定週四 19:00
- 角落標籤：`Muse Glimmer · open weights · RTX 3090`
- 中文：Autopilot 接手。Muse Glimmer 跑在我自己的 RTX 3090 上，一步一步呼叫工具，再用 A2A 協議同時跟三個球友的 agent 談。agent 只標出哪些時間可以，最後由程式碼從交集挑時間，不讓模型自由喊價。
- 英文：Autopilot takes over. Muse Glimmer, on my own RTX 3090, calls one tool at a time, then negotiates with three friends' agents at once over A2A. Agents only mark which times work; code picks from the overlap.

**1-3（1:00–1:18）找場地、一鍵成局**
- 畫面：
  - 4 張球場卡片，每條理由旁邊附出處（地圖、評論原文、天氣）
  - 有一條沒附出處的理由被劃掉
  - Messenger 一鍵核准 → Booked
- 角落標籤：`Prompt Guard 2 86M`
- 中文：找場地時，Prompt Guard 2 先過濾外部的 Google 評論，Glimmer 再結合地圖和天氣一次評四個場地；沒有逐字引用出處的理由，程式直接刪掉。我按一下，訂好了。
- 英文：Prompt Guard 2 screens the Google reviews, then Glimmer judges four courts. A reason that doesn't quote its source is dropped by code. One tap, and we're booked.

## 段落 2：一週實錄・下半（1:18–1:55）｜Demo + Tooling

**2-1（1:18–1:40）打完球：視覺管線**
- 畫面：上傳手機影片，疊圖依序打開
  1. DETR 框出人
  2. Sapiens2 骨架，抓到揮拍最快的那一刻
  3. SAM 2.1 去背
  4. 時間暫停，鏡頭繞 20°（左右各約 10°）
- 慢動作那 2 秒不講話，只留擊球聲和音樂重拍
- 角落標籤：`DETR · Sapiens2 · SAM 2.1 · MapAnything · on my GPU`
- 中文：週四打完球，把手機影片丟上去。DETR 找到人、Sapiens2 讀出姿勢找到揮拍最快的瞬間、SAM 2.1 把人摳出來做慢動作；再用 MapAnything 從一支手機影片算出深度，讓時間停住、鏡頭繞著殺球轉。
- 英文：Thursday, game done. I upload a phone clip. DETR finds the players, Sapiens2 finds the fastest swing, SAM 2.1 cuts me out. With MapAnything, time stops and the camera turns around the smash.

**2-2（1:40–1:55）記分板和分享**
- 畫面：
  - 拍記分板 → 讀出比分 → 排行榜往上跳
  - 完整播放成品 reel，不停在暫停那一格
  - 分享到 Instagram
- 角落標籤：`Muse Glimmer vision`
- 中文：拍一張記分板，Glimmer 讀出比分，程式檢查過規則後更新社團 Elo 排行榜，精華一鍵分享到 IG。
- 英文：Glimmer reads the scoreboard, code checks it, my club ranking moves, and the reel goes to Instagram.

## 段落 3：工程上踩到的坑（1:55–2:40）｜Technical Depth + Tooling 驚喜點

**3-1（1:55–2:12）Glimmer 的隱藏推理和蒸餾**
- 畫面：
  - 背景放真實的 ledger 圖表（`submission/results/glimmer_in_practice.json`）：2,755 次呼叫、84% 是推理 token、9% 空回覆
  - 接著是分層：程式碼 → Llama 3.2 1B 學生模型 → Glimmer
- 中文：跑了 2,755 次呼叫後，我發現 Muse Glimmer 有 84% 的 token 在推理，就算關掉 thinking，它還是在隱藏通道裡想，小預算的呼叫直接回空白。所以每次呼叫都留推理空間；我再把它的選擇蒸餾成一個本地的 Llama 3.2 1B，模擬社團裡球友 agent 的回答有 54% 到 67% 不用再問 Glimmer，而且沒有違反任何規則。
- 英文：Logging 2,755 calls, I found 84% of Glimmer's tokens are reasoning. Even with thinking off, it reasoned in a hidden channel and came back empty. So every call leaves room to think, and a local Llama 3.2 1B, distilled from Glimmer, now answers 54 to 67% of members' decisions in my simulated club, with no rule broken.

**3-2（2:12–2:28）Agents Rule of Two 和揭露預算**
- 畫面：
  - Rule of Two 矩陣：不可信輸入、私人資料、能改狀態的權力，三選二
  - 一個惡意球友反覆約球探測行程，圖表從 97.6% 降到 32.4%，角落標 `simulated prober`
- 中文：安全上我照 Meta 的 Agents Rule of Two 做：沒有任何 agent 同時碰到不可信輸入、私人資料和能動手的權力。有人一直約你來猜你的行程，揭露預算能把被猜中的天數從 97.6% 壓到 32.4%。
- 英文：Every agent follows Meta's Agents Rule of Two. And a disclosure budget cuts how much of your week a snooping agent can pin down, from 97.6% to 32.4%.

**3-3（2:28–2:40）會自己演化的社團**
- 畫面：
  - 社員在 Messenger 用 /idea 許願
  - DRAMA 把相似的想法聚在一起 → 二次方投票 → coding agent 在隔離分支實作 → 九道 gate → 碰到 never-list 被擋 → 金絲雀發布後自動回滾
  - 角落標 `simulated club · real pipeline`
- 中文：最後，社團會自己演化。社員的想法用 DRAMA 聚類、投票，coding agent 在隔離分支實作，過九道 gate、小範圍上線；負評上升就自己回滾，而且永遠碰不到安全和部署的核心。
- 英文：And the club evolves itself. Members' ideas are grouped with DRAMA, voted on, built by a coding agent behind nine gates, and rolled back on their own if feedback drops.

## 段落 4：片尾（2:40–2:50）

- 畫面：serve logo + **Play more. Manage less.**，下面放：
  - `65 of 65 attacks stopped · A2A across two machines, 22 of 22 checks`
  - `Built during the Meta Global AI Developer Hackathon, Oct 27 – Nov 4, 2026. Everything except the TrackNetV5 library.`
  - `github.com/gino6178/serve-meta-hackathon`
  - `Sample clip: Roy Huang, US Badminton 2012, CC BY 3.0`
- 中文：這就是 Serve。多打球，少管事。
- 英文：And the club evolves itself. Members' ideas are grouped with DRAMA, voted on, built by a coding agent behind nine gates, and rolled back on their own if feedback drops.

## 數字出處（全部在 submission/technical_report.md）

| 數字 | 出處 |
|---|---|
| 2,755 次、84% 推理、9% 空回覆、隱藏通道 | 第 17–22 行，§5.10 |
| Llama 3.2 1B，54–67%，模擬社團，沒有違反規則 | §3.12 |
| 97.6% → 32.4% | §3.13（模擬的探測者） |
| Agent Card 簽章；agent 只標可行時間，程式碼挑交集 | §3.2 |
| Prompt Guard 2 讀 Google 評論；沒引用出處的理由被刪 | §3.3、§3.6 |
| 伺服器已設 Google Maps key | 已確認 |
| 九道 gate、never-list、canary、回滾（模擬社團 seed 7） | §3.7、§5.6 |
| 65 of 65 attacks | §5.1 |
| 兩台機器 A2A，22 of 22 | §3.11 |
| 環繞 20° = 左右各約 10° | app 的 `effectBadge` 把兩邊加總；報告寫 ±6–12° 看起來自然 |

## 跟對方 v2 不一樣的地方（都是事實修正）

1. **蒸餾**
   - 對方寫：「砍掉一半以上的 Glimmer 呼叫」
   - 報告寫：模擬社團裡，球友 agent 交給 Glimmer 的回答少了 54–67%，不是全部呼叫
   - 已改成報告的說法
2. **A2A**
   - 對方寫：「只交換簽章過的時間」
   - 實際上：簽章簽的是 Agent Card，agent 只標可行時間，由程式碼挑交集
3. **環繞鏡頭**
   - 對方寫：標成「原型」、轉 12°
   - 實際上：環繞已經是 app 裡可選的 camera effect（`web/src/components/Effect.jsx`），範例影片轉的是 20°（左右各 10°）
   - 所以不能標「prototype」，要改的是文件：README、技術報告、methods.md、project_description 還寫著 "a prototype, not in the app"
4. **片尾數字**
   - 對方寫：「240 Unit Tests」
   - 實際上：237/240 通過，所以拿掉，改放 65/65 和兩台機器 A2A
5. **記分板**
   - 對方寫：「符合官方 21 分制」
   - 報告只寫 "scores checked by rules"，改成「程式檢查規則」
6. **人稱**：一人參賽，全部改成 I

## 已決定

- 旁白：自己錄，英文。我先用 Kokoro 做一版對時間用的參考音軌
- 主角：用第一人稱，不虛構人物
- 環繞鏡頭：保留，誠實標模型名稱
- 實錄：只錄一次連貫的一週，debug 疊圖後製加上去
- 選配：開場 5 秒放你本人或球場實拍（要你自己拍）
