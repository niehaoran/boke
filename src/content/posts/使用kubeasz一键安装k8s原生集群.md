---
title: 使用kubeasz一键安装k8s原生集群
published: 2025-08-27
description: '详细介绍如何使用kubeasz工具部署高可用的Kubernetes原生集群'
image: '/src/assets/images/k8s.png'
tags: [kubernetes, k8s, kubeasz, 集群部署]
category: 'k8s'
draft: false
lang: ''
pinned: true
---

## 注意事项

在开始安装之前，请仔细阅读以下重要注意事项：

> **注意1：** 确保各节点时区设置一致、时间同步。如果你的环境没有提供NTP时间同步，推荐集成安装chrony

> **注意2：** 确保在干净的系统上开始安装，不要使用曾经装过kubeadm或其他k8s发行版的环境

> **注意3：** 建议操作系统升级到新的稳定内核，请结合阅读内核升级文档

> **注意4：** 在公有云上创建多主集群，请结合阅读在公有云上部署kubeasz

## 集群节点规划

### 高可用集群所需节点配置

| 角色 | 数量 | 描述 |
|------|------|------|
| 部署节点 | 1 | 运行ansible/ezctl命令，一般复用第一个master节点 |
| etcd节点 | 3 | 注意etcd集群需要1,3,5,...奇数个节点，一般复用master节点 |
| master节点 | 2 | 高可用集群至少2个master节点 |
| node节点 | n | 运行应用负载的节点，可根据需要提升机器配置/增加节点数 |

### 机器配置要求

- **master节点：** 4c/8g内存/50g硬盘
- **worker节点：** 建议8c/32g内存/200g硬盘以上

> **注意：** 默认配置下容器运行时和kubelet会占用`/var`的磁盘空间，如果磁盘分区特殊，可以设置`config.yml`中的容器运行时和kubelet数据目录：`CONTAINERD_STORAGE_DIR`、`DOCKER_STORAGE_DIR`、`KUBELET_ROOT_DIR`

### 部署方式

在kubeasz 2.x版本，多节点高可用集群安装可以使用2种方式：

1. 按照本文步骤先规划准备，预先配置节点信息后，直接安装多节点高可用集群
2. 先部署单节点集群AllinOne部署，然后通过节点添加扩容成高可用集群

## 部署步骤

以下示例创建一个4节点的多主高可用集群，文档中命令默认都需要root权限运行。

### 1. 基础系统配置

- 2c/4g内存/40g硬盘（该配置仅测试用）
- 最小化安装Ubuntu 16.04 server或者CentOS 7 Minimal
- 配置基础网络、更新源、SSH登录等

### 2. 在每个节点安装依赖工具

推荐使用ansible in docker容器化方式运行，无需安装额外依赖。

### 3. 准备ssh免密登录

配置从部署节点**Master**能够ssh免密登录所有节点，并且设置python软连接：

```bash
# $IP为所有节点地址包括自身，按照提示输入yes和root密码
ssh-copy-id $IP
```

<details>
<summary><strong>对于密钥登录的服务器设置</strong></summary>

如果目标服务器已经配置了密钥登录，可以使用以下方式：

```bash
# 方式1：指定私钥文件
ssh-copy-id -i ~/.ssh/id_rsa.pub -o "IdentityFile=~/.ssh/your_private_key" root@$IP

# 方式2：手动复制公钥内容到目标服务器
cat ~/.ssh/id_rsa.pub | ssh -i ~/.ssh/your_private_key root@$IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# 方式3：使用scp复制公钥文件
scp -i ~/.ssh/your_private_key ~/.ssh/id_rsa.pub root@$IP:/tmp/
ssh -i ~/.ssh/your_private_key root@$IP "cat /tmp/id_rsa.pub >> ~/.ssh/authorized_keys && rm /tmp/id_rsa.pub"
```

</details>

### 4. 在部署节点编排k8s安装

#### 4.1 下载项目源码、二进制及离线镜像

下载工具脚本ezdown，举例使用kubeasz版本3.5.0：

**版本对应关系：**
| Kubernetes | kubeasz |
|------------|---------|
| 1.23 | 3.2.0 |
| 1.24-1.28 | 3.6.2 |
| 1.29 | 3.6.3 |
| 1.30 | 3.6.4 |
| 1.31 | 3.6.5 |
| 1.32 | 3.6.6 |
| 1.33 | 3.6.7 |

```bash
export release=3.6.7
wget https://github.com/easzlab/kubeasz/releases/download/${release}/ezdown
chmod +x ./ezdown
```

下载kubeasz代码、二进制、默认容器镜像（更多关于ezdown的参数，运行`./ezdown`查看）：

```bash
# 国内环境
./ezdown -D
```

```bash
# 海外环境
# ./ezdown -D -m standard
```

