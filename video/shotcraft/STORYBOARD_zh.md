# Serve Demo 影片分鏡稿（目前版本，2:09）

畫面上的字都是英文（評審看的）。「改哪裡」欄寫的是要改這一鏡時動哪個檔案。
時間是成片時間（mm:ss），30 fps。

## 總覽

| # | 時間 | 長度 | 鏡頭 | 主要內容 |
|---|---|---|---|---|
| 1 | 0:00–0:06 | 6.3 s | 開場：群組訊息 | 約球的痛點 |
| 2 | 0:06–0:10 | 4.0 s | serve 字標 | 品牌與標語 |
| 3 | 0:10–0:15 | 5.0 s | 數據 | 40% → 26% |
| 4 | 0:15–0:21 | 6.2 s | 手機 | 產品一眼看懂 |
| 5 | 0:21–1:41 | 79.8 s | 真實 app 錄影（15 段） | 實際操作 |
| 6 | 1:41–1:47 | 5.5 s | Meta 模型卡 | 六個模型撐起產品 |
| 7 | 1:47–1:52 | 5.5 s | 安全 | 93/93、Rule of Two |
| 8 | 1:52–1:58 | 6.0 s | Built for… | 還能服務誰 |
| 9 | 1:58–2:03 | 5.0 s | 真人數據 | 8 人、2 社團、7 人加入 |
| 10 | 2:03–2:09 | 5.9 s | 結尾 | 標誌、標語、repo |

## 逐鏡

### 1　開場：群組訊息（0:00–0:06）
- **畫面**：群組「Saturday badminton」的訊息從下往上一則則疊上來；右上計數器 MESSAGES 0→6，下面紅字「GAMES BOOKED: 0」。
- **訊息**：Leo「Who's free this week?」→ Kenji「Thu? No, work till 8」→ Sam「Is the court even free?」→ 你「Sat 9 works for me」→ Hana「Can we do 10 instead?」→ Leo「We're one short.」
- **字卡**（3.9 秒起）：「People don't quit the game.」／綠字「They quit organizing it.」
- **音效**：每則訊息落下一聲 pop，字卡出現時 swoosh。
- **改哪裡**：`src/serve/ColdOpen.tsx`（`MSGS` 訊息、字卡文字）

### 2　serve 字標（0:06–0:10）
- **畫面**：白底、淡淡的羽球場線，「s e r v e」所有筆畫同時畫出；接著「Play more. Manage less.」
- **音效**：柔和轉場，寫完時一聲 sparkle。
- **改哪裡**：`src/serve/Wordmark.tsx`

### 3　數據（0:10–0:15）
- **畫面**：眉題「WHY PEOPLE STOP PLAYING」；大字「40% → 26%」；「of US adults play a sport at 18 to 21, then at 26 to 49」；「What stops adults (Active NZ): other commitments, out of the habit, no one to play with.」
- **出處**（底部）：US: NPR, RWJF and Harvard Chan poll, 2015 · NZ: Active NZ survey, 2023
- **改哪裡**：`src/serve/Stat.tsx`

### 4　手機（0:15–0:21）
- **畫面**：同心圓呼吸，中間手機捲動真實截圖（agent 之間的對話 → 兩場都談好、Book both）。
- **兩側標籤**：左「Agents agree your week」、右「One yes, and it's booked」。
- **音效**：手機升起 whoosh，兩個標籤各一聲 pop。
- **改哪裡**：`src/serve/PhoneHero.tsx`；截圖 `public/shots/phone_stack.png`

### 5　真實 app 錄影（0:21–1:41，綠框；Leo 那段藍框）
外框上方左邊「LIVE · THE REAL APP」（藍框時是「LIVE · LEO'S PHONE, NO ACCOUNT」），右上 serve 標誌；底部框帶是字幕，有加速時右邊顯示「N× speed」。

