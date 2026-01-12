import React, { useState, useEffect } from 'react';
import { AppSettings, DataSource, SketchModule } from '../types';
import { UI_TEXT } from '../constants';

interface PropertyPanelProps {
  settings: AppSettings;
  data: DataSource;
  selectedModule: SketchModule | null;
  isMultiSelect: boolean;
  onUpdate: (id: string, updates: Partial<SketchModule>) => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({ settings, data, selectedModule, isMultiSelect, onUpdate }) => {
  const t = UI_TEXT[settings.language];
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [localCode, setLocalCode] = useState('');

  // Sync local code state when module changes
  useEffect(() => {
    if (selectedModule) {
      setLocalCode(selectedModule.customCode || '');
      // If switching modules, reset editor visibility (optional, keeping it open might be better for workflow)
      // setShowCodeEditor(false); 
    }
  }, [selectedModule?.id, selectedModule?.customCode]);

  // Generate default HTML code based on module type and data
  const generateDefaultCode = (mod: SketchModule) => {
    const value = mod.suggestedField ? data[mod.suggestedField] : '${value}';
    
    if (mod.type === 'stat_card') {
      return `<!-- Custom Stat Card -->
<div class="flex flex-col items-center justify-center h-full p-4 bg-white">
  <div class="text-3xl font-bold text-blue-600">
    ${value || '--'}
  </div>
  <div class="text-sm text-gray-500 uppercase mt-2">
    ${mod.label}
  </div>
</div>`;
    }
    
    if (mod.type === 'text') {
      return `<!-- Custom Text Block -->
<div class="p-4 text-gray-700 text-sm leading-relaxed">
  <h4 class="font-bold mb-2">${mod.label}</h4>
  <p>${mod.description || 'Add your text content here...'}</p>
</div>`;
    }

    if (mod.type === 'chart') {
      return `<!-- HTML Placeholder for Chart 
     Note: Interactive Recharts cannot be edited as HTML string directly.
     Use this to replace the chart with a custom HTML visualization.
-->
<div class="w-full h-full flex items-end justify-between p-4 space-x-1">
  <div class="w-1/6 bg-blue-200 h-1/3 rounded-t"></div>
  <div class="w-1/6 bg-blue-300 h-1/2 rounded-t"></div>
  <div class="w-1/6 bg-blue-400 h-2/3 rounded-t"></div>
  <div class="w-1/6 bg-blue-500 h-3/4 rounded-t"></div>
  <div class="w-1/6 bg-blue-600 h-full rounded-t"></div>
</div>`;
    }

    return `<div>${mod.label}</div>`;
  };

  const handleOpenEditor = () => {
    if (selectedModule && !localCode) {
      setLocalCode(generateDefaultCode(selectedModule));
    }
    setShowCodeEditor(true);
  };

  const handleSaveCode = () => {
    if (selectedModule) {
      onUpdate(selectedModule.id, { customCode: localCode });
      setShowCodeEditor(false);
    }
  };

  const handleResetCode = () => {
    if (selectedModule) {
      onUpdate(selectedModule.id, { customCode: undefined });
      setLocalCode('');
      setShowCodeEditor(false);
    }
  };

  if (isMultiSelect) {
    return (
        <div className="h-full bg-white border-l border-gray-200 p-6 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            </div>
            <h3 className="text-gray-700 font-medium">{t.multiSelection}</h3>
            <p className="text-gray-400 text-sm mt-2">{t.multiSelectionHint}</p>
        </div>
    )
  }

  if (!selectedModule) {
    return (
      <div className="h-full bg-white border-l border-gray-200 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
        </div>
        <h3 className="text-gray-500 font-medium">{t.propertiesTitle}</h3>
        <p className="text-gray-400 text-sm mt-2">{t.selectComponentHint}</p>
      </div>
    );
  }

  const isGroup = selectedModule.type === 'group';

  return (
    <div className="h-full bg-white border-l border-gray-200 flex flex-col animate-in slide-in-from-right-5 duration-200">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-700">{t.propertiesTitle}</h3>
        <span className="text-xs text-gray-400 uppercase tracking-wider">{selectedModule.type}</span>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto flex-1">
        {/* Basic Properties */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t.label}</label>
          <input
            type="text"
            value={selectedModule.label}
            onChange={(e) => onUpdate(selectedModule.id, { label: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
          />
        </div>

        {!isGroup && (
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.field}</label>
            <div className="relative">
                <select
                value={selectedModule.suggestedField || ''}
                onChange={(e) => onUpdate(selectedModule.id, { suggestedField: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm bg-white"
                >
                <option value="">{t.noBinding}</option>
                {Object.keys(data).map((key) => (
                    <option key={key} value={key}>
                    {key}
                    </option>
                ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
            {selectedModule.suggestedField && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-600 font-mono break-all">
                    Value: {JSON.stringify(data[selectedModule.suggestedField]).substring(0, 50)}...
                </div>
            )}
            </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t.description}</label>
          <textarea
            value={selectedModule.description}
            onChange={(e) => onUpdate(selectedModule.id, { description: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm resize-none"
          />
        </div>

        {/* Layer Management */}
        <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">{t.layer}</label>
           <div className="flex items-center space-x-2">
               <button 
                  onClick={() => onUpdate(selectedModule.id, { zIndex: (selectedModule.zIndex || 0) - 1 })}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                  title={t.sendBackward}
               >
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
               </button>
               <input 
                  type="number"
                  value={selectedModule.zIndex || 0}
                  onChange={(e) => onUpdate(selectedModule.id, { zIndex: parseInt(e.target.value) || 0 })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-blue-500"
               />
               <button 
                  onClick={() => onUpdate(selectedModule.id, { zIndex: (selectedModule.zIndex || 0) + 1 })}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                  title={t.bringForward}
               >
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
               </button>
           </div>
        </div>
        
        {/* Code Editor Section */}
        {!isGroup && (
          <div className="pt-4 border-t border-gray-100">
             <div className="flex justify-between items-center mb-2">
                 <label className="block text-sm font-medium text-gray-700">{t.codeEditor}</label>
                 {selectedModule.customCode && (
                     <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Customized</span>
                 )}
             </div>
             
             {!showCodeEditor ? (
                 <button 
                    onClick={handleOpenEditor}
                    className="w-full py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-white hover:text-blue-600 hover:border-blue-300 transition flex items-center justify-center gap-2"
                 >
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                     </svg>
                     {t.viewCode}
                 </button>
             ) : (
                 <div className="bg-gray-800 rounded-lg p-3 space-y-3 animate-in fade-in duration-200">
                     <p className="text-[10px] text-gray-400">{t.codeWarning}</p>
                     <textarea
                        value={localCode}
                        onChange={(e) => setLocalCode(e.target.value)}
                        rows={8}
                        className="w-full bg-gray-900 text-green-400 font-mono text-xs p-2 rounded border border-gray-700 focus:border-blue-500 outline-none resize-y"
                        placeholder={t.codePlaceholder}
                        spellCheck={false}
                     />
                     <div className="flex gap-2">
                        <button 
                            onClick={handleSaveCode}
                            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition"
                        >
                            {t.saveCode}
                        </button>
                        <button 
                            onClick={() => setShowCodeEditor(false)}
                            className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded transition"
                        >
                            {t.close}
                        </button>
                     </div>
                     <button 
                        onClick={handleResetCode}
                        className="w-full py-1.5 border border-red-500/50 text-red-400 hover:bg-red-900/20 text-xs rounded transition"
                     >
                        {t.resetCode}
                    </button>
                 </div>
             )}
          </div>
        )}

        {/* Layout Info (Read Only) */}
        {selectedModule.w !== undefined && (
            <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div>
                    <span className="text-xs text-gray-400 block">X</span>
                    <span className="text-sm font-mono">{Math.round(selectedModule.x)}</span>
                </div>
                <div>
                    <span className="text-xs text-gray-400 block">Y</span>
                    <span className="text-sm font-mono">{Math.round(selectedModule.y)}</span>
                </div>
                <div>
                    <span className="text-xs text-gray-400 block">W</span>
                    <span className="text-sm font-mono">{Math.round(selectedModule.w)}</span>
                </div>
                <div>
                    <span className="text-xs text-gray-400 block">H</span>
                    <span className="text-sm font-mono">{Math.round(selectedModule.h)}</span>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default PropertyPanel;