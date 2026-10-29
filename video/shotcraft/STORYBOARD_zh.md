# Serve Demo 影片分鏡稿（目前版本，2:27，英文旁白＋字幕）

畫面上的字都是英文（評審看的）。「改哪裡」欄寫的是要改這一鏡時動哪個檔案。
時間是成片時間（mm:ss），30 fps，共 4,423 格。

## 總覽

| # | 時間 | 長度 | 鏡頭 | 主要內容 |
|---|---|---|---|---|
| 1 | 0:00–0:07 | 6.8 s | 開場：群組訊息＋數據 | 約球的痛點，40% → 26% |
| 2 | 0:07–0:10 | 3.2 s | serve 字標 | 品牌與標語 |
| 3 | 0:10–0:15 | 5.2 s | 手機 | Your week, agreed agent to agent. One yes from you. |
| 4 | 0:15–1:44 | 88.8 s | 真實 app 錄影，三幕（22 段） | 冷啟動 → A2A 協商 → 球場與社團 |
| 5 | 1:44–1:49 | 5.0 s | 自動剪輯 | 影片自動剪成分享片段（不是教練、不是運動分析） |
| 6 | 1:49–1:55 | 5.5 s | Meta 模型卡 | Six Meta models carry Serve，另外九個一行帶過 |
| 7 | 1:55–2:04 | 9.0 s | 蒸餾與 cascade | Glimmer 40 s → 1B 學生 0.9 s（89.5%）→ cascade 89.9% |
| 8 | 2:04–2:10 | 6.0 s | 安全 | 93/93（自己寫的攻擊）、37/42、Rule of Two、揭露預算 |
| 9 | 2:10–2:16 | 6.0 s | 真人數據 | 8 人、2 社團、8 次加入、4 場滿 3 場（10/30 統計） |
| 10 | 2:16–2:22 | 6.0 s | Built for… | 還能服務誰 |
| 11 | 2:22–2:27 | 5.9 s | 結尾 | 標誌、標語、開發期間、repo、play.theminimallab.com |

## 逐鏡

### 1　開場：群組訊息＋數據（0:00–0:07）
- **畫面**：群組「Saturday badminton」的訊息一則則疊上來；右上計數器 MESSAGES 0→6，下面紅字「GAMES BOOKED: 0」。
- **字卡**：「People don't quit the game.」／綠字「They quit organizing it.」，下面接「40% of US adults play a sport at 18 to 21. At 26 to 49: 26%.」與出處「NPR, RWJF and Harvard Chan poll, 2015」。
- **音效**：每則訊息一聲 pop，字卡與數據各一聲 swoosh。
- **改哪裡**：`src/serve/ColdOpen.tsx`

### 2　serve 字標（0:07–0:10）
- **畫面**：「s e r v e」筆畫同時畫出；「Play more. Manage less.」。比上一版短（96 格）。
- **改哪裡**：`src/serve/Wordmark.tsx`

### 3　手機（0:10–0:15）
- **畫面**：同心圓呼吸，手機捲動真實截圖。左「Your week, agreed agent to agent」、右「One yes from you」；左下小字「Built on Muse Glimmer / Meta's open weights, on my RTX 3090」。
- **改哪裡**：`src/serve/PhoneHero.tsx`

### 4　真實 app 錄影，三幕（0:15–1:49）
外框上方左邊「LIVE · THE REAL APP」，上方中間是**模型狀態膠囊**（這一段是哪個 Meta 模型在工作），右上 serve 標誌；底部框帶是字幕，有加速時右邊顯示「N× speed」。每幕前有 1.5 秒白色幕卡（綠色數字＋標題）。

