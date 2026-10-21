# 設定步驟：免操作登入的共享題庫

此版本的功能已依最新需求簡化：沒有帳號設定頁、沒有登入按鈕、沒有老師角色。任何訪客都能上傳及使用共享題庫。Firebase Authentication 在背景自動建立匿名 UID，維持 Rules 的驗證與私人作答紀錄隔離；不需要手動建立任何使用者。

選用的發布方式是 **純 HTML 直接由 GitHub Pages 發布**。瀏覽器從 Firebase 官方 CDN 載入 pinned modular SDK 13.0.0，不需要建置、不需要 Node 伺服器，也不使用 Cloud Functions。npm 僅供開發測試。

## 1. Firebase 專案與 Web App

1. 開啟 [Firebase Console](https://console.firebase.google.com/project/language-timothy920611/overview)。目前已有專案 **language**（ID `language-timothy920611`）；不必另外建立。
2. 若從零重建，選「新增專案」，顯示名稱填 `language`，選可用的唯一 Project ID，再新增 Web App。
3. 到「專案設定 → 一般 → 你的應用程式 → SDK 設定與配置」，複製 `firebaseConfig` 到 `src/firebase-config.js`。
4. `firebaseConfig` 與 reCAPTCHA **site key** 可以公開。**service account JSON、Admin SDK 憑證、第三方私鑰、reCAPTCHA secret key、App Check debug token 絕不能放進原始碼或 repo。**
5. 本版本直接使用[官方 CDN modular SDK](https://firebase.google.com/docs/web/alt-setup)。不要混用 compat SDK，也不要讓不同模組使用不同 SDK 版本。

## 2. 啟用匿名 Authentication 與授權網域

1. Firebase Console → **Authentication → Sign-in method → Anonymous → Enable**。
2. 不用建立使用者、不用提供老師 Google 帳號。訪客第一次開啟網頁時，程式會自動呼叫 `signInAnonymously()`。
3. Authentication → **Settings → Authorized domains**，加入 `timothy920611.github.io`。只填主機名稱，不包含 `https://`、路徑或 repo 名稱。
4. 這個 Web App 不再呼叫 Google Sign-In；舊有 Google provider 不會再被前端使用。如不再需要，可在 Console 手動停用。
5. 「免操作登入」仍然有背景匿名身分。同一瀏覽器的使用者會共用紀錄；不同裝置不會自動同步身分。清除網站資料或換瀏覽器後，無法取回舊匿名 UID。若日後需要跨裝置私人紀錄，就需要可恢復的登入方式。

[匿名驗證官方說明](https://firebase.google.com/docs/auth/web/anonymous-auth)

## 3. Firestore 正式模式與 Rules

1. 目前已存在 **Enterprise Native** 資料庫 `allen`，地區為台灣 `asia-east1`，不必重建。
2. 若重新建立，選 **Production mode／Locked mode**，不要選會暫時對外開放的 Test mode。前端透過同一官方 CDN Firestore Lite modular 模組使用 Core 查詢，不啟用即時監聽或本機資料庫快取。官方 CDN 13.0.0 的 Pipeline 獨立模組與 Lite 實例未能正常互通，故不使用該組合，也不以私有 API 修補。資料庫 ID 必須與 `src/firebase-config.js` 的 `DATABASE_ID` 一致。
3. 部署此 repo 的 `firestore.rules`，不要只儲存前端程式碼。可以在有 Firebase CLI／ADC 權限的管理端執行：

   ```sh
   npx -y firebase-tools@latest deploy --only firestore --project language-timothy920611
   ```

4. 確認 Rules 為此 repo 版本。未驗證的 `request.auth == null` 一律拒絕，未列出的路徑一律拒絕，沒有 `allow read, write: if true`。
5. 驗收應至少包含：未驗證讀取被拒絕；訪客 A 可上傳、訪客 B 可讀取題庫；B 無法讀取 A 的上傳者識別或作答紀錄；惡意欄位、超長字串、錯誤型別、偽造 ownerUid、追加／修改他人題庫全部被拒絕。

資料路徑均在 `Allen/app` 下：

| 路徑 | 權限與用途 |
|---|---|
| `banks/{bankId}` 與 `questions/{id}` | 題庫名稱與題目／答案明確共享給所有背景驗證的訪客；只能新增，不能修改或刪除既有內容 |
| `bankOwners/{bankId}` | 上傳者匿名 UID；僅上傳者可單筆讀取，不提供公開列表 |
| `users/{uid}/records/{id}` 與 `answers/{id}` | 僅相同 `request.auth.uid` 可讀取及新增，不開放跨使用者權限 |
| 舊 `records`、`quiz_data`、其他路徑 | 舊資料保留在 Firebase 中，但新 Rules 拒絕所有 Web 客戶端讀寫，只能由受信任管理工具處理 |

題庫共享是你最新要求的**明確例外**，不是放寬所有資料的擁有者限制。共享題庫文件不含上傳者 email、姓名、UID 或作答紀錄。每題最多 4 個選項以確保逐項驗證不超過 Rules 運算上限。每題及每份作答明細都是有欄位驗證的結構化文件，不使用可塞入任意私有資料的 JSON 文字欄位。

## 4. 限制 Firebase API Key

1. 開啟 [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=language-timothy920611)。
2. 找到 `src/firebase-config.js` 所使用的 Firebase **Browser key**；不要編輯其他服務的 key。
3. **Application restrictions → Websites（HTTP referrers）**，加入：

   ```text
   https://timothy920611.github.io/*
   ```

4. 若使用自訂網域，需另外加入該 HTTPS 網域。不要為正式 key 加上 `*` 或整個 `*.github.io/*`。
5. **API restrictions → Restrict key**。保留此 App 所需的 Identity Toolkit API、Token Service API，以及已選用 Firebase 服務要求的 API；修改前先核對[官方服務對照表](https://firebase.google.com/docs/projects/api-keys#required-apis-for-firebase)。不要加入 Gemini／Generative Language 等非 Firebase API。
6. 儲存後，以正式網址實測匿名驗證、題庫載入、共享上傳與私人紀錄；若遇到 `API_KEY_SERVICE_BLOCKED`，核對必要 API，勿直接移除所有限制。
7. 本機使用 `?emulator=1` 與 demo project 測試，避免為了 localhost 放寬正式 key。啟用 HTTP referrer 限制後，沒有瀏覽器來源標頭的 Node／curl client SDK 測試可能被拒絕；可信任管理工具使用 IAM／ADC，不以公開 browser key 代替管理憑證。

API Key 與 HTTP referrer 限制不等於身分或資料授權；資料仍由 Rules 控制。[官方說明](https://firebase.google.com/docs/projects/api-keys)

## 5. 建議啟用 App Check（程式已預留初始化）

**目前 `APP_CHECK.siteKey` 為空，代表尚未註冊與啟用 App Check；不能把它當成已完成保護。**

1. 到 [reCAPTCHA 管理頁](https://www.google.com/recaptcha/admin/create)，註冊 **reCAPTCHA v3** 網站，網域填 `timothy920611.github.io`。
2. 取得 site key 和 secret key。只有 **site key** 可填進 `src/firebase-config.js`：

   ```js
   export const APP_CHECK = {
     siteKey: '你的公開 reCAPTCHA site key',
     provider: 'v3'
   };
   ```

3. Firebase Console → **App Check → Apps**，選 Allen Web App、註冊 **reCAPTCHA v3 provider**。secret key 只填在 Firebase Console；不要貼到 GitHub。
4. `src/firebase.js` 已在匿名驗證與資料操作前初始化，實際邏輯相當於：

   ```js
   import { initializeAppCheck, ReCaptchaV3Provider }
     from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app-check.js';
   initializeAppCheck(app, {
     provider: new ReCaptchaV3Provider(APP_CHECK.siteKey),
     isTokenAutoRefreshEnabled: true
   });
   ```

5. 先部署帶 site key 的程式，檢查 App Check request metrics，確認正常瀏覽器都有有效 token，再對 **Cloud Firestore** 開啟 enforcement。Authentication 如有可用的 enforcement 選項，先查看該產品資格／方案及監測結果再啟用。
6. 若選 reCAPTCHA Enterprise，先依其 Console 設定 Web key，將 `provider` 改成 `enterprise`；程式會使用 `ReCaptchaEnterpriseProvider`。請先確認其當前額度與費用。
7. 本機優先使用模擬器。若必要使用 debug provider，只在本機開啟；debug token 是機密，不能提交 repo，也不能放到正式網站。不要為了本機測試將 localhost 加進正式 reCAPTCHA 網域來繞過驗證。

[App Check／reCAPTCHA v3 步驟](https://firebase.google.com/docs/app-check/web/recaptcha-provider)、[debug provider 注意事項](https://firebase.google.com/docs/app-check/web/debug-provider)

## 6. 預算與濫用控制

1. 目前專案沿用未連結帳單的設定；沒有因這次修改自動升級 Blaze 或連結信用卡。
2. 若要啟用需要 Cloud Billing 的功能，先在 **Google Cloud Console → Billing → Budgets & alerts → Create budget** 建立只涵蓋 `language-timothy920611` 的預算。
3. 月預算依可接受費用填寫，設定 50%、80%、100% 實際花費及預測花費通知，確認通知收件者。
4. 一般 **alerts-only** 預算是提醒，不會自動停止服務或限制花費；支援服務的 spend-cap 預算是另一種設定，需核對產品涵蓋範圍。不要把預算警示當成硬上限。
5. 監測 Firestore／Authentication 用量與配額，啟用 App Check 後再依實際流量調整配額。前端只查最近 100 份題庫和本人最近 30 份紀錄，降低無意間的大量讀取。
6. 「任何人都能上傳」仍會有垃圾題庫、不當內容與自動化刷量風險；Rules 只能驗證格式、大小及權限，不能判斷題目是否有意義或內容是否違規。若需要內容審核、跨帳號可靠限流或可信任考試計分，應另行設計受信任後端／審核流程，不要把管理密碼或 API 私鑰塞進前端。

[Google Cloud 預算步驟與限制](https://docs.cloud.google.com/billing/docs/how-to/budgets)

## 7. GitHub repo、2FA 與 main 保護

1. Repo 為 `timothy920611/Allen-s-quiz-world`。使用 GitHub Free 的 Pages 需公開 repo，原始碼與歷史可能被任何人下載；**不要提交機密、學生私人紀錄或私人備份**。[Pages 方案說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
2. 此修改會從目前公開版本移除舊的 `records/` JSON 與含學生檔名的遷移清單，本機保留備份，Firebase 原資料仍保留。**舊 Git 歷史、舊部署或第三方副本仍可能存在，無法因此恢復既有隱私。**需要清除 Git 歷史時，請另外評估影響並逐項確認；本次沒有重寫歷史。
3. 舊版前端曾放置混淆 GitHub Token，應在 GitHub 設定中撤銷該 Token；刪除程式碼不足以讓既有金鑰失效。
4. GitHub 個人 **Settings → Password and authentication → Two-factor authentication**，啟用 TOTP 或 passkey／security key，安全保管 recovery codes；不要將 recovery codes 提交 repo。[2FA 步驟](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication)
5. Repo **Settings → Branches → Add branch protection rule**（或 Rules → Rulesets），目標填 `main`。啟用「Require a pull request before merging」、「Require status checks to pass」並選此 repo 的 `verify`，禁止 force push／刪除，視需要套用到管理員。[分支保護說明](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
6. 若只有一名維護者，不要設定無人能提供的第二人批准，以免自己無法合併；仍可要求 PR 與測試通過。

## 8. GitHub Pages 發布

1. Repo **Settings → Pages → Build and deployment → Source** 選 **Deploy from a branch**。
2. Branch 選 **main**，資料夾選 **/（root）**，按 Save。
3. 開啟 [正式網站](https://timothy920611.github.io/Allen-s-quiz-world/)。原 repo 目前已採用此方式；新版本保留同一網址。
4. 不需要 `npm run build`，也不需要 Node.js／SSR 伺服器。`.github/workflows/check.yml` 只執行測試，不處理前端打包。
5. 若將來加入 build 流程，應改成 Source **GitHub Actions**，只發布產生的靜態輸出目錄；不要一邊使用 bundler、一邊發布過期的根目錄產物。[官方發布來源說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
6. 切換上線時，先確認新 Rules 與新前端屬於同一版本；舊版前端不相容新的私人資料結構，部署切換期間可能需要重新整理。

## 9. 驗收

1. 開啟正式網頁：不應出現登入、帳號或老師按鈕。
2. 選擇「原有題庫・66 題」並測驗，確認日期、題型、英文／拼音、多選與簡答都正常。
3. 上傳一份不含私人內容的 JSON；再用另一個瀏覽器／私人視窗重新整理，確認新題庫可以使用。
4. 完成測驗後，「我的作答紀錄」應只出現在原瀏覽器；另一個匿名身分不能用紀錄網址讀取它。
5. 用含 `<img onerror=...>` 或 `<script>` 的題目／簡答測試，內容應當作普通文字顯示，不應建立 HTML 元素或執行程式碼。
6. 用 Rules 模擬器驗證未驗證、越權、額外欄位、超長字串、錯誤型別及不合法答案索引會被拒絕。

規則是已經測試的安全原型；廣泛分享前仍應人工檢閱。公開題庫不應放任何需要保密的欄位；前端的「不顯示」不是資料保護。