<details>
<summary><strong>【可选】下载额外容器镜像</strong></summary>

下载额外容器镜像（cilium, flannel, prometheus等）：

```bash
# 按需下载
./ezdown -X flannel
./ezdown -X prometheus
```

</details>

<details>
<summary><strong>【可选】下载离线系统包</strong></summary>

适用于无法使用yum/apt仓库情形：

```bash
./ezdown -P
```

</details>

上述脚本运行成功后，所有文件（kubeasz代码、二进制、离线镜像）均已整理好放入目录`/etc/kubeasz`

<details>
<summary><strong>ezctl 命令参数说明</strong></summary>

**使用帮助：**

随时运行 `ezctl` 获取命令行提示信息：

```bash
Usage: ezctl COMMAND [args]
-------------------------------------------------------------------------------------
Cluster setups:
    list                             显示当前所有管理的集群
    checkout    <cluster>            切换默认集群
    new         <cluster>            创建新集群配置
    setup       <cluster>  <step>    安装新集群
    start       <cluster>            启动临时停止的集群
    stop        <cluster>            临时停止某个集群（包括集群内运行的pod）
    upgrade     <cluster>            升级集群k8s组件版本
    destroy     <cluster>            删除集群
    backup      <cluster>            备份集群（仅etcd数据，不包括pv数据和业务应用数据）
    restore     <cluster>            从备份中恢复集群
    start-aio                        创建单机集群（类似 minikube）

Cluster ops:
    add-etcd    <cluster>  <ip>      增加 etcd 节点
    add-master  <cluster>  <ip>      增加主节点
    add-node    <cluster>  <ip>      增加工作节点
    del-etcd    <cluster>  <ip>      删除 etcd 节点
    del-master  <cluster>  <ip>      删除主节点
    del-node    <cluster>  <ip>      删除工作节点

Extra operation:
    kcfg-adm    <cluster>  <args>    管理客户端kubeconfig
```

</details>

#### 4.2 创建集群配置实例

```bash
# 容器化运行kubeasz
./ezdown -S

# 创建新集群 k8s-01
docker exec -it kubeasz ezctl new k8s-01
```

输出示例：
```
2021-01-19 10:48:23 DEBUG generate custom cluster files in /etc/kubeasz/clusters/k8s-01
2021-01-19 10:48:23 DEBUG set version of common plugins
2021-01-19 10:48:23 DEBUG cluster k8s-01: files successfully created.
2021-01-19 10:48:23 INFO next steps 1: to config '/etc/kubeasz/clusters/k8s-01/hosts'
2021-01-19 10:48:23 INFO next steps 2: to config '/etc/kubeasz/clusters/k8s-01/config.yml'
```

然后根据提示配置：
- `/etc/kubeasz/clusters/k8s-01/hosts`：根据前面节点规划修改hosts文件
- `/etc/kubeasz/clusters/k8s-01/config.yml`：修改其他集群层面的主要配置选项

<details>
<summary><strong>hosts 文件配置示例</strong></summary>

根据您的实际节点规划，修改 `/etc/kubeasz/clusters/k8s-01/hosts` 文件。一般只需要修改以下三个部分：

**1. etcd 节点配置**
```ini
# 'etcd' cluster should have odd member(s) (1,3,5,...)
[etcd]
10.0.1.10
```

**2. master 节点配置**
```ini
# master node(s), set unique 'k8s_nodename' for each node
# CAUTION: 'k8s_nodename' must consist of lower case alphanumeric characters, '-' or '.',
# and must start and end with an alphanumeric character
[kube_master]
10.0.1.10 k8s_nodename='master-01'
```

**3. worker 节点配置**
```ini
# work node(s), set unique 'k8s_nodename' for each node
# CAUTION: 'k8s_nodename' must consist of lower case alphanumeric characters, '-' or '.',
# and must start and end with an alphanumeric character
[kube_node]
10.0.1.11 k8s_nodename='node-01'
10.0.1.12 k8s_nodename='node-02'
10.0.1.13 k8s_nodename='node-03'
```

