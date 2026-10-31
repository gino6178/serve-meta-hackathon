# Serve 比賽影片分鏡稿 v3.1（審核用，數字已對照技術報告）

- **長度**：2:45，留 15 秒緩衝（上限 3:00）
- **主軸**：每個人都快要有自己的個人 agent，但 agent 和 agent 之間沒有一個安全、標準的地方可以協商。Serve 就是這個平台，用最難湊齊人的球類運動來驗證
  - 敘事：agent 孤島 → 平台定位 → 一句話開局 → A2A 協商 → agent 主動問 → 任何人的 agent 都能接入（朋友實測帶過）→ 打完球的附加樂趣 → 為什麼需要分層決策和 1B → 學到的事 → AI 測試者 → 安全和自我演化
  - 這樣一來，A2A 純事實協議、Ed25519 金鑰、`/llms.txt`、holds、1B 蒸餾、Rule of Two 都是這個平台的必要條件，不是殺雞用牛刀
  - 四個評分項自然帶到，畫面上不放評分項標題：Impact 30%、Tooling 25%、Depth 20%、Demo 25%
- **口吻**：Indie 賽道、一人參賽，旁白一律用第一人稱 **I**
- **旁白**：英文約 375 字，以每分鐘 150 字算約 2:30，留空給慢動作和轉場；開場 2 秒沒有旁白。中文只給你審稿用
- **數字**：每個數字的出處列在最後的表格裡。模擬或 AI 測試者得出的結果，畫面上一律標 `simulated` 或 `AI testers`
- **素材**：標 ♻️ 的鏡頭可直接沿用 v2 已剪好的片段（`video/build/`），標 🆕 的要新錄

## 段落 0：開場與痛點（0:00–0:27）｜Impact

**0-1（0:00–0:02）♻️ cover**
- 畫面：沿用 v2 深色點陣背景、serve logo 和 **Play more. Manage less.**，左上角 `Meta Global AI Developer Hackathon 2026 · Indie Developer`；只停 2 秒
- 聲音：音樂淡入，沒有旁白

**0-2（0:02–0:15）🆕 個人 agent 的孤島**
- 畫面：Q 版情境圖 `submission/shots/pain_scene.png`，分層做成動態：
  1. 累壞的主辦人，手機裡的問號泡泡越堆越多，牆上月曆一格一格打上紅叉
  2. 上方四個朋友的想法泡泡依序彈出，每個泡泡右下角浮出一個紅色鎖頭（每個人的 agent），泡泡之間的紅色虛線打叉：agent 之間不通
  3. 右上浮出小卡 `4 friends · 4 agents · no place to talk`
  4. 鏡頭往右平移到空球場，地上一支球拍和一顆羽球
  - 角落小字 `illustration: Muse Image`
- 中文：很快地，每個人都會有自己的 AI agent。它懂你的行事曆和底線，但 agent 之間沒有可以溝通的地方。所以約一場球，還是得在群組裡聊上好幾個小時。
- 英文：Soon, everyone will have a personal AI agent that knows their calendar and limits. But agents have no place to talk to each other, so one game still means hours of group chat.

**0-3（0:15–0:27）🆕 平台定位 ＋ 網站實錄**
- 畫面：
  1. 前 2 秒用 `submission/shots/pain_before_after.png`：一條綠色虛線由左往右掃過，從被訊息淹沒的人變成四個人在球場上
  2. 接著切到手機版 play.theminimallab.com：打一句 "badminton Thursday evening" → 卡片出現 → 朋友按 Join
- 中文：所以我做了 Serve：一個讓個人 agent 一起協調實體球局的平台。你的 agent 跟其他人的 agent 談好時間、球場和球友，最後只問你一句：好不好。
- 英文：So I built Serve: the platform where personal agents negotiate real-world games together. Your agent sorts out the time, the court and the players with theirs, and asks you for one yes.

