#!/bin/bash

# 顏色輸出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GitHub CLI 自動安裝和登入${NC}"
echo -e "${BLUE}========================================${NC}\n"

# ===== 步驟 1: 檢查 Homebrew =====
echo -e "${YELLOW}[1/4] 檢查 Homebrew...${NC}"

if ! command -v brew &> /dev/null; then
    echo -e "${RED}✗ Homebrew 未安裝${NC}"
    echo -e "${YELLOW}正在安裝 Homebrew...${NC}\n"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo -e "${GREEN}✓ Homebrew 已安裝${NC}"
else
    echo -e "${GREEN}✓ Homebrew 已安裝${NC}"
fi
echo ""

# ===== 步驟 2: 安裝 GitHub CLI =====
echo -e "${YELLOW}[2/4] 安裝 GitHub CLI...${NC}"

if command -v gh &> /dev/null; then
    echo -e "${GREEN}✓ GitHub CLI 已安裝${NC}"
    echo -e "${YELLOW}版本：$(gh --version)${NC}"
else
    echo -e "${YELLOW}正在安裝 GitHub CLI...${NC}"
    brew install gh
    echo -e "${GREEN}✓ GitHub CLI 已安裝${NC}"
fi
echo ""

# ===== 步驟 3: 檢查登入狀態 =====
echo -e "${YELLOW}[3/4] 檢查登入狀態...${NC}"

if gh auth status &> /dev/null; then
    echo -e "${GREEN}✓ 已登入 GitHub${NC}"
    gh auth status
else
    echo -e "${YELLOW}✗ 未登入，正在啟動登入流程...${NC}"
fi
echo ""

# ===== 步驟 4: 啟動登入 =====
echo -e "${YELLOW}[4/4] 啟動 GitHub 登入...${NC}\n"

read -p "是否要登入 GitHub? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}啟動網頁登入...${NC}\n"
    gh auth login
    
    if gh auth status &> /dev/null; then
        echo ""
        echo -e "${GREEN}✓ 登入成功！${NC}\n"
        echo -e "${YELLOW}登入信息：${NC}"
        gh auth status
    else
        echo -e "${RED}✗ 登入失敗，請重試${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}跳過登入步驟${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ GitHub CLI 設定完成！${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}常用命令：${NC}"
echo "查看登入狀態: gh auth status"
echo "查看個人信息: gh api user"
echo "列出倉庫: gh repo list"
echo "克隆倉庫: gh repo clone <owner>/<repo>"
echo "創建議題: gh issue create"
echo "創建 Pull Request: gh pr create"
echo ""
