---
title: 设置SSH使用密钥登录
published: 2025-09-07
description: '详细介绍如何配置SSH密钥登录，提高服务器安全性，包括密钥生成、配置和安全设置的完整指南'
image: ''
tags: [SSH, 密钥登录, Linux]
category: '服务器配置'
draft: false 
lang: ''
---

## 什么是SSH密钥登录

SSH密钥登录是一种更安全的服务器登录方式，使用密钥文件代替密码登录，避免密码被破解的风险。

## 为什么要使用密钥登录

- **更安全**：不用担心密码被暴力破解
- **更方便**：配置后无需输入密码即可登录
- **适合脚本**：自动化部署时不需要交互输入密码

## 第一步：生成密钥对

在客户端（你的电脑）上生成密钥：

```bash
# 生成密钥对（推荐使用ED25519）
ssh-keygen -t ed25519 -C "your_email@example.com"
```

执行后按提示操作：
- 密钥保存位置：直接回车使用默认位置
- 密钥密码：可以设置密码，也可以直接回车跳过

## 第二步：复制公钥到服务器

### 方法一：自动复制（推荐）

```bash
# 将公钥复制到服务器
ssh-copy-id username@server_ip
```

### 方法二：手动复制

1. 查看并复制公钥内容：
```bash
cat ~/.ssh/id_ed25519.pub
```

2. 登录服务器：
```bash
ssh username@server_ip
```

3. 在服务器上创建目录和文件：
```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

4. 将公钥内容添加到文件中：
```bash
# 将公钥内容追加到authorized_keys文件（替换YOUR_PUBLIC_KEY为实际的公钥内容）
echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys
```

## 第三步：测试密钥登录

```bash
# 测试登录
ssh username@server_ip
```

如果能够免密码登录，说明配置成功！

## 第四步：禁用密码登录（可选）

为了提高安全性，可以禁用密码登录：

```bash
# 禁用密码登录
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# 启用密钥登录
sudo sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo sed -i 's/PubkeyAuthentication no/PubkeyAuthentication yes/' /etc/ssh/sshd_config
```

重启SSH服务：
```bash
sudo systemctl restart sshd
```

## 简单的客户端配置

创建SSH配置文件方便管理：

```bash
# 一键创建SSH配置文件
cat << EOF >> ~/.ssh/config
Host myserver
    HostName 192.168.1.100
    User username
    IdentityFile ~/.ssh/id_ed25519
EOF

# 设置配置文件权限
chmod 600 ~/.ssh/config
```

配置后可以直接使用：
```bash
ssh myserver
```
