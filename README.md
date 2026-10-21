# Allen 共享題庫

純 HTML、CSS、ES Modules 的語言學習 Web App，GitHub Pages 直接發布。Firebase Web modular SDK 13.0.0 從官方 CDN 載入；後端只有 Firebase Authentication 與 Cloud Firestore，沒有 Cloud Functions 或伺服器。

沒有帳號設定、登入按鈕或老師角色。每個人都能上傳共享題庫，其他訪客重新整理即可使用。背景匿名驗證提供 Rules 所需的 UID；作答紀錄只供同一瀏覽器匿名身分讀取。所有動態文字以 `textContent` 呈現。

## 操作與設定

[逐步設定與安全清單：SETUP.md](./SETUP.md) 涵蓋 Firebase、授權網域、API Key HTTP referrer 限制、App Check／reCAPTCHA 初始化、預算警示、GitHub 2FA、main 保護與 Pages。

目前專案：`language-timothy920611`（顯示名稱 language），資料庫 `allen`，台灣 `asia-east1`。共享資料在 `Allen/app/banks`，上傳者識別在私有 `bankOwners`，私人作答紀錄在 `Allen/app/users/{uid}/records`。原 66 題會轉入新的共享結構，舊成績保留於 Firebase 的封鎖路徑。

## 本機與測試

直接使用靜態 HTTP server 即可，不要以 file:// 開啟 ES Modules。

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

測試依賴需要 Node.js 24.12+，規則模擬器需要 Java 21+：

```sh
npm ci
npm test
npx -y firebase-tools@latest emulators:exec --only firestore --project demo-language-allen 'npm run test:rules'
```

本機瀏覽器測試需另開 Auth／Firestore 模擬器：

```sh
npx -y firebase-tools@latest emulators:start --only auth,firestore --project demo-language-allen
```

再開 `http://127.0.0.1:5173/?emulator=1`。這個開關只在 localhost／127.0.0.1 有效，正式網域不會因查詢參數改連模擬器。測試必須先放入共享題庫或透過上傳表單加入；正式資料不會自動複製到模擬器。

`firebaseConfig` 與 reCAPTCHA site key 是公開識別資訊。管理憑證、secret key、debug token、私人紀錄與備份不可提交 repo。App Check 目前需填入真實 site key 並在 Console 註冊／監測／enforce；不要把預留程式當作已啟用保護。
