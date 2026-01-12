import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppSettings, DataSource, SketchModule } from '../types';
import { UI_TEXT } from '../constants';
import { 
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';

interface DashboardCanvasProps {
  settings: AppSettings;
  data: DataSource;
  modules: SketchModule[];
  setModules: React.Dispatch<React.SetStateAction<SketchModule[]>>;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  // History Props
  onRegisterHistory: (modules: SketchModule[]) => void;
  onUndo: () => void;
  onRedo: () => void;
}

type CanvasTool = 'select' | 'text' | 'rect' | 'circle' | 'line' | 'pen';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const DashboardCanvas: React.FC<DashboardCanvasProps> = ({ 
  settings, 
  data, 
  modules, 
  setModules, 
  selectedIds, 
  onSelect,
  onRegisterHistory,
  onUndo,
  onRedo
}) => {
  const t = UI_TEXT[settings.language];
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Local Clipboard for Canvas operations
  const [clipboard, setClipboard] = useState<SketchModule | null>(null);

  // Tools State
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');

  // Zoom State
  const [scale, setScale] = useState(1);

  // Dragging State (Internal Canvas Movement/Resize)
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialLayout, setInitialLayout] = useState<{ id: string, x: number, y: number, w: number, h: number } | null>(null);

  // State Snapshot for History (Captured on MouseDown)
  const dragStartModules = useRef<SketchModule[]>([]);

  // Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStartPos, setDrawingStartPos] = useState({ x: 0, y: 0 });
  const [drawingModule, setDrawingModule] = useState<SketchModule | null>(null);
  const [penPoints, setPenPoints] = useState<{x: number, y: number}[]>([]);

  // --- Helpers ---
  const getSelectedModules = () => modules.filter(m => selectedIds.includes(m.id));

  // --- Actions ---
  const handleDelete = useCallback(() => {
    if (selectedIds.length > 0) {
        onRegisterHistory(modules); // Snapshot before delete
        setModules(prev => prev.filter(m => !selectedIds.includes(m.id)));
        onSelect([]);
    }
  }, [selectedIds, setModules, onSelect, onRegisterHistory, modules]);

  const handleCopy = useCallback(() => {
    // For simplicity, copy the first selected item
    if (selectedIds.length > 0) {
        const item = modules.find(m => m.id === selectedIds[0]);
        if (item) setClipboard(item);
    }
  }, [selectedIds, modules]);

  const handlePaste = useCallback(() => {
    if (clipboard) {
        onRegisterHistory(modules); // Snapshot before paste
        const newId = `copy-${Date.now()}`;
        // Deep clone to avoid reference issues, especially for children
        const clone = JSON.parse(JSON.stringify(clipboard));
        const newModule = {
            ...clone,
            id: newId,
            x: clipboard.x + 20,
            y: clipboard.y + 20,
            zIndex: (Math.max(...modules.map(m => m.zIndex || 0)) || 0) + 1
        };
        setModules(prev => [...prev, newModule]);
        onSelect([newId]);
    }
  }, [clipboard, setModules, onSelect, modules, onRegisterHistory]);

  // --- Zoom Actions ---
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.2));
  const handleResetZoom = () => setScale(1);

  // --- Layer Management ---
  const handleLayerChange = (action: 'front' | 'back' | 'forward' | 'backward') => {
    if (selectedIds.length === 0) return;

    onRegisterHistory(modules); // Snapshot before layer change

    setModules(prev => {
        const selectedModules = prev.filter(m => selectedIds.includes(m.id));
        if (selectedModules.length === 0) return prev;

        const allZIndexes = prev.map(m => m.zIndex || 0);
        const maxZ = Math.max(...allZIndexes, 0);
        const minZ = Math.min(...allZIndexes, 0);

        return prev.map(m => {
            if (!selectedIds.includes(m.id)) return m;
            
            const currentZ = m.zIndex || 0;
            let newZ = currentZ;

            if (action === 'front') newZ = maxZ + 1;
            if (action === 'back') newZ = minZ - 1;
            if (action === 'forward') newZ = currentZ + 1;
            if (action === 'backward') newZ = currentZ - 1;

            return { ...m, zIndex: newZ };
        });
    });
  };

  // --- Grouping Logic ---
  const handleGroup = () => {
    if (selectedIds.length < 2) return;

    const selectedMods = getSelectedModules();
    if (selectedMods.length < 2) return;

    onRegisterHistory(modules); // Snapshot before group

    // Calculate bounding box
    const minX = Math.min(...selectedMods.map(m => m.x));
    const minY = Math.min(...selectedMods.map(m => m.y));
    const maxX = Math.max(...selectedMods.map(m => m.x + m.w));
    const maxY = Math.max(...selectedMods.map(m => m.y + m.h));
    const maxZ = Math.max(...selectedMods.map(m => m.zIndex || 0));

    const groupW = maxX - minX;
    const groupH = maxY - minY;

    // Create children with relative coordinates
    const children: SketchModule[] = selectedMods.map(m => ({
        ...m,
        x: m.x - minX,
        y: m.y - minY
    }));

    const groupModule: SketchModule = {
        id: `group-${Date.now()}`,
        type: 'group',
        label: 'Group',
        description: 'Grouped components',
        x: minX,
        y: minY,
        w: groupW,
        h: groupH,
        zIndex: maxZ + 1,
        children: children
    };

    setModules(prev => {
        const remaining = prev.filter(m => !selectedIds.includes(m.id));
        return [...remaining, groupModule];
    });
    
    onSelect([groupModule.id]);
  };

  const handleUngroup = () => {
    if (selectedIds.length !== 1) return;
    const groupMod = modules.find(m => m.id === selectedIds[0]);
    if (!groupMod || groupMod.type !== 'group' || !groupMod.children) return;

    onRegisterHistory(modules); // Snapshot before ungroup

    // Convert children back to absolute coordinates
    const freedChildren: SketchModule[] = groupMod.children.map(child => ({
        ...child,
        x: groupMod.x + child.x,
        y: groupMod.y + child.y,
        zIndex: (groupMod.zIndex || 0) + 1
    }));

    setModules(prev => {
        const remaining = prev.filter(m => m.id !== groupMod.id);
        return [...remaining, ...freedChildren];
    });

    onSelect(freedChildren.map(c => c.id));
  };


  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore if typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedIds.length > 0) handleDelete();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            handleCopy();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            handlePaste();
        }
        if (e.key === 'Escape') {
            setActiveTool('select');
            setDrawingModule(null);
            setIsDrawing(false);
        }
        // Undo / Redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                onRedo();
            } else {
                onUndo();
            }
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y')) {
            e.preventDefault();
            onRedo();
        }
        // Zoom Shortcuts
        if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            handleZoomIn();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            handleZoomOut();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
             e.preventDefault();
             handleResetZoom();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDelete, handleCopy, handlePaste, selectedIds, onUndo, onRedo]); 

  // --- Drag & Drop (External from Preview) ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const json = e.dataTransfer.getData('application/json');
    if (!json) return;

    try {
        const previewModule = JSON.parse(json) as SketchModule;
        
        onRegisterHistory(modules); // Snapshot before drop

        const canvasRect = containerRef.current?.getBoundingClientRect();
        // Adjust drop coordinates by scale
        const dropX = (canvasRect ? e.clientX - canvasRect.left : 0) / scale;
        const dropY = (canvasRect ? e.clientY - canvasRect.top : 0) / scale;
        
        // New item on top
        const maxZ = Math.max(...modules.map(m => m.zIndex || 0), 0);

        const newModule: SketchModule = {
            ...previewModule,
            id: `canvas-${Date.now()}`, 
            x: dropX - 100, 
            y: dropY - 80,
            w: previewModule.w || 200, 
            h: previewModule.h || 160,
            zIndex: maxZ + 1
        };

        setModules(prev => [...prev, newModule]);
        onSelect([newModule.id]);

    } catch (err) {
        console.error("Failed to drop module", err);
    }
  };


  // --- Canvas Interaction (Drawing or Selecting) ---

  const getCanvasCoords = (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      // Adjust coordinates by scale
      return {
          x: (e.clientX - rect.left) / scale,
          y: (e.clientY - rect.top) / scale
      };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      // Capture state before any interaction starts
      dragStartModules.current = modules;

      if (activeTool === 'select') {
          onSelect([]);
          return;
      }

      // Start Drawing
      const { x, y } = getCanvasCoords(e);
      setIsDrawing(true);
      setDrawingStartPos({ x, y });

      const maxZ = Math.max(...modules.map(m => m.zIndex || 0), 0) + 1;

      if (activeTool === 'text') {
          // Instant creation for text (needs history)
          onRegisterHistory(modules);

          const newText: SketchModule = {
              id: `text-${Date.now()}`,
              type: 'text',
              label: 'Text Block',
              description: 'Double click to edit text',
              x: x,
              y: y,
              w: 150,
              h: 60,
              zIndex: maxZ
          };
          setModules(prev => [...prev, newText]);
          onSelect([newText.id]);
          setActiveTool('select'); // Auto revert to select
          setIsDrawing(false);
          return;
      }

      if (activeTool === 'pen') {
          setPenPoints([{ x, y }]);
      }
      
      // Initialize temporary drawing module
      setDrawingModule({
          id: 'drawing-temp',
          type: 'shape',
          shapeType: activeTool as any,
          label: activeTool,
          description: '',
          x: x,
          y: y,
          w: 0,
          h: 0,
          zIndex: maxZ
      });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      // 1. Handle Selection Dragging
      if (activeTool === 'select' && (isDragging || isResizing) && initialLayout) {
          // Adjust dx/dy by scale
          const dx = (e.clientX - dragStart.x) / scale;
          const dy = (e.clientY - dragStart.y) / scale;

          setModules(prev => prev.map(m => {
              if (m.id !== initialLayout.id) return m;

              if (isDragging) {
                  return {
                      ...m,
                      x: Math.max(0, initialLayout.x + dx),
                      y: Math.max(0, initialLayout.y + dy)
                  };
              } else { // Resizing
                  return {
                      ...m,
                      w: Math.max(20, initialLayout.w + dx),
                      h: Math.max(20, initialLayout.h + dy)
                  };
              }
          }));
          return;
      }

      // 2. Handle Drawing
      if (isDrawing && drawingModule) {
          const { x, y } = getCanvasCoords(e);
          const startX = drawingStartPos.x;
          const startY = drawingStartPos.y;

          if (activeTool === 'pen') {
              // Append points
              const newPoints = [...penPoints, { x, y }];
              setPenPoints(newPoints);
              
              // Calculate bounding box dynamically
              const xs = newPoints.map(p => p.x);
              const ys = newPoints.map(p => p.y);
              const minX = Math.min(...xs);
              const minY = Math.min(...ys);
              const maxX = Math.max(...xs);
              const maxY = Math.max(...ys);

              setDrawingModule({
                  ...drawingModule,
                  x: minX,
                  y: minY,
                  w: maxX - minX,
                  h: maxY - minY
              });
          } else {
              // Rect, Circle, Line
              // Calculate new box
              const minX = Math.min(startX, x);
              const minY = Math.min(startY, y);
              const w = Math.abs(x - startX);
              const h = Math.abs(y - startY);

              setDrawingModule({
                  ...drawingModule,
                  x: minX,
                  y: minY,
                  w: w,
                  h: h
              });
          }
      }
  };

  const handleCanvasMouseUp = () => {
      // End Dragging
      if (isDragging || isResizing) {
          // If state changed, register history (saving the state BEFORE drag started)
          const hasChanged = JSON.stringify(dragStartModules.current) !== JSON.stringify(modules);
          if (hasChanged) {
             onRegisterHistory(dragStartModules.current);
          }

          setIsDragging(false);
          setIsResizing(false);
          setInitialLayout(null);
          return;
      }

      // End Drawing
      if (isDrawing && drawingModule) {
          // If too small, ignore
          if (drawingModule.w < 5 && drawingModule.h < 5 && activeTool !== 'pen') {
              setIsDrawing(false);
              setDrawingModule(null);
              return;
          }

          // We are about to add a new module, save current state to history
          onRegisterHistory(modules);

          // Finalize Module
          const finalModule: SketchModule = { ...drawingModule, id: `shape-${Date.now()}` };

          if (activeTool === 'pen') {
             const offsetX = finalModule.x;
             const offsetY = finalModule.y;
             
             const pathD = penPoints.map((p, i) => {
                 const lx = p.x - offsetX;
                 const ly = p.y - offsetY;
                 return `${i === 0 ? 'M' : 'L'} ${lx} ${ly}`;
             }).join(' ');

             finalModule.pathData = pathD;
          }

          setModules(prev => [...prev, finalModule]);
          onSelect([finalModule.id]);
          
          setDrawingModule(null);
          setPenPoints([]);
          setIsDrawing(false);
          setActiveTool('select'); // Reset to select
      }
  };


  // --- Item Mouse Handlers ---
  const onModuleMouseDown = (e: React.MouseEvent, id: string, type: 'drag' | 'resize') => {
    e.stopPropagation();
    
    // Capture state before dragging module
    dragStartModules.current = modules;

    if (activeTool !== 'select') return; // Pass through to canvas if drawing
    
    // Multi-select Logic
    let newSelectedIds = [...selectedIds];
    if (e.shiftKey) {
        if (newSelectedIds.includes(id)) {
            newSelectedIds = newSelectedIds.filter(sid => sid !== id);
        } else {
            newSelectedIds.push(id);
        }
        onSelect(newSelectedIds);
        return; 
    } else {
        if (!newSelectedIds.includes(id)) {
            newSelectedIds = [id];
            onSelect(newSelectedIds);
        }
    }

    if (newSelectedIds.length > 1) return;

    const mod = modules.find(m => m.id === id);
    if (!mod) return;

    if (type === 'drag') {
        setIsDragging(true);
    } else {
        setIsResizing(true);
    }

    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialLayout({ id: mod.id, x: mod.x, y: mod.y, w: mod.w, h: mod.h });
  };


  // --- Render Content Helper ---
  const renderModuleContent = (mod: SketchModule) => {
    // 0. Shape Rendering
    if (mod.type === 'shape') {
        const strokeColor = "#334155";
        const strokeWidth = 2;
        
        if (mod.shapeType === 'rect') {
            return <div className="w-full h-full border-2 border-slate-700 bg-transparent box-border" />;
        }
        if (mod.shapeType === 'circle') {
            return <div className="w-full h-full border-2 border-slate-700 bg-transparent rounded-full box-border" />;
        }
        if (mod.shapeType === 'line') {
            // Simple diagonal line
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
        if (mod.shapeType === 'pen' && !mod.pathData && activeTool === 'pen') {
            // Live Preview of Pen
            const offsetX = mod.x;
            const offsetY = mod.y;
            const pathD = penPoints.map((p, i) => `${i===0?'M':'L'} ${p.x - offsetX} ${p.y - offsetY}`).join(' ');
             return (
                <svg width="100%" height="100%" style={{overflow: 'visible'}}>
                     <path d={pathD} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            );
        }
        return null;
    }

    // 1. Recursive rendering for groups
    if (mod.type === 'group' && mod.children) {
        return (
            <div className="w-full h-full relative border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50">
                 {mod.children.map(child => (
                     <div 
                        key={child.id}
                        className="absolute bg-white border border-gray-200 rounded shadow-sm overflow-hidden"
                        style={{
                            left: child.x,
                            top: child.y,
                            width: child.w,
                            height: child.h,
                            zIndex: child.zIndex,
                            pointerEvents: 'none'
                        }}
                     >
                         <div className="w-full h-full">
                             {renderModuleContent(child)}
                         </div>
                     </div>
                 ))}
            </div>
        );
    }

    // 2. Custom Code Rendering
    if (mod.customCode) {
        return (
            <div 
                className="w-full h-full overflow-auto"
                dangerouslySetInnerHTML={{ __html: mod.customCode }} 
            />
        );
    }

    // 3. New UI Elements Rendering
    if (mod.type === 'button') {
        return (
            <div className="w-full h-full flex items-center justify-center pointer-events-none">
                <button className="px-4 py-2 bg-blue-600 text-white rounded shadow-sm font-medium">
                    {mod.label}
                </button>
            </div>
        );
    }
    if (mod.type === 'image') {
        return (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 pointer-events-none">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
        );
    }

    // 4. Default Visual Rendering (Charts & Stats)
    const boundValue = mod.suggestedField ? data[mod.suggestedField] : null;
    const chartData = Array.isArray(boundValue) 
      ? boundValue.map((val, idx) => ({ name: `T${idx+1}`, value: val }))
      : [{ name: 'Val', value: Number(boundValue) || 100 }];

    if (mod.type === 'stat_card') {
        return (
            <div className="flex flex-col items-center justify-center h-full pointer-events-none">
                <div className="text-3xl font-bold text-gray-800 truncate max-w-full px-2">
                    {boundValue?.toString() || '--'}
                </div>
                <div className="text-xs text-gray-500 uppercase mt-1">{mod.label}</div>
            </div>
        );
    }
    
    // --- Charts ---
    if (mod.type === 'chart' || mod.type === 'table') {
        return (
            <div className="h-full w-full pointer-events-none">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }
    
    if (mod.type === 'line_chart') {
         return (
            <div className="h-full w-full pointer-events-none">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={3} dot={{r: 4}} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (mod.type === 'pie_chart') {
        return (
            <div className="h-full w-full pointer-events-none">
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
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div className="p-2 text-gray-700 overflow-hidden pointer-events-none text-sm break-words">
            {boundValue?.toString() || mod.label}
        </div>
    );
  };

  const isGroupSelected = selectedIds.length === 1 && modules.find(m => m.id === selectedIds[0])?.type === 'group';
  const isMultipleSelected = selectedIds.length > 1;

  // Add event listeners for global mouse move/up to handle dragging outside of components
  useEffect(() => {
    if (isDragging || isResizing || isDrawing) {
        window.addEventListener('mousemove', handleCanvasMouseMove as any);
        window.addEventListener('mouseup', handleCanvasMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleCanvasMouseMove as any);
        window.removeEventListener('mouseup', handleCanvasMouseUp);
    };
  }, [isDragging, isResizing, isDrawing, handleCanvasMouseMove, handleCanvasMouseUp]);


  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-2xl shadow-inner border border-gray-200 overflow-hidden relative">
      {/* Header / Toolbar */}
      <div className="p-2 border-b border-gray-200 bg-white flex justify-between items-center z-10 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-gray-700 text-sm flex items-center mr-2">
                <span className="bg-orange-100 text-orange-600 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">4</span>
                {t.canvasTitle}
            </h3>
            
            {/* Drawing Tools */}
            <div className="flex bg-gray-100 p-1 rounded-lg space-x-0.5">
                {[
                    { id: 'select', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />, title: t.toolSelect },
                    { id: 'text', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />, title: t.toolText }, // Using bubble icon for text, or T
                    { id: 'rect', icon: <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2" />, title: t.toolRect },
                    { id: 'circle', icon: <circle cx="12" cy="12" r="9" strokeWidth="2" />, title: t.toolCircle },
                    { id: 'line', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20L20 4" />, title: t.toolLine },
                    { id: 'pen', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />, title: t.toolPen },
                ].map(tool => (
                    <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id as CanvasTool)}
                        className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                            activeTool === tool.id ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:bg-gray-200'
                        }`}
                        title={tool.title}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {tool.icon}
                        </svg>
                    </button>
                ))}
            </div>
        </div>

        <div className="flex space-x-1 items-center">
             {/* History Controls */}
             <div className="flex bg-gray-100 p-1 rounded-lg space-x-0.5 mr-2">
                <button onClick={onUndo} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition" title="Undo (Ctrl+Z)">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                </button>
                <button onClick={onRedo} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition" title="Redo (Ctrl+Y)">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                </button>
             </div>

             {/* Zoom Controls */}
             <div className="flex bg-gray-100 p-1 rounded-lg space-x-0.5 mr-2 items-center">
                <button onClick={handleZoomOut} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition" title={t.zoomOut}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                </button>
                <span className="text-[10px] text-gray-500 w-8 text-center select-none">{Math.round(scale * 100)}%</span>
                <button onClick={handleZoomIn} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition" title={t.zoomIn}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
                <button onClick={handleResetZoom} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition ml-1" title={t.resetView}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                </button>
             </div>

             {/* Layer Controls */}
             {selectedIds.length > 0 && (
                <div className="flex bg-gray-100 p-1 rounded-lg space-x-0.5 mr-2">
                    <button onClick={() => handleLayerChange('front')} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition" title={t.bringToFront}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => handleLayerChange('forward')} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition" title={t.bringForward}>
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => handleLayerChange('backward')} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition" title={t.sendBackward}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button onClick={() => handleLayerChange('back')} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition" title={t.sendToBack}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" /></svg>
                    </button>
                </div>
             )}

             {/* Group/Ungroup Actions */}
            {isMultipleSelected && (
                <button onClick={handleGroup} className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition mr-2 flex items-center">
                    {t.group}
                </button>
            )}
            {isGroupSelected && (
                <button onClick={handleUngroup} className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition mr-2 flex items-center">
                    {t.ungroup}
                </button>
            )}

            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button onClick={handleCopy} disabled={selectedIds.length === 0} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 transition" title={t.copy}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={handlePaste} disabled={!clipboard} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 transition" title={t.paste}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1 self-center"></div>
            <button onClick={handleDelete} disabled={selectedIds.length === 0} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30 transition" title={t.delete}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className={`flex-1 relative overflow-auto bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-10 isolate ${activeTool !== 'select' ? 'cursor-crosshair' : ''}`}
        onMouseDown={handleCanvasMouseDown}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
         <div 
            style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: '0 0',
                width: '100%',
                height: '100%',
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
                backgroundSize: '20px 20px',
                minWidth: '100%',
                minHeight: '100%'
            }}
            className="relative"
         >

            {modules.length === 0 && !drawingModule && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-gray-400 text-sm bg-white/80 px-4 py-2 rounded-full border border-gray-200 backdrop-blur">
                        {t.canvasHint}
                    </p>
                </div>
            )}

            {/* Existing Modules */}
            {modules.map((mod) => {
                const isSelected = selectedIds.includes(mod.id);
                return (
                    <div
                        key={mod.id}
                        className={`absolute bg-white rounded-lg shadow-sm border transition-shadow group 
                            ${isSelected ? 'border-blue-500 ring-2 ring-blue-100 z-10' : 'border-gray-200 hover:border-blue-300'}
                            ${activeTool !== 'select' ? 'pointer-events-none' : ''} 
                        `}
                        style={{
                            left: mod.x,
                            top: mod.y,
                            width: mod.w,
                            height: mod.h,
                            zIndex: mod.zIndex || 0,
                            cursor: isDragging && isSelected ? 'grabbing' : 'grab',
                            backgroundColor: mod.type === 'shape' ? 'transparent' : 'white',
                            borderStyle: mod.type === 'shape' ? 'none' : 'solid', // Remove container border for shapes
                            boxShadow: mod.type === 'shape' ? 'none' : undefined,
                        }}
                        onMouseDown={(e) => onModuleMouseDown(e, mod.id, 'drag')}
                    >
                        {/* Header (Hide for shapes or if drawing) */}
                        {mod.type !== 'shape' && (
                            <div className="h-6 bg-gray-50 border-b border-gray-100 rounded-t-lg flex items-center justify-between px-2 cursor-grab active:cursor-grabbing">
                                <span className="text-[10px] uppercase font-bold text-gray-400 truncate w-2/3 select-none">
                                    {mod.label}
                                </span>
                            </div>
                        )}

                        {/* Content */}
                        <div className={`w-full ${mod.type !== 'shape' ? 'h-[calc(100%-24px)]' : 'h-full'} overflow-hidden`}>
                            {renderModuleContent(mod)}
                        </div>

                        {/* Resize Handle (Only if single selection for now) */}
                        {isSelected && selectedIds.length === 1 && (
                            <div 
                                className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize flex items-end justify-end p-0.5 z-20"
                                onMouseDown={(e) => onModuleMouseDown(e, mod.id, 'resize')}
                            >
                                <div className="w-2 h-2 bg-blue-500 rounded-sm"></div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Drawing Module Preview */}
            {drawingModule && (
                <div
                    className="absolute border-blue-400 border-2 border-dashed z-50 pointer-events-none"
                    style={{
                        left: drawingModule.x,
                        top: drawingModule.y,
                        width: drawingModule.w,
                        height: drawingModule.h,
                        zIndex: 9999
                    }}
                >
                    <div className="w-full h-full opacity-50">
                        {renderModuleContent(drawingModule)}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default DashboardCanvas;