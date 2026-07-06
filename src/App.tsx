/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  Award, 
  Download, 
  Info,
  Trophy,
  Undo,
  Redo,
  RefreshCw,
  Camera,
  Layers,
  Star
} from 'lucide-react';
import CameraStream from './components/CameraStream';
import DrawingCanvas, { DrawingCanvasRef } from './components/DrawingCanvas';
import TutorialModal from './components/TutorialModal';
import { CHALLENGE_TEMPLATES, ChallengeTemplate, GameMode, GestureType } from './types';
import { audioEffects } from './components/AudioEffects';

export default function App() {
  // Tracking coordinates
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [gesture, setGesture] = useState<GestureType>('none');
  
  // Customization
  const [activeColor, setActiveColor] = useState<string>('#f43f5e'); // Default to puppy red blob
  const [brushSize, setBrushSize] = useState<number>(8);
  const [eraserSize, setEraserSize] = useState<number>(35);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showWebcam, setShowWebcam] = useState<boolean>(true);
  
  // Game Modes
  const [gameMode, setGameMode] = useState<GameMode>('challenge'); // Default to challenge to immediately show puppy
  const [selectedTemplate, setSelectedTemplate] = useState<ChallengeTemplate | null>(CHALLENGE_TEMPLATES[0]); // Default to Cute Dog
  
  // Tutorial State
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);
  
  // Live score tracker & win screen overlays
  const [currentAccuracy, setCurrentAccuracy] = useState<number>(0);
  const [showWinOverlay, setShowWinOverlay] = useState<boolean>(false);

  const canvasRef = useRef<DrawingCanvasRef | null>(null);

  // Sync sound setting with synth engine
  useEffect(() => {
    audioEffects.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Open tutorial on first load
  useEffect(() => {
    const hasVisited = localStorage.getItem('gesture_draw_visited');
    if (!hasVisited) {
      setIsTutorialOpen(true);
      localStorage.setItem('gesture_draw_visited', 'true');
    }
  }, []);

  // Hand tracking coordinate receiver
  const handleHandTracked = (x: number, y: number, currentGesture: GestureType) => {
    setCursor({ x, y });
    setGesture(currentGesture);
  };

  // Hover tracking engine for hands-free UI control
  const [hoverTarget, setHoverTarget] = useState<HTMLElement | null>(null);
  const [hoverStartTime, setHoverStartTime] = useState<number>(0);
  const [hoverProgress, setHoverProgress] = useState<number>(0);

  useEffect(() => {
    if (gesture === 'none' || (cursor.x === 0 && cursor.y === 0)) {
      setHoverTarget(null);
      setHoverProgress(0);
      return;
    }

    const screenX = cursor.x * window.innerWidth;
    const screenY = cursor.y * window.innerHeight;

    // Use document.elementFromPoint to find what hand cursor is pointing at
    const el = document.elementFromPoint(screenX, screenY);
    const target = el?.closest('.hover-trigger') as HTMLElement;

    if (target) {
      if (hoverTarget === target) {
        // Same target, update progress
        const elapsed = Date.now() - hoverStartTime;
        // Selection triggers after 800ms
        const progress = Math.min(100, (elapsed / 800) * 100);
        setHoverProgress(progress);

        if (progress >= 100) {
          // Trigger virtual click!
          target.click();
          // Reset hover to avoid infinite looping click trigger
          setHoverTarget(null);
          setHoverProgress(0);
        }
      } else {
        // New target, start timer
        setHoverTarget(target);
        setHoverStartTime(Date.now());
        setHoverProgress(0);
      }
    } else {
      // Not hovering over anything hoverable
      setHoverTarget(null);
      setHoverProgress(0);
    }
  }, [cursor, gesture, hoverTarget, hoverStartTime]);

  // Color Swatches (Paint Blobs Stack Left and Right)
  const LEFT_COLORS = [
    { name: '烈焰紅', value: '#f43f5e', shadow: 'rgba(244, 63, 94, 0.4)' },
    { name: '活力橘', value: '#f97316', shadow: 'rgba(249, 115, 22, 0.4)' },
    { name: '向日黃', value: '#eab308', shadow: 'rgba(234, 179, 8, 0.4)' },
    { name: '青檸綠', value: '#84cc16', shadow: 'rgba(132, 204, 22, 0.4)' },
    { name: '春意綠', value: '#22c55e', shadow: 'rgba(34, 197, 94, 0.4)' },
    { name: '晴空藍', value: '#06b6d4', shadow: 'rgba(6, 182, 212, 0.4)' },
    { name: '深海藍', value: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.4)' },
  ];

  const RIGHT_COLORS = [
    { name: '神秘紫', value: '#a855f7', shadow: 'rgba(168, 85, 247, 0.4)' },
    { name: '甜心粉', value: '#ec4899', shadow: 'rgba(236, 72, 153, 0.4)' },
    { name: '蜜桃粉', value: '#ff9a9e', shadow: 'rgba(255, 154, 158, 0.4)' },
    { name: '朱古褐', value: '#78350f', shadow: 'rgba(120, 53, 15, 0.4)' },
    { name: '極致白', value: '#ffffff', shadow: 'rgba(255, 255, 255, 0.4)' },
    { name: '冷酷灰', value: '#64748b', shadow: 'rgba(100, 116, 139, 0.4)' },
    { name: '純黑曜', value: '#0f172a', shadow: 'rgba(15, 23, 42, 0.4)' },
  ];

  // Download artwork helper
  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.getCanvasImage();
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = `gesture-air-draw-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const selectChallenge = (template: ChallengeTemplate) => {
    setGameMode('challenge');
    setSelectedTemplate(template);
    setCurrentAccuracy(0);
    setShowWinOverlay(false);
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
    }
  };

  // Monitor accuracy for win trigger
  useEffect(() => {
    if (gameMode === 'challenge' && currentAccuracy === 100) {
      setShowWinOverlay(true);
    }
  }, [currentAccuracy, gameMode]);

  return (
    <div className="min-h-screen bg-gradient-to-tr from-rose-100 via-sky-100 to-indigo-100 text-slate-800 flex flex-col font-sans relative overflow-x-hidden pb-12">
      
      {/* Decorative Floating Sparkles & Clouds */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-white/40 blur-2xl rounded-full pointer-events-none animate-pulse" />
      <div className="absolute bottom-20 right-10 w-44 h-44 bg-pink-200/40 blur-2xl rounded-full pointer-events-none" />

      {/* Header Bar */}
      <header className="px-6 py-4 flex items-center justify-between select-none max-w-7xl w-full mx-auto">
        {/* Cute Playful Brand */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-400 to-indigo-500 flex items-center justify-center shadow-lg transform rotate-2">
            <Sparkles className="w-6 h-6 text-white animate-bounce" style={{ animationDuration: '3s' }} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-indigo-950 flex items-center gap-1">
              魔法手勢空中繪圖
              <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                點點連線版
              </span>
            </h1>
            <p className="text-xs text-indigo-800/80 font-medium">食指是畫筆，握拳是橡皮擦，手勢懸空停住即自動選擇！</p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2">
          {/* Audio Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`hover-trigger p-3 rounded-2xl border transition shadow-sm ${
              soundEnabled 
                ? 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50' 
                : 'bg-neutral-100 border-neutral-200 text-neutral-400 hover:bg-neutral-200'
            }`}
            title={soundEnabled ? '關閉音效' : '開啟音效'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Help Button */}
          <button
            onClick={() => setIsTutorialOpen(true)}
            className="hover-trigger p-3 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition flex items-center gap-1.5 text-xs font-bold shadow-sm"
          >
            <HelpCircle className="w-5 h-5" />
            <span>玩法說明</span>
          </button>
        </div>
      </header>

      {/* Main Sandbox Interactive Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 flex flex-col items-center gap-6 relative z-10">
        
        {/* Game Mode Selector HUD */}
        <div className="grid grid-cols-2 gap-2 bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-indigo-100/80 max-w-md w-full shadow-md select-none">
          <button
            onClick={() => {
              setGameMode('free');
              setSelectedTemplate(null);
              setShowWinOverlay(false);
            }}
            className={`hover-trigger py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 ${
              gameMode === 'free'
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md'
                : 'text-indigo-900/60 hover:text-indigo-900 hover:bg-white/40'
            }`}
          >
            🎨 自由創作畫布
          </button>
          <button
            onClick={() => {
              selectChallenge(CHALLENGE_TEMPLATES[0]);
            }}
            className={`hover-trigger py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 ${
              gameMode === 'challenge'
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md'
                : 'text-indigo-900/60 hover:text-indigo-900 hover:bg-white/40'
            }`}
          >
            🐶 小狗連線挑戰
          </button>
        </div>

        {/* Center Canvas & Side Painting Blobs Columns */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-center relative">
          
          {/* LEFT: Paint Blob Swatches (7 colors) */}
          <div className="hidden lg:flex lg:col-span-1 flex-col gap-3.5 items-center justify-center">
            <span className="text-[10px] font-black tracking-wider text-indigo-950/40 uppercase rotate-[-90] mb-2">彩色顏料</span>
            {LEFT_COLORS.map((col) => (
              <button
                key={col.value}
                onClick={() => {
                  setActiveColor(col.value);
                  setGesture('none'); // temporarily trigger refresh
                }}
                className={`hover-trigger w-12 h-12 rounded-full cursor-pointer transition-all duration-300 relative flex items-center justify-center border-4 border-white shadow-lg ${
                  activeColor === col.value
                    ? 'scale-125 ring-4 ring-indigo-500/40'
                    : 'hover:scale-110'
                }`}
                style={{ 
                  backgroundColor: col.value,
                  boxShadow: `0 8px 16px ${col.shadow}` 
                }}
                title={col.name}
              >
                {activeColor === col.value && (
                  <div className="w-3 h-3 rounded-full bg-white shadow-inner animate-ping" />
                )}
              </button>
            ))}
          </div>

          {/* MIDDLE: Primary Drawing Whiteboard & Shelf (10 cols) */}
          <div className="lg:col-span-10 flex flex-col items-center">
            
            {/* Top Toolbar overlayed on top of whiteboard */}
            <div className="w-full max-w-4xl bg-white/85 backdrop-blur-sm border-t border-x border-slate-300 rounded-t-3xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm relative z-20">
              
              {/* Brush size sliders with large cute chrome handles */}
              <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex justify-between items-center text-[11px] font-extrabold text-slate-500">
                    <span>✏️ 畫筆粗細</span>
                    <span className="font-mono text-indigo-600">{brushSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="30"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Mode quick indicators (brush, eraser, empty brush preview) */}
              <div className="flex items-center gap-3 select-none">
                
                {/* Gesture guide light */}
                <div className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    gesture === 'draw' ? 'bg-emerald-500 animate-pulse' : gesture === 'erase' ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'
                  }`} />
                  <span>
                    手勢狀態: {gesture === 'draw' ? '畫筆中' : gesture === 'erase' ? '橡皮擦中' : '空手懸浮'}
                  </span>
                </div>

                {/* Polaroid camera preview frame (PIP) */}
                {showWebcam && (
                  <div className="fixed bottom-6 right-6 lg:absolute lg:bottom-auto lg:right-auto lg:-top-16 lg:left-6 z-40 p-2 pb-4 bg-white border border-neutral-300 shadow-2xl rounded-2xl rotate-1 flex flex-col gap-1 w-44 hover:rotate-0 transition-transform duration-300">
                    <CameraStream 
                      onHandTracked={handleHandTracked} 
                      activeColor={activeColor}
                      brushSize={brushSize}
                      eraserSize={eraserSize}
                    />
                    <div className="text-[9px] font-black text-center text-slate-400 mt-1 select-none font-display">
                      📸 鏡頭捕捉畫面 (食指畫)
                    </div>
                  </div>
                )}
              </div>

              {/* Exit button to reset board */}
              <button
                onClick={() => {
                  if (canvasRef.current) canvasRef.current.clearCanvas();
                  setSelectedTemplate(null);
                  setGameMode('free');
                }}
                className="hover-trigger px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition active:scale-95 flex items-center gap-1"
              >
                <span>退出</span>
              </button>
            </div>

            {/* Main Interactive whiteboard frame */}
            <div className="w-full max-w-4xl relative">
              <DrawingCanvas
                ref={canvasRef}
                cursorX={cursor.x}
                cursorY={cursor.y}
                gesture={gesture}
                activeColor={activeColor}
                brushSize={brushSize}
                eraserSize={eraserSize}
                selectedTemplate={selectedTemplate}
                onAccuracyCalculated={setCurrentAccuracy}
              />
            </div>

            {/* Wooden Shelf Ledge holding action controls */}
            <div className="w-full max-w-4.2xl h-9 bg-amber-800 rounded-lg shadow-xl border-b-6 border-amber-950 flex justify-center relative -top-1.5 z-10">
              {/* Ledge top side glow */}
              <div className="absolute inset-x-0 top-0 h-1 bg-amber-600/50 rounded-full" />
              
              {/* Shelf Items (Action Buttons) resting on the shelf */}
              <div className="absolute -top-6 flex items-center justify-center gap-4 px-4 w-full">
                
                {/* Active Color Preview */}
                <div 
                  className="w-10 h-10 rounded-full border-4 border-amber-900 shadow-lg flex items-center justify-center font-bold text-lg select-none"
                  style={{ backgroundColor: activeColor }}
                  title="目前筆劃顏色"
                >
                  🎨
                </div>

                {/* Undo Button */}
                <button
                  onClick={() => canvasRef.current?.undo()}
                  className="hover-trigger w-12 h-12 rounded-full bg-white hover:bg-slate-50 border-4 border-amber-900 text-slate-700 hover:text-indigo-600 shadow-lg flex items-center justify-center transition active:scale-90 cursor-pointer"
                  title="復原 (Undo)"
                >
                  <Undo className="w-5 h-5 stroke-[2.5]" />
                </button>

                {/* Redo Button */}
                <button
                  onClick={() => canvasRef.current?.redo()}
                  className="hover-trigger w-12 h-12 rounded-full bg-white hover:bg-slate-50 border-4 border-amber-900 text-slate-700 hover:text-indigo-600 shadow-lg flex items-center justify-center transition active:scale-90 cursor-pointer"
                  title="重做 (Redo)"
                >
                  <Redo className="w-5 h-5 stroke-[2.5]" />
                </button>

                {/* Toggle Webcam PIP */}
                <button
                  onClick={() => setShowWebcam(!showWebcam)}
                  className={`hover-trigger w-12 h-12 rounded-full border-4 border-amber-900 shadow-lg flex items-center justify-center transition active:scale-90 cursor-pointer ${
                    showWebcam ? 'bg-white text-indigo-600' : 'bg-neutral-200 text-neutral-400'
                  }`}
                  title="鏡頭預覽開關"
                >
                  <Camera className="w-5 h-5 stroke-[2.5]" />
                </button>

                {/* Save Canvas Image */}
                <button
                  onClick={handleDownloadImage}
                  className="hover-trigger w-12 h-12 rounded-full bg-white hover:bg-slate-50 border-4 border-amber-900 text-slate-700 hover:text-indigo-600 shadow-lg flex items-center justify-center transition active:scale-90 cursor-pointer"
                  title="儲存並下載作品"
                >
                  <Download className="w-5 h-5 stroke-[2.5]" />
                </button>

                {/* Trash/Clear All */}
                <button
                  onClick={() => canvasRef.current?.clearCanvas()}
                  className="hover-trigger w-12 h-12 rounded-full bg-rose-50 hover:bg-rose-100 border-4 border-amber-900 text-rose-600 shadow-lg flex items-center justify-center transition active:scale-90 cursor-pointer"
                  title="清空畫布"
                >
                  <RefreshCw className="w-5 h-5 stroke-[2.5]" />
                </button>

              </div>
            </div>

          </div>

          {/* RIGHT: Paint Blob Swatches (7 colors) */}
          <div className="hidden lg:flex lg:col-span-1 flex-col gap-3.5 items-center justify-center">
            <span className="text-[10px] font-black tracking-wider text-indigo-950/40 uppercase rotate-[90] mb-2">彩色顏料</span>
            {RIGHT_COLORS.map((col) => (
              <button
                key={col.value}
                onClick={() => {
                  setActiveColor(col.value);
                  setGesture('none');
                }}
                className={`hover-trigger w-12 h-12 rounded-full cursor-pointer transition-all duration-300 relative flex items-center justify-center border-4 border-white shadow-lg ${
                  activeColor === col.value
                    ? 'scale-125 ring-4 ring-indigo-500/40'
                    : 'hover:scale-110'
                }`}
                style={{ 
                  backgroundColor: col.value,
                  boxShadow: `0 8px 16px ${col.shadow}` 
                }}
                title={col.name}
              >
                {activeColor === col.value && (
                  <div className="w-3 h-3 rounded-full bg-white shadow-inner animate-ping" />
                )}
              </button>
            ))}
          </div>

        </div>

        {/* BOTTOM SECTION: Interactive challenge templates level grid */}
        {gameMode === 'challenge' && (
          <div className="mt-6 select-none max-w-4xl w-full">
            <h3 className="text-sm font-black text-indigo-950 flex items-center gap-2 mb-4 bg-white/60 w-fit px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>描繪關卡庫 (Challenge Levels)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {CHALLENGE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => selectChallenge(tpl)}
                  className={`hover-trigger p-4 rounded-3xl text-left border cursor-pointer flex flex-col gap-2.5 transition-all duration-300 bg-white/95 ${
                    selectedTemplate?.id === tpl.id
                      ? 'border-indigo-500 ring-4 ring-indigo-500/15 scale-102 shadow-md'
                      : 'border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{tpl.icon}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${tpl.difficultyColor}`}>
                      {tpl.difficulty}
                    </span>
                  </div>

                  <div className="mt-1">
                    <h4 className="text-sm font-extrabold text-indigo-950">{tpl.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Hands-free Floating Virtual Pointer Cursor with Loading Arc */}
      {gesture !== 'none' && cursor.x > 0 && cursor.y > 0 && (
        <div 
          className="fixed pointer-events-none z-50 -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
          style={{ 
            left: `${cursor.x * window.innerWidth}px`, 
            top: `${cursor.y * window.innerHeight}px` 
          }}
        >
          {/* Circular Hover Progress Loader */}
          {hoverProgress > 0 && (
            <svg className="absolute -inset-6 w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="4"
                fill="transparent"
              />
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke="#6366f1"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray={113}
                strokeDashoffset={113 - (113 * hoverProgress) / 100}
              />
            </svg>
          )}

          {/* Pointer center point */}
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-xl border-2 select-none transition-transform duration-100 ${
            gesture === 'draw'
              ? 'bg-emerald-500 border-white text-white scale-110 animate-pulse'
              : gesture === 'erase'
              ? 'bg-rose-500 border-white text-white scale-110'
              : 'bg-indigo-500 border-white text-white scale-95'
          }`}>
            {gesture === 'draw' ? '✏️' : gesture === 'erase' ? '🧽' : '👆'}
          </div>
        </div>
      )}

      {/* Challenge Match Result Score Dialog Overlay */}
      {showWinOverlay && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            onClick={() => setShowWinOverlay(false)}
          />
          
          <div className="relative bg-white border border-indigo-100 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl z-10 select-none overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-gradient-to-b from-indigo-500/10 to-transparent blur-2xl pointer-events-none" />

            <div className="text-5xl mb-4 animate-bounce">🏆</div>
            <h3 className="text-2xl font-black text-indigo-950">太厲害了！完成連線</h3>
            
            <p className="text-slate-600 text-xs leading-relaxed max-w-xs mx-auto mt-3 mb-6">
              恭喜你順利完成了【{selectedTemplate.name}】的點點連線挑戰！你的運筆控制非常出色，一隻栩栩如生的小動物誕生了！🎨
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowWinOverlay(false);
                  selectChallenge(selectedTemplate);
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl text-xs transition cursor-pointer shadow-md shadow-indigo-600/20"
              >
                重新挑戰 (Retry Level)
              </button>
              <button
                onClick={() => setShowWinOverlay(false)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-2xl text-xs transition cursor-pointer"
              >
                返回畫布
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Onboarding Overlay Modal */}
      <TutorialModal 
        isOpen={isTutorialOpen} 
        onClose={() => setIsTutorialOpen(false)} 
      />

    </div>
  );
}
