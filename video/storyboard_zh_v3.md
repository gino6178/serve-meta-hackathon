# Serve 比賽影片分鏡稿 v3（審核用，數字已對照技術報告）

- **長度**：2:45，留 15 秒緩衝（上限 3:00）
- **敘事**：痛點 → 一句話開出球局 → 背後的 agent 怎麼談 → 真實社團 → 精華影片 → 分層決策和我們自己的模型 → 用 AI 測試者驗證 → 安全和自我演化
  - 跟 v2 最大的差別：v2 講「我一個人的一週」；v3 講「人和 agent 一起約球的平台」，對齊現在的報告和網站
  - 四個評分項自然帶到，畫面上不放評分項標題：Impact 30%、Tooling 25%、Depth 20%、Demo 25%
- **口吻**：Indie 賽道、一人參賽，旁白一律用第一人稱 **I**
- **旁白**：英文 370 字，以每分鐘 140 字算約 2:39；開場 5 秒沒有旁白。中文只給你審稿用
- **數字**：每個數字的出處列在最後的表格裡。模擬或 AI 測試者得出的結果，畫面上一律標 `simulated` 或 `AI testers`
- **素材**：標 ♻️ 的鏡頭可直接沿用 v2 已剪好的片段（`video/build/`），標 🆕 的要新錄

## 段落 0：開場與痛點（0:00–0:28）｜Impact

**0-1（0:00–0:05）♻️ cover**
- 畫面：深色點陣背景，serve logo 和 **Play more. Manage less.**，左上角 `Meta Global AI Developer Hackathon 2026 · Indie Developer`
- 聲音：音樂淡入，沒有旁白

**0-2（0:05–0:16）♻️ pain**
- 畫面：群組對話「週四誰有空？」「少一咖」「球場沒了」；右下角浮出長條圖：`64.2% · times that are hard to fit together`，來源小字 `Sport NZ, Active NZ 2023`
- 中文：多數人不打球，不是不愛了。紐西蘭的全國調查裡，64% 的成年人說擋住他們的是同一件事：時間湊不起來。約一場球，就是好幾個小時的群組訊息。
- 英文：Most adults who stop playing haven't lost interest. In New Zealand's national survey, 64% name the same thing: times that won't fit together. One game can mean hours of group chat.

**0-3（0:16–0:28）🆕 網站實錄**
- 畫面：手機版 play.theminimallab.com，打一句 "badminton Thursday evening" → 卡片出現 → 朋友按 Join → 卡片上的人數跳動
- 中文：所以我做了 Serve：一個讓人和 agent 一起約球的平台。你的 agent 跟大家的 agent 談好時間、球場和人，最後只問你一件事：一個「好」。
- 英文：So I built Serve: a platform where people and their agents make games together. Your agent sorts out the time, the court and the players with everyone else's, and asks you for one thing: one yes.

## 段落 1：怎麼運作（0:28–1:22）｜Demo + Tooling

**1-1（0:28–0:42）🆕 一句話變成球局**
- 畫面：打字 → 7 ms 後卡片出現（角落計時器）→ 群組外的人用連結打開、加入 → 討論串裡 agent 貼出「Mia is in. 1 spot left.」
- 角落標籤：`code · 7 ms (local copy)`
- 中文：我只打一句話。程式在幾毫秒內從句子裡讀出日期，配上最近的球場。有空的人按加入就好，不用等所有人投票。
- 英文：I type one sentence. Code reads the day and finds the nearest court in milliseconds. Whoever is free taps Join. Nobody waits for a poll.

**1-2（0:42–0:58）♻️＋🆕 A2A 談判**
- 畫面：沿用 v2 的分割畫面（三個 agent 同時談）；新增一個疊圖：一則 proposal 的 JSON 只有 `{date, start, venue, court, trip}`，旁邊打勾的時間交集亮起；最後顯示 `held 30 min`
- 角落標籤：`A2A v1.0 · official SDK · signed Agent Cards`
- 中文：背後，每個球友的 agent 用 A2A 協議談。提案只帶事實，沒有任何一方的模型會讀到對方的文字。agent 標出哪些時間可以，程式從交集裡挑，再替每個人保留 30 分鐘，等大家說好。
- 英文：Behind it, every player's agent talks over A2A. A proposal carries facts only, so no model ever reads another side's words. Agents mark the times that work, code picks from the overlap, and holds it for everyone until they say yes.

