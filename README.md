# 🍥Fuwari  

A static blog template built with [Astro](https://astro.build).

## 🚀 快速开始

1. 安装依赖：
   ```sh
   pnpm install
   ```

2. 编辑配置文件 `src/config.ts` 来自定义您的博客设置

3. 开始开发或构建项目

## ⚡ 项目命令

所有命令都需要在项目根目录下运行：

| 命令                       | 说明                                         |
|:---------------------------|:---------------------------------------------|
| `pnpm install`             | 安装依赖                                     |
| `pnpm dev`                 | 启动本地开发服务器 `localhost:4321`           |
| `pnpm build`               | 构建生产环境到 `./dist/` 目录                 |
| `pnpm preview`             | 本地预览构建后的站点                         |
| `pnpm check`               | 检查代码错误                                 |
| `pnpm format`              | 使用 Biome 格式化代码                       |
| `pnpm new-post <filename>` | 创建新文章                                   |
| `pnpm astro ...`           | 运行 Astro CLI 命令如 `astro add`, `astro check` |
| `pnpm astro --help`        | 获取 Astro CLI 帮助                         |

## 📝 文章配置

```yaml
---
title: 我的第一篇博客文章
published: 2023-09-09
description: 这是我新 Astro 博客的第一篇文章。
image: ./cover.jpg
tags: [标签1, 标签2]
category: 前端
draft: false
lang: zh_CN
---
```
