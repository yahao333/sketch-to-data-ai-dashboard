import React from 'react';
import { AppSettings, DataSource, SketchModule } from '../types';
import { UI_TEXT } from '../constants';
import { 
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip 
} from 'recharts';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  data: DataSource;
  modules: SketchModule[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, settings, data, modules }) => {
  if (!isOpen) return null;

  const t = UI_TEXT[settings.language];

  // Helper to render content (similar to DashboardCanvas but styled for Dark Mode presentation)
  const renderModuleContent = (mod: SketchModule) => {
    // 0. Shape Rendering (Dark Mode Styled)
    if (mod.type === 'shape') {
        const strokeColor = "#94a3b8"; // Light slate for dark mode
        const strokeWidth = 2;
        
        if (mod.shapeType === 'rect') {
            return <div className="w-full h-full border-2 border-slate-400 bg-transparent box-border" />;
        }
        if (mod.shapeType === 'circle') {
            return <div className="w-full h-full border-2 border-slate-400 bg-transparent rounded-full box-border" />;
        }
        if (mod.shapeType === 'line') {
            return (
                <svg width="100%" height="100%" style={{overflow: 'visible'}}>
                    <line x1="0" y1="0" x2="100%" y2="100%" stroke={strokeColor} strokeWidth={strokeWidth} />
                </svg>
            );
        }
        if (mod.shapeType === 'pen' && mod.pathData) {
            return (
                <svg width="100%" height="100%" viewBox={`0 0 ${mod.w} ${mod.h}`} style={{overflow: 'visible'}}>
                     <path d={mod.pathData} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        return null;
    }

    // Recursive Group Rendering
    if (mod.type === 'group' && mod.children) {
        return (
            <div className="w-full h-full relative">
                 {mod.children.map(child => (
                     <div 
                        key={child.id}
                        className="absolute bg-[#1e293b] rounded-lg shadow-md overflow-hidden"
                        style={{
                            left: child.x,
                            top: child.y,
                            width: child.w,
                            height: child.h,
                            zIndex: child.zIndex,
                        }}
                     >
                         <div className="w-full h-full text-white">
                             {renderModuleContent(child)}
                         </div>
                     </div>
                 ))}
            </div>
        );
    }

    // Custom Code (e.g. HTML override)
    if (mod.customCode) {
        return (
            <div 
                className="w-full h-full overflow-auto text-gray-200"
                dangerouslySetInnerHTML={{ __html: mod.customCode }} 
            />
        );
    }

    // UI Elements
    if (mod.type === 'button') {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <button className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg font-medium transition">
                    {mod.label}
                </button>
            </div>
        );
    }
    if (mod.type === 'image') {
        return (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-600">
                <svg className="w-16 h-16 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
        );
    }

    const boundValue = mod.suggestedField ? data[mod.suggestedField] : null;
    const chartData = Array.isArray(boundValue) 
      ? boundValue.map((val, idx) => ({ name: `T${idx+1}`, value: val }))
      : [{ name: 'Val', value: Number(boundValue) || 100 }];

    if (mod.type === 'stat_card') {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <div className="text-4xl font-bold text-white drop-shadow-md truncate max-w-full">
                    {boundValue?.toString() || '--'}
                </div>
                {mod.suggestedField ? (
                     <div className="text-xs text-blue-300 mt-2 uppercase tracking-widest opacity-80">{mod.suggestedField}</div>
                ) : (
                    <div className="text-xs text-gray-400 mt-2 uppercase tracking-widest opacity-80">{mod.label}</div>
                )}
            </div>
        );
    }

    // --- Charts ---

    if (mod.type === 'chart' || mod.type === 'table') {
        return (
            <div className="h-full w-full p-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                            itemStyle={{ color: '#60a5fa' }}
                            cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (mod.type === 'line_chart') {
         return (
            <div className="h-full w-full p-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                            itemStyle={{ color: '#8884d8' }}
                            cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4, fill:'#8b5cf6', stroke:'#fff'}} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (mod.type === 'pie_chart') {
        return (
            <div className="h-full w-full p-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={mod.w / 6}
                            outerRadius={mod.w / 3}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                        >
                             {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div className="p-4 text-gray-200 overflow-hidden text-sm leading-relaxed flex items-center justify-center h-full text-center">
            {boundValue?.toString() || mod.label}
        </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#0f172a] text-white flex flex-col animate-in fade-in duration-300">
      {/* Navbar for Preview */}
      <div className="h-16 px-6 flex items-center justify-between bg-[#1e293b] border-b border-gray-700 shadow-lg shrink-0">
        <div className="flex items-center space-x-3">
             <div className="bg-blue-600 p-2 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
             </div>
             <h1 className="text-xl font-bold tracking-tight text-white">Dashboard Live Preview</h1>
        </div>
        
        <button 
            onClick={onClose}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition shadow flex items-center"
        >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t.exitPreview}
        </button>
      </div>

      {/* Main Content Area - Centered Canvas */}
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5">
        <div 
            className="relative bg-[#1e293b] shadow-2xl rounded-xl border border-gray-700 overflow-hidden isolate"
            style={{
                width: '100%',
                height: '100%',
                maxWidth: '1280px', // Restrict max width to keep layout sane
                maxHeight: '800px'
            }}
        >
            {modules.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    No components to display.
                </div>
            )}

            {modules.map(mod => (
                <div
                    key={mod.id}
                    className="absolute bg-[#0f172a] rounded-lg shadow-xl border border-gray-800 overflow-hidden"
                    style={{
                        left: mod.x,
                        top: mod.y,
                        width: mod.w,
                        height: mod.h,
                        zIndex: mod.zIndex || 0,
                        backgroundColor: mod.type === 'shape' ? 'transparent' : '#0f172a',
                        borderWidth: mod.type === 'shape' ? 0 : 1,
                        boxShadow: mod.type === 'shape' ? 'none' : undefined,
                    }}
                >
                    {/* Module Content - Full height without header */}
                    <div className="w-full h-full">
                        {renderModuleContent(mod)}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;