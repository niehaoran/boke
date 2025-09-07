---
title: 使用frp实现流量转发
published: 2025-09-07
description: '详细介绍如何使用frp搭建服务端和客户端，实现内网穿透和流量转发功能'
image: ''
tags: [frp, 内网穿透, 流量转发, 网络工具]
category: '网络工具'
draft: false 
lang: ''
---

## 什么是frp

frp是一个专注于内网穿透的高性能的反向代理应用，支持TCP、UDP、HTTP、HTTPS等多种协议。可以将内网的服务通过具有公网IP的服务器暴露到互联网上，同时提供web界面管理内网连接状态。

## 环境准备

- **服务端**：具有公网IP的服务器（用于运行frps）
- **客户端**：内网设备（用于运行frpc）
- **系统要求**：Linux 64位系统

## 安装frp

### 下载和安装

在服务端和客户端都需要执行以下安装步骤：

```bash
# 下载frp压缩包
curl -L -O https://github.com/fatedier/frp/releases/download/v0.58.1/frp_0.58.1_linux_amd64.tar.gz

# 解压缩
tar -zxvf frp_0.58.1_linux_amd64.tar.gz

# 移动到系统目录
sudo mv frp_0.58.1_linux_amd64 /usr/local/frp
```

> **注意：** 确保下载的版本号一致，本教程使用的是v0.58.1版本。

## 配置服务端(frps)

### 创建服务端配置文件

在具有公网IP的服务器上配置frps：

```bash
# 创建服务端配置文件
cat > /usr/local/frp/frps.ini << EOF
[common]
bind_port = 7000
dashboard_port = 7500
dashboard_user = admin
dashboard_pwd = admin
EOF
```

#### 配置说明

- `bind_port`: frp服务监听端口，默认7000，客户端需要连接此端口
- `dashboard_port`: Web管理界面端口，默认7500
- `dashboard_user`: Web管理界面用户名，默认admin
- `dashboard_pwd`: Web管理界面密码，默认admin

### 创建systemd服务

```bash
# 创建frps服务文件
cat > /etc/systemd/system/frps.service << EOF
[Unit]
Description=frps daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/frp/frps -c /usr/local/frp/frps.ini
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动服务
systemctl enable frps && systemctl start frps
```

### 验证服务状态

```bash
# 检查服务状态
systemctl status frps

# 检查端口监听
netstat -tulnp | grep :7000
netstat -tulnp | grep :7500
```

访问 `http://你的服务器IP:7500` 查看Web管理界面。

## 配置客户端(frpc)

### 创建客户端配置文件

在需要进行内网穿透的设备上配置frpc：

```bash
# 创建客户端配置文件
cat > /usr/local/frp/frpc.ini << EOF
[common]
server_addr = 你的服务器IP
server_port = 7000

[ssh]
type = tcp
local_ip = 127.0.0.1
local_port = 22
remote_port = 6000

[web]
type = tcp
local_ip = 127.0.0.1
local_port = 80
remote_port = 8080
EOF
```

#### 配置说明

- `server_addr`: frps服务端的公网IP地址
- `server_port`: frps服务端监听端口，默认7000
- `[ssh]`、`[web]`: 服务配置段，可以配置多个服务
- `type`: 协议类型，支持tcp、udp、http、https等
- `local_ip`: 内网目标设备IP，127.0.0.1代表本机
- `local_port`: 内网目标端口
- `remote_port`: 服务端映射的外网端口

> **重要：** 请根据实际情况修改server_addr。上述示例中，SSH服务将通过服务器的6000端口访问，Web服务通过8080端口访问。

### 创建systemd服务

```bash
# 创建frpc服务文件
cat > /etc/systemd/system/frpc.service << EOF
[Unit]
Description=frpc daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/frp/frpc -c /usr/local/frp/frpc.ini
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动服务
systemctl enable frpc && systemctl start frpc
```

## 服务管理

### 常用管理命令

```bash
# 启动服务
systemctl start frps   # 服务端
systemctl start frpc   # 客户端

# 停止服务
systemctl stop frps    # 服务端
systemctl stop frpc    # 客户端

# 重启服务
systemctl restart frps # 服务端
systemctl restart frpc # 客户端

# 查看服务状态
systemctl status frps  # 服务端
systemctl status frpc  # 客户端

# 查看服务日志
journalctl -u frps -f  # 服务端
journalctl -u frpc -f  # 客户端
```


## 测试连接

### 验证连接状态

1. **检查客户端连接**：在frps的Web管理界面（http://服务器IP:7500）查看客户端连接状态

2. **测试端口转发**：从外网访问 `服务器IP:映射端口` 验证是否能正常访问内网服务
   - SSH访问：`ssh -p 6000 用户名@服务器IP`
   - Web访问：`http://服务器IP:8080`

3. **查看日志**：通过日志排查连接问题
   ```bash
   journalctl -u frpc -f
   ```

## 注意事项

> **安全提醒：** 
> 1. 及时修改默认的dashboard用户名和密码
> 2. 使用强密码的token进行身份验证
> 3. 定期更新frp版本以获得安全补丁

> **网络要求：**
> 1. 服务端必须具有公网IP
> 2. 服务端防火墙需要开放相应端口
> 3. 客户端需要能够访问服务端的bind_port

> **性能考虑：**
> 1. 大量端口映射可能影响性能
> 2. 建议根据实际需求合理配置端口范围
> 3. 监控服务器资源使用情况

## 故障排除

### 常见问题

1. **客户端无法连接服务端**
   - 检查服务端防火墙设置
   - 验证server_addr和server_port配置
   - 确认token一致性

2. **端口映射不生效**
   - 检查端口范围配置
   - 验证目标服务是否正常运行
   - 查看frp日志文件

3. **服务异常重启**
   - 检查配置文件语法
   - 查看系统日志
   - 验证权限设置

通过以上配置，你就可以成功使用frp实现内网穿透和流量转发功能了。
