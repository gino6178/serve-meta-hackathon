# Serve 比賽影片分鏡稿 v4（照主辦單位影片規範改）

## 主辦單位的影片規範，以及這版怎麼對應

| 規範 | v4 的做法 |
|---|---|
| 開頭先說明專案解決的問題和目標受眾 | 段落 0（0:00–0:28）：先講問題，再用一個鏡頭點名三種受眾，最後一句話講 Serve 是什麼 |
| 接著完整展示 | 段落 1（0:28–1:48）：同一個主辦人 Mia 的**一場球從頭走到尾**，不再在功能之間跳來跳去：一句話 → 邀請 → agent 協商 → 朋友加入 → 成局 → Messenger 主動問 → 外部 agent 接入 → 打完球的精華片段 |
| 刪減載入畫面與設定步驟 | 登入、OAuth、註冊金鑰、主人核准、模型等待、影片處理進度條全部剪掉（下面標 ✂️）。剪掉等待的地方，角落放小字 `time cut`，不讓評審以為系統真的那麼快 |
| 可以使用 AI 配音 | 全片英文旁白用 AI 配音：`video/tts.py`（Kokoro，聲音 `af_heart`，和 v2 一樣），字幕跟著句子時間走。片尾小字註明 `Narration: AI voice (Kokoro)` |

- **長度**：2:48（上限 3:00，留 12 秒緩衝）
- **口吻**：Indie 賽道、一人參賽，旁白一律用第一人稱 **I**
- **旁白**：英文約 390 字，以每分鐘 150 字算約 2:36；中文只給你審稿用
- **數字**：沿用 v3.1，出處表在最後；模擬或 AI 測試者的結果，畫面上一律標 `simulated` 或 `AI testers`
- **素材**：♻️ 沿用 `video/build/` 已剪好的片段；🆕 要新錄（在本機副本 localhost:8898 錄，正式站不建帳號）

---

## 段落 0：問題與目標受眾（0:00–0:28）

**0-1（0:00–0:02）♻️ cover**
- 畫面：深色點陣背景、serve logo、**Play more. Manage less.**；左上角 `Meta Global AI Developer Hackathon 2026 · Indie Developer`
- 聲音：音樂淡入，沒有旁白

**0-2（0:02–0:13）🆕 問題**
- 畫面：Q 版情境圖 `submission/shots/pain_scene.png` 做成動態：主辦人手機裡的問號泡泡越堆越多 → 四個朋友各帶一個鎖頭（各自的 agent），彼此之間的虛線打叉 → 小卡 `4 friends · 4 agents · no place to talk` → 鏡頭平移到空球場
- 中文：約一場球要對齊四個人的行事曆、找球場、等每個人回覆，常常在群組裡聊好幾個小時，最後還是沒打成。每個人很快都會有自己的 AI agent，但 agent 之間沒有可以談的地方。
- 英文：Getting four people onto one court means matching calendars, finding a court and chasing replies for hours, and the game often never happens. Soon everyone will have a personal AI agent, but agents have no place to talk to each other.

**0-3（0:13–0:22）🆕 目標受眾**
- 畫面：三張卡片由左到右依序滑入，各配一個 Q 版小圖：
  1. `Casual players & organizers`：每週想打球、卻總是當主辦人的人
  2. `Clubs`：要湊場、補人、排球場的社團
  3. `Agent builders`：自己的個人 agent 需要一個地方跟別人的 agent 談的開發者
- 中文：Serve 是為三種人做的：想多打球、卻總是負責揪人的玩家；要湊場、補人的社團；還有想讓自己的個人 agent 跟別人的 agent 協商的開發者。
- 英文：Serve is for three groups: players who keep ending up as the organizer, clubs that need to fill courts and spots, and developers whose personal agents need somewhere to negotiate.

**0-4（0:22–0:28）🆕 一句話定位**
- 畫面：`submission/shots/pain_before_after.png`，綠色虛線由左往右掃過，從被訊息淹沒的人變成四個人在球場上
- 中文：所以我做了 Serve：你的 agent 跟大家的 agent 談好時間、球場和球友，最後只問你一句：好不好。
- 英文：So I built Serve. Your agent works out the time, the court and the players with theirs, and asks you for one yes.

