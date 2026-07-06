/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { RefreshCw, Star, Award, Undo2, Redo2 } from 'lucide-react';
import { DrawingPoint, ChallengeTemplate, GestureType } from '../types';
import { audioEffects } from './AudioEffects';

interface DrawingCanvasProps {
  cursorX: number;
  cursorY: number;
  gesture: GestureType;
  activeColor: string;
  brushSize: number;
  eraserSize: number;
  selectedTemplate: ChallengeTemplate | null;
  onAccuracyCalculated?: (accuracy: number) => void;
}

export interface DrawingCanvasRef {
  clearCanvas: () => void;
  getCanvasImage: () => string | null;
  calculateFinalAccuracy: () => number;
  undo: () => void;
  redo: () => void;
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  cursorX,
  cursorY,
  gesture,
  activeColor,
  brushSize,
  eraserSize,
  selectedTemplate,
  onAccuracyCalculated,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Strokes represent lines drawn by the user. Each stroke is an array of points.
  const [strokes, setStrokes] = useState<DrawingPoint[][]>([]);
  // Redo stack for strokes
  const [redoList, setRedoList] = useState<DrawingPoint[][]>([]);
  
  // Connect the dots game state
  const [connectedDotCount, setConnectedDotCount] = useState<number>(0);
  
  const isStartOfLineRef = useRef<boolean>(true);
  const lastGestureRef = useRef<GestureType>('none');

  // Sync / Reset on template change
  useEffect(() => {
    clearCanvas();
  }, [selectedTemplate]);

  // Trigger sound effect and add point based on gesture & cursor coordinates
  useEffect(() => {
    if (gesture === 'none' || (cursorX === 0 && cursorY === 0)) {
      if (lastGestureRef.current === 'draw') {
        audioEffects.stopDraw();
      }
      isStartOfLineRef.current = true;
      lastGestureRef.current = gesture;
      return;
    }

    if (gesture === 'draw') {
      // Audio feedback
      if (lastGestureRef.current !== 'draw') {
        audioEffects.startDraw(cursorY);
      } else {
        audioEffects.updateDrawPitch(cursorY);
      }

      // Add points to current stroke
      const newPoint: DrawingPoint = {
        x: cursorX,
        y: cursorY,
        color: activeColor,
        size: brushSize,
      };

      setStrokes((prev) => {
        const next = [...prev];
        if (isStartOfLineRef.current || next.length === 0) {
          next.push([newPoint]);
        } else {
          next[next.length - 1] = [...next[next.length - 1], newPoint];
        }
        return next;
      });

      setRedoList([]); // Clear redo list on new drawing actions
      isStartOfLineRef.current = false;

      // Handle Connect-The-Dots Hit Testing
      if (selectedTemplate) {
        const currentTargetIdx = connectedDotCount;
        if (currentTargetIdx < selectedTemplate.points.length) {
          const targetPt = selectedTemplate.points[currentTargetIdx];
          const tx = targetPt.x / 1000;
          const ty = targetPt.y / 1000;
          const distance = Math.hypot(cursorX - tx, cursorY - ty);

          // If close enough (within ~5% of canvas width/height)
          if (distance < 0.05) {
            const nextCount = currentTargetIdx + 1;
            setConnectedDotCount(nextCount);
            
            if (nextCount === selectedTemplate.points.length) {
              // Complete!
              audioEffects.playWin();
              if (onAccuracyCalculated) {
                onAccuracyCalculated(100);
              }
            } else {
              audioEffects.playDotSuccess(nextCount);
            }
          }
        }
      }

    } else if (gesture === 'erase') {
      if (lastGestureRef.current === 'draw') {
        audioEffects.stopDraw();
      }
      
      // Audio feedback
      audioEffects.playErase();

      // Erase points within normalized distance of eraser
      const eraserRadius = eraserSize / 480; // normalize relative to screen height
      setStrokes((prev) => 
        prev.map((stroke) => 
          stroke.filter((p) => Math.hypot(p.x - cursorX, p.y - cursorY) > eraserRadius)
        ).filter((stroke) => stroke.length > 0) // filter out empty strokes
      );
      isStartOfLineRef.current = true;
    } else {
      // Idle mode
      if (lastGestureRef.current === 'draw') {
        audioEffects.stopDraw();
      }
      isStartOfLineRef.current = true;
    }

    lastGestureRef.current = gesture;
  }, [cursorX, cursorY, gesture, connectedDotCount, selectedTemplate]);

