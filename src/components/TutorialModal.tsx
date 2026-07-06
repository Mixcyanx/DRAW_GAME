/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { X, Play, HelpCircle } from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white border border-indigo-100 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl z-10 overflow-hidden select-none">
        
        {/* Visual glow element */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-gradient-to-b from-indigo-500/10 to-transparent blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-500 rounded-2xl flex items-center justify-center mb-4">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black font-display text-indigo-950">手勢空中繪圖教學</h2>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
            利用 AI 視訊手勢追蹤，在空中就能揮灑創意、玩轉點點連線！
          </p>
        </div>

        {/* Gestures List */}
        <div className="space-y-4 mb-8">
          
          {/* Gesture 1: Draw */}
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all duration-300">
            <div className="text-4xl select-none leading-none pt-1">☝️</div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-indigo-950 text-sm">食指立起 = 畫筆繪圖</h4>
                <span className="text-[10px] bg-emerald-100 border border-emerald-200 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded-lg">
                  DRAW
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                僅伸出食指，其餘手指收攏。移動食指尖端，即可在白板畫布上畫畫或連線。
              </p>
            </div>
          </div>

          {/* Gesture 2: Erase */}
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all duration-300">
            <div className="text-4xl select-none leading-none pt-1">✊</div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-indigo-950 text-sm">握緊拳頭 = 橡皮擦</h4>
                <span className="text-[10px] bg-rose-100 border border-rose-200 text-rose-700 font-extrabold px-1.5 py-0.5 rounded-lg">
                  ERASE
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                將五指握成拳頭。移動拳頭中心，便能像黑板擦一樣擦除任何畫筆線條。
              </p>
            </div>
          </div>

          {/* Gesture 3: Idle */}
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all duration-300">
            <div className="text-4xl select-none leading-none pt-1">🖐️</div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-indigo-950 text-sm">張開手掌 = 空手懸浮 (按鈕選擇)</h4>
                <span className="text-[10px] bg-indigo-100 border border-indigo-200 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-lg">
                  HOVER SELECT
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                五指張開時不會下筆。將指標停留在任何按鈕或顏料上 800 毫秒即可自動觸選！
              </p>
            </div>
          </div>

        </div>

        {/* Footer Play Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-500/25"
        >
          <Play className="w-5 h-5 fill-white" />
          <span>立即開始</span>
        </button>

      </div>
    </div>
  );
}
