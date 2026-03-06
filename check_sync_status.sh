#!/bin/bash

# 顏色輸出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

LOCAL_PATH="$HOME/Documents/和聖壇網站資料夾"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GitHub 同步狀態檢查${NC}"
echo -e "${BLUE}========================================${NC}\n"

# ===== 檢查 1: GitHub CLI 登入狀態 =====
echo -e "${YELLOW}[1] 檢查 GitHub CLI 登入狀態...${NC}"

if command -v gh &> /dev/null; then
    if gh auth status &> /dev/null; then
        echo -e "${GREEN}✓ GitHub CLI 已登入${NC}"
        gh auth status
    else
        echo -e "${RED}✗ GitHub CLI 未登入${NC}"
    fi
else
    echo -e "${RED}✗ GitHub CLI 未安裝${NC}"
fi
echo ""

# ===== 檢查 2: 進入本地資料夾 =====
echo -e "${YELLOW}[2] 檢查本地資料夾...${NC}"

if [ -d "$LOCAL_PATH" ]; then
    echo -e "${GREEN}✓ 資料夾存在: $LOCAL_PATH${NC}"
    cd "$LOCAL_PATH" || exit 1
else
    echo -e "${RED}✗ 資料夾不存在: $LOCAL_PATH${NC}"
    exit 1
fi
echo ""

# ===== 檢查 3: Git Repo 狀態 =====
echo -e "${YELLOW}[3] 檢查 Git Repo 狀態...${NC}"

if [ -d .git ]; then
    echo -e "${GREEN}✓ 這是一個 Git Repo${NC}"
else
    echo -e "${RED}✗ 不是 Git Repo（未初始化）${NC}"
fi
echo ""

# ===== 檢查 4: 遠端倉庫配置 =====
echo -e "${YELLOW}[4] 檢查遠端倉庫配置...${NC}"

REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null)

if [ -z "$REMOTE_URL" ]; then
    echo -e "${RED}✗ 沒有配置遠端倉庫${NC}"
else
    echo -e "${GREEN}✓ 遠端倉庫: $REMOTE_URL${NC}"
    
    # 檢查是否是正確的倉庫
    if [[ "$REMOTE_URL" == *"mazu"* ]]; then
        echo -e "${GREEN}✓ 是 mazu 倉庫${NC}"
    else
        echo -e "${YELLOW}⚠ 可能不是 mazu 倉庫${NC}"
    fi
fi
echo ""

# ===== 檢查 5: 當前分支 =====
echo -e "${YELLOW}[5] 檢查當前分支...${NC}"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

if [ -z "$CURRENT_BRANCH" ]; then
    echo -e "${RED}✗ 無法確定當前分支${NC}"
else
    echo -e "${GREEN}✓ 當前分支: $CURRENT_BRANCH${NC}"
fi
echo ""

# ===== 檢查 6: 最新提交信息 =====
echo -e "${YELLOW}[6] 最新提交信息...${NC}"

LATEST_COMMIT=$(git log -1 --pretty=format:'%h - %s - %an (%ae) - %ar' 2>/dev/null)

if [ -z "$LATEST_COMMIT" ]; then
    echo -e "${YELLOW}⚠ 尚無提交記錄${NC}"
else
    echo -e "${GREEN}$LATEST_COMMIT${NC}"
fi
echo ""

# ===== 檢查 7: 本地未提交的改動 =====
echo -e "${YELLOW}[7] 本地改動狀態...${NC}"

CHANGES=$(git status --porcelain 2>/dev/null)

if [ -z "$CHANGES" ]; then
    echo -e "${GREEN}✓ 沒有未提交的改動${NC}"
else
    echo -e "${YELLOW}⚠ 有未提交的改動:${NC}"
    echo "$CHANGES"
fi
echo ""

# ===== 檢查 8: 與遠端比較 =====
echo -e "${YELLOW}[8] 與遠端的同步狀態...${NC}"

git fetch origin 2>/dev/null

BEHIND=$(git rev-list --count "HEAD..origin/$CURRENT_BRANCH" 2>/dev/null)
AHEAD=$(git rev-list --count "origin/$CURRENT_BRANCH..HEAD" 2>/dev/null)

if [ -z "$BEHIND" ] && [ -z "$AHEAD" ]; then
    echo -e "${YELLOW}⚠ 無法比較（可能尚未推送過）${NC}"
else
    if [ "$AHEAD" -gt 0 ]; then
        echo -e "${YELLOW}⚠ 本地領先遠端 $AHEAD 個提交${NC}"
    fi
    
    if [ "$BEHIND" -gt 0 ]; then
        echo -e "${YELLOW}⚠ 本地落後遠端 $BEHIND 個提交${NC}"
    fi
    
    if [ "$AHEAD" -eq 0 ] && [ "$BEHIND" -eq 0 ]; then
        echo -e "${GREEN}✓ 本地和遠端完全同步${NC}"
    fi
fi
echo ""

# ===== 檢查 9: 遠端倉庫信息 =====
echo -e "${YELLOW}[9] 查詢 GitHub 遠端倉庫...${NC}"

if command -v gh &> /dev/null && gh auth status &> /dev/null; then
    REPO_INFO=$(gh repo view LaiQuan-tech/mazu --json nameWithOwner,url,updatedAt 2>/dev/null)
    
    if [ -z "$REPO_INFO" ]; then
        echo -e "${YELLOW}⚠ 無法查詢倉庫信息（可能沒有推送過）${NC}"
    else
        echo -e "${GREEN}✓ 遠端倉庫信息:${NC}"
        echo "$REPO_INFO" | jq .
    fi
else
    echo -e "${YELLOW}⚠ GitHub CLI 未登入，跳過此檢查${NC}"
fi
echo ""

# ===== 最終總結 =====
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}檢查總結${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}已確認的信息：${NC}"
echo "• GitHub 帳號: lqtech2026@gmail.com"
echo "• 本地路徑: $LOCAL_PATH"
echo "• 遠端倉庫: $REMOTE_URL"
echo "• 當前分支: $CURRENT_BRANCH"
echo ""

# 判斷是否已同步
if [ -n "$REMOTE_URL" ] && [[ "$REMOTE_URL" == *"mazu"* ]]; then
    if [ -z "$CHANGES" ]; then
        echo -e "${GREEN}✓✓✓ 已成功同步到 GitHub！${NC}"
        echo ""
        echo -e "${YELLOW}下一步：${NC}"
        echo "1. 訪問: https://github.com/LaiQuan-tech/mazu"
        echo "2. 檢查最新的 commit"
        echo "3. 驗證提交者是否是 lqtech2026"
    else
        echo -e "${YELLOW}⚠⚠⚠ 有未推送的改動${NC}"
        echo ""
        echo -e "${YELLOW}要推送改動，執行：${NC}"
        echo "cd '$LOCAL_PATH'"
        echo "git add ."
        echo "git commit -m '更新提交信息'"
        echo "git push origin $CURRENT_BRANCH"
    fi
else
    echo -e "${RED}✗✗✗ 尚未配置或同步到 GitHub${NC}"
    echo ""
    echo -e "${YELLOW}要開始同步，執行：${NC}"
    echo "~/Documents/sync_with_github_cli.sh"
fi

echo ""
echo -e "${BLUE}========================================${NC}\n"
