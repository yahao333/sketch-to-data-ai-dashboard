import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { LLMProvider, SketchModule, AppSettings } from "../types";

// --- Gemini Client Helper ---
const getAiClient = () => {
  const apiKey = process.env.API_KEY || ''; 
  if (!apiKey) {
    console.warn("API_KEY is missing from environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Aliyun Client Helpers ---
const ALIYUN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

interface AliyunMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_calls?: any[];
}

const callAliyun = async (apiKey: string, messages: AliyunMessage[], model: string, tools?: any[]) => {
  const body: any = {
    model: model,
    messages: messages,
    temperature: 0.1, // Low temperature for deterministic layout tasks
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const response = await fetch(ALIYUN_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Aliyun API Error: ${response.status} - ${err}`);
  }

  return await response.json();
};

// Define a partial type for the analysis result which lacks layout properties
type SketchModuleAnalysis = Omit<SketchModule, 'x' | 'y' | 'w' | 'h'>;

/**
 * Tool Definition: Update Component Layout
 * Shared between Gemini and Aliyun
 */
const updateLayoutToolDefinition = {
  name: 'update_component_layout',
  description: 'Update the position (x, y) or size (w, h) of a specific dashboard component. Use this when the user asks to move, resize, scale, or adjust a component.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      component_id: {
        type: Type.STRING,
        description: 'The exact ID of the component to update (e.g., "canvas-123456").'
      },
      x: { type: Type.NUMBER, description: 'The new X coordinate (horizontal position).' },
      y: { type: Type.NUMBER, description: 'The new Y coordinate (vertical position).' },
      w: { type: Type.NUMBER, description: 'The new Width.' },
      h: { type: Type.NUMBER, description: 'The new Height.' }
    },
    required: ['component_id']
  }
};

// Gemini Tool Format
const geminiUpdateLayoutTool: FunctionDeclaration = updateLayoutToolDefinition;

// Aliyun/OpenAI Tool Format
const aliyunUpdateLayoutTool = {
  type: "function",
  function: {
    name: updateLayoutToolDefinition.name,
    description: updateLayoutToolDefinition.description,
    parameters: {
      type: "object", // Type.OBJECT is 'OBJECT', but OpenAI expects lowercase 'object'
      properties: updateLayoutToolDefinition.parameters.properties,
      required: updateLayoutToolDefinition.parameters.required
    }
  }
};


/**
 * 识别草图并建议数据绑定
 */
export const analyzeSketch = async (
  imageBase64: string,
  dataFields: string[],
  settings: AppSettings
): Promise<SketchModuleAnalysis[]> => {
  
  console.log(`[AI Service] Analyzing sketch using provider: ${settings.llmProvider}`);

  const promptText = `
    Please analyze this hand-drawn UI sketch.
    I have a dataset with the following fields: ${JSON.stringify(dataFields)}.
    
    Your task:
    1. Identify the UI components drawn (e.g., a chart, a number card, a text block, a table).
    2. Based on the appearance, guess which data field from the list above best fits this component.
    3. Return a JSON array. Each item should have:
       - id: unique string
       - type: one of ['chart', 'stat_card', 'text', 'table', 'unknown']
       - label: a short name for the component
       - suggestedField: the exact key from the provided list that matches best, or null if unsure.
       - description: brief reasoning.
       
    RETURN ONLY PURE JSON ARRAY. NO MARKDOWN.
  `;

  // --- Aliyun Implementation ---
  if (settings.llmProvider === LLMProvider.ALIYUN) {
    if (!settings.aliyunApiKey) {
      console.error("Aliyun API Key is missing.");
      return [];
    }

    try {
      const result = await callAliyun(
        settings.aliyunApiKey,
        [
           {
             role: "user",
             content: [
               { type: "text", text: promptText },
               { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
             ]
           }
        ],
        "qwen-vl-max" // Qwen-VL-Max supports vision
      );
      
      const content = result.choices[0]?.message?.content || "[]";
      const cleanJson = content.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson) as SketchModuleAnalysis[];

    } catch (error) {
      console.error("[AI Service] Aliyun Analysis Error:", error);
      return [];
    }
  }

  // --- Gemini Implementation ---
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          { text: promptText }
        ]
      }
    });

    const text = response.text || "[]";
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson) as SketchModuleAnalysis[];

  } catch (error) {
    console.error("[AI Service] Gemini Analysis Error:", error);
    return [];
  }
};

/**
 * AI 聊天助手接口 (支持 Function Calling)
 */
export const chatWithAssistant = async (
  history: { role: string; content: string }[],
  newMessage: string,
  modulesContext: SketchModule[], 
  image: string | undefined,
  settings: AppSettings 
): Promise<{ text: string; functionCalls?: any[] }> => {
  
  // 构建系统指令，包含当前组件的状态
  const systemInstructionText = `
    You are a smart dashboard assistant capable of modifying the layout.
    
    CURRENT DASHBOARD STATE (Components on Canvas):
    ${JSON.stringify(modulesContext.map(m => ({
        id: m.id,
        label: m.label,
        type: m.type,
        x: Math.round(m.x),
        y: Math.round(m.y),
        w: Math.round(m.w),
        h: Math.round(m.h)
    })))}

    INSTRUCTIONS:
    1. If the user asks to move, resize, make bigger/smaller, or adjust any component, use the 'update_component_layout' tool.
    2. Identify the component by its 'label' or inferred context (e.g., from the screenshot or description). Use the exact 'id' from the state above in the tool call.
    3. Calculate new coordinates/dimensions based on the user's intent. 
       - "Move right" -> increase x.
       - "Move to edge" -> set x to a large value (e.g. 800 or 1000 depending on context) or 0 for left edge.
       - "Make bigger" -> increase w and h.
       - "Align" -> set matching x or y.
    4. If the user just wants to chat, reply normally.
  `;

  // --- Aliyun Implementation ---
  if (settings.llmProvider === LLMProvider.ALIYUN) {
    if (!settings.aliyunApiKey) {
      return { text: "Error: Please set your Aliyun API Key in Settings." };
    }

    // Convert history format to Aliyun/OpenAI format
    const messages: AliyunMessage[] = [
        { role: 'system', content: systemInstructionText },
        ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.content })),
    ];

    // Handle New Message (Text or Image)
    if (image) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: newMessage },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${image}` } }
            ]
        });
    } else {
        messages.push({ role: 'user', content: newMessage });
    }

    try {
        // Use qwen-vl-max if image is present, otherwise qwen-max
        // Note: qwen-vl-max might have different tool support, but Qwen-Max is best for pure tools. 
        // If image is present, we must use VL.
        const model = image ? "qwen-vl-max" : "qwen-max";

        // IMPORTANT: As of early 2025, Qwen-VL-Max might NOT support tools fully in the same way as Qwen-Max.
        // However, for this demo, we assume the API is standardizing. 
        // If qwen-vl-max fails with tools, we might need a two-step process (Caption -> Layout), but let's try direct.
        
        const result = await callAliyun(
            settings.aliyunApiKey, 
            messages, 
            model,
            [aliyunUpdateLayoutTool]
        );

        const msg = result.choices[0]?.message;
        const text = msg?.content || "";
        const toolCallsRaw = msg?.tool_calls;

        let formattedCalls: any[] | undefined = undefined;

        if (toolCallsRaw && toolCallsRaw.length > 0) {
            formattedCalls = toolCallsRaw.map((tc: any) => ({
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments)
            }));
        }

        return { text, functionCalls: formattedCalls };

    } catch (error) {
        console.error("[AI Service] Aliyun Chat Error:", error);
        return { text: "Sorry, I encountered an error with Aliyun service." };
    }
  }

  // --- Gemini Implementation ---
  const ai = getAiClient();
  try {
    const modelName = 'gemini-3-flash-preview'; 

    if (image) {
       const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: image } },
            { text: newMessage }
          ]
        },
        config: {
            systemInstruction: systemInstructionText,
            tools: [{ functionDeclarations: [geminiUpdateLayoutTool] }]
        }
      });
      
      const text = response.text || "";
      const calls = response.functionCalls; 
      
      return { text, functionCalls: calls };

    } else {
      const chat = ai.chats.create({
        model: modelName,
        config: {
            systemInstruction: systemInstructionText,
            tools: [{ functionDeclarations: [geminiUpdateLayoutTool] }]
        },
        history: history.map(h => ({
            role: h.role,
            parts: [{ text: h.content }]
        }))
      });

      const result = await chat.sendMessage({ message: newMessage });
      
      const text = result.text || "";
      const calls = result.functionCalls; 

      return { text, functionCalls: calls };
    }
  } catch (error) {
    console.error("[AI Service] Gemini Chat Error:", error);
    return { text: "Sorry, I encountered an error connecting to Gemini." };
  }
};