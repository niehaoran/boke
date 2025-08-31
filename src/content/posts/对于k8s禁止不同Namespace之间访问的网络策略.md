---
title: 对于k8s禁止不同Namespace之间访问的网络策略
published: 2025-08-28
description: ''
image: ''
tags: ["网络策略/NetworkPolicy"]
category: 'k8s'
draft: false 
lang: ''
---

## 网络策略如下
我使用的网络插件是 **Calico**，以下是基于 Calico 的网络策略示例，实现不同 Namespace 之间的访问隔离：

```yaml
# API 版本，指定使用的 Kubernetes 网络策略 API
apiVersion: networking.k8s.io/v1
# 资源类型，这里是 NetworkPolicy
kind: NetworkPolicy
metadata:
  # 策略名称
  name: namespace-isolation
  # 策略所属的命名空间
  namespace: namespace-name
spec:
  # 选择器，{} 表示作用于该命名空间下所有 Pod
  podSelector: {}
  # 策略类型，Ingress 表示入站流量，Egress 表示出站流量
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # 允许同命名空间下的 Pod 访问
    - from:
        - podSelector: {}
    # 允许集群内部分必要组件访问
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: cattle-monitoring-system
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: pod-files-api
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: web-ssh
    # 允许所有 TCP 和 UDP 协议端口流量（用于 NodePort/LoadBalancer 类型 Service）
    - ports:
        - protocol: TCP
        - protocol: UDP
  egress:
    # 允许访问同命名空间下的 Pod
    - to:
        - podSelector: {}
    # 允许访问 DNS 服务（53 端口，TCP/UDP）
    - ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
    # 允许访问除内网和保留地址外的公网 IP
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8        # 私有网段
              - 172.16.0.0/12     # 私有网段
              - 192.168.0.0/16    # 私有网段
              - 169.254.0.0/16    # 链路本地地址
              - 224.0.0.0/4       # 组播地址
              - 240.0.0.0/4       # 保留地址
              - 127.0.0.0/8       # 本地回环地址
```
## 思路说明

1. **屏蔽内网网段**  
  首先通过 `ipBlock` 的 `except` 字段屏蔽了常见的内网和保留地址段，提升集群安全性，防止 Pod 直接访问内网资源：
  ```yaml
  - to:
     - ipBlock:
        cidr: 0.0.0.0/0
        except:
         - 10.0.0.0/8        # 私有网段
         - 172.16.0.0/12     # 私有网段
         - 192.168.0.0/16    # 私有网段
         - 169.254.0.0/16    # 链路本地地址
         - 224.0.0.0/4       # 组播地址
         - 240.0.0.0/4       # 保留地址
         - 127.0.0.0/8       # 本地回环地址
  ```

2. **只允许必要流量**  
  由于上述策略会禁止所有外部流量（包括集群内部流量），所以需要通过 `podSelector` 和 `namespaceSelector` 显式允许同命名空间和部分系统组件的访问。

3. **放行必要组件**  
  允许如 `ingress-nginx`、`kube-system` 等命名空间的流量，保证集群管理和监控等功能正常。

4. **NodePort/LoadBalancer 兼容性**  
  由于 NodePort 和 LoadBalancer 类型的 Service 需要暴露端口给外部访问，需通过 `ports` 字段放行所有 TCP/UDP 流量，否则会导致服务不可用：
  ```yaml
  - ports:
     - protocol: TCP
     - protocol: UDP
  ```

---

> Kubernetes 的 NetworkPolicy 默认是“拒绝优先”，只有被允许的流量才能通过。通过 `ipBlock`、`namespaceSelector` 和 `ports` 的组合，可以实现灵活且安全的网络隔离。若有更细粒度需求，可进一步细化 `podSelector` 或 `namespaceSelector`，甚至指定端口范围。

如果有更好的方法，欢迎交流。