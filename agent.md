# Sketch-to-Data AI Agent 原理与架构文档

本项目实现了一个**多模态生成式 UI 智能体 (Multimodal Generative UI Agent)**。它不仅仅是一个简单的聊天机器人，而是一个能够“看懂”用户草图、“理解”当前画布状态，并能“操作”页面元素的智能助手。

核心逻辑位于 `services/aiService.ts`，并通过 `components/AIAssistant.tsx` 与用户交互，通过 `App.tsx` 执行状态变更。

## 1. 核心架构概览

该 Agent 的工作流基于 **Perception-Reasoning-Action (感知-推理-行动)** 循环：

1.  **感知 (Perception)**：
    *   **视觉输入**：用户绘制的草图截图或上传的图片 (Base64)。
    *   **状态输入**：当前画布上所有组件的 JSON 描述（坐标、尺寸、类型、标签）。
    *   **文本输入**：用户的自然语言指令（如“把这个图表变大一点”）。
2.  **推理 (Reasoning)**：
    *   LLM (Gemini 或 Qwen) 结合上下文理解用户意图。
    *   判断是需要进行纯文本回复，还是需要调用工具修改状态。
3.  **行动 (Action)**：
    *   **Function Calling (工具调用)**：模型输出结构化的 JSON 指令（如 `update_component_layout`）。
    *   **前端执行**：React 状态机接收指令，更新 `modules` 状态，触发 UI 重绘。

---

## 2. 功能模块详解

### 2.1 草图识别 (Sketch Recognition)

这是 Agent 的“眼睛”。当用户在左侧画板绘制草图并点击“AI 识别”时触发。

*   **技术实现**：`analyzeSketch` 函数。
*   **输入**：
    *   草图的 Base64 图片。
    *   `dataFields`：当前数据源中可用的字段列表（如 `totalRevenue`, `monthlySales`）。
*   **Prompt 策略**：
    *   使用 **Zero-shot Prompting**。
    *   要求模型识别 UI 组件类型（图表、文本、统计卡片等）。
    *   **关键逻辑**：要求模型基于视觉特征，从提供的 `dataFields` 中推测最合适的数据绑定字段。例如，画了一个折线图，模型会倾向于绑定数组类型的 `monthlySales`。
*   **输出限制**：强制要求模型返回纯 JSON 数组，不包含 Markdown 格式，以便前端直接 `JSON.parse`。

### 2.2 上下文感知的对话助手 (Context-Aware Assistant)

这是 Agent 的“大脑”。它不仅处理聊天，还实时维护着对画布的认知。

*   **状态注入 (State Injection)**：
    在每次发送消息给 LLM 时，系统会在 `systemInstruction`（系统指令）中动态插入当前画布的状态快照。
    
    ```typescript
    // 代码片段示例
    const systemInstruction = `
      You are a smart dashboard assistant...
      CURRENT DASHBOARD STATE:
      ${JSON.stringify(modulesContext.map(m => ({
          id: m.id,
          label: m.label,
          type: m.type,
          x: m.x, y: m.y, w: m.w, h: m.h
      })))}
    `;
    ```
    
    这意味着，当用户说“把**销售额**往右移”时，LLM 不需要用户指明 ID，它会通过查找状态中 `label` 为“销售额”的组件，找到对应的 `id` 和当前的 `x` 坐标。

### 2.3 工具调用与布局控制 (Function Calling)

这是 Agent 的“手”。模型本身不能直接修改前端代码，但可以通过 Function Calling 协议请求前端执行代码。

*   **工具定义 (`update_component_layout`)**：
    我们在 `aiService.ts` 中定义了一个工具，描述了如何修改组件：
    *   `component_id`: 目标组件 ID (必填)。
    *   `x`, `y`: 新的坐标。
    *   `w`, `h`: 新的宽高。

*   **执行流程**：
    1.  **用户指令**：“把柱状图放大一点。”
    2.  **LLM 思考**：
        *   在上下文中找到类型为 `chart` 的组件，ID 为 `canvas-123`。
        *   读取当前尺寸 `w=300, h=200`。
        *   推断“放大”意图，决定增加 50px。
        *   计算新尺寸 `w=350, h=250`。
    3.  **LLM 输出**：
        ```json
        {
          "functionCall": {
            "name": "update_component_layout",
            "args": { "component_id": "canvas-123", "w": 350, "h": 250 }
          }
        }
        ```
    4.  **App.tsx 响应**：`handleAICommand` 函数接收到 Tool Call，更新 React State，界面随之变化。

---

## 3. 多模型适配 (LLM Abstraction Layer)

系统设计了适配层以支持不同的 LLM 提供商，屏蔽了 API 差异。

### 3.1 Google Gemini (`gemini-3-flash-preview`)
*   **优势**：原生支持多模态（图片+文本）和强大的 Function Calling，延迟极低。
*   **实现**：使用 `@google/genai` SDK。
*   **模式**：使用 `ai.chats.create` 维护对话历史，支持流式传输（本项目简化为一次性返回）。

### 3.2 阿里云百炼 (`qwen-max` / `qwen-vl-max`)
*   **场景**：国内访问优化，或用户偏好。
*   **实现**：使用 `fetch` 调用 REST API。
*   **差异处理**：
    *   **OpenAI 兼容格式**：阿里云兼容 OpenAI 的消息格式（`messages` 数组），与 Gemini 的 `parts` 结构不同，我们在 `chatWithAssistant` 中进行了格式转换。
    *   **工具定义**：将 Gemini 的 `FunctionDeclaration` 转换为 OpenAI 标准的 `tools` JSON Schema。
    *   **视觉模型切换**：如果消息包含图片，自动切换调用 `qwen-vl-max`；纯文本对话则使用 `qwen-max` 以获得更好的逻辑推理能力。

---

## 4. 关键技术点总结

1.  **多模态输入**：同时处理文本指令和视觉图像（如截图 Debug 或草图）。
2.  **确定性输出**：通过 Function Calling 强制模型输出结构化数据，避免了传统 Prompt 工程中正则表达式解析的不稳定性。
3.  **闭环反馈**：
    *   用户 -> 意图
    *   AI -> 工具调用
    *   Frontend -> 执行并更新状态
    *   AI (下一轮对话) -> 获取最新状态
    这形成了一个完整的反馈闭环，使得 AI 能够连续完成复杂的布局调整任务（例如：“往右移，再移一点，太过了往回一点”）。

## 5. 扩展性

当前 Agent 架构易于扩展：
*   **添加新工具**：只需在 `aiService.ts` 定义新工具（如 `change_color`, `update_data_binding`），并在前端添加对应的 handler，无需修改模型本身。
*   **切换模型**：只要新的模型支持 Function Calling 和 Vision，即可快速集成。