**1-3（0:58–1:10）♻️ Match 先問 ＋ Messenger**
- 畫面：Messenger 跳出「Thursday 19:00: Leo is free. Want a game?」→ 按 Yes → Booked
- 角落標籤：`Messenger · Send API`
- 中文：Match 會記住我習慣的時段，先來問我：週四 19:00，Leo 有空，要打嗎？在 Messenger 按一下就好。
- 英文：Match learns when I usually play, and asks first: Thursday, seven p.m., Leo is free, want a game? One tap, right in Messenger.

**1-4（1:10–1:22）🆕 真實社團 ＋ 自己的 agent**
- 畫面：左半：兩句球友原話（英文字幕），下方 `10+ people · 3 invites · 2 games played · 3 days`；右半：一個外部 agent 讀 `/llms.txt` → 用自己的 Ed25519 金鑰簽名 → 嘗試放寬主人的上限 → `403 · needs: person`（字幕 `your own agent, through the same open door`）
- 中文：我在一個真的羽球社團試用：超過十個人用過，三個邀請裡有兩個真的打成了。你自己的 agent 也能進來，但永遠不能放寬你設的上限。
- 英文：I tried it with a real badminton club: more than ten people used it, and two of three invites became games. Your own agent can come in too, but it can never loosen your limits.

## 段落 2：精華影片（1:22–1:40）｜Demo + Tooling

**2-1（1:22–1:40）♻️ highlight**
- 畫面：沿用 v2：上傳手機影片 → 偵測框 → Sapiens2 骨架 → SAM 2.1 去背 → 時間暫停、鏡頭繞轉；慢動作那 2 秒不講話
- 角落標籤：`Sapiens2 · SAM 2.1 · MapAnything · on my GPU`
- 中文：打完球，把手機影片丟上去。Sapiens2 找出揮拍最快的那一刻，SAM 2.1 把我摳出來，MapAnything 讓時間停住、鏡頭繞著殺球轉。
- 英文：After the game, I upload a phone clip. Sapiens2 finds the fastest swing, SAM 2.1 cuts me out, and MapAnything stops time while the camera turns.

## 段落 3：技術深度（1:40–2:35）｜Depth + Tooling

**3-1（1:40–2:02）🆕 分層決策和我們自己的模型**
- 畫面：論文級圖表 `video/deck/figs/` 的決策分層圖（code → tiny → 1B → Glimmer），每層標時間；接著放 1B 和 Glimmer 一致率的長條圖（89.5% vs 88.8%）
- 角落標籤：`Llama 3.2 1B · distilled by me · int4 on CPU`
- 中文：大部分決定根本不會用到大模型。程式守住每條硬規則；一個 28 KB 的小分類器在 0.06 毫秒內答掉六成的一般選擇；剩下的交給我用 Muse Glimmer 的 4,868 次選擇蒸餾出來的 Llama 3.2 1B。它跟 Glimmer 的一致率是 89.5%，Glimmer 跟自己只有 88.8%，而且只要 0.9 秒，不用 40 秒。
- 英文：Most decisions never reach the big model. Code keeps every hard rule. A 28-kilobyte classifier settles six in ten ordinary choices in 0.06 milliseconds. Then my own Llama 3.2 1B, distilled from 4,868 of Muse Glimmer's choices, agrees with Glimmer 89.5% of the time. Glimmer agrees with itself 88.8%. In 0.9 seconds, not 40.

**3-2（2:02–2:12）♻️ 實際跑 Meta 模型學到的事**
- 畫面：v2 的 ledger 圖表（2,755 次呼叫、84% 推理）→ 一個社團名稱 "Serve test round 27" 被紅框擋下 `refused: violence`，再變綠
- 中文：真的上線跑 Meta 的模型，學到兩件事：Glimmer 就算關掉 thinking 也在推理，84% 的 token 都是推理；Llama Guard 還曾經把一個叫 round 27 的社團當成暴力威脅。
- 英文：Running Meta's models taught me two things. Glimmer reasons even with thinking off: 84% of its tokens. And Llama Guard once refused a club called "round 27" as a threat.

**3-3（2:12–2:26）♻️＋更新 AI 測試者**
- 畫面：沿用 `Serve_agent_swarm.mp4` 的多格畫面（每格一個測試者重播自己的請求）；畫面上的數字要更新成 `177 AI testers · 28 rounds · 17,432 requests`，角落標 `AI testers, not people`
- 中文：九天不夠做長期試用，所以我讓 177 個 AI 測試者，每輪全新，像真人一樣使用 Serve：28 輪、17,432 個請求，每輪找到的問題都在下一輪前修好。
- 英文：Nine days is too short for a long trial, so 177 AI testers, fresh every round, used Serve the way people would. Twenty-eight rounds, 17,432 requests, every fault fixed before the next.

