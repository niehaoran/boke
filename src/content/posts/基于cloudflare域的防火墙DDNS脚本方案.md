---
title: 基于cloudflare域的防火墙DDNS脚本方案
published: 2025-01-17
description: '一个简单的脚本，通过Cloudflare API远程更新防火墙规则，让动态IP用户也能使用IP白名单保护'
image: ''
tags: [Cloudflare, DDNS, 防火墙, Linux, Bash, 自动化, 网络安全]
category: '网络安全'
draft: false 
lang: ''
---

## 前言

当您的网站或API服务面临恶意爬虫、API配额被刷等安全威胁时，最有效的防护方式是设置严格的IP白名单，只允许特定IP地址访问。然而，如果您使用的是动态IP地址，这就带来了一个难题：IP地址会不断变化，导致您无法正常访问自己的服务。

本文提供的脚本是一个简单的解决方案，它通过调用Cloudflare API来远程更新防火墙规则，自动将当前IP地址加入白名单。

## 方案概述

这是一个利用Cloudflare API远程管理防火墙的脚本，核心功能包括：

- **检测当前IP**：获取当前公网IP地址
- **远程更新防火墙**：通过API调用更新Cloudflare防火墙规则
- **自动化运行**：可以定时检查IP变化并自动更新
- **简单易用**：提供命令行操作界面

## 脚本特点

### 1. 简单直接
直接调用Cloudflare API更新防火墙规则，无复杂依赖。

### 2. 多源IP检测  
使用多个服务获取当前IP地址，提高可靠性。

### 3. 后台运行
支持作为后台服务运行，定时检查IP变化。

## API配额保护的重要性

许多开发者都遇到过API配额被恶意消耗的问题：
- **第三方API服务**：如Google Maps API、天气API等，被爬虫大量调用导致配额超限
- **云服务资源**：如AWS、阿里云等按调用次数计费的服务
- **个人项目接口**：开发的小程序或网站接口被恶意刷取数据
- **测试环境暴露**：开发环境意外暴露在公网，被自动化工具扫描攻击

通过严格的IP白名单控制，这些问题可以得到根本性解决。

## 安装和配置

### 前置要求

1. **Cloudflare账户**：需要有Cloudflare账户并托管域名
2. **Linux系统**：支持主流Linux发行版
3. **root权限**：某些操作需要管理员权限

### 准备工作

使用此脚本前，您需要准备以下信息（可从Cloudflare控制台获取）：

1. **Zone ID**：您域名的Zone ID
2. **Ruleset ID**：防火墙规则集ID  
3. **Rule ID**：具体规则ID
4. **API Token**：具有防火墙编辑权限的API Token

### 脚本配置

将以下脚本保存为 `cloudflare-firewall.sh`，并根据您的实际情况修改配置信息：