| 段 | 時間 | 錄影內容 | 速度 | 底部字幕 |
|---|---|---|---|---|
| 5-1 | 0:21–0:29 | Mia 打字給 agent | 1.4× | Tell your agent: "Saturday morning singles, need 1" |
| 5-2 | 0:29–0:31 | 等模型讀 | 10× | Muse Glimmer reads it on my own GPU |
| 5-3 | 0:31–0:34 | 邀請草稿出現（NTU Gymnasium），按 Post it | 1× | It drafts the invite: day, time, nearest court |
| 5-4 | 0:34–0:36 | 安全檢查中 | 8× | Llama Guard checks it before anyone sees it |
| 5-5 | 0:36–0:39 | 已發布，Share link | 1× | Posted. Share the link to any group chat. |
| 5-6 | 0:39–0:49 | **藍框**：Leo 打開連結，看到球局，輸入名字登入，「You're in」 | 1.4× | Leo has no account: the link opens, one sign-in joins |
| 5-7 | 0:49–0:55 | **綠框**：Mia 畫面跳出「Game on」通知（放大 2 倍） | 1× | Last spot taken: "Game on", wherever you are |
| 5-8 | 0:55–1:01 | 規劃頁，按 Plan my week | 1× | Or let your agent plan the week: one tap |
| 5-9 | 1:01–1:07 | Glimmer 一步步規劃、agent 協商 | 16× | Glimmer plans; the demo club's simulated members' agents answer |
| 5-10 | 1:07–1:16 | 一場談好，按 Book it | 1× | Every agent agreed. Nothing is booked without your yes. |
| 5-11 | 1:16–1:24 | Agent chats：逐字對話（含 Hana 的反提案） | 1× | What the agents said to each other, word for word |
| 5-12 | 1:24–1:27 | 社團頁：真實地圖 | 1× | Clubs on a real map, near wherever you are |
| 5-13 | 1:27–1:34 | Start a club：名稱、運動、在地圖點位置 | 3× | Start your own: a name, a sport, a place on the map |
| 5-14 | 1:34–1:37 | Starting… | 2× | （同上） |
| 5-15 | 1:37–1:41 | 新社團「NTU Morning Smash」頁面 | 1× | Open to anyone nearby; their games show up here |

- **音效**：外框出現 snap、打字聲、切換藍框／綠框各一聲 click、切到規劃與社團時 swoosh。
- **改哪裡**：字幕、剪接點、速度都在 `src/serve/live.ts`（每段一行）；外框與字幕樣式 `src/serve/LiveFrame.tsx`；重錄用 `scripts/record_live.mjs`。

### 6　Meta 模型卡（1:41–1:47）
- **畫面**：六張卡從下方彈入疊起，展開成扇形，中間 Muse Glimmer 被抽出、綠框加一道光。
- **卡片**：Llama Guard 3（Checks every message）、Prompt Guard 2（Screens reviews）、**Muse Glimmer**（Plans, talks, decides · GPU）、Llama 3.2 1B（89.5% agree、0.9 s）、DRAMA（Memory by meaning）、Muse Voice（Talk to your agent）。
- **標題**：「15 Meta models. Six carry Serve.」／「Muse Glimmer at the centre, on a GPU I own. All fifteen are in the deck.」
- **改哪裡**：`src/serve/Models.tsx`（`CARDS`、標題）

### 7　安全（1:47–1:52）
- **畫面**：比分卡從鏡頭前砸到畫面中央（衝擊環、碎片、短暫震動）：「Attacks 93 / 93 Stopped」，上方「RED TEAM · MEASURED」，下方「INJECTED INSTRUCTIONS · POISONED REVIEWS · FORGED AGENT CARDS」。
- **字卡**：「No agent holds all three at once.」／「Untrusted input, private data, the power to act: Meta's Agents Rule of Two. Unsafe messages: 37 of 42 refused.」
- **音效**：全片第一個重音。
- **改哪裡**：`src/serve/Safety.tsx`

### 8　Built for…（1:52–1:58）
- **畫面**：「Built for ___」滾輪換詞：your club → a school club → older adults → a charity cup → any ball sport。
- **小字**：A club can run children's sessions, gentle games or a charity cup, with the rules in code.
- **改哪裡**：`src/serve/WhoElse.tsx`（`WORDS`）

### 9　真人數據（1:58–2:03）
- **畫面**：三張深色卡依序翻面成白卡：**8** people, me included／**2** clubs on the map／**7** joins, 2 games filled。
- **標題**：「Live since 29 October.」
- **改哪裡**：`src/serve/LiveNumbers.tsx`（`FEATURES`）

### 10　結尾（2:03–2:09）
- **畫面**：綠色光環收縮成 serve 標誌，字母滑入「serve」，「PLAY MORE. MANAGE LESS.」，最後一行「github.com/gino6178/serve-meta-hackathon · built during the Meta Global AI Developer Hackathon」，定格約 1.5 秒。
- **音效**：whoosh → 全片第二個重音 → sparkle。
- **改哪裡**：`src/serve/Outro.tsx`

## 調整順序、改完怎麼出片

- **鏡頭順序與長度**：`src/Main.tsx` 的 `ORDER`；音效跟著鏡頭走，換順序不用重對音效。
- **出片**：在 `video/shotcraft` 執行
  - 有配樂：`npx remotion render src/index.ts ServePromo out/serve-promo.mp4`
  - 無配樂：再加 `--props=props-nobgm.json`
