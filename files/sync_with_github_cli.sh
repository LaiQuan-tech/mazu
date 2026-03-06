#!/bin/bash

# 顏色輸出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

LOCAL_PATH="$HOME/Documents/和聖壇網站資料夾"
REPO_URL="git@github.com:LaiQuan-tech/mazu.git"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Mazu Repo - GitHub CLI 高級同步${NC}"
echo -e "${BLUE}========================================${NC}\n"

# ===== 檢查 GitHub CLI 認證 =====
echo -e "${YELLOW}[1/5] 檢查 GitHub CLI 認證...${NC}"

if ! command -v gh &> /dev/null; then
    echo -e "${RED}✗ GitHub CLI 未安裝${NC}"
    echo "請先執行: ~/Documents/install_github_cli.sh"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo -e "${RED}✗ 未登入 GitHub${NC}"
    echo "正在啟動登入..."
    gh auth login
fi

echo -e "${GREEN}✓ GitHub CLI 已認證${NC}"
gh auth status
echo ""

# ===== 進入資料夾 =====
echo -e "${YELLOW}[2/5] 進入本地資料夾...${NC}"
mkdir -p "$LOCAL_PATH"
cd "$LOCAL_PATH" || exit 1
echo -e "${GREEN}✓ 進入: $LOCAL_PATH${NC}\n"

# ===== 初始化/更新 Repo =====
echo -e "${YELLOW}[3/5] 初始化/更新 Repo...${NC}"

if [ ! -d .git ]; then
    echo -e "${YELLOW}初始化新 Repo...${NC}"
    git init
    git remote add origin "$REPO_URL"
fi

echo -e "${YELLOW}拉取最新代碼...${NC}"
git fetch origin
git checkout main 2>/dev/null || git checkout master 2>/dev/null || git pull origin --all
echo -e "${GREEN}✓ Repo 已更新${NC}\n"

# ===== 檢測項目類型並執行 =====
echo -e "${YELLOW}[4/5] 檢測和執行項目...${NC}"

if [ -f "package.json" ]; then
    echo -e "${YELLOW}檢測到 Node.js 項目${NC}"
    npm install
    echo -e "${GREEN}✓ 依賴已安裝${NC}"
elif [ -f "requirements.txt" ]; then
    echo -e "${YELLOW}檢測到 Python 項目${NC}"
    pip install -r requirements.txt
    echo -e "${GREEN}✓ 依賴已安裝${NC}"
elif [ -f "composer.json" ]; then
    echo -e "${YELLOW}檢測到 PHP 項目${NC}"
    composer install
    echo -e "${GREEN}✓ 依賴已安裝${NC}"
else
    echo -e "${YELLOW}✓ 項目準備就緒${NC}"
fi
echo ""

# ===== 提交和推送 =====
echo -e "${YELLOW}[5/5] 提交改動...${NC}"
echo ""
git status
echo ""

read -p "要提交改動嗎? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add .
    
    # 提示輸入 commit 訊息
    echo -e "${YELLOW}輸入 commit 訊息 (或按 Enter 使用預設):${NC}"
    read -p "> " commit_msg
    commit_msg=${commit_msg:-"Update: $(date '+%Y-%m-%d %H:%M:%S')"}
    
    # 提交
    if git commit -m "$commit_msg"; then
        echo ""
        echo -e "${YELLOW}推送到 GitHub...${NC}"
        
        # 推送並顯示結果
        if git push origin main 2>&1 | tee /tmp/push_output.txt; then
            echo -e "${GREEN}✓ 推送成功${NC}"
        elif grep -q "master" /tmp/push_output.txt; then
            git push origin master
            echo -e "${GREEN}✓ 推送成功${NC}"
        else
            echo -e "${RED}✗ 推送失敗${NC}"
        fi
    else
        echo -e "${YELLOW}沒有新改動需要提交${NC}"
    fi
    
    echo ""
fi

# ===== 顯示狀態 =====
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 同步完成！${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}當前狀態：${NC}"
echo "• 倉庫位置: $LOCAL_PATH"
echo "• 遠端地址: $(git config --get remote.origin.url)"
echo "• 當前分支: $(git rev-parse --abbrev-ref HEAD)"
echo "• 最新提交: $(git log -1 --pretty=format:'%h - %s')"
echo ""

echo -e "${YELLOW}常用命令：${NC}"
echo "• 查看狀態: git status"
echo "• 拉取更新: git pull origin main"
echo "• 查看日誌: git log --oneline -10"
echo "• 查看改動: git diff"
echo "• 創建分支: git checkout -b feature/新功能"
echo "• 查看倉庫信息: gh repo view"
echo ""