```bash
#!/bin/bash

# =============================================================================
# Cloudflare 防火墙自动更新管理器
# =============================================================================

# 配置信息 - 请替换为您的实际信息
ZONE_ID="your_zone_id_here"                    # 您的Zone ID
RULESET_ID="your_ruleset_id_here"              # 规则集ID  
RULE_ID="your_rule_id_here"                    # 规则ID
CF_AUTH_TOKEN="your_api_token_here"            # API Token
UPDATE_INTERVAL=300                             # 检查间隔（秒）
RULE_DESCRIPTION="仅允许指定 IP 地址"           # 规则描述

# 文件路径
CONFIG_FILE="$HOME/.cloudflare-firewall-config"
LOG_FILE="/tmp/cloudflare-firewall.log"
PID_FILE="/tmp/cloudflare-firewall.pid"
SERVICE_FILE="/tmp/cloudflare-firewall-service.sh"
LAST_IP_FILE="/tmp/cloudflare-last-ip"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# 清屏函数
clear_screen() {
    clear
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${WHITE}Cloudflare 防火墙管理器${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo ""
}

# 日志函数
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case $level in
        "INFO")  echo -e "${CYAN}ℹ️ $message${NC}" ;;
        "SUCCESS") echo -e "${GREEN}✅ $message${NC}" ;;
        "ERROR") echo -e "${RED}❌ $message${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️ $message${NC}" ;;
    esac
}

# 等待按键
wait_for_key() {
    echo ""
    echo -e "${YELLOW}按回车继续...${NC}"
    read
}

# 检查依赖
check_dependencies() {
    for cmd in curl jq; do
        if ! command -v $cmd >/dev/null 2>&1; then
            log "WARNING" "缺少依赖: $cmd，尝试自动安装..."
            
            if command -v apt-get >/dev/null 2>&1; then
                echo "正在安装 $cmd (Ubuntu/Debian)..."
                sudo apt-get update && sudo apt-get install -y $cmd
            elif command -v yum >/dev/null 2>&1; then
                echo "正在安装 $cmd (CentOS/RHEL)..."
                sudo yum install -y $cmd
            elif command -v dnf >/dev/null 2>&1; then
                echo "正在安装 $cmd (Fedora)..."
                sudo dnf install -y $cmd
            elif command -v pacman >/dev/null 2>&1; then
                echo "正在安装 $cmd (Arch Linux)..."
                sudo pacman -S --noconfirm $cmd
            elif command -v zypper >/dev/null 2>&1; then
                echo "正在安装 $cmd (openSUSE)..."
                sudo zypper install -y $cmd
            else
                echo ""
                echo -e "${RED}❌ 无法自动安装 $cmd${NC}"
                echo -e "${YELLOW}请手动安装:${NC}"
                echo "  Ubuntu/Debian: sudo apt-get install $cmd"
                echo "  CentOS/RHEL:   sudo yum install $cmd"
                echo "  Fedora:        sudo dnf install $cmd"
                echo "  Arch Linux:    sudo pacman -S $cmd"
                echo ""
                exit 1
            fi
            
            # 验证安装
            if command -v $cmd >/dev/null 2>&1; then
                log "SUCCESS" "$cmd 安装成功"
            else
                log "ERROR" "$cmd 安装失败"
                exit 1
            fi
        fi
    done
}

# 加载配置
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
        return 0
    else
        return 1
    fi
}

# 保存配置
save_config() {
    cat > "$CONFIG_FILE" << EOF
CF_AUTH_TOKEN="$CF_AUTH_TOKEN"
EOF
    chmod 600 "$CONFIG_FILE"
    log "SUCCESS" "API Token已保存"
}

# 获取当前IP
get_current_ip() {
    local services=("ifconfig.me" "https://checkip.amazonaws.com" "https://ipinfo.io/ip" "https://icanhazip.com")
    
    for service in "${services[@]}"; do
        local ip=$(curl -s --max-time 10 "$service" | tr -d '\n\r')
        if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "$ip"
            return 0
        fi
    done
    return 1
}

# 获取上次IP
get_last_ip() {
    if [ -f "$LAST_IP_FILE" ]; then
        cat "$LAST_IP_FILE"
    fi
}

# 保存IP
save_current_ip() {
    echo "$1" > "$LAST_IP_FILE"
}

# 更新防火墙规则
update_firewall_rule() {
    local new_ip=$1
    
    log "INFO" "更新防火墙规则: $new_ip"
    
    local response=$(curl -s -X PATCH \
        "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets/$RULESET_ID/rules/$RULE_ID" \
        -H "Authorization: Bearer $CF_AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"action\": \"block\",
            \"description\": \"$RULE_DESCRIPTION - IP: $new_ip [$(date '+%Y-%m-%d %H:%M:%S')]\",
            \"enabled\": true,
            \"expression\": \"(ip.src ne $new_ip)\"
        }")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        log "SUCCESS" "规则更新成功 - 允许IP: $new_ip"
        save_current_ip "$new_ip"
        return 0
    else
        log "ERROR" "规则更新失败: $response"
        return 1
    fi
}

# 检查并更新
check_and_update() {
    local current_ip=$(get_current_ip)
    local last_ip=$(get_last_ip)
    
    if [ -z "$current_ip" ]; then
        log "ERROR" "无法获取当前IP"
        return 1
    fi
    
    if [ "$current_ip" != "$last_ip" ]; then
        log "INFO" "IP变化: $last_ip -> $current_ip"
        update_firewall_rule "$current_ip"
    else
        log "INFO" "IP无变化: $current_ip"
    fi
}

# 创建后台服务脚本
create_service_script() {
    cat > "$SERVICE_FILE" << 'EOF'
#!/bin/bash

# 从主脚本继承配置
ZONE_ID="your_zone_id_here"
RULESET_ID="your_ruleset_id_here"
RULE_ID="your_rule_id_here"
CF_AUTH_TOKEN="your_api_token_here"
UPDATE_INTERVAL=300
RULE_DESCRIPTION="仅允许指定 IP 地址"

CONFIG_FILE="$HOME/.cloudflare-firewall-config"
LOG_FILE="/tmp/cloudflare-firewall.log"
LAST_IP_FILE="/tmp/cloudflare-last-ip"

# 加载配置
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# 日志函数
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# 获取当前IP
get_current_ip() {
    local services=("ifconfig.me" "https://checkip.amazonaws.com" "https://ipinfo.io/ip" "https://icanhazip.com")
    for service in "${services[@]}"; do
        local ip=$(curl -s --max-time 10 "$service" | tr -d '\n\r')
        if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "$ip"
            return 0
        fi
    done
    return 1
}

get_last_ip() {
    if [ -f "$LAST_IP_FILE" ]; then
        cat "$LAST_IP_FILE"
    fi
}

save_current_ip() {
    echo "$1" > "$LAST_IP_FILE"
}

# 更新防火墙规则
update_firewall_rule() {
    local new_ip=$1
    log "INFO" "更新防火墙规则: $new_ip"
    
    local response=$(curl -s -X PATCH \
        "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets/$RULESET_ID/rules/$RULE_ID" \
        -H "Authorization: Bearer $CF_AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"action\": \"block\",
            \"description\": \"$RULE_DESCRIPTION - IP: $new_ip [$(date '+%Y-%m-%d %H:%M:%S')]\",
            \"enabled\": true,
            \"expression\": \"(ip.src ne $new_ip)\"
        }")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        log "SUCCESS" "规则更新成功 - IP: $new_ip"
        save_current_ip "$new_ip"
        return 0
    else
        log "ERROR" "规则更新失败: $response"
        return 1
    fi
}

# 检查并更新
check_and_update() {
    local current_ip=$(get_current_ip)
    local last_ip=$(get_last_ip)
    
    if [ -z "$current_ip" ]; then
        log "ERROR" "无法获取当前IP"
        return 1
    fi
    
    if [ "$current_ip" != "$last_ip" ]; then
        log "INFO" "IP变化: $last_ip -> $current_ip"
        update_firewall_rule "$current_ip"
    else
        log "INFO" "IP无变化: $current_ip"
    fi
}

# 主循环
log "INFO" "防火墙自动更新服务启动"
while true; do
    check_and_update
    sleep "$UPDATE_INTERVAL"
done
EOF
    
    # 替换配置
    sed -i "s/your_zone_id_here/$ZONE_ID/g" "$SERVICE_FILE"
    sed -i "s/your_ruleset_id_here/$RULESET_ID/g" "$SERVICE_FILE"
    sed -i "s/your_rule_id_here/$RULE_ID/g" "$SERVICE_FILE"
    sed -i "s/your_api_token_here/$CF_AUTH_TOKEN/g" "$SERVICE_FILE"
    
    chmod +x "$SERVICE_FILE"
}

# 启动服务
start_service() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        log "WARNING" "服务已在运行"
        return 1
    fi
    
    create_service_script
    nohup "$SERVICE_FILE" > /dev/null 2>&1 &
    echo $! > "$PID_FILE"
    
    sleep 2
    if kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        log "SUCCESS" "服务启动成功 (PID: $(cat "$PID_FILE"))"
        return 0
    else
        log "ERROR" "服务启动失败"
        return 1
    fi
}

# 停止服务
stop_service() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            rm -f "$PID_FILE"
            log "SUCCESS" "服务已停止"
            return 0
        else
            rm -f "$PID_FILE"
            log "WARNING" "服务未运行"
            return 1
        fi
    else
        log "WARNING" "服务未运行"
        return 1
    fi
}

# 获取服务状态
get_service_status() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo -e "${GREEN}运行中 (PID: $(cat "$PID_FILE"))${NC}"
        return 0
    else
        echo -e "${RED}已停止${NC}"
        return 1
    fi
}

# 设置API Token
setup_token() {
    clear_screen
    echo -e "${CYAN}API Token 设置${NC}"
    echo "==============================="
    echo ""
    echo -e "${YELLOW}如何获取 Cloudflare API Token:${NC}"
    echo "1. 访问: https://dash.cloudflare.com/profile/api-tokens"
    echo "2. 点击 'Create Token'"
    echo "3. 选择 'Edit zone DNS' 模板"
    echo "4. 或者使用自定义权限:"
    echo "   - Zone:Zone:Read"
    echo "   - Zone:DNS:Edit"
    echo "   - Zone:Zone Settings:Edit"
    echo "5. 复制生成的Token"
    echo ""
    
    while true; do
        echo -n -e "${YELLOW}请输入 Cloudflare API Token: ${NC}"
        read -s input_token
        echo ""
        if [ -n "$input_token" ]; then
            CF_AUTH_TOKEN="$input_token"
            break
        else
            echo -e "${RED}Token 不能为空！${NC}"
        fi
    done
    
    echo ""
    echo -e "${CYAN}测试连接...${NC}"
    
    local test_response=$(curl -s -X GET \
        "https://api.cloudflare.com/client/v4/zones/$ZONE_ID" \
        -H "Authorization: Bearer $CF_AUTH_TOKEN" \
        -H "Content-Type: application/json")
    
    if echo "$test_response" | jq -e '.success' > /dev/null 2>&1; then
        log "SUCCESS" "API连接成功"
        save_config
        echo ""
        echo -e "${GREEN}✅ 设置完成！${NC}"
    else
        log "ERROR" "API连接失败"
        echo -e "${RED}❌ Token无效，请重新设置${NC}"
        wait_for_key
        return 1
    fi
    
    wait_for_key
}

# 查看日志
view_logs() {
    clear_screen
    echo -e "${CYAN}日志查看${NC}"
    echo "======================"
    echo ""
    
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}暂无日志${NC}"
        wait_for_key
        return
    fi
    
    echo "1) 最近50行"
    echo "2) 全部日志"
    echo "3) 实时监控"
    echo "4) 清空日志"
    echo "5) 返回"
    echo ""
    echo -n -e "${YELLOW}选择: ${NC}"
    read choice
    
    case $choice in
        1)
            clear_screen
            tail -50 "$LOG_FILE"
            wait_for_key
            ;;
        2)
            clear_screen
            cat "$LOG_FILE"
            wait_for_key
            ;;
        3)
            clear_screen
            echo "实时监控 (Ctrl+C退出)"
            tail -f "$LOG_FILE"
            ;;
        4)
            echo -n "确认清空? [y/N]: "
            read confirm
            if [[ $confirm =~ ^[Yy]$ ]]; then
                > "$LOG_FILE"
                log "INFO" "日志已清空"
            fi
            ;;
        5) return ;;
    esac
    
    view_logs
}

# 服务管理
service_management() {
    clear_screen
    echo -e "${CYAN}服务管理${NC}"
    echo "===================="
    echo ""
    
    echo -n "状态: "
    get_service_status
    echo ""
    
    echo "1) 启动服务"
    echo "2) 停止服务"
    echo "3) 重启服务"
    echo "4) 立即更新"
    echo "5) 查看当前IP"
    echo "6) 返回"
    echo ""
    echo -n -e "${YELLOW}选择: ${NC}"
    read choice
    
    case $choice in
        1)
            echo ""
            start_service
            wait_for_key
            ;;
        2)
            echo ""
            stop_service
            wait_for_key
            ;;
        3)
            echo ""
            stop_service
            sleep 1
            start_service
            wait_for_key
            ;;
        4)
            echo ""
            if load_config || [ -n "$CF_AUTH_TOKEN" ]; then
                check_and_update
            else
                log "ERROR" "请先设置API Token"
            fi
            wait_for_key
            ;;
        5)
            echo ""
            local current_ip=$(get_current_ip)
            local last_ip=$(get_last_ip)
            echo -e "当前IP: ${WHITE}$current_ip${NC}"
            echo -e "记录IP: ${WHITE}$last_ip${NC}"
            wait_for_key
            ;;
        6) return ;;
    esac
    
    service_management
}

# 卸载
uninstall() {
    clear_screen
    echo -e "${RED}卸载程序${NC}"
    echo "=================="
    echo ""
    
    echo -e "${YELLOW}将删除:${NC}"
    echo "• $CONFIG_FILE"
    echo "• $LOG_FILE"
    echo "• $PID_FILE"
    echo "• $SERVICE_FILE"
    echo "• $LAST_IP_FILE"
    echo ""
    echo -n -e "${RED}确认卸载? [y/N]: ${NC}"
    read confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        echo ""
        stop_service
        
        local files=("$CONFIG_FILE" "$LOG_FILE" "$PID_FILE" "$SERVICE_FILE" "$LAST_IP_FILE")
        for file in "${files[@]}"; do
            if [ -f "$file" ]; then
                rm -f "$file"
                echo -e "${GREEN}已删除: $file${NC}"
            fi
        done
        
        echo ""
        echo -e "${GREEN}卸载完成${NC}"
        exit 0
    else
        echo -e "${CYAN}取消卸载${NC}"
        wait_for_key
    fi
}

# 主菜单
show_main_menu() {
    clear_screen
    
    echo -n "• Token: "
    if load_config || [ -n "$CF_AUTH_TOKEN" ]; then
        echo -e "${GREEN}已设置${NC}"
    else
        echo -e "${RED}未设置${NC}"
    fi
    
    echo -n "• 服务: "
    get_service_status > /dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}运行中${NC}"
    else
        echo -e "${RED}已停止${NC}"
    fi
    
    echo -n "• 当前IP: "
    local current_ip=$(get_current_ip)
    if [ -n "$current_ip" ]; then
        echo -e "${CYAN}$current_ip${NC}"
    else
        echo -e "${RED}获取失败${NC}"
    fi
    
    echo ""
    echo "1) 设置API Token"
    echo "2) 服务管理"
    echo "3) 查看日志"
    echo "4) 卸载"
    echo "5) 退出"
    echo ""
    echo -n -e "${YELLOW}选择: ${NC}"
    read choice
    
    case $choice in
        1) setup_token ;;
        2) service_management ;;
        3) view_logs ;;
        4) uninstall ;;
        5) exit 0 ;;
        *) 
            echo -e "${RED}无效选择${NC}"
            wait_for_key
            ;;
    esac
}

# 主函数
main() {
    check_dependencies
    touch "$LOG_FILE"
    log "INFO" "程序启动"
    
    while true; do
        show_main_menu
    done
}

# 执行主函数
main "$@"
```