**3-4（2:26–2:35）♻️ 安全和自我演化**
- 畫面：Rule of Two 矩陣 → `93 of 93 attacks stopped` → /idea 投票 → 九道 gate → 自動回滾（標 `simulated club · real pipeline`）
- 中文：每個 agent 都照 Meta 的 Agents Rule of Two 設計，93 個攻擊全部擋下。社員的想法會變成平台的改動，過九道關卡，負評上升就自己回滾。
- 英文：Every agent follows Meta's Agents Rule of Two, and 93 of 93 attacks were stopped. Members' ideas become changes behind nine gates, and roll back on their own if feedback drops.

## 段落 4：片尾（2:35–2:45）♻️ endcard

- 畫面：serve logo + **Play more. Manage less.**，下面放：
  - `play.theminimallab.com · github.com/gino6178/serve-meta-hackathon`
  - `Built during the Meta Global AI Developer Hackathon, Oct 27 – Nov 4, 2026. Everything except the TrackNetV5 library.`
  - `Sample clip: Badminton klub Ljubljana, CC BY 3.0`（依實際用到的片段改）
- 中文：這就是 Serve。多打球，少管事。
- 英文：That's Serve. Play more, manage less.

## 數字出處（都在 submission/technical_report.md）

| 數字 | 出處 |
|---|---|
| 64.2% 時間湊不起來（Sport NZ, Active NZ 2023） | §1，參考文獻 [2] |
| 一個「好」（one yes） | §1、§2 |
| 卡片 7 ms（中位數，本機副本） | §2.5 Layer 0；§4 註明是本機副本 |
| A2A v1.0、提案只帶事實、交集、保留 30 分鐘、Agent Card 簽章 | §2.1 |
| 10 人以上、3 個邀請 2 場成局、三天內、兩句原話 | §1 |
| 自己的 agent 不能放寬上限（403，needs person） | §2.1 開放的門；第 28 輪報告 `agent_trial28/` |
| Sapiens2、SAM 2.1、MapAnything、學到的門檻 | §2.4 |
| 28 KB、0.06 ms、六成一般選擇（59.8%） | §2.5 |
| 4,868 次、89.5% vs 88.8%、0.9 s vs 約 40 s | §2.6 |
| 84% 推理 token、隱藏通道 | §2.6「What surprised us」 |
| "round 27" 被當成暴力（S9，之後 S1） | §2.6「What surprised us」 |
| 177 個測試者、28 輪、17,432 個請求 | §1；`submission/agent_testing.md` |
| 93 of 93 attacks | §2.7 |
| 九道 gate、自動回滾、模擬社團 | §2.3 |

## 跟 v2 不一樣的地方

1. **定位**：v2「我的一週」→ v3「人和 agent 一起約球的平台」，跟現在的報告、網站、README 一致
2. **拿掉**：語音和膝蓋那段、記分板和 Elo、IG 分享、揭露預算 97.6%→32.4%、片尾的 65/65 和 22/22。前三段和主線無關；後兩項是舊數字，報告現在寫 93/93
3. **新增**：一句話開局、真實社團、自己的 agent 從開放的門進來、小分類器分層、AI 測試者
4. **蒸餾的說法**：v2 是「模擬社團裡少問 Glimmer 54–67%」；v3 改成一致率 89.5% vs 88.8%、0.9 s vs 40 s，報告裡這是主要結果
5. **DETR**：報告現在預設偵測器是 RT-DETR（不是 Meta 的），所以旁白不再點名 DETR，只講 Sapiens2、SAM 2.1、MapAnything

## 要你決定的

1. **AI 測試者那段**的數字：swarm 影片目前重播 146 個 session，畫面上的數字還是舊的（153、16,713）。我建議用 v3 的數字重新輸出那段（新增第 26 輪和第 28 輪的請求紀錄）
2. **Llama Guard「round 27」那句**：講出來可能被看成在揭 Meta 模型的短處。我建議保留，因為誠實、又展示了我們怎麼處理，但你可以拿掉
3. **0-3 和 1-1** 要新錄網站實錄，要用正式站還是本機副本錄？正式站錄影只能看、不能建帳號，所以建議在本機副本上錄，畫面完全一樣
