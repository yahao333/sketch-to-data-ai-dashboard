# Sketch-to-Data AI Dashboard（草图到数据 AI 仪表盘）

## 项目简介（中文）

这是一个用「手绘草图」快速搭建数据仪表盘的前端 Demo：你在画板上画出大概的 UI（图表、指标卡、表格、文本等），点击 AI 识别后，系统会尝试识别组件类型，并从可用数据字段中推荐最合适的绑定字段，最终在画布中生成可预览的仪表盘模块。

你也可以在右侧与 AI 助手对话，基于当前画布上下文进行调整与编辑（例如：修改布局、替换组件、建议展示方式等）。

在线体验：
https://sketch-to-data-ai-dashboard.vercel.app/

## Project Overview (English)

This is a frontend demo that turns a hand-drawn dashboard sketch into data-bound UI modules. Draw rough UI blocks (charts, stat cards, tables, text, etc.) in the sketch area, run AI analysis, and the app will identify component types and recommend the best matching data fields. The generated modules can then be previewed and arranged on the dashboard canvas.

It also includes a context-aware AI assistant that can help refine the dashboard based on the current canvas state.

Live demo:
https://sketch-to-data-ai-dashboard.vercel.app/

## 功能亮点 / Key Features

- 草图识别：从手绘草图识别仪表盘组件类型  
  Sketch recognition: detect dashboard module types from hand-drawn sketches
- 数据绑定推荐：从可用数据字段中自动推荐绑定字段  
  Data binding suggestions: auto-pick a suitable field from available dataset keys
- 画布编辑：在画布中预览与编排模块  
  Canvas editing: preview and arrange modules on the dashboard canvas
- AI 助手：基于当前画布状态的上下文对话与操作建议  
  AI assistant: context-aware chat grounded in the current canvas state
- 多模型提供商：支持 Gemini（环境变量）与阿里云百炼（设置面板）  
  Multiple providers: Gemini (env var) and Aliyun Bailian (in Settings)

## 技术栈 / Tech Stack

- Vite + React + TypeScript
- Recharts（图表）
- @google/genai（Gemini 接入）

## 本地运行 / Run Locally

**前置条件 / Prerequisites**
- Node.js

**1) 安装依赖 / Install dependencies**

使用 pnpm（推荐）：
```bash
pnpm install
```

或使用 npm：
```bash
npm install
```

**2) 配置环境变量 / Configure environment**

在项目根目录创建或编辑 `.env.local`，写入你的 Gemini Key：
```bash
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

说明：
- Gemini 使用环境变量 `GEMINI_API_KEY`
- 如果你切换到「阿里云百炼」，需要在应用内 Settings 面板里填写 API Key（本地存储）

**3) 启动开发服务器 / Start dev server**

```bash
pnpm dev
```

或：
```bash
npm run dev
```

默认访问地址 / Default URL:
- http://localhost:3000

## 构建与预览 / Build & Preview

```bash
pnpm build
pnpm preview
```

或：
```bash
npm run build
npm run preview
```