## 使用方法

### 1. 基本使用

```bash
# 下载脚本
wget https://raw.githubusercontent.com/niehaoran/docker-cloudflare/main/ddns/cloudflare-firewall-manager.sh

# 设置执行权限
chmod +x cloudflare-firewall-manager.sh

# 运行脚本
./cloudflare-firewall-manager.sh
```

### 2. 配置步骤

1. **运行脚本**：首次运行会显示主菜单
2. **设置API Token**：选择选项1设置您的Cloudflare API Token
3. **启动服务**：选择选项2进入服务管理，然后启动自动更新服务
4. **监控日志**：选择选项3查看运行日志

### 3. 服务管理

脚本提供完整的服务管理功能：

- **启动服务**：后台运行，定期检查IP变化
- **停止服务**：停止后台服务
- **重启服务**：重新启动服务
- **立即更新**：手动触发一次IP检查和更新
- **查看状态**：显示当前服务状态和IP信息

## 工作原理

### 1. 获取当前IP
脚本通过调用外部IP检测服务获取当前公网IP地址。

### 2. 调用API更新防火墙
当IP发生变化时，脚本通过Cloudflare API更新防火墙规则：
- 设置规则表达式为 `(ip.src ne NEW_IP)`，只允许当前IP访问
- 更新规则描述和时间戳
- 保存新IP到本地，避免重复更新