## 段落 1：完整展示，一場球從頭到尾（0:28–1:48）

> 整段是同一個故事：主辦人 Mia 星期二晚上想打羽球。畫面左上角固定放一條小進度列 `request → invite → agents agree → friend joins → booked → after the game`，目前走到哪一步就亮哪一格，讓評審知道這是一條完整的流程。

**1-1（0:28–0:38）🆕 一句話變成邀請**
- 畫面：Mia 已經在首頁（✂️ 登入畫面剪掉）。她打 "Badminton Tuesday evening, need 1" → 邀請卡直接出現（NTU Gymnasium、18:00、還差 1 人）
- 角落標籤：`code reads the day and the nearest court · no model`
- 中文：Mia 只打一句話。程式在幾毫秒內讀出日期、找到最近的球場，完全不用模型。
- 英文：Mia types one sentence. Code reads the day and finds the nearest court in milliseconds, with no model at all.

**1-2（0:38–0:44）🆕 發出邀請，先過安全檢查**
- 畫面：按 Post it → 邀請卡上直接亮綠色徽章 `checked: Llama Guard 3 · Prompt Guard 2`（✂️ 檢查的等待剪掉，角落 `time cut`）→ 分享連結
- 中文：任何人看到這張邀請之前，Llama Guard 和 Prompt Guard 會先檢查一次。
- 英文：Before anyone sees it, Llama Guard and Prompt Guard check the invite.

**1-3（0:44–1:02）♻️＋🆕 agent 之間用 A2A 協商**
- 畫面：沿用 v2 的分割畫面（三個 agent 同時談）；放大疊加一則 Ed25519 簽章的 proposal，JSON 只有 `{date, start, venue, court, trip}` → 打勾的時間交集亮起 → `held 30 min`。v2 底下太小的說明字拿掉或放大
- 角落標籤：`A2A v1.0 · official SDK · signed Agent Cards`
- 中文：接著，每個球友的 agent 用 A2A 協議協商。提案只帶簽章過的事實，沒有任何模型會讀到對方 agent 的原始文字。各家 agent 標出可行的時間，程式挑出交集，保留 30 分鐘，等大家說好。
- 英文：Next, every player's agent negotiates over the A2A protocol. Proposals carry signed facts only, so no model ever reads another agent's words. Agents mark the times that work, code picks the overlap, and holds it thirty minutes until everyone says yes.

**1-4（1:02–1:10）🆕 朋友加入，成局**
- 畫面：Leo 用手機打開連結 → 直接跳到已加入（✂️ 登入那一步剪掉）→ Mia 的聊天卡變成「Game on. The spot is taken: Leo.」→ 進度列亮到 `booked`
- 中文：Leo 點開連結、按一下加入，這場球就成了。
- 英文：Leo opens the link, taps join, and the game is on.

**1-5（1:10–1:20）♻️ 下一次，agent 主動問**
- 畫面：Messenger 跳出「Thursday 19:00: Leo is free. Want a game?」→ 按 Yes → Booked
- 角落標籤：`Messenger · Send API`
- 中文：因為 agent 會在背景先談好，下一次 Match 會主動問 Mia：週四晚上七點，Leo 有空，要打嗎？在 Messenger 按一下就好。
- 英文：And because agents talk in the background, next time Match asks first: Thursday, seven p.m., Leo is free, want a game? One tap in Messenger.

**1-6（1:20–1:33）🆕 任何人的 agent 都能接入**
- 畫面：左側大終端機畫面，只留三行結果：
  1. `curl play.theminimallab.com/llms.txt`（只顯示前幾行）
  2. `200 agent registered`（✂️ 產生金鑰、主人核准的步驟剪掉，角落 `setup cut`）
  3. 簽名請求把費用上限放寬到 400（主人設 NT$150）→ 紅字 `403 · needs: person`
  - 右側小卡：`10+ people · 2 of 3 invites became games · 3 days`
