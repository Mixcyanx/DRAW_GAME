/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, ChangeEvent } from 'react';
import { Camera as CameraIcon, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { GestureType } from '../types';

// Declare types for window globals from MediaPipe CDN
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

interface CameraStreamProps {
  onHandTracked: (x: number, y: number, gesture: GestureType) => void;
  activeColor: string;
  brushSize: number;
  eraserSize: number;
}

export default function CameraStream({
  onHandTracked,
  activeColor,
  brushSize,
  eraserSize,
}: CameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'no-camera'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeGesture, setActiveGesture] = useState<GestureType>('none');
  const [trackingScore, setTrackingScore] = useState<number>(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const cameraInstanceRef = useRef<any>(null);
  const handsInstanceRef = useRef<any>(null);
  const isDestroyedRef = useRef(false);

  // Load cameras
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((deviceInfos) => {
      const videoDevices = deviceInfos.filter((d) => d.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    }).catch((err) => {
      console.warn('Enumerating devices error:', err);
    });
  }, []);

  useEffect(() => {
    isDestroyedRef.current = false;
    let isInitialized = false;

    const initMediaPipe = async () => {
      setStatus('loading');
      
      // Wait for globals to be available
      let attempts = 0;
      while ((!window.Hands || !window.Camera) && attempts < 50) {
        if (isDestroyedRef.current) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.Hands || !window.Camera) {
        setStatus('error');
        setErrorMessage('無法載入 MediaPipe 追蹤庫，請檢查您的網路連線。');
        return;
      }

      try {
        // Create hands instance
        const hands = new window.Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.65,
          minTrackingConfidence: 0.65,
        });

        hands.onResults((results: any) => {
          if (isDestroyedRef.current) return;
          processHandResults(results);
        });

        handsInstanceRef.current = hands;

        // Set up video stream manually or via MediaPipe Camera utils
        if (!videoRef.current) return;

        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId 
            ? { deviceId: { exact: selectedDeviceId }, width: 640, height: 480 }
            : { width: 640, height: 480 },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isDestroyedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Create camera runner
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (isDestroyedRef.current || !videoRef.current) return;
            try {
              await hands.send({ image: videoRef.current });
            } catch (e) {
              // ignore frame processing errors during sudden shutdowns
            }
          },
          width: 640,
          height: 480,
        });

        cameraInstanceRef.current = camera;
        await camera.start();
        
        setStatus('ready');
        isInitialized = true;
      } catch (err: any) {
        console.error('MediaPipe initialization failed:', err);
        if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
          setStatus('no-camera');
          setErrorMessage('相機權限遭拒絕。請開啟鏡頭權限以玩此遊戲！');
        } else {
          setStatus('error');
          setErrorMessage(`相機啟動失敗: ${err.message || err}`);
        }
      }
    };

    initMediaPipe();

    return () => {
      isDestroyedRef.current = true;
      
      // Stop drawing feedback
      onHandTracked(0, 0, 'none');

      // Stop camera helper
      if (cameraInstanceRef.current) {
        try {
          cameraInstanceRef.current.stop();
        } catch (e) {}
        cameraInstanceRef.current = null;
      }

      // Stop stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      // Close hands
      if (handsInstanceRef.current) {
        try {
          handsInstanceRef.current.close();
        } catch (e) {}
        handsInstanceRef.current = null;
      }
    };
  }, [selectedDeviceId]);

  // Euclidean distance between two 3D landmarks
  const dist = (p1: any, p2: any) => {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
  };

  // Main hand analysis
  const processHandResults = (results: any) => {
    const canvas = skeletonCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous skeleton overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      setActiveGesture('none');
      setTrackingScore(0);
      onHandTracked(0, 0, 'none');
      return;
    }

    setTrackingScore(Math.round((results.multiHandedness?.[0]?.score || 0.9) * 100));

    // Get the first detected hand
    const landmarks = results.multiHandLandmarks[0];

    // Determine gesture
    // Calculate distance scaling factor based on palm size (wrist to middle finger base)
    const palmScale = dist(landmarks[0], landmarks[9]);

    // Check finger extensions (distance from tip to wrist versus PIP joint to wrist)
    const indexExtended = dist(landmarks[8], landmarks[0]) > dist(landmarks[6], landmarks[0]) * 1.05;
    const middleExtended = dist(landmarks[12], landmarks[0]) > dist(landmarks[10], landmarks[0]) * 1.05;
    const ringExtended = dist(landmarks[16], landmarks[0]) > dist(landmarks[14], landmarks[0]) * 1.05;
    const pinkyExtended = dist(landmarks[20], landmarks[0]) > dist(landmarks[18], landmarks[0]) * 1.05;

    // Thumb check (thumb tip distance to pinky base)
    const thumbExtended = dist(landmarks[4], landmarks[17]) > dist(landmarks[2], landmarks[17]) * 1.1;

    let gesture: GestureType = 'idle';

    // 1. FIST (拳頭) -> Eraser (橡皮擦)
    // All fingers curled
    if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      gesture = 'erase';
    }
    // 2. OPEN HAND (張開手) -> No action (空手勢 / 懸空移動)
    // 4 or 5 fingers extended
    else if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
      gesture = 'idle';
    }
    // 3. INDEX ONLY (食指起立) -> Draw (畫筆)
    // Index extended, middle/ring/pinky curled
    else if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      gesture = 'draw';
    }
    // 4. Default to idle if gesture is ambiguous, to prevent unintended ink marks
    else {
      gesture = 'idle';
    }

    setActiveGesture(gesture);

    // Coordinate mapping: Mirror the X axis because video is mirrored
    // MediaPipe x is 0 on left, 1 on right. 
    // In our mirrored canvas, we want right movement to match, so we flip X.
    const activeFingerTip = landmarks[8]; // Index tip
    const mappedX = 1 - activeFingerTip.x;
    const mappedY = activeFingerTip.y;

    // Emit tracking callback
    onHandTracked(mappedX, mappedY, gesture);

    // Draw stylized skeleton on overlay canvas
    drawSkeleton(ctx, landmarks, gesture, mappedX * canvas.width, mappedY * canvas.height);
  };

  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    gesture: GestureType,
    cursorX: number,
    cursorY: number
  ) => {
    // Joint connections pairs
    const connections = [
      // Thumb
      [0, 1], [1, 2], [2, 3], [3, 4],
      // Index
      [0, 5], [5, 6], [6, 7], [7, 8],
      // Middle
      [0, 9], [9, 10], [10, 11], [11, 12],
      // Ring
      [0, 13], [13, 14], [14, 15], [15, 16],
      // Pinky
      [0, 17], [17, 18], [18, 19], [19, 20],
      // Palm cross
      [5, 9], [9, 13], [13, 17]
    ];

    // Colors according to current gesture
    let skeletonColor = 'rgba(255, 255, 255, 0.4)';
    let jointColor = '#cbd5e1';
    let ringColor = 'rgba(139, 92, 246, 0.4)'; // violet

    if (gesture === 'draw') {
      skeletonColor = 'rgba(16, 185, 129, 0.5)'; // emerald
      jointColor = '#34d399';
      ringColor = 'rgba(16, 185, 129, 0.3)';
    } else if (gesture === 'erase') {
      skeletonColor = 'rgba(244, 63, 94, 0.5)'; // rose
      jointColor = '#fb7185';
      ringColor = 'rgba(244, 63, 94, 0.3)';
    } else if (gesture === 'idle') {
      skeletonColor = 'rgba(59, 130, 246, 0.5)'; // blue
      jointColor = '#60a5fa';
      ringColor = 'rgba(59, 130, 246, 0.3)';
    }

    // Mirror horizontal drawing since video is mirrored
    const getCanvasCoords = (pt: any) => ({
      x: (1 - pt.x) * ctx.canvas.width,
      y: pt.y * ctx.canvas.height
    });

    // Draw lines
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 4;
    ctx.shadowColor = skeletonColor;

    connections.forEach(([p1, p2]) => {
      const c1 = getCanvasCoords(landmarks[p1]);
      const c2 = getCanvasCoords(landmarks[p2]);
      ctx.beginPath();
      ctx.strokeStyle = skeletonColor;
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
    });

    // Draw joints
    ctx.shadowBlur = 0;
    landmarks.forEach((landmark, index) => {
      const coords = getCanvasCoords(landmark);
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, index === 8 || index === 4 || index === 12 || index === 16 || index === 20 ? 6 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = jointColor;
      ctx.fill();
    });

    // Draw stylized laser/pointer ring around active index finger tip (8)
    if (gesture === 'draw') {
      ctx.shadowBlur = 10;
      ctx.shadowColor = activeColor;
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, brushSize + 8, 0, 2 * Math.PI);
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Core tip circle
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (gesture === 'erase') {
      // Draw standard eraser block/circle dashed outline
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#f43f5e';
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, eraserSize, 0, 2 * Math.PI);
      ctx.strokeStyle = '#f43f5e';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Eraser center cross
      ctx.beginPath();
      ctx.moveTo(cursorX - 5, cursorY);
      ctx.lineTo(cursorX + 5, cursorY);
      ctx.moveTo(cursorX, cursorY - 5);
      ctx.lineTo(cursorX, cursorY + 5);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (gesture === 'idle') {
      // Draw smooth pointer dot with trailing target ring
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 14, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
    }
  };

  const handleDeviceChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedDeviceId(e.target.value);
  };

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center">
      
      {/* Invisible/Behind `<video>` element feed (mirrored) */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none scale-x-[-1]"
        style={{ opacity: status === 'ready' ? 0.3 : 0 }}
      />

      {/* Overlay Canvas for skeleton tracking wires */}
      <canvas
        ref={skeletonCanvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
      />

      {/* State alerts */}
      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md p-6 text-center">
          <div className="relative flex items-center justify-center mb-4">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
            <CameraIcon className="w-4 h-4 text-white absolute" />
          </div>
          <p className="text-lg font-medium text-slate-200">相機與 AI 追蹤引擎載入中...</p>
          <p className="text-xs text-slate-400 mt-2 max-w-sm">
            正在下載 MediaPipe 機器學習模組，請稍候。這需要幾秒鐘的時間。
          </p>
        </div>
      )}

      {status === 'no-camera' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
          <h3 className="text-xl font-bold text-white">需要相機權限</h3>
          <p className="text-slate-300 text-sm mt-2 max-w-sm">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition"
          >
            <RefreshCw className="w-4 h-4" /> 重新整理網頁
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
          <h3 className="text-xl font-bold text-white">追蹤引擎錯誤</h3>
          <p className="text-slate-300 text-sm mt-2 max-w-sm">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" /> 重新嘗試
          </button>
        </div>
      )}

      {/* Floating Status Widgets */}
      {status === 'ready' && (
        <>
          {/* Top Left Indicator */}
          <div className="absolute top-4 left-4 z-20 bg-slate-950/75 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 flex items-center gap-2 select-none">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <span className="text-xs font-bold font-display tracking-wide text-slate-200">
              AI 追蹤中 | {trackingScore}%
            </span>
          </div>

          {/* Device Selector on Top Right */}
          {devices.length > 1 && (
            <div className="absolute top-4 right-4 z-20">
              <select
                value={selectedDeviceId}
                onChange={handleDeviceChange}
                className="bg-slate-950/75 backdrop-blur-md border border-slate-800 text-slate-200 text-xs font-medium rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `攝影機 ${device.deviceId.substring(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bottom Gesture Bubble */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
            <div className={`px-5 py-2.5 rounded-full backdrop-blur-md shadow-lg border text-sm font-bold flex items-center gap-2.5 transition-all duration-300 ${
              activeGesture === 'draw'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 scale-105 shadow-emerald-500/10'
                : activeGesture === 'erase'
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 scale-105 shadow-rose-500/10'
                : activeGesture === 'idle'
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : 'bg-slate-950/75 border-slate-800 text-slate-400'
            }`}>
              {activeGesture === 'draw' && (
                <>
                  <span className="text-base animate-pulse">✍️</span>
                  <span>畫筆繪圖中</span>
                </>
              )}
              {activeGesture === 'erase' && (
                <>
                  <span className="text-base animate-bounce">🧽</span>
                  <span>橡皮擦擦除中</span>
                </>
              )}
              {activeGesture === 'idle' && (
                <>
                  <span className="text-base">🖐️</span>
                  <span>空手勢 (懸空移動)</span>
                </>
              )}
              {activeGesture === 'none' && (
                <>
                  <span className="text-base">👋</span>
                  <span>請在鏡頭內伸出手掌</span>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
