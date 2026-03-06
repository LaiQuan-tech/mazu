# 🚀 GitHub CLI 快速開始 - 5 分鐘上手

## 📦 你現在擁有的文件

```
📁 ~/Documents/
├── install_github_cli.sh          ← 安裝和登入腳本
├── sync_with_github_cli.sh        ← 高級同步腳本（推薦）
├── sync_repo.sh                   ← 基礎同步腳本
├── setup_repo.sh                  ← Git 初始化腳本
├── GITHUB_CLI_GUIDE.md            ← 詳細指南
└── README.md                      ← Repo 同步指南
```

---

## ⚡ 最快 3 步開始使用

### 第一步：下載所有文件
將 6 個文件下載到 `~/Documents/` 目錄

### 第二步：安裝 GitHub CLI（5 分鐘）
在 Mac 終端機執行：
```bash
chmod +x ~/Documents/install_github_cli.sh
~/Documents/install_github_cli.sh
```

**這個腳本會：**
1. ✅ 安裝 Homebrew（如果需要）
2. ✅ 安裝 GitHub CLI
3. ✅ 自動打開瀏覽器讓你登入
4. ✅ 保存認證信息

### 第三步：同步 Repo（之後每次只需 1 句指令）
```bash
~/Documents/sync_with_github_cli.sh
```

**這個腳本會自動：**
- 📥 拉取最新代碼
- 🚀 執行你的項目
- 📤 提交並推送改動
- ✅ 全部搞定！

---

## 🎯 登入流程說明

執行 `install_github_cli.sh` 時，會看到這樣的提示：

```
? What is your preferred protocol for Git operations? (Use arrow keys)
❯ HTTPS
  SSH

? Authenticate with an OAuth token, or login with your browser?
❯ Login with your browser (recommended)
  Paste an authentication token
```

**選擇：**
1. **HTTPS** ✅ （推薦）
2. **Login with your browser** ✅ （自動打開瀏覽器）

然後：
- 瀏覽器會打開 GitHub 登入頁面
- 輸入你的 GitHub 帳號密碼
- 授予 GitHub CLI 權限
- 自動返回終端機，完成登入 ✨

---

## 📋 三個腳本的作用

| 腳本名稱 | 用途 | 第一次使用 | 之後每次 |
|---------|------|----------|--------|
| `install_github_cli.sh` | 安裝 GitHub CLI | ✅ 需要 | ❌ 不需要 |
| `setup_repo.sh` | 設定 Git SSH | ✅ 可選 | ❌ 不需要 |
| `sync_with_github_cli.sh` | 同步 Repo | ❌ 不需要 | ✅ **每次都用** |

---

## 📲 完整操作流程

### 第 1 天：初次設定（10 分鐘）

```bash
# 1. 安裝 GitHub CLI
chmod +x ~/Documents/install_github_cli.sh
~/Documents/install_github_cli.sh
# ↑ 會自動打開瀏覽器讓你登入

# 2. 驗證登入成功
gh auth status
# 應該看到: ✓ Logged in to github.com as lqtech2026
```

### 第 2-N 天：日常使用（每次 1 句）

```bash
# 拉取代碼、執行項目、推送改動 - 全部自動化
~/Documents/sync_with_github_cli.sh
```

---

## 🔑 登入常見問題

### Q1: 登入時卡住了？
**A:** 檢查是否有瀏覽器窗口打開。如果沒有，按 `Ctrl+C` 退出，重新執行：
```bash
gh auth login
```

### Q2: "GitHub CLI not found"？
**A:** 檢查是否正確執行了 `install_github_cli.sh`：
```bash
which gh
brew list gh
```

### Q3: 登入後還是要密碼？
**A:** 可能是 HTTPS 協議，改用 SSH：
```bash
gh auth login --web
# 選擇 SSH 協議
```

### Q4: 需要重新登入？
**A:** 執行：
```bash
gh auth logout
gh auth login
```

---

## ✨ GitHub CLI 的優勢

✅ **不需要手動處理 SSH Key**
- GitHub CLI 自動生成和管理認證
- 更安全（Token 保存在系統鑰匙圈）

✅ **推送代碼無需密碼**
- 登入一次，之後自動認證
- Git 會自動使用 GitHub CLI 的認證

✅ **命令行管理 GitHub**
```bash
# 查看倉庫
gh repo view

# 創建 Issue
gh issue create

# 創建 Pull Request
gh pr create

# 查看 PR 狀態
gh pr status
```

✅ **與 Git 無縫整合**
```bash
git push origin main
# 自動使用 GitHub CLI 的認證，不需要輸入密碼！
```

---

## 🎓 進階：完整工作流

```bash
# 1. 進入項目
cd ~/Documents/和聖壇網站資料夾

# 2. 修改代碼
vim file.txt

# 3. 檢查狀態
git status

# 4. 一鍵同步（自動做完以下所有步驟）
~/Documents/sync_with_github_cli.sh
# ↑ 自動執行：
#   - git add .
#   - git commit -m "提交信息"
#   - git push origin main
```

---

## 📞 需要幫助？

查看 GitHub CLI 所有命令：
```bash
gh --help
```

查看特定命令幫助：
```bash
gh auth --help
gh repo --help
gh pr --help
```

查看詳細指南（已提供）：
```bash
open ~/Documents/GITHUB_CLI_GUIDE.md
```

---

## ✅ 驗證安裝成功

執行以下命令，應該都能正常工作：

```bash
# 1. 檢查 GitHub CLI 版本
gh --version
# 期望輸出: gh version 2.x.x

# 2. 檢查登入狀態
gh auth status
# 期望輸出: ✓ Logged in to github.com as lqtech2026

# 3. 查看倉庫信息
gh repo view LaiQuan-tech/mazu
# 期望輸出: 倉庫信息

# 4. 列出你的倉庫
gh repo list
# 期望輸出: 你的倉庫列表
```

全部成功 ✅ = 安裝完成！

---

## 🎉 祝你使用愉快！

現在你有了企業級的 GitHub 工作流：
- ✨ 自動化認證
- ✨ 一句指令同步
- ✨ 無需手動管理 SSH Key
- ✨ 完全命令行操作

享受高效的開發體驗！ 🚀
