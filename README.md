# Allen 語言學習測驗

前端仍使用原本的 GitHub Pages 網址，資料改存 Firebase 專案 **language**（ID：`language-timothy920611`）。

## 資料架構

Cloud Firestore Enterprise Native 資料庫：`allen`。所有應用程式資料集中在 `Allen` 下：

- `Allen/app`：應用程式與遷移來源資訊。
- `Allen/app/quiz_data/{id}`：原始題庫及新上傳題庫（`questionsJson` 保留不同題型的完整欄位）。
- `Allen/app/records/{id}`：成績、作答明細、學生匿名 UID。
- `Allen/app/examples/example`：原本的 JSON 格式範例。

學生直接作答，系統會建立匿名 Firebase 身分。題庫可公開讀取；學生只可新增、讀取自己的成績。老師使用 **timothy920611@gmail.com** 的 Google 帳號登入，可上傳新題庫與查看所有成績。既有 13 份紀錄沒有 Firebase UID，遷移時以 `legacy` 標記，只供老師查看。原本瀏覽器內的考卷仍可從本機歷史紀錄開啟。匿名帳號的雲端紀錄不能自動跨裝置識別；刪除網站資料會失去該匿名身分。

三個頁面共用 `app/src/firebase.js` 資料存取層及 `app/src/auth-ui.js` 登入元件。Enterprise 查詢使用 Firestore Lite Pipeline，新增與單筆查詢使用 Lite Core 操作，不依賴即時監聽。題庫在瀏覽器隨機抽題、計分，適用學習練習；分數並非伺服器驗證的正式考試成績。變更老師帳號時須同步修改 `app/src/firebase-config.js` 與 `firestore.rules` 並重新部署規則。

## 開發、測試與建置

需要 Node.js 24.12 以上；模擬器需要 Java 21 以上。

```sh
npm ci
npm run dev
npm test
npx -y firebase-tools@latest emulators:exec --only firestore --project demo-language-allen 'npm run test:rules'
npm run build
```

修改 `app/*.html` 和 `app/src/*.js`。`npm run build` 會產生 `dist/`，並同步根目錄的 HTML 與 `assets/`；請一起提交根目錄產物以相容目前 GitHub Pages 的根目錄發佈方式。Firebase 的 Web config 是公開識別資訊，存取權由 Authentication 與 Firestore Rules 控制；不要把管理金鑰或 GitHub Token 放進前端。

本機連到模擬器需設定 `VITE_USE_EMULATORS=true`，並開啟 Firestore 和 Auth 模擬器。正式建置請不要設定此變數。

## 建立資料庫與部署

專案、Allen Web App、Google／匿名登入與台灣 `asia-east1` 的 `allen` 資料庫已建立。已逐欄核對匯入 66 題、13 份歷史紀錄與 JSON 範例。以下為重建／維護命令：

```sh
npx -y firebase-tools@latest firestore:databases:create allen --project language-timothy920611 --edition enterprise --location asia-east1 --firestore-data-access ENABLED --mongodb-compatible-data-access DISABLED
npx -y firebase-tools@latest deploy --only auth,firestore --project language-timothy920611
npm run migrate
npm run migrate -- --write
```

`npm run migrate` 僅列出遷移計畫，`--write` 才實際寫入。腳本使用 Firebase 官方 MCP，不讀取舊網頁的 GitHub 金鑰；需先用 Firebase CLI 登入或設定 Application Default Credentials。檔案路徑產生固定 ID，重跑不覆蓋現有文件，並核對每個寫入欄位。若目的文件內容不同，會停止而不覆蓋。成功後產生 `migration-report.json`，包含來源 SHA-256 與核對時間。

`migration-report.json` 記錄已完成的遷移核對。正式前端透過 Firebase SDK 連線，原 GitHub 寫入金鑰與資料 API 已移除。根目錄舊 JSON 暫留為來源備份，正式前端不再讀寫它們；GitHub 上原本公開的資料及歷史版本仍可被讀取。舊網頁內曾包含混淆的 GitHub Token，應在 GitHub 撤銷該舊 Token；本版本已移除金鑰與 GitHub 資料讀寫。

## 權限規則說明

已建立 prototype Security Rules，限制老師身分、成績擁有者、新增資料格式、大小與伺服器時間，並禁止前端修改或刪除歷史紀錄。模擬器測試涵蓋未登入／跨學生讀取、冒用老師、竄改擁有者、額外欄位、超大資料、時間戳與更新／刪除拒絕，也測試正式使用的 Pipeline 查詢。規則仍應在廣泛分享應用程式前人工檢閱。
