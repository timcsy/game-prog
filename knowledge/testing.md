# 自動測試

遊戲仍是無需建置的靜態網站；測試工具只供開發時使用，需要 Node.js 20 以上。

```sh
npm ci
npx playwright install chromium
npm test
```

測試以本機 HTTP 服務啟動網站，檢查三關通關與解鎖、重載與重新遊玩、鍵盤導航、編輯後重新執行、錯誤回饋、儲存失敗、多分頁進度、窄版地圖、中途重設及 Chromium 輔助科技樹中的地圖結構。每項測試使用獨立瀏覽器環境，不會更動玩家的實際存檔。

GitHub Actions 在推送 `main` 後安裝 Chromium 並執行測試，通過後才發布 Pages。自動測試不取代實際玩家、行動裝置或輔助科技測試。
