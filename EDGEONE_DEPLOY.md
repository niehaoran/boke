# 腾讯云EdgeOne部署指南

本文档介绍如何将 Astro 博客部署到腾讯云EdgeOne。

## 前置条件

1. 腾讯云账号
2. 已开通EdgeOne服务
3. 域名已备案（如果在中国大陆访问）

## 部署步骤

### 1. 手动部署

#### 步骤1：构建项目
```bash
pnpm install
pnpm run build
```

#### 步骤2：登录腾讯云EdgeOne控制台
- 访问 [EdgeOne控制台](https://console.cloud.tencent.com/edgeone)
- 创建站点或选择现有站点

#### 步骤3：上传文件
- 在EdgeOne控制台中，选择"静态网站托管"
- 将 `dist` 目录中的所有文件上传到EdgeOne

#### 步骤4：配置域名
- 在EdgeOne控制台中配置自定义域名
- 设置DNS记录指向EdgeOne提供的CNAME

### 2. 自动部署 (推荐)

#### 步骤1：配置GitHub Secrets
在GitHub仓库的 Settings > Secrets and variables > Actions 中添加：

- `TENCENT_SECRET_ID`: 腾讯云API密钥ID
- `TENCENT_SECRET_KEY`: 腾讯云API密钥Key
- `EDGEONE_ZONE_ID`: EdgeOne站点ID

#### 步骤2：获取腾讯云API密钥
1. 登录腾讯云控制台
2. 访问 [API密钥管理](https://console.cloud.tencent.com/cam/capi)
3. 创建新的API密钥
4. 复制 SecretId 和 SecretKey

#### 步骤3：获取EdgeOne站点ID
1. 在EdgeOne控制台中选择你的站点
2. 在站点详情页面复制站点ID (Zone ID)

#### 步骤4：推送代码
推送代码到main分支将自动触发部署：
```bash
git add .
git commit -m "配置EdgeOne部署"
git push origin main
```

## 配置文件说明

### edgeone.config.json
项目根目录的 `edgeone.config.json` 包含EdgeOne部署配置：

- `framework`: 指定框架类型 (astro)
- `buildCommand`: 构建命令
- `outputDirectory`: 输出目录 (dist)
- `nodeVersion`: Node.js版本
- `routes`: 路由重写规则
- `headers`: HTTP头部设置

### 路由配置
EdgeOne配置包含SPA路由重写，确保所有路径都指向 `index.html`，适合Astro的静态站点。

### 缓存配置
静态资源 (CSS, JS, 图片) 设置1年缓存，提高访问速度。

## 域名配置

### 自定义域名
1. 在EdgeOne控制台添加域名
2. 更新DNS记录：
   ```
   CNAME记录: blog.budiuyun.net -> edgeone提供的域名
   ```

### SSL证书
EdgeOne自动提供免费SSL证书，无需额外配置。

## 监控和维护

### 查看部署状态
- GitHub Actions页面查看部署日志
- EdgeOne控制台查看访问统计

### 更新网站
每次推送到main分支都会自动重新部署。

## 故障排除

### 常见问题

1. **静态资源404**
   - 检查 `astro.config.mjs` 中的 `site` 配置
   - 确保域名配置正确

2. **页面路由404**
   - 检查EdgeOne路由重写配置
   - 确保SPA模式正确设置

3. **部署失败**
   - 检查GitHub Secrets配置
   - 查看GitHub Actions日志

### 联系支持
如有问题，请查看：
- [腾讯云EdgeOne文档](https://cloud.tencent.com/document/product/1552)
- [GitHub Issues](https://github.com/your-repo/issues)

## 性能优化

EdgeOne提供以下优化功能：
- 全球CDN加速
- 智能压缩
- 图片优化
- 预加载优化

这些功能在EdgeOne控制台中可以启用和配置。 