### 3. 简单的错误处理
- API调用失败时记录错误并重试
- 使用多个IP检测服务提高可靠性

## 配置说明

### 主要参数

```bash
ZONE_ID="your_zone_id_here"          # Cloudflare Zone ID
RULESET_ID="your_ruleset_id_here"    # 防火墙规则集ID
RULE_ID="your_rule_id_here"          # 具体规则ID
CF_AUTH_TOKEN="your_api_token_here"  # API认证Token
UPDATE_INTERVAL=300                   # 检查间隔（秒）
```

### 文件路径

- **配置文件**：`$HOME/.cloudflare-firewall-config`
- **日志文件**：`/tmp/cloudflare-firewall.log`
- **PID文件**：`/tmp/cloudflare-firewall.pid`
- **服务脚本**：`/tmp/cloudflare-firewall-service.sh`
- **IP记录**：`/tmp/cloudflare-last-ip`

## 安全注意事项

### 1. API Token安全

- API Token具有修改防火墙规则的权限，请妥善保管
- 建议使用最小权限原则，只授予必要的权限
- 定期轮换API Token

### 2. 防火墙规则

- 脚本会创建严格的IP白名单规则，**只允许当前IP访问**
- 建议在测试环境中先验证脚本功能，确保不会影响正常业务
- **务必保留备用访问方式**，如Cloudflare控制台访问权限，避免被完全锁定
- 对于重要的生产环境，建议先在子域名或测试接口上验证效果

