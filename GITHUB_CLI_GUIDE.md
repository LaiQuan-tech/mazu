# 🔐 GitHub CLI 安裝和登入指南

## 📋 概述
GitHub CLI 是 GitHub 官方的命令行工具，可以讓你：
- ✅ 在終端機直接管理倉庫
- ✅ 提交 Pull Request
- ✅ 管理 Issues
- ✅ 克隆倉庫
- ✅ 無需輸入密碼和 SSH Key（自動認證）

---

## 🚀 快速安裝（一句指令）

在 Mac 終端機執行：

```bash
chmod +x ~/Documents/install_github_cli.sh
~/Documents/install_github_cli.sh
```

腳本會自動：
1. 安裝 Homebrew（如果需要）
2. 安裝 GitHub CLI
3. 幫你登入 GitHub
4. 顯示常用命令

---

## 📖 完整步驟說明

### 步驟 1️⃣: 準備腳本
下載 `install_github_cli.sh` 到你的 Mac

### 步驟 2️⃣: 執行安裝
```bash
chmod +x ~/Documents/install_github_cli.sh
~/Documents/install_github_cli.sh
```

### 步驟 3️⃣: 按照提示登入
腳本會：
- 檢查 Homebrew
- 安裝 GitHub CLI
- 自動打開網頁讓你登入
- 生成認證 Token

### 步驟 4️⃣: 確認登入成功
```bash
gh auth status
```

應該看到：
```
✓ Logged in to github.com as lqtech2026
  - Active account: true
  - Credentials: OAuth token in keychain
  - Token scopes: gist, public_repo, read:org
```

---

## 🎯 常用命令

### 檢查登入狀態
```bash
gh auth status
```

### 查看個人信息
```bash
gh api user
```

### 列出你的倉庫
```bash
gh repo list
```

### 克隆倉庫（比 git clone 更快）
```bash
gh repo clone LaiQuan-tech/mazu
```

### 查看遠端倉庫信息
```bash
gh repo view LaiQuan-tech/mazu
```

---

## 🔄 與 Git 整合使用

### 拉取最新代碼
```bash
cd ~/Documents/和聖壇網站資料夾
gh repo clone LaiQuan-tech/mazu
```

### 推送改動
```bash
git push origin main
# GitHub CLI 會自動使用已登入的認證
```

### 創建 Pull Request
```bash
gh pr create --title "新功能描述" --body "詳細說明"
```

### 查看 Issues
```bash
gh issue list
```

### 創建 Issue
```bash
gh issue create --title "BUG 描述" --body "如何重現這個問題"
```

---

## 🔑 登入方式選擇

執行 `gh auth login` 時會問你：

**選項 1: GitHub.com（推薦）**
- 選擇: `github.com`

**選項 2: 認證協議**
- 推薦: `HTTPS`（需要網頁認證）
- 或: `SSH`（如果已設定 SSH Key）

**選項 3: 認證方法**
- 推薦: **Login with a web browser**（最安全）
  - 會自動打開瀏覽器
  - 你在網頁上授權
  - Token 自動保存在 Mac 鑰匙圈
  
- 或: Paste an authentication token（需要先生成 Token）

---

## ✅ 使用 GitHub CLI 的優點

| 功能 | 無 CLI | 使用 CLI |
|------|--------|---------|
| 推送代碼 | 需要 SSH Key 或 Personal Token | 自動認證 ✅ |
| 克隆倉庫 | `git clone https://...` | `gh repo clone ...` |
| 創建 PR | 需要網頁 | `gh pr create` |
| 查看 Issues | 需要網頁 | `gh issue list` |
| 管理倉庫 | 需要網頁 | `gh repo view` |

---

## 🔧 故障排除

### 問題 1: "command not found: gh"
解決方案：
```bash
# 檢查是否安裝成功
brew list gh

# 如果未安裝，手動安裝
brew install gh
```

### 問題 2: "Homebrew not found"
解決方案（手動安裝 Homebrew）：
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 問題 3: 登入後仍然要求密碼
解決方案：
```bash
# 檢查認證
gh auth status

# 重新登入
gh auth login
```

### 問題 4: "Permission denied"
解決方案：
```bash
chmod +x ~/Documents/install_github_cli.sh
```

### 問題 5: 需要重新登入
```bash
gh auth logout
gh auth login
```

---

## 🌐 網頁登入流程

執行 `gh auth login` 並選擇 **Login with a web browser** 時：

1. 終端機會顯示一個代碼（如 `XXXX-XXXX`）
2. 自動打開瀏覽器到 GitHub 登入頁面
3. 在網頁輸入代碼
4. 授予 GitHub CLI 權限
5. 返回終端機，自動設定完成 ✅

---

## 📂 與之前的 SSH Key 共存

GitHub CLI 和 SSH Key 可以同時使用：

```bash
# 使用 SSH
git push origin main

# 或使用 GitHub CLI 的認證
gh auth status  # 確認已登入

# 以後 git push 會自動使用 GitHub CLI 的認證
git push origin main
```

---

## 🎓 進階使用

### 自動化 Commit 和 Push
```bash
#!/bin/bash
cd ~/Documents/和聖壇網站資料夾
git add .
git commit -m "自動提交：$(date)"
git push origin main
```

### 批量克隆倉庫
```bash
gh repo list --limit 10 | awk '{print $1}' | xargs -I {} gh repo clone {}
```

### 檢查倉庫狀態
```bash
gh repo view LaiQuan-tech/mazu --json description,url,updatedAt
```

---

## 💡 Tips

✨ **Git 和 GitHub CLI 的區別：**
- `git` - 本地版本控制（commit, push, pull）
- `gh` - GitHub 遠端操作（PR, Issues, 倉庫管理）

✨ **推薦工作流：**
```bash
# 1. 修改代碼
vim file.txt

# 2. 提交到本地
git add .
git commit -m "描述改動"

# 3. 推送到遠端（自動認證）
git push origin main

# 4. 創建 PR（可選）
gh pr create --title "新功能"

# 5. 查看 PR 狀態
gh pr status
```

---

## 📞 需要幫助?

查看所有可用命令：
```bash
gh --help
```

查看特定命令幫助：
```bash
gh auth --help
gh repo --help
gh pr --help
```

---

祝你使用愉快！ 🎉