  // Main Draw Loop & Animation Frame
  useEffect(() => {
    let animationId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Cute Dog Face background if 'dog' template is active
      if (selectedTemplate && selectedTemplate.id === 'dog') {
        drawDogDecorations(ctx, canvas.width, canvas.height);
      }

      // 2. Draw Tracing Dot Guides & Completed Lines (Connect the dots)
      if (selectedTemplate) {
        drawConnectTheDotsGuides(ctx, canvas.width, canvas.height);
      }

      // 3. Draw user strokes
      if (strokes.length > 0) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        strokes.forEach((stroke) => {
          if (stroke.length === 0) return;
          ctx.beginPath();
          ctx.strokeStyle = stroke[0].color;
          ctx.lineWidth = stroke[0].size;
          ctx.moveTo(stroke[0].x * canvas.width, stroke[0].y * canvas.height);
          for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i].x * canvas.width, stroke[i].y * canvas.height);
          }
          ctx.stroke();
        });
      }

      // 4. Draw cursor indicator when actively drawing or erasing
      if (gesture !== 'none' && cursorX > 0 && cursorY > 0) {
        const screenX = cursorX * canvas.width;
        const screenY = cursorY * canvas.height;

        if (gesture === 'draw') {
          ctx.beginPath();
          ctx.arc(screenX, screenY, brushSize / 2, 0, 2 * Math.PI);
          ctx.fillStyle = activeColor;
          ctx.fill();
        }
      }

      // 5. Report accuracy
      if (selectedTemplate) {
        if (connectedDotCount > 0) {
          const acc = Math.round((connectedDotCount / selectedTemplate.points.length) * 100);
          if (onAccuracyCalculated) {
            onAccuracyCalculated(acc);
          }
        }
      } else {
        if (onAccuracyCalculated) onAccuracyCalculated(0);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [strokes, selectedTemplate, activeColor, brushSize, cursorX, cursorY, gesture, connectedDotCount]);

  // Helper to draw puppy inner face vector graphics
  const drawDogDecorations = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    ctx.scale(w / 1000, h / 1000);

    // 1. Inner folding ears (pink accents)
    ctx.fillStyle = '#fecdd3'; // light rose
    // Left ear inner
    ctx.beginPath();
    ctx.moveTo(255, 380);
    ctx.quadraticCurveTo(280, 460, 230, 470);
    ctx.quadraticCurveTo(210, 410, 255, 380);
    ctx.fill();

    // Right ear inner
    ctx.beginPath();
    ctx.moveTo(745, 380);
    ctx.quadraticCurveTo(720, 460, 770, 470);
    ctx.quadraticCurveTo(790, 410, 745, 380);
    ctx.fill();

    // 2. Eyes
    // Eyebrows
    ctx.strokeStyle = '#3e2723'; // dark brown
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    
    // Left Eyebrow
    ctx.beginPath();
    ctx.arc(410, 430, 30, Math.PI, Math.PI * 1.6);
    ctx.stroke();
    
    // Right Eyebrow
    ctx.beginPath();
    ctx.arc(590, 430, 30, Math.PI * 1.4, 2 * Math.PI);
    ctx.stroke();

    // Eyeballs
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(410, 470, 16, 0, 2 * Math.PI);
    ctx.arc(590, 470, 16, 0, 2 * Math.PI);
    ctx.fill();

    // Eye catchlights (white shine)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(405, 464, 5, 0, 2 * Math.PI);
    ctx.arc(585, 464, 5, 0, 2 * Math.PI);
    ctx.fill();

    // 3. Cheeks (Cute glowing pink cheeks)
    ctx.fillStyle = 'rgba(251, 113, 133, 0.45)'; // semi-transparent pink
    ctx.beginPath();
    ctx.arc(330, 560, 25, 0, 2 * Math.PI);
    ctx.arc(670, 560, 25, 0, 2 * Math.PI);
    ctx.fill();

    // 4. Nose
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    // Rounded cute dog nose
    ctx.moveTo(500, 545);
    ctx.bezierCurveTo(475, 545, 465, 520, 500, 520);
    ctx.bezierCurveTo(535, 520, 525, 545, 500, 545);
    ctx.fill();

    // 5. Mouth & Smile hooks
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 5;
    ctx.beginPath();
    // Left smile hook
    ctx.moveTo(500, 545);
    ctx.quadraticCurveTo(470, 580, 440, 560);
    // Right smile hook
    ctx.moveTo(500, 545);
    ctx.quadraticCurveTo(530, 580, 560, 560);
    ctx.stroke();

    // 6. Tongue stretching down
    ctx.fillStyle = '#fda4af'; // warm pink tongue
    ctx.beginPath();
    ctx.arc(500, 580, 15, 0, Math.PI);
    ctx.fill();
    // Tongue line
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(500, 580);
    ctx.lineTo(500, 595);
    ctx.stroke();

    ctx.restore();
  };

  // Render sequential numbering dots and lines connecting successfully matched dots
  const drawConnectTheDotsGuides = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!selectedTemplate) return;
    const pts = selectedTemplate.points;

    ctx.save();

    // A. Draw bold sequential connecting lines for successfully connected segments
    if (connectedDotCount > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#000000'; // Bold marker black
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const startPt = pts[0];
      ctx.moveTo((startPt.x / 1000) * w, (startPt.y / 1000) * h);
      
      const limit = Math.min(connectedDotCount, pts.length);
      for (let i = 1; i < limit; i++) {
        const nextPt = pts[i];
        ctx.lineTo((nextPt.x / 1000) * w, (nextPt.y / 1000) * h);
      }
      
      // If fully connected, close the path back to dot 1
      if (connectedDotCount === pts.length) {
        ctx.lineTo((startPt.x / 1000) * w, (startPt.y / 1000) * h);
      }
      
      ctx.stroke();
    }

    // B. Draw dashed lines for remaining segments to help the user trace
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    
    const startIndex = Math.max(0, connectedDotCount - 1);
    const startGuidePt = pts[startIndex];
    ctx.moveTo((startGuidePt.x / 1000) * w, (startGuidePt.y / 1000) * h);
    
    for (let i = startIndex + 1; i < pts.length; i++) {
      ctx.lineTo((pts[i].x / 1000) * w, (pts[i].y / 1000) * h);
    }
    // Loop back to 1
    ctx.lineTo((pts[0].x / 1000) * w, (pts[0].y / 1000) * h);
    ctx.stroke();
    ctx.setLineDash([]);

    // C. Draw glowing pulse under current target dot
    if (connectedDotCount < pts.length) {
      const activePt = pts[connectedDotCount];
      const ax = (activePt.x / 1000) * w;
      const ay = (activePt.y / 1000) * h;
      
      const pulseRadius = 14 + Math.sin(Date.now() / 150) * 5;
      ctx.beginPath();
      ctx.arc(ax, ay, pulseRadius, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)'; // pulsing translucent emerald
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // D. Render each numbered dot circle
    pts.forEach((pt, index) => {
      const screenX = (pt.x / 1000) * w;
      const screenY = (pt.y / 1000) * h;
      const dotNum = index + 1;
      const isConnected = index < connectedDotCount;
      const isActive = index === connectedDotCount;

      // Draw dot container circle
      ctx.beginPath();
      ctx.arc(screenX, screenY, 12, 0, 2 * Math.PI);
      
      if (isConnected) {
        // Connected: Filled with vibrant emerald/green
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
      } else if (isActive) {
        // Current target dot: Highlight yellow-gold
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
      } else {
        // Future dot: Clean white with subtle grey outline
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
      }
      ctx.fill();
      ctx.stroke();

      // Draw Number inside circle
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (isConnected) {
        ctx.fillStyle = '#ffffff';
      } else if (isActive) {
        ctx.fillStyle = '#000000';
      } else {
        ctx.fillStyle = '#1e293b';
      }
      ctx.fillText(dotNum.toString(), screenX, screenY + 0.5);
    });

    ctx.restore();
  };

  // Reset function
  const clearCanvas = () => {
    setStrokes([]);
    setRedoList([]);
    setConnectedDotCount(0);
    isStartOfLineRef.current = true;
    audioEffects.playClear();
  };

  const getCanvasImage = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  // Expose API via ref
  useImperativeHandle(ref, () => ({
    clearCanvas,
    getCanvasImage,
    calculateFinalAccuracy: () => {
      if (!selectedTemplate) return 0;
      return Math.round((connectedDotCount / selectedTemplate.points.length) * 100);
    },
    undo: () => {
      if (strokes.length === 0) return;
      audioEffects.playErase();
      setStrokes((prev) => {
        const next = [...prev];
        const removed = next.pop();
        if (removed) {
          setRedoList((r) => [...r, removed]);
        }
        return next;
      });
      // Backtrack connect the dots count if needed
      setConnectedDotCount(prev => Math.max(0, prev - 2));
    },
    redo: () => {
      if (redoList.length === 0) return;
      audioEffects.playDotSuccess(connectedDotCount + 1);
      setRedoList((prev) => {
        const next = [...prev];
        const restored = next.pop();
        if (restored) {
          setStrokes((s) => [...s, restored]);
        }
        return next;
      });
    },
  }));

  return (
    <div className="relative w-full aspect-video bg-neutral-900 border-12 border-neutral-700 rounded-3xl shadow-inner overflow-hidden select-none">
      
      {/* Blackboard/Whiteboard grid felt lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] opacity-25" />

      {/* Primary Drawing Canvas */}
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="absolute inset-0 w-full h-full object-cover z-0 cursor-crosshair"
      />

      {/* Clear Button Inset */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={clearCanvas}
          className="hover-trigger flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition shadow-lg backdrop-blur-sm"
          title="清除畫布"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>清除</span>
        </button>
      </div>

      {/* Connect-the-Dots HUD */}
      {selectedTemplate && (
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5">
          <div className="px-3.5 py-1.5 bg-slate-900/95 border border-slate-800 rounded-xl flex items-center gap-2 shadow-lg backdrop-blur-sm">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-400">目前進度</span>
            <span className="text-sm font-black font-display text-amber-400">
              {connectedDotCount} / {selectedTemplate.points.length} 點
            </span>
          </div>
        </div>
      )}

      {/* No action tutorial guidelines */}
      {strokes.length === 0 && !selectedTemplate && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-6 pointer-events-none select-none">
          <div className="w-12 h-12 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-400 text-lg mb-3">
            ✏️
          </div>
          <p className="text-sm font-semibold text-slate-400">空中畫布已準備就緒</p>
          <p className="text-xs text-slate-600 mt-1 max-w-xs text-center leading-relaxed">
            伸出<strong>食指</strong>即可開始畫畫，<strong>握起拳頭</strong>可以當作橡皮擦擦去線條。
          </p>
        </div>
      )}

      {strokes.length === 0 && selectedTemplate && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none select-none w-full">
          <div className="mx-auto w-fit bg-indigo-950/80 text-indigo-300 border border-indigo-900/50 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 pulsing-indicator">
            <Award className="w-3.5 h-3.5" />
            <span>請將手指對準第 1 號點點開始連線吧！</span>
          </div>
        </div>
      )}
    </div>
  );
});

DrawingCanvas.displayName = 'DrawingCanvas';
export default DrawingCanvas;