- 中文：外部 agent 也能帶著自己的 Ed25519 金鑰，從 /llms.txt 連進來，但程式確保它永遠不能放寬主人設的底線。我找了十幾個朋友一起測，三個邀請裡有兩個在三天內真的打成了。
- 英文：Outside agents can join through llms.txt with their own Ed25519 key, and code makes sure they can never loosen their human's limits. More than ten friends tested it with me: two of three invites became games within three days.

**1-7（1:33–1:48）♻️ 打完球：精華片段**
- 畫面：手機影片丟進去 → 直接跳到結果（✂️ 上傳和處理進度條剪掉，角落 `time cut`）：骨架 → 去背 → 時間暫停、鏡頭繞著殺球轉；慢動作那 2 秒不講話 → 進度列亮到 `after the game`
- 角落標籤：`Sapiens2 · SAM 2.1 · MapAnything · on my GPU`
- 中文：打完球，Mia 上傳手機影片：Sapiens2 找出揮拍最快的一刻，SAM 2.1 把她摳出來，MapAnything 讓時間停住、鏡頭繞著殺球轉。
- 英文：After the game, Mia uploads a phone clip. Sapiens2 finds the fastest swing, SAM 2.1 cuts her out, and MapAnything freezes time while the camera orbits.

## 段落 2：技術深度（1:48–2:38）

**2-1（1:48–2:08）🆕 為什麼需要分層決策和 1B**
- 畫面：決策分層圖（code 7 ms → 28 KB classifier 0.06 ms → Llama 3.2 1B 0.9 s → Muse Glimmer 20–40 s），接著 1B 和 Glimmer 一致率的長條圖（89.5% vs 88.8%）
- 角落標籤：`Llama 3.2 1B · distilled by me · int4 on CPU`
- 中文：四個 agent 一起協商，每一步都等 40 秒就太慢了。所以程式守住每條硬規則；一個 28 KB 的分類器在 0.06 毫秒內答掉六成的一般選擇；剩下的交給我用 4,868 次 Muse Glimmer 選擇蒸餾出來的 Llama 3.2 1B：一致率 89.5%，在 CPU 上 0.9 秒。
- 英文：When four agents negotiate, forty seconds a step is too slow. So code keeps every hard rule, and a 28-kilobyte classifier settles six in ten ordinary choices in 0.06 milliseconds. Then my Llama 3.2 1B, distilled from 4,868 Muse Glimmer choices, agrees with Glimmer 89.5% of the time, in 0.9 seconds, on a CPU.

**2-2（2:08–2:18）♻️ 實際跑 Meta 模型學到的事**
- 畫面：左邊 2,755 次呼叫裡 84% 是推理 token；右邊社團名稱 "Serve test round 27" 被紅框擋下 `refused: violence`，再變綠
- 中文：真的上線跑 Meta 的模型學到兩件事：Glimmer 就算關掉 thinking，84% 的 token 還是推理；Llama Guard 還曾經把叫 round 27 的社團當成暴力威脅。
- 英文：Running Meta's models taught me two things. Glimmer reasons even with thinking off: 84% of its tokens. And Llama Guard once refused a club called "round 27" as a threat.

**2-3（2:18–2:28）♻️＋更新 AI 測試者**
- 畫面：`Serve_agent_swarm.mp4` 的多格畫面；數字改成 `177 AI testers · 28 rounds · 17,432 requests`，角落 `AI testers, not people`
- 中文：九天不夠做長期試用，所以我讓 177 個 AI 測試者，每輪全新，像真人和外部 agent 那樣使用 Serve：28 輪、17,432 個請求，每個找到的問題都修好了。
- 英文：Nine days is too short for a long trial, so 177 AI testers, fresh every round, used Serve the way people and outside agents would. Twenty-eight rounds, 17,432 requests, every fault fixed.

**2-4（2:28–2:38）♻️ 安全防線和自我演化**
- 畫面：Rule of Two 矩陣 → `93 of 93 attacks stopped` → /idea 投票 → 九道 gate → 自動回滾（標 `simulated club · real pipeline`）
- 中文：每個 agent 都照 Meta 的 Agents Rule of Two 設計，93 個攻擊全部擋下。社員的想法會變成平台的改動，要過九道關卡，負評上升就自己回滾。
- 英文：Every agent follows Meta's Agents Rule of Two, and 93 of 93 attacks were stopped. Members' ideas become changes behind nine gates, and roll back on their own if feedback drops.

