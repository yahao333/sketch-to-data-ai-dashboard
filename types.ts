export enum Language {
  ZH = 'zh',
  EN = 'en'
}

export enum LLMProvider {
  GEMINI = 'gemini',
  ALIYUN = 'aliyun'
}

export interface DataSource {
  [key: string]: number | string | Array<number>;
}

export interface SketchModule {
  id: string;
  type: 
    | 'chart'       // Default Bar Chart
    | 'line_chart'  // New
    | 'pie_chart'   // New
    | 'stat_card' 
    | 'text' 
    | 'table' 
    | 'button'      // New
    | 'image'       // New
    | 'custom'      // New: User defined
    | 'unknown' 
    | 'group' 
    | 'shape';
  label: string;
  suggestedField?: string; // Key from DataSource
  description: string;
  // Layout properties
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex?: number; // Layer order
  // Grouping
  children?: SketchModule[];
  // Customization
  customCode?: string; // User-defined HTML/Code override
  // Shape properties
  shapeType?: 'rect' | 'circle' | 'line' | 'pen';
  pathData?: string; // For pen or specific vector data
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  image?: string; // Base64
  timestamp: number;
}

export interface AppSettings {
  language: Language;
  llmProvider: LLMProvider;
  aliyunApiKey?: string;
}