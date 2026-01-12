import React, { useState } from 'react';
import { AppSettings, DataSource, SketchModule } from '../types';
import { UI_TEXT, COMPONENT_LIBRARY } from '../constants';

interface ComponentPreviewListProps {
  settings: AppSettings;
  modules: SketchModule[];
  customModules?: SketchModule[]; // Added prop
  selectedIds: string[];
  onSelect: (id: string) => void;
  onAddCustom?: (module: SketchModule) => void; // Added prop
}

type Tab = 'ai' | 'lib';

const ComponentPreviewList: React.FC<ComponentPreviewListProps> = ({ 
    settings, 
    modules, 
    customModules = [], 
    selectedIds, 
    onSelect,
    onAddCustom
}) => {
  const t = UI_TEXT[settings.language];
  const [activeTab, setActiveTab] = useState<Tab>('lib');

  // Creation Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompCode, setNewCompCode] = useState('<div class="w-full h-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold p-2 text-center">New Component</div>');

  const handleDragStart = (e: React.DragEvent, module: SketchModule) => {
    // We send the JSON of the module to the canvas
    e.dataTransfer.setData('application/json', JSON.stringify(module));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCreateCustom = () => {
      if (!newCompName.trim()) return;

      const newModule: SketchModule = {
          id: `custom-${Date.now()}`,
          type: 'custom',
          label: newCompName,
          description: 'Custom user defined component',
          x: 0, 
          y: 0, 
          w: 200, 
          h: 150,
          customCode: newCompCode
      };

      onAddCustom?.(newModule);
      setIsCreating(false);
      setNewCompName('');
      setNewCompCode('<div class="w-full h-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold p-2 text-center">New Component</div>');
  };

  const currentList = activeTab === 'ai' ? modules : [...customModules, ...COMPONENT_LIBRARY];

  return (
    <>
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50">
            <div className="p-3 pb-0 flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-700 text-sm flex items-center">
                    <span className="bg-orange-100 text-orange-600 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">2</span>
                    {t.previewTitle}
                </h3>
            </div>
            
            {/* Tabs */}
            <div className="flex px-2 space-x-1">
                <button 
                    onClick={() => setActiveTab('lib')}
                    className={`flex-1 py-2 text-xs font-medium rounded-t-lg transition ${
                        activeTab === 'lib' 
                        ? 'bg-white border-x border-t border-gray-200 text-blue-600 shadow-sm relative top-px' 
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                >
                    {t.tabLib}
                </button>
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`flex-1 py-2 text-xs font-medium rounded-t-lg transition flex items-center justify-center ${
                        activeTab === 'ai' 
                        ? 'bg-white border-x border-t border-gray-200 text-blue-600 shadow-sm relative top-px' 
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                >
                    {t.tabAI}
                    {modules.length > 0 && (
                        <span className="ml-1.5 bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5 text-[9px] min-w-[16px] text-center">
                            {modules.length}
                        </span>
                    )}
                </button>
            </div>
        </div>

        <div className="flex-1 p-3 overflow-y-auto bg-white relative">
            {activeTab === 'lib' && (
                <button 
                    onClick={() => setIsCreating(true)}
                    className="w-full py-2 mb-3 bg-blue-50 text-blue-600 border border-blue-200 border-dashed rounded-lg text-xs font-medium hover:bg-blue-100 transition flex items-center justify-center gap-1"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t.addCustom}
                </button>
            )}

            {currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center px-4">
                <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-xs">{activeTab === 'ai' ? t.noAIResults : 'No components'}</p>
            </div>
            ) : (
            <div className="grid grid-cols-2 gap-3 pb-8">
                {currentList.map((mod) => (
                <div
                    key={mod.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, mod)}
                    onClick={() => onSelect(mod.id)}
                    className={`p-2 rounded-lg border cursor-move transition-all hover:shadow-md group relative bg-white flex flex-col items-center text-center ${
                    selectedIds.includes(mod.id) ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                    {/* Visual Preview Icon */}
                    <div className="w-10 h-10 mb-2 rounded bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition overflow-hidden">
                        {getIconForType(mod.type)}
                    </div>

                    <h4 className="text-xs font-medium text-gray-700 truncate w-full">{mod.label}</h4>
                    <div className="mt-1 text-[10px] text-gray-400 truncate w-full">
                        {mod.type === 'custom' ? t.custom : mod.type}
                    </div>

                    {/* Status Indicator for AI Binding */}
                    {mod.suggestedField && (
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400" title={`Bound to ${mod.suggestedField}`} />
                    )}
                </div>
                ))}
            </div>
            )}
        </div>
        </div>

        {/* Custom Component Creation Modal */}
        {isCreating && (
            <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-[1px] flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-sm border border-gray-200 p-4 animate-in zoom-in duration-200">
                    <h3 className="font-bold text-gray-800 mb-4">{t.createCustomTitle}</h3>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">{t.componentName}</label>
                            <input 
                                type="text" 
                                value={newCompName}
                                onChange={(e) => setNewCompName(e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="My Custom Widget"
                            />
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-gray-500 mb-1">{t.htmlContent}</label>
                             <textarea 
                                value={newCompCode}
                                onChange={(e) => setNewCompCode(e.target.value)}
                                rows={5}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                             />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
                        <button 
                            onClick={() => setIsCreating(false)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition"
                        >
                            {t.cancel}
                        </button>
                        <button 
                            onClick={handleCreateCustom}
                            disabled={!newCompName.trim()}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition disabled:opacity-50"
                        >
                            {t.create}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

const getIconForType = (type: string) => {
    switch (type) {
        case 'chart': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
        case 'line_chart': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>;
        case 'pie_chart': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>;
        case 'stat_card': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
        case 'button': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="4" y="8" width="16" height="8" rx="2" strokeWidth={1.5} /></svg>;
        case 'image': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
        case 'text': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16m-7 6h7" /></svg>;
        case 'table': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
        case 'custom': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;
        default: return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
    }
}

export default ComponentPreviewList;