**完整配置文件示例：**
```ini
# 'etcd' cluster should have odd member(s) (1,3,5,...)
[etcd]
10.0.1.10

# master node(s), set unique 'k8s_nodename' for each node
[kube_master]
10.0.1.10 k8s_nodename='master-01'

# work node(s), set unique 'k8s_nodename' for each node
[kube_node]
10.0.1.11 k8s_nodename='node-01'
10.0.1.12 k8s_nodename='node-02'
10.0.1.13 k8s_nodename='node-03'

# [optional] harbor server, a private docker registry
[harbor]
#10.0.1.20 NEW_INSTALL=false

# [optional] loadbalance for accessing k8s from outside
[ex_lb]
#10.0.1.30 LB_ROLE=backup EX_APISERVER_VIP=10.0.1.100 EX_APISERVER_PORT=8443
#10.0.1.31 LB_ROLE=master EX_APISERVER_VIP=10.0.1.100 EX_APISERVER_PORT=8443

# [optional] ntp server for the cluster
[chrony]
#10.0.1.1

[all:vars]
# --------- Main Variables ---------------
# Secure port for apiservers
SECURE_PORT="6443"

# Cluster container-runtime supported: docker, containerd
CONTAINER_RUNTIME="containerd"

# Network plugins supported: calico, flannel, kube-router, cilium, kube-ovn
CLUSTER_NETWORK="calico"

# Service proxy mode of kube-proxy: 'iptables' or 'ipvs'
PROXY_MODE="ipvs"

# K8S Service CIDR, not overlap with node(host) networking
SERVICE_CIDR="10.68.0.0/16"

# Cluster CIDR (Pod CIDR), not overlap with node(host) networking
CLUSTER_CIDR="172.20.0.0/16"

# NodePort Range
NODE_PORT_RANGE="30000-32767"

# Cluster DNS Domain
CLUSTER_DNS_DOMAIN="cluster.local"
```

**配置说明：**
- **etcd节点**：生产环境建议配置奇数个节点（1,3,5个），示例中复用了master节点
- **master节点**：高可用集群至少需要2个master节点
- **worker节点**：根据实际需要配置工作节点数量
- **k8s_nodename**：必须由小写字母、数字、'-' 或 '.' 组成，且必须以字母或数字开头和结尾
- **可选配置**：harbor、负载均衡器、NTP服务器等可根据需要启用

**修改步骤：**
1. 将示例中的IP地址替换为您的实际节点IP
2. 根据您的节点规划调整etcd、master、worker节点配置
3. 确保每个节点的`k8s_nodename`唯一且符合命名规范
4. 根据网络环境调整CIDR配置，确保不与现有网络冲突

</details>

#### 4.3 开始安装

如果你对集群安装流程不熟悉，请阅读项目首页安装步骤讲解后分步安装，并对每步都进行验证。

```bash
# 建议使用alias命令，查看~/.bashrc文件应该包含：alias dk='docker exec -it kubeasz'
source ~/.bashrc

# 一键安装，等价于执行docker exec -it kubeasz ezctl setup k8s-01 all
dk ezctl setup k8s-01 all

# 或者分步安装，具体使用 dk ezctl help setup 查看分步安装帮助信息
# dk ezctl setup k8s-01 01
# dk ezctl setup k8s-01 02
# dk ezctl setup k8s-01 03
# dk ezctl setup k8s-01 04
```

## 验证安装

### 安装kubectl客户端工具

如果kubeasz安装后没有安装kubectl，请先安装kubectl客户端工具：

<details>
<summary><strong>kubectl 二进制安装方法</strong></summary>

**下载指定版本**
```bash
# 替换为您需要的版本
export K8S_VERSION="v1.31.0"

# 下载指定版本
curl -LO "https://dl.k8s.io/release/${K8S_VERSION}/bin/linux/amd64/kubectl"

# 添加执行权限
chmod +x kubectl

# 移动到系统路径
sudo mv kubectl /usr/local/bin/

# 验证安装
kubectl version --client
```

**配置kubectl**
```bash
# 复制kubeconfig文件
mkdir -p ~/.kube
sudo cp /etc/kubeasz/clusters/k8s-01/kubectl.kubeconfig ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config

# 或者设置环境变量
export KUBECONFIG=/etc/kubeasz/clusters/k8s-01/kubectl.kubeconfig
```

</details>

### 验证集群状态

安装完成后，可以通过以下命令验证集群状态：

```bash
# 查看节点状态
kubectl get nodes

# 查看集群信息
kubectl cluster-info

# 查看所有pod状态
kubectl get pods --all-namespaces

# 查看集群版本信息
kubectl version

# 查看集群组件状态
kubectl get componentstatuses
```

---

通过以上步骤，你就可以成功部署一个高可用的Kubernetes原生集群了。记住在生产环境中使用时，要根据实际需求调整机器配置和网络规划。 

## 参考项目

本文介绍的安装方法基于 [kubeasz](https://github.com/easzlab/kubeasz) 项目，这是一个优秀的开源项目，致力于提供快速部署高可用k8s集群的工具。该项目具有以下特点：

- **集群特性**：Master高可用、离线安装、多架构支持(amd64/arm64)
- **集群版本**：支持kubernetes v1.24 到 v1.33
- **运行时**：containerd v1.7.x, v2.0.x
- **网络插件**：calico, cilium, flannel, kube-ovn, kube-router

更多详细信息和最新版本请访问：[https://github.com/easzlab/kubeasz](https://github.com/easzlab/kubeasz) 