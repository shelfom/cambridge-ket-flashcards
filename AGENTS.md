## 项目概述

Cambridge KET Flashcards — 基于剑桥 A2 Key (KET) 2025 年官方词汇表的插图闪卡学习应用。包含 98 个 A 条目，每个条目配有故事书风格插图、英式女声发音、中文释义、英文释义和例句。采用 AWL 风格的零滚动练习流程，支持进度保存。

## 技术栈

- **框架**: React 19 + Vite 7
- **语言**: JavaScript (JSX)
- **样式**: 原生 CSS (styles.css)
- **字体**: Plus Jakarta Sans Variable (@fontsource-variable/plus-jakarta-sans)
- **包管理器**: pnpm (规范要求，禁止 npm/yarn)
- **运行时**: Node.js 24
- **辅助脚本**: Node.js (mjs) + Python 3 (数据提取/构建)
- **图像处理**: sharp + openmoji
- **音频**: 预生成的 .m4a 文件 (public/audio/)

## 目录结构

```
/workspace/projects/
├── .coze                    # 根 .coze (同时承担子项目 .coze，path=".")
├── index.html               # Vite 入口 HTML
├── package.json             # 依赖与脚本定义
├── vite.config.js           # Vite 配置 (React 插件, HMR 关闭)
├── src/
│   ├── main.jsx             # React 入口
│   ├── App.jsx              # 主应用组件 (闪卡逻辑)
│   ├── styles.css           # 全局样式
│   └── data/                # 词汇数据 (JSON)
├── public/
│   ├── audio/               # 预生成的发音文件 (.m4a)
│   ├── images/              # 故事书风格插图
│   ├── icon.svg             # 应用图标
│   ├── manifest.webmanifest # PWA manifest
│   └── sw.js                # Service Worker
├── scripts/
│   ├── coze-preview-build.sh  # 预览构建脚本
│   ├── coze-preview-run.sh    # 预览运行脚本
│   ├── build.sh               # 部署构建脚本
│   ├── run.sh                 # 部署运行脚本
│   ├── generate-audio.mjs     # 音频生成
│   ├── compose-dark-storybook-clues.mjs  # 图像合成
│   ├── verify-data.mjs        # 数据验证
│   ├── verify-ui.mjs          # UI 验证
│   ├── extract-ket-2025.py    # 词汇提取
│   └── build-dictionary-course.py  # 课程数据构建
└── qa/                        # 测试/质量保障
```

## 关键入口 / 核心模块

- **React 入口**: `src/main.jsx` → `src/App.jsx`
- **样式**: `src/styles.css`
- **数据**: `src/data/` 下的 JSON 文件
- **Vite 配置**: `vite.config.js` (HMR 已关闭)
- **构建产物**: `dist/` 目录 (vite build 输出)

## 运行与预览

### 预览链路

- **判定**: Web 预览型项目，通过 Vite dev server 提供实时预览
- **入口**: 根 `.coze` 的 `[dev]` 段 → `scripts/coze-preview-build.sh` + `scripts/coze-preview-run.sh`
- **端口**: 5000 (绑定 0.0.0.0)
- **映射**: 技术项目根目录与工作区根目录重合，根 `.coze` 同时承担子项目 `.coze` 职责

### 部署链路

- **模式**: Vite 纯前端 service 部署 (非纯静态站点)
- **入口**: 根 `.coze` 的 `[deploy]` 段 → `scripts/build.sh` + `scripts/run.sh`
- **构建**: `pnpm install` + `pnpm vite build` → `dist/`
- **运行**: `pnpm dlx serve dist -l 5000`
- **端口**: 5000

### 本地开发

```bash
pnpm install
pnpm run dev      # vite build && vite preview (构建后预览)
pnpm test         # 数据验证 + UI 验证
```

## 用户偏好与长期约束

- Node.js 项目只允许使用 pnpm，禁止 npm 或 yarn
- 预览端口固定 5000，禁止使用 9000
- Vite 配置中 HMR 已关闭 (`server.hmr: false`)
- 项目包含 Python 辅助脚本 (数据提取/构建)，需要 Python 3 环境
- 音频和图像资源为预生成文件，位于 `public/` 目录

## 常见问题和预防

- **端口冲突**: 预览/部署脚本已包含 5000 端口清理逻辑 (fuser -k)
- **锁文件**: 项目原有 package-lock.json (npm)，已切换到 pnpm 并生成 pnpm-lock.yaml
- **HMR**: Vite 配置中已禁用 HMR，预览通过 dev server 模式运行
- **部署**: 纯前端项目按 service 方式部署，使用 `serve` 提供静态文件服务