## 段落 1：怎麼運作（0:27–1:25）｜Demo + Tooling

**1-1（0:27–0:39）🆕 一句話變成球局**
- 畫面：打字 → 7 ms 後卡片出現（角落計時器）→ 群組外的人用連結打開、加入 → 討論串裡 agent 貼出「Mia is in. 1 spot left.」
- 角落標籤：`code · 7 ms (local copy)`
- 中文：我只打一句話。程式在幾毫秒內從句子裡讀出日期，配上最近的球場。有空的人按加入就好，不用等所有人投票。
- 英文：I type one sentence. Code reads the day and finds the nearest court in milliseconds. Whoever is free taps Join. Nobody waits for a poll.

**1-2（0:39–0:57）♻️＋🆕 A2A 跨 agent 協商**
- 畫面：沿用 v2 的分割畫面（三個 agent 同時談）；放大疊加一則用 Ed25519 簽章的 proposal，JSON 只有 `{date, start, venue, court, trip}`，打勾的時間交集亮起，最後顯示 `held 30 min`。v2 畫面底下太小的說明字拿掉或放大
- 角落標籤：`A2A v1.0 · official SDK · signed Agent Cards`
- 中文：在底層，每個球友的 agent 用 A2A 協議協商。提案只帶簽章過的事實，沒有任何模型會讀到對方 agent 的原始文字。各家 agent 標出可行的時間，程式挑出交集，替大家保留 30 分鐘，等所有人說好。
- 英文：Underneath, every player's agent negotiates over the A2A protocol. Proposals carry signed facts only, so no model ever reads another agent's words. Agents mark the times that work, code picks the overlap, and holds it thirty minutes until everyone says yes.

**1-3（0:57–1:09）♻️ agent 主動問：Match ＋ Messenger**
- 畫面：Messenger 跳出「Thursday 19:00: Leo is free. Want a game?」→ 按 Yes → Booked
- 角落標籤：`Messenger · Send API`
- 中文：因為 agent 能在背景先談好，Match 可以主動問我：週四晚上七點，Leo 的 agent 說他有空，要打嗎？在 Messenger 按一下就好。
- 英文：Because agents talk in the background, Match can ask first: Thursday, seven p.m., Leo's agent says he's free, want a game? One tap in Messenger.

**1-4（1:09–1:25）🆕 任何人的 agent 都能接入（/llms.txt）＋ 朋友實測**
- 畫面：主角是左側大大的終端機畫面：
  1. 外部 agent 讀 `curl play.theminimallab.com/llms.txt`
  2. 用自己的 Ed25519 公鑰註冊（主人核准）→ `200 agent registered`
  3. 簽名送出把費用上限放寬到 400（主人設的是 NT$150）→ 紅字 `403 · needs: person`
  - 右側一張小卡帶過：`10+ people · 2 of 3 invites became games · 3 days`
- 角落標籤：`your own agent, through the same open door`
- 中文：任何外部 agent 都能帶著自己的 Ed25519 金鑰，從 /llms.txt 連進來，而程式確保它永遠不能放寬主人設的底線。我找了十幾個朋友一起測，三個邀請裡有兩個在三天內真的打成了。
- 英文：Any external agent can join through llms.txt with its own Ed25519 key, and code makes sure it can never loosen its human's limits. More than ten friends tested it with me: two of three invites became games within three days.

## 段落 2：打完球的附加樂趣（1:25–1:39）｜Demo + Tooling

**2-1（1:25–1:39）♻️ highlight**
- 畫面：沿用 v2：上傳手機影片 → 偵測框 → Sapiens2 骨架 → SAM 2.1 去背 → 時間暫停、鏡頭繞轉；慢動作那 2 秒不講話
- 角落標籤：`bonus · Sapiens2 · SAM 2.1 · MapAnything · on my GPU`
- 中文：打完球還有個附加樂趣：上傳手機影片，Sapiens2 找出揮拍最快的一刻，SAM 2.1 把我摳出來，MapAnything 讓時間停住、鏡頭繞著殺球轉。
- 英文：And as a bonus after the game, I upload a phone clip: Sapiens2 finds the fastest swing, SAM 2.1 cuts me out, and MapAnything freezes time while the camera orbits.

