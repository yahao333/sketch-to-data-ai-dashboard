import React, { useState } from 'react';
import { AppSettings, Language, LLMProvider, SketchModule } from './types';
import { MOCK_DATA_SOURCE, UI_TEXT } from './constants';
import SettingsModal from './components/SettingsModal';
import SketchBoard from './components/SketchBoard';
import DashboardCanvas from './components/DashboardCanvas';
import ComponentPreviewList from './components/DataPreview'; // Now functioning as the draggable list
import PropertyPanel from './components/PropertyPanel';
import AIAssistant from './components/AIAssistant';
import PreviewModal from './components/PreviewModal'; // Import the new modal
import { analyzeSketch } from './services/aiService';

// Helper type to track where the selection came from
type SelectionSource = 'preview' | 'canvas' | null;

const App: React.FC = () => {
  // Global Settings State
  const [settings, setSettings] = useState<AppSettings>({
    language: Language.ZH,
    llmProvider: LLMProvider.GEMINI
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false); // State for preview mode
  
  // Data State
  const [previewModules, setPreviewModules] = useState<SketchModule[]>([]);
  const [canvasModules, setCanvasModules] = useState<SketchModule[]>([]);
  const [customLibrary, setCustomLibrary] = useState<SketchModule[]>([]); // New State for Custom Components
  
  // History State
  const [history, setHistory] = useState<SketchModule[][]>([]);
  const [future, setFuture] = useState<SketchModule[][]>([]);

  // Selection State (Now supports multiple IDs)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionSource, setSelectionSource] = useState<SelectionSource>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const t = UI_TEXT[settings.language];

  // --- History Logic ---

  const handleRegisterHistory = (currentModules: SketchModule[]) => {
    // Push current state to history before making changes
    setHistory(prev => [...prev, currentModules]);
    // Clear future because we branched off
    setFuture([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    // Save current state to future
    setFuture(prev => [canvasModules, ...prev]);
    // Restore previous state
    setHistory(newHistory);
    setCanvasModules(previousState);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const nextState = future[0];
    const newFuture = future.slice(1);
    
    // Save current state to history
    setHistory(prev => [...prev, canvasModules]);
    // Restore next state
    setFuture(newFuture);
    setCanvasModules(nextState);
  };

  // --- Logic ---

  const handleAnalyze = async (imageBase64: string) => {
    setIsAnalyzing(true);
    try {
      const availableKeys = Object.keys(MOCK_DATA_SOURCE);
      // Pass full settings object which contains API key for Aliyun
      const result = await analyzeSketch(imageBase64, availableKeys, settings);
      
      // Add IDs if missing and place in Preview bucket (no layout props needed yet)
      const newModules: SketchModule[] = result.map((mod, index) => ({
         ...mod,
         id: `prev-${Date.now()}-${index}`,
         x: 0, y: 0, w: 0, h: 0 // Placeholders
      }));

      setPreviewModules(newModules);
      // Clear previous selection
      setSelectedIds([]);
      setSelectionSource(null);

    } catch (error) {
      console.error("Analysis Failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateModule = (id: string, updates: Partial<SketchModule>) => {
    // Only updates top-level modules for now
    if (selectionSource === 'preview') {
        setPreviewModules(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    } else if (selectionSource === 'canvas') {
        // Optional: Add history for property changes (might be too granular, skipping for now or could add debounced history)
        setCanvasModules(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    }
  };

  const getSelectedModule = (): SketchModule | null => {
      // Returns the first selected module for the property panel
      if (selectedIds.length === 0) return null;
      const primaryId = selectedIds[0];

      if (selectionSource === 'preview') return previewModules.find(m => m.id === primaryId) || null;
      if (selectionSource === 'canvas') return canvasModules.find(m => m.id === primaryId) || null;
      return null;
  };

  const handleAddCustomComponent = (newComponent: SketchModule) => {
    setCustomLibrary(prev => [...prev, newComponent]);
  };

  // --- AI Command Handling (Tool Execution) ---
  const handleAICommand = (toolCalls: any[]) => {
      if (!toolCalls || toolCalls.length === 0) return;

      console.log("Executing AI Commands:", toolCalls);
      
      // Register history before applying AI changes
      handleRegisterHistory(canvasModules);

      setCanvasModules(prev => {
          let newModules = [...prev];
          
          toolCalls.forEach(call => {
              if (call.name === 'update_component_layout') {
                  const { component_id, x, y, w, h } = call.args;
                  
                  newModules = newModules.map(m => {
                      if (m.id === component_id) {
                          return {
                              ...m,
                              x: typeof x === 'number' ? x : m.x,
                              y: typeof y === 'number' ? y : m.y,
                              w: typeof w === 'number' ? w : m.w,
                              h: typeof h === 'number' ? h : m.h
                          };
                      }
                      return m;
                  });
              }
          });
          return newModules;
      });
  };

  return (
    <div className="h-screen bg-slate-100 text-gray-800 font-sans selection:bg-blue-100 flex flex-col overflow-hidden">
      
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 z-10 h-14 flex-shrink-0">
        <div className="max-w-full mx-auto px-4 h-full flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 rounded-lg p-1.5">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800">
              Sketch<span className="text-blue-600">2</span>Data <span className="text-gray-400 font-normal text-xs ml-2">v2.0 Workspace</span>
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
             {/* Preview Button */}
             <button
                onClick={() => setIsPreviewOpen(true)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition shadow-sm text-sm"
             >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="hidden sm:inline">{t.previewMode}</span>
             </button>

             <div className="h-6 w-px bg-gray-200"></div>

             <div className="hidden md:flex text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                {settings.llmProvider}
             </div>
             <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Workspace Grid */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Column: Input & Staging (25% width) */}
        <aside className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white z-0">
            {/* Top: Sketch */}
            <div className="h-1/2 p-4 border-b border-gray-200 flex flex-col min-h-[300px]">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                    <span className="bg-orange-100 text-orange-600 rounded-full w-5 h-5 flex items-center justify-center text-[10px] mr-2">1</span>
                    {t.sketchTitle}
                </h3>
                <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                     <SketchBoard 
                        settings={settings} 
                        onAnalyze={handleAnalyze} 
                        isAnalyzing={isAnalyzing}
                    />
                </div>
            </div>
            
            {/* Bottom: Preview/Staging */}
            <div className="h-1/2 p-4 flex flex-col bg-gray-50/50 relative">
                <ComponentPreviewList 
                    settings={settings}
                    modules={previewModules}
                    customModules={customLibrary}
                    selectedIds={selectionSource === 'preview' ? selectedIds : []}
                    onSelect={(id) => {
                        setSelectedIds([id]);
                        setSelectionSource('preview');
                    }}
                    onAddCustom={handleAddCustomComponent}
                />
            </div>
        </aside>

        {/* Center Column: Dashboard Canvas (Main) */}
        <main className="flex-1 bg-gray-100 p-6 relative flex flex-col min-w-0">
            <DashboardCanvas 
                settings={settings}
                data={MOCK_DATA_SOURCE}
                modules={canvasModules}
                setModules={setCanvasModules}
                selectedIds={selectionSource === 'canvas' ? selectedIds : []}
                onSelect={(ids) => {
                    setSelectedIds(ids);
                    setSelectionSource(ids.length > 0 ? 'canvas' : null);
                }}
                onRegisterHistory={handleRegisterHistory}
                onUndo={handleUndo}
                onRedo={handleRedo}
            />
        </main>

        {/* Right Column: Properties (20% width) */}
        <aside className="w-72 flex-shrink-0 bg-white border-l border-gray-200 z-0">
            <PropertyPanel 
                settings={settings}
                data={MOCK_DATA_SOURCE}
                selectedModule={getSelectedModule()}
                isMultiSelect={selectedIds.length > 1}
                onUpdate={handleUpdateModule}
            />
        </aside>

      </div>

      {/* Floating AI Assistant */}
      <AIAssistant 
        settings={settings}
        modules={canvasModules}
        onCommand={handleAICommand}
      />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
      
      {/* Full Screen Preview Modal */}
      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        settings={settings}
        data={MOCK_DATA_SOURCE}
        modules={canvasModules}
      />

    </div>
  );
};

export default App;