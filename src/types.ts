/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GestureType = 'draw' | 'erase' | 'idle' | 'none';

export interface DrawingPoint {
  x: number; // 0 to 1, normalized relative to canvas width
  y: number; // 0 to 1, normalized relative to canvas height
  color: string;
  size: number;
  isStartOfLine?: boolean;
}

export type GameMode = 'free' | 'challenge';

export interface ChallengeTemplate {
  id: string;
  name: string;
  difficulty: '簡單' | '中等' | '困難';
  difficultyColor: string;
  icon: string;
  description: string;
  points: { x: number; y: number }[]; // 1000x1000 scale points
}

// Coordinate sequences for our custom connect-the-dots and tracing templates
const generateDogPoints = (): { x: number; y: number }[] => {
  return [
    { x: 700, y: 310 }, // 1
    { x: 650, y: 270 }, // 2
    { x: 600, y: 240 }, // 3
    { x: 550, y: 220 }, // 4
    { x: 500, y: 215 }, // 5
    { x: 450, y: 220 }, // 6
    { x: 400, y: 240 }, // 7
    { x: 350, y: 270 }, // 8
    { x: 300, y: 310 }, // 9
    { x: 250, y: 365 }, // 10
    { x: 215, y: 430 }, // 11
    { x: 210, y: 500 }, // 12
    { x: 225, y: 570 }, // 13
    { x: 260, y: 630 }, // 14
    { x: 315, y: 680 }, // 15
    { x: 380, y: 725 }, // 16
    { x: 450, y: 755 }, // 17
    { x: 500, y: 765 }, // 18
    { x: 550, y: 755 }, // 19
    { x: 620, y: 725 }, // 20
    { x: 685, y: 680 }, // 21
    { x: 740, y: 630 }, // 22
    { x: 775, y: 570 }, // 23
    { x: 790, y: 500 }, // 24
    { x: 785, y: 430 }  // 25
  ];
};

const generateCirclePoints = (): { x: number; y: number }[] => {
  const points = [];
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * 2 * Math.PI - Math.PI / 2;
    points.push({
      x: Math.round(500 + 300 * Math.cos(angle)),
      y: Math.round(500 + 300 * Math.sin(angle)),
    });
  }
  return points;
};

const generateHeartPoints = (): { x: number; y: number }[] => {
  const points = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * 2 * Math.PI;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
    points.push({
      x: Math.round(500 + x * 22),
      y: Math.round(450 - y * 22),
    });
  }
  return points;
};

const generateStarPoints = (): { x: number; y: number }[] => {
  const points = [];
  const outerRadius = 350;
  const innerRadius = 150;
  const cx = 500;
  const cy = 500;
  
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    points.push({
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
    });
  }
  return points;
};

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'dog',
    name: '可愛小狗 (1-25 點點連線)',
    difficulty: '中等',
    difficultyColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    icon: '🐶',
    description: '經典的連線遊戲！從數字 1 連到 25，畫出一隻可愛的小黃狗！',
    points: generateDogPoints(),
  },
  {
    id: 'heart',
    name: '溫馨愛心 (1-24 點點連線)',
    difficulty: '簡單',
    difficultyColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    icon: '❤️',
    description: '順著點點畫出對稱飽滿的溫馨愛心圖案。',
    points: generateHeartPoints(),
  },
  {
    id: 'star',
    name: '閃耀五角星 (1-10 點點連線)',
    difficulty: '困難',
    difficultyColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    icon: '⭐',
    description: '十個轉折的五星考驗，挑戰空中運筆穩定性！',
    points: generateStarPoints(),
  },
  {
    id: 'circle',
    name: '完美圓圈 (1-24 點點連線)',
    difficulty: '簡單',
    difficultyColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    icon: '⭕',
    description: '畫出一個圓潤無瑕的圓形，測試控筆圓滑度。',
    points: generateCirclePoints(),
  },
];