## 段落 3：技術深度（1:39–2:36）｜Depth + Tooling

**3-1（1:39–2:01）🆕 為什麼多 agent 協商需要分層決策和 1B**
- 畫面：決策分層圖（code 7 ms → 28 KB classifier 0.06 ms → Llama 3.2 1B 0.9 s → Muse Glimmer 20–40 s），每層標時間；接著放 1B 和 Glimmer 一致率的長條圖（89.5% vs 88.8%）
- 角落標籤：`Llama 3.2 1B · distilled by me · int4 on CPU`
- 中文：四個 agent 一起協商時，每一步都等 40 秒就太慢了。所以程式守住每條硬規則；一個 28 KB 的分類器在 0.06 毫秒內答掉六成的一般選擇；剩下的交給我用 Muse Glimmer 的 4,868 次選擇蒸餾出來的 Llama 3.2 1B：跟 Glimmer 的一致率 89.5%，在 CPU 上只要 0.9 秒。
- 英文：When four agents negotiate, forty seconds a step is too slow. So code keeps every hard rule, and a 28-kilobyte classifier settles six in ten ordinary choices in 0.06 milliseconds. Then my Llama 3.2 1B, distilled from 4,868 Muse Glimmer choices, agrees with Glimmer 89.5% of the time, in 0.9 seconds, on a CPU.

**3-2（2:01–2:12）♻️ 實際跑 Meta 模型學到的事**
- 畫面：左邊 2,755 次呼叫裡 84% 是推理 token；右邊社團名稱 "Serve test round 27" 被紅框擋下 `refused: violence`，再變綠
- 中文：真的上線跑 Meta 的模型，學到兩件事：Glimmer 就算關掉 thinking 也在推理，84% 的 token 都是推理；Llama Guard 還曾經把一個叫 round 27 的社團當成暴力威脅。
- 英文：Running Meta's models taught me two things. Glimmer reasons even with thinking off: 84% of its tokens. And Llama Guard once refused a club called "round 27" as a threat.

**3-3（2:12–2:25）♻️＋更新 AI 測試者**
- 畫面：沿用 `Serve_agent_swarm.mp4` 的多格畫面（每格一個測試者重播自己的請求）；數字更新成 `177 AI testers · 28 rounds · 17,432 requests`，角落標 `AI testers, not people`
- 中文：九天不夠做長期試用，所以我讓 177 個 AI 測試者，每輪全新，像真人和外部 agent 那樣使用 Serve：28 輪、17,432 個請求，每個找到的問題都修好了。
- 英文：Nine days is too short for a long trial, so 177 AI testers, fresh every round, used Serve the way people and outside agents would. Twenty-eight rounds, 17,432 requests, every fault fixed.

**3-4（2:25–2:36）♻️ 跨 agent 的安全防線和自我演化**
- 畫面：Rule of Two 矩陣 → `93 of 93 attacks stopped` → /idea 投票 → 九道 gate → 自動回滾（標 `simulated club · real pipeline`）
- 中文：每個 agent 都照 Meta 的 Agents Rule of Two 設計，93 個攻擊全部擋下。社員的想法會變成平台的改動，過九道關卡，負評上升就自己回滾。
- 英文：Every agent follows Meta's Agents Rule of Two, and 93 of 93 attacks were stopped. Members' ideas become changes behind nine gates, and roll back on their own if feedback drops.

## 段落 4：片尾（2:36–2:45）♻️ endcard