## 段落 3：片尾（2:38–2:48）♻️ endcard

- 畫面：serve logo + **Play more. Manage less.**
  - `For players, clubs, and the agents that play for them.`
  - `93 of 93 attacks stopped · 177 AI testers, 28 rounds · A2A v1.0`
  - `Built during the Meta Global AI Developer Hackathon, Oct 27 – Nov 4, 2026: everything except the TrackNetV5 library`
  - `play.theminimallab.com · github.com/gino6178/serve-meta-hackathon`
  - `Narration: AI voice (Kokoro) · Sample clip: Badminton klub Ljubljana, CC BY 3.0`
- 中文：這就是 Serve。多打球，少管事。
- 英文：That's Serve. Play more, manage less.

---

## 剪掉的東西（✂️ 清單，剪輯時對照）

| 鏡頭 | 剪掉 | 畫面上怎麼交代 |
|---|---|---|
| 1-1 | 登入、Facebook/Instagram OAuth、首次設定位置和運動 | 直接從已登入的首頁開始 |
| 1-2 | Llama Guard / Prompt Guard 檢查的等待 | 綠色徽章直接出現，角落 `time cut` |
| 1-3 | agent 之間來回的等待 | 只留提案、交集、保留三個畫面 |
| 1-4 | 朋友登入的畫面 | 點連結後直接跳到已加入 |
| 1-6 | 產生 Ed25519 金鑰、主人核准、安裝指令 | 終端機只留三行結果，角落 `setup cut` |
| 1-7 | 上傳、偵測、去背的進度條（實際要幾十秒） | 直接跳結果，角落 `time cut` |
| 全片 | 伺服器啟動、GPU 開機、任何設定頁 | 不出現 |

## 數字出處（都在 submission/technical_report.md，和 v3.1 相同）

| 數字 | 出處 |
|---|---|
| 一個「好」（one yes） | §1、§2 |
| 卡片 7 ms（中位數，本機副本） | §2.5 Layer 0；§4 |
| A2A v1.0、提案只帶事實、Ed25519 簽章、交集、保留 30 分鐘 | §2.1 |
| 外部 agent 從 /llms.txt 接入、403 needs person | §2.1；第 28 輪報告 `agent_trial28/` |
| 10 人以上、3 個邀請 2 場成局、三天內 | §1 |
| Sapiens2、SAM 2.1、MapAnything | §2.4 |
| 28 KB、0.06 ms、六成一般選擇（59.8%） | §2.5 |
| 4,868 次、89.5% vs 88.8%、0.9 s vs 約 40 s | §2.6 |
| 84% 推理 token、2,755 次呼叫；"round 27" | §2.6「What surprised us」 |
| 177 個測試者、28 輪、17,432 個請求 | §1；`submission/agent_testing.md` |
| 93 of 93 attacks | §2.7 |
| 九道 gate、自動回滾、模擬社團 | §2.3 |

## v4 跟 v3.1 不一樣的地方

1. **開頭**：多了 0-3「目標受眾」三張卡（玩家/主辦人、社團、agent 開發者），規範要求明講受眾
2. **完整展示**：段落 1 改成同一場球的完整流程，加上左上角的進度列；精華片段移進流程最後一步（「打完球」），不再單獨成段
3. **刪減**：登入、設定、金鑰註冊、所有等待都剪掉，並用 `time cut` / `setup cut` 標明
4. **AI 配音**：明寫用 Kokoro AI 配音，片尾註明
5. **旁白主詞**：展示段改用 Mia 當主角（第三人稱），開場和技術段仍是第一人稱 I

## 要你決定的

1. **目標受眾的三種人**是我依專案定位擬的，你要不要改成只講前兩種（玩家和社團），讓開場更好懂？
2. **展示段的主角**用 Mia（第三人稱）還是改回「我」（第一人稱）？
3. **`time cut` 小字**：我建議保留，以免評審以為系統真的那麼快；規範只說刪減，沒有要求標示