### 3. API配额管理

- 定期监控API使用情况，确认保护效果
- 关注API服务商的配额重置周期
- 建议设置配额使用告警，及时发现异常消耗
- 考虑为关键API设置多重保护机制

### 4. 网络依赖

- 脚本依赖外部IP检测服务，如果所有服务都不可用，更新将失败
- 建议定期检查日志，确保服务正常运行

## 故障排除

### 常见问题

1. **无法获取IP地址**
   - 检查网络连接
   - 确认IP检测服务可访问
   - 查看日志文件获取详细错误信息

2. **API调用失败**
   - 验证API Token是否有效
   - 检查Zone ID、Ruleset ID、Rule ID是否正确
   - 确认API Token权限设置

3. **服务无法启动**
   - 检查依赖是否安装（curl、jq）
   - 确认脚本执行权限
   - 查看系统日志

### 日志分析

脚本提供详细的日志记录：

```bash
# 查看最近日志
tail -50 /tmp/cloudflare-firewall.log

# 实时监控
tail -f /tmp/cloudflare-firewall.log

# 查找错误
grep ERROR /tmp/cloudflare-firewall.log
```

## 高级配置

### 1. 自定义检查间隔

```bash
# 修改UPDATE_INTERVAL变量
UPDATE_INTERVAL=600  # 10分钟检查一次
```