| 段 | 時間 | 內容 | 速度 | 字幕 | 模型膠囊 |
|---|---|---|---|---|---|
| 幕卡 1 | 0:15 | Cold start: no account needed | | | |
| 1-1 | 0:17 | Mia 打字給 agent | 1.4× | Tell your agent: "Saturday morning singles, need 1" | |
| 1-2 | 0:24 | 等模型讀 | 10× | It reads the request on my own GPU | Muse Glimmer · RTX 3090 |
| 1-3 | 0:26 | 邀請草稿，按 Post it | 1× | It drafts the invite: day, time, nearest court | Muse Glimmer drafts |
| 1-4 | 0:29 | 安全檢查 | 8× | Checked before anyone sees it | Llama Guard 3 · safe |
| 1-5 | 0:31 | 已發布，Share link | 1× | Posted. Share the link to any group chat. | |
| 1-6 | 0:34 | 藍框：Leo 沒帳號，點連結加入 | 1.4× | Leo has no account: the link opens, one sign-in joins | |
| 1-7 | 0:41 | **並排**：左 Leo「You're in」、右 Mia 的 Game on | 1× | Leo joins, and Mia hears "Game on" at once | |
| 1-8 | 0:45 | Game on 通知放大 | 1× | Last spot taken: "Game on", wherever you are | |
| 幕卡 2 | 0:48 | Agents negotiate. You say yes once. | | | |
| 2-1 | 0:50 | 規劃頁，按 Plan my week | 1× | Or let your agent plan the week: one tap | |
| 2-2 | 0:55 | Glimmer 規劃、agent 協商 | 16× | Glimmer plans; the demo club's simulated members' agents answer | Signed Agent Cards ✓ · 1B student, or Glimmer when unsure |
| 2-3 | 1:01 | 一場談好，Book it | 1× | Every agent agreed. Nothing is booked without your yes. | |
| 2-4 | 1:10 | Messenger 裡一個 yes 就訂好 | 1.5× | Or in Messenger: one yes, and it is booked (end-to-end test) | Muse Glimmer · your agent in Messenger |
| 2-5 | 1:15 | Agent chats，**黃框標出 Hana 的反提案** | 1× | A real counter-offer: Hana's agent proposes Saturday | |
| 幕卡 3 | 1:21 | Real courts, checked reviews, clubs | | | |
| 3-1 | 1:22 | 找球場 | 1× | Courts near you, in any ball sport | |
| 3-2 | 1:26 | 過濾評論、判斷球場 | 14× | Reviews screened, then every court judged | Prompt Guard 2 · then Muse Glimmer judges |
| 3-3 | 1:29 | 結果與理由 | 1× | Every reason cites the map, a review or the forecast | |
| 3-4 | 1:34 | 社團地圖 | 1× | Clubs on a real map, near wherever you are | |
| 3-5 | 1:38 | Start a club | 4× | Start your own: a name, a sport, a place on the map | |
| 3-6 | 1:44 | 新社團頁 | 1× | Open to anyone nearby; their games show up here | |

- **音效**：外框 snap、每張幕卡 swoosh、打字聲、切藍框／並排／Game on／Messenger 各一聲 click、Hana 黃框出現一聲 pop。
- **改哪裡**：字幕、剪接點、速度、模型膠囊、黃框都在 `src/serve/live.ts`（每段一行）；外框、幕卡、並排、膠囊樣式在 `src/serve/LiveFrame.tsx`。

### 5　自動剪輯（1:49–1:54）
- **畫面**：左邊 CC BY 的羽球影片片段（0.8 倍），右邊「BEYOND TEXT / Your video, auto-cut into a clip to share」「Posted to your club only after your yes」「DETR · Sapiens2 · SAM 2.1 · MapAnything」「Not a coach, not a sports analyzer.」
- **改哪裡**：`src/serve/AutoClip.tsx`

### 6　Meta 模型卡（1:54–1:59）
- **畫面**：六張卡疊起展開，Muse Glimmer 被抽出；底部一行「And nine more: Omnilingual ASR · DETR · Sapiens2 · SAM 2.1 · MapAnything · Muse Image · Muse Spark · Muse Wonder · SAM 3.1」。
- **改哪裡**：`src/serve/Models.tsx`

