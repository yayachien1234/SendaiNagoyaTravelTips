# 上架到 GitHub Pages

這個資料夾已經是一個 git repo（本機已經 commit 好第一版）。要讓爸媽姊姊能用連結打開，照下面步驟做：

## 1. 建立一個空的 GitHub repo

到 https://github.com/new 建立一個新 repo（例如取名 `sendai-nagoya-trip`）：
- **Public**（GitHub Pages 免費版必須是 public）
- 不要勾選「Add a README」等初始化選項（保持空的 repo）

建好後複製它的網址，例如 `https://github.com/你的帳號/sendai-nagoya-trip.git`。

## 2. 推上去

在這個資料夾（`trip-site/`）打開終端機，執行：

```
git remote add origin https://github.com/你的帳號/sendai-nagoya-trip.git
git branch -M main
git push -u origin main
```

（如果你把網址給 Claude，也可以請它幫你做這三行。）

## 3. 打開 GitHub Pages

到 repo 頁面 → Settings → Pages：
- Source 選 `Deploy from a branch`
- Branch 選 `main` / `/(root)`
- 存檔，等 1–2 分鐘

網址會是 `https://你的帳號.github.io/sendai-nagoya-trip/`。

## 4. 存到手機主畫面（爸媽姊姊各自做一次）

打開上面那個網址：
- **iPhone (Safari)**：分享 → 加入主畫面
- **Android (Chrome)**：右上角選單 → 加到主畫面 / 安裝應用程式

加入後從主畫面圖示打開，第一次要有網路載入一次，之後（Service Worker 快取好之後）沒有網路也能開。

## 5. 之後行程有更動怎麼辦

這個網站的資料是**一次性快照**，Notion 之後再改不會自動同步過來。如果 Notion 有更新，要請 Claude 重新跑一次匯出（重新產生 `data.json`），改完之後：

```
git add -A
git commit -m "更新行程資料"
git push
```

推上去後，GitHub Pages 會自動更新（但因為離線快取是 cache-first，已經安裝在手機上的人可能要重新整理兩次、或重新開啟App才會抓到新版——出發前建議大家都手動刷新一次确保是最新版）。