### 2. 添加更多IP检测服务

在 `get_current_ip()` 函数中添加更多服务：

```bash
local services=(
    "ifconfig.me" 
    "https://checkip.amazonaws.com" 
    "https://ipinfo.io/ip" 
    "https://icanhazip.com"
    "https://your-custom-service.com/ip"
)
```

### 3. 系统服务集成

可以将脚本集成到systemd服务中：

```bash
# 创建服务文件
sudo tee /etc/systemd/system/cloudflare-firewall.service << EOF
[Unit]
Description=Cloudflare Firewall Auto Update
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/path/to/your/cloudflare-firewall.sh
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动服务
sudo systemctl enable cloudflare-firewall
sudo systemctl start cloudflare-firewall
```

## 总结

这个脚本是一个简单实用的工具，通过调用Cloudflare API来远程管理防火墙规则。它解决了动态IP用户无法使用固定IP白名单的问题，让您能够：

- **自动更新白名单**：IP变化时自动更新防火墙规则
- **远程管理**：无需登录Cloudflare控制台，通过API直接操作
- **定时运行**：可以作为后台服务持续监控IP变化

## 适用场景

适合需要IP白名单保护但使用动态IP的用户：

- 家庭宽带用户保护个人网站或API服务
- 开发者保护测试环境免受外部访问
- 小型项目需要简单的访问控制

这个脚本本质上就是利用Cloudflare的API接口远程更新防火墙规则，让动态IP用户也能享受白名单保护的便利。