### 7　蒸餾與 cascade（1:59–2:07）
- **畫面**：三欄依序浮現：THE TEACHER Muse Glimmer **40 s**（84% 的 token 在推理）→ FINE-TUNED HERE Llama 3.2 1B **0.9 s**（CPU；LoRA，4,868 個 Glimmer 的選擇）→ THE CASCADE **89.5%**（與 Glimmer 一致；Glimmer 自己跟自己 88.8%）。下面「54–67% fewer Glimmer answers in simulated talks, no rule broken」。
- **改哪裡**：`src/serve/Cascade.tsx`

### 8　安全（2:07–2:12）
- **畫面**：「Attacks 93 / 93 Stopped」砸進畫面；「No agent holds all three at once.」；小字加上「A prober pins down 32.4% of your week, not 97.6%: a disclosure budget.」
- **改哪裡**：`src/serve/Safety.tsx`

### 9　真人數據（2:12–2:17）
- **畫面**：8 people, me included／2 clubs on the map／7 joins, 2 games filled；「Live since 29 October.」
- **改哪裡**：`src/serve/LiveNumbers.tsx`

### 10　Built for…（2:17–2:23）
- **畫面**：your club → a school club → older adults → a charity cup → any ball sport。
- **改哪裡**：`src/serve/WhoElse.tsx`

### 11　結尾（2:22–2:27）
- **畫面**：serve 標誌、「PLAY MORE. MANAGE LESS.」、「Built Oct 28 – Nov 4, 2026, 900+ commits · github.com/gino6178/serve-meta-hackathon」，定格 1.5 秒。
- **改哪裡**：`src/serve/Outro.tsx`

## 英文旁白與字幕

- **旁白稿**：`narration/lines.json`，每句寫在片中第幾秒開始（at）。共 15 句，配合各鏡頭；女聲 Kokoro af_heart。
- **產生聲音**：在 GPU 伺服器的 CPU 上跑 `scripts/tts_lines.py`（不佔 3090），輸出 `public/narration/n*.wav` 和 `src/serve/narration.json`（每句、每個子句的時間）。改了稿子要重跑；只改 at 不用重跑。
- **字幕**：燒進畫面，跟旁白逐句同步；冒號後半句併在同一行。錄影段落在綠色字幕帶上方，其他鏡頭貼近畫面底部。上傳用的字幕檔 `narration/serve-promo.en.srt`（`python scripts/srt.py` 產生）。
- **配樂**：講話時自動降低（0.24 → 0.09），句子之間回來。
- **開關**：`ServePromo` 的 props `voice`、`subs`、`bgm`；`props-nobgm.json` 是有旁白字幕、沒有配樂。

## 第二次獨立評審後的修改（10/30）

- **旁白對齊畫面**：協商那句說明 demo 社團的會員是模擬的；自動剪輯說「like this sample clip」；安全說「93 scripted attacks… 37 of 42 unsafe messages refused」；真人數據改成「eight people so far, me included, and three games filled」；加上「built during this hackathon」和「The plan took 78 seconds, in the background」。
- **數字**：cascade 卡改成 89.9%（學生自己 89.5%），拿掉「no rule broken」；模型卡標題改成「Six Meta models carry Serve.」；結尾拿掉「900+ commits」。
- **看得清楚**：錄影段落放大（ask、Leo 的連結、規劃頁、找球場、社團），連續同一支錄影的段落直接延續放大，不會一縮一放；左上角標籤改成「LIVE · BUILT OCT 28 – NOV 4」。
- **節奏**：建立社團那段 4× 改 8×，最後一段縮短，整支片 2:27。
- **拼字**：統一美式（organize、center）。
- **沒改**：數據來源（美國、紐西蘭）維持，因為是全球比賽。

## 調整順序、改完怎麼出片

- **鏡頭順序與長度**：`src/Main.tsx` 的 `ORDER`；音效跟著鏡頭走，錄影裡的音效依段落種類找（幕卡、並排、Messenger…），加減段落不用重對。
- **出片**：在 `video/shotcraft` 執行
  - 有配樂：`npx remotion render src/index.ts ServePromo out/serve-promo.mp4`
  - 無配樂：再加 `--props=props-nobgm.json`
