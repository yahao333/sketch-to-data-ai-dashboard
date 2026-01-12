import React, { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { AppSettings } from '../types';
import { UI_TEXT } from '../constants';

interface ScreenshotOverlayProps {
  settings: AppSettings;
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

type ToolType = 'rect' | 'arrow';

interface Shape {
  type: ToolType;
  x: number;
  y: number;
  w: number; // For arrow: endX - startX
  h: number; // For arrow: endY - startY
  color: string;
}

const ScreenshotOverlay: React.FC<ScreenshotOverlayProps> = ({ settings, onCapture, onClose }) => {
  const t = UI_TEXT[settings.language];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  const [activeTool, setActiveTool] = useState<ToolType>('rect');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  // Dragging logic for toolbar
  const [toolbarPos, setToolbarPos] = useState({ x: 20, y: 20 });
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize canvas to full screen
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    
    // Disable scrolling while screenshotting
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const getContext = () => canvasRef.current?.getContext('2d');

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
    const headlen = 15; // length of head in pixels
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ef4444'; // Red color
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const drawRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ef4444'; // Red color
    ctx.stroke();
  };

  const redraw = useCallback((currentShape?: Shape) => {
    const ctx = getContext();
    if (!ctx || !canvasRef.current) return;
    
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Draw saved shapes
    [...shapes, ...(currentShape ? [currentShape] : [])].forEach(shape => {
      if (shape.type === 'rect') {
        drawRect(ctx, shape.x, shape.y, shape.w, shape.h);
      } else {
        // For arrow, w and h are actually dx and dy
        drawArrow(ctx, shape.x, shape.y, shape.x + shape.w, shape.y + shape.h);
      }
    });
  }, [shapes]);

  // Drawing Events
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking on toolbar, don't draw
    if (toolbarRef.current?.contains(e.target as Node)) return;

    setIsDrawing(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const currentShape: Shape = {
      type: activeTool,
      x: startPos.x,
      y: startPos.y,
      w: currentX - startPos.x,
      h: currentY - startPos.y,
      color: '#ef4444'
    };

    redraw(currentShape);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    // Don't add if too small
    if (Math.abs(currentX - startPos.x) < 5 && Math.abs(currentY - startPos.y) < 5) return;

    const newShape: Shape = {
      type: activeTool,
      x: startPos.x,
      y: startPos.y,
      w: currentX - startPos.x,
      h: currentY - startPos.y,
      color: '#ef4444'
    };
    
    setShapes(prev => [...prev, newShape]);
  };

  // Capture Logic
  const handleCapture = async () => {
    setIsCapturing(true);
    
    // Wait a tick for React to hide the toolbar button (we manually hide toolbar with style)
    if (toolbarRef.current) {
        toolbarRef.current.style.display = 'none';
    }

    try {
      // Capture the entire body
      // html2canvas usually captures the canvas content too if useCORS is enabled or it's not tainted
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null, // Transparent background if possible
      });
      
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      onCapture(base64);
      
    } catch (error) {
      console.error("Screenshot failed:", error);
      if (toolbarRef.current) toolbarRef.current.style.display = 'block';
    } finally {
      setIsCapturing(false);
    }
  };

  // Toolbar Dragging Events
  const startDragToolbar = (e: React.MouseEvent) => {
    setIsDraggingToolbar(true);
    setDragOffset({
      x: e.clientX - toolbarPos.x,
      y: e.clientY - toolbarPos.y
    });
  };

  const onDragToolbar = (e: React.MouseEvent) => {
    if (!isDraggingToolbar) return;
    setToolbarPos({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const stopDragToolbar = () => {
    setIsDraggingToolbar(false);
  };

  return (
    <div 
      className="fixed inset-0 z-[60] cursor-crosshair select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => { handleMouseMove(e); onDragToolbar(e); }}
      onMouseUp={(e) => { handleMouseUp(e); stopDragToolbar(); }}
    >
      {/* Semi-transparent background for better focus */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />

      {/* Drawing Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Floating Toolbar */}
      <div
        ref={toolbarRef}
        className="absolute bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden w-64 flex flex-col cursor-auto animate-in fade-in zoom-in duration-200"
        style={{ left: toolbarPos.x, top: toolbarPos.y }}
        onMouseDown={(e) => e.stopPropagation()} // Prevent drawing start when clicking toolbar
      >
        {/* Header (Drag Handle) */}
        <div 
          className="bg-gray-100 p-2 cursor-move flex items-center justify-between border-b border-gray-200"
          onMouseDown={startDragToolbar}
        >
           <span className="text-xs font-bold text-gray-600 uppercase tracking-wider pl-2">
             {t.screenshotToolTitle}
           </span>
           <div className="flex space-x-1">
             <div className="w-2 h-2 rounded-full bg-gray-300"></div>
             <div className="w-2 h-2 rounded-full bg-gray-300"></div>
           </div>
        </div>

        {/* Tools */}
        <div className="p-3 grid grid-cols-2 gap-2">
            <button
                onClick={() => setActiveTool('rect')}
                className={`p-2 rounded flex flex-col items-center justify-center border transition ${
                    activeTool === 'rect' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
            >
                <div className="w-6 h-4 border-2 border-current mb-1"></div>
                <span className="text-xs">{t.toolRect}</span>
            </button>
            <button
                onClick={() => setActiveTool('arrow')}
                className={`p-2 rounded flex flex-col items-center justify-center border transition ${
                    activeTool === 'arrow' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
            >
                <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="text-xs">{t.toolArrow}</span>
            </button>
        </div>

        {/* Actions */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 space-y-2">
            <button
                onClick={handleCapture}
                disabled={isCapturing}
                className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition flex items-center justify-center"
            >
                {isCapturing ? (
                    <svg className="animate-spin h-4 w-4 mr-2 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                )}
                {t.addToMessage}
            </button>
            <button
                onClick={onClose}
                className="w-full py-2 bg-white border border-gray-300 text-gray-600 text-sm font-medium rounded hover:text-red-600 hover:border-red-300 transition"
            >
                {t.closeToolbar}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ScreenshotOverlay;