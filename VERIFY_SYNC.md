# 🔍 驗證 GitHub 同步狀態

## ⚡ 快速檢查（1 句指令）

在你的 Mac 終端機執行：

```bash
chmod +x ~/Documents/check_sync_status.sh
~/Documents/check_sync_status.sh
```

這個腳本會檢查：
- ✅ GitHub CLI 登入狀態
- ✅ 本地 Git Repo 配置
- ✅ 遠端倉庫連接
- ✅ 最新提交信息
- ✅ 與遠端的同步狀態
- ✅ 是否有未推送的改動

---

## 🌐 快速驗證（在網頁上看）

不想執行腳本？直接訪問你的 GitHub Repo：

```
https://github.com/LaiQuan-tech/mazu
```

**檢查點：**

1. **查看提交歷史**
   - 點 Commits（提交歷史）
   - 查看最新的 commit 是誰提交的
   - 應該看到 `lqtech2026` 或你的 GitHub username

2. **查看最新提交者**
   - 點最新的 commit
   - 檢查 "Authored by" 欄位
   - 應該是你的 GitHub 郵箱

3. **查看時間戳**
   - 應該是最近的時間（不是很久以前）

---

## 📋 手動檢查方式

如果喜歡手動檢查，在 Mac 終端機執行：

### 1️⃣ 檢查 GitHub CLI 登入
```bash
gh auth status
```

**應該看到：**
```
✓ Logged in to github.com as lqtech2026
  - Active account: true
  - Credentials: OAuth token in keychain
  - Token scopes: gist, public_repo, read:org
```

### 2️⃣ 進入本地資料夾
```bash
cd ~/Documents/和聖壇網站資料夾
```

### 3️⃣ 檢查 Git 狀態
```bash
git status
```

**應該看到：**
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

### 4️⃣ 查看最新提交
```bash
git log -1 --pretty=format:'%h - %s - %an (%ae)'
```

**應該看到類似：**
```
abc1234 - Update: 本機端改動 - lqtech2026 (lqtech2026@gmail.com)
```

### 5️⃣ 檢查遠端倉庫
```bash
git config --get remote.origin.url
```

**應該看到：**
```
git@github.com:LaiQuan-tech/mazu.git
```

或

```
https://github.com/LaiQuan-tech/mazu.git
```

### 6️⃣ 查詢 GitHub 遠端信息
```bash
gh repo view LaiQuan-tech/mazu
```

---

## ✅ 同步成功的標誌

✓ `gh auth status` 顯示已登入 `lqtech2026`
✓ `git status` 顯示 "nothing to commit"
✓ `git log` 顯示最新提交者是你的郵箱
✓ 訪問 GitHub Repo 看到最新 commit

---

## ❌ 常見問題排查

### 問題 1: GitHub CLI 未登入
```bash
gh auth status
# 輸出: Not logged in
```

**解決：**
```bash
~/Documents/install_github_cli.sh
```

### 問題 2: 有未推送的改動
```bash
git status
# 輸出: nothing to commit 之外的內容
```

**解決：**
```bash
cd ~/Documents/和聖壇網站資料夾
~/Documents/sync_with_github_cli.sh
```

### 問題 3: 本地沒有 Repo
```bash
cd ~/Documents/和聖壇網站資料夾
git status
# 輸出: fatal: not a git repository
```

**解決：**
```bash
~/Documents/sync_with_github_cli.sh
```

### 問題 4: 遠端倉庫錯誤
```bash
git config --get remote.origin.url
# 輸出: 不是 mazu 倉庫的地址
```

**解決：**
```bash
git remote remove origin
git remote add origin git@github.com:LaiQuan-tech/mazu.git
git push -u origin main
```

---

## 📊 同步狀態判斷表

| 檢查項 | ✅ 已同步 | ❌ 未同步 |
|--------|---------|---------|
| `gh auth status` | Logged in | Not logged in |
| `git status` | nothing to commit | Changes not staged |
| 遠端倉庫 | git@github.com:LaiQuan-tech/mazu.git | 未配置或錯誤 |
| GitHub Repo | 有最新 commit | 沒有 commit 或很舊 |
| 提交者 | lqtech2026 | 其他用戶或未知 |

---

## 🎯 三種驗證方式對比

| 方式 | 難度 | 速度 | 全面性 |
|------|------|------|--------|
| 自動腳本 `check_sync_status.sh` | ⭐ 簡單 | ⚡ 最快 | ✅ 全面 |
| 手動命令逐個執行 | ⭐⭐ 中等 | 🐢 較慢 | ✅ 全面 |
| 網頁查看 GitHub Repo | ⭐ 簡單 | ⚡ 快 | ⭐ 基本 |

**推薦：** 先用自動腳本 `check_sync_status.sh`，它會自動告訴你是否已同步！

---

## 💡 我的建議

**最簡單的驗證方式：**

1. 執行自動檢查腳本：
```bash
~/Documents/check_sync_status.sh
```

2. 看最後的總結：
   - 如果顯示 **✓✓✓ 已成功同步到 GitHub！** → 完成了 ✅
   - 如果顯示其他提示 → 按照建議執行相應命令

就這麼簡單！🎉

---

祝你驗證順利！有任何問題隨時告訴我！ 🚀