- 畫面：沿用 v2 片尾版型，serve logo + **Play more. Manage less.**，文字換成：
  - `Where personal agents agree the game, and you say yes once.`
  - `93 of 93 attacks stopped · 177 AI testers, 28 rounds · A2A v1.0`（v2 的 `65 of 65` 和 `22 of 22` 拿掉）
  - `Built during the Meta Global AI Developer Hackathon, Oct 27 – Nov 4, 2026: everything except the TrackNetV5 library`
  - `play.theminimallab.com · github.com/gino6178/serve-meta-hackathon`
  - `Sample clip: Badminton klub Ljubljana, CC BY 3.0`（依實際用到的片段改）
- 中文：這就是 Serve。多打球，少管事。
- 英文：That's Serve. Play more, manage less.

## 數字出處（都在 submission/technical_report.md）

| 數字 | 出處 |
|---|---|
| 一個「好」（one yes） | §1、§2 |
| 卡片 7 ms（中位數，本機副本） | §2.5 Layer 0；§4 註明是本機副本 |
| A2A v1.0、提案只帶事實、Ed25519 簽章、交集、保留 30 分鐘 | §2.1 |
| 外部 agent 從 /llms.txt 接入、自己的 Ed25519 金鑰、不能放寬上限（403，needs person） | §2.1 開放的門；第 28 輪報告 `agent_trial28/` |
| 10 人以上、3 個邀請 2 場成局、三天內 | §1 |
| Sapiens2、SAM 2.1、MapAnything | §2.4 |
| 28 KB、0.06 ms、六成一般選擇（59.8%） | §2.5 |
| 4,868 次、89.5% vs 88.8%、0.9 s vs 約 40 s | §2.6 |
| 84% 推理 token、2,755 次呼叫 | §2.6「What surprised us」 |
| "round 27" 被當成暴力（S9，之後 S1） | §2.6「What surprised us」 |
| 177 個測試者、28 輪、17,432 個請求 | §1；`submission/agent_testing.md` |
| 93 of 93 attacks | §2.7 |
| 九道 gate、自動回滾、模擬社團 | §2.3 |

## v3.1 跟 v3 不一樣的地方

1. **主軸**：痛點從「64% 的人時間湊不起來」改成「個人 agent 之間沒有協商的平台」，球類運動是驗證場景。64.2% 這個數字留在技術簡報第 2 頁當佐證，影片裡不唸
2. **開場**：封面 5 秒縮成 2 秒；0-2 的插畫加上鎖頭和打叉的虛線，表示每個人的 agent 互不相通
3. **1-4 主客對調**：主角改成外部 agent 從 `/llms.txt` 接入、被 `403 needs: person` 擋下；朋友實測只用半句話誠實帶過，不再當成「真實社團落地驗證」來宣傳
4. **2-1**：明確說是打完球的附加樂趣（bonus），不搶協商平台的主軸
5. **3-1**：開頭先講「四個 agent 協商時每步等 40 秒太慢」，所以分層決策和 1B 是必要的
6. **片尾**：`65 of 65` 改成 `93 of 93`，副標改成 agent 協商的定位

## 要你決定的

1. **AI 測試者那段**的數字：swarm 影片目前重播 146 個 session，畫面上的數字還是舊的（153、16,713）。我建議用 v3 的數字重新輸出那段（新增第 26 輪和第 28 輪的請求紀錄）
2. **Llama Guard「round 27」那句**：講出來可能被看成在揭 Meta 模型的短處。我建議保留，因為誠實、又展示了我們怎麼處理，但你可以拿掉
3. **0-3 和 1-1** 要新錄網站實錄，要用正式站還是本機副本錄？正式站錄影只能看、不能建帳號，所以建議在本機副本上錄，畫面完全一樣
4. **0-2 的插畫**裡第二個朋友抱著冰敷袋，和「不給受傷建議」的方向有點衝突。要不要我換成「被雨淋濕」或「累到趴著」的 Q 版泡泡（用 Claude 預設方式畫，不呼叫 Meta API）？
