
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, ShapeType, Point, LevelConfig, RankingRecord } from './types';
import { getGameFeedback, getIntroTip } from './services/geminiService';

const LEVEL_CONFIGS: LevelConfig[] = [
  { level: 1, shape: ShapeType.CIRCLE, stressGain: 2, precision: 22, requiredCoverage: 0.6 },
  { level: 2, shape: ShapeType.TRIANGLE, stressGain: 2.5, precision: 20, requiredCoverage: 0.65 },
  { level: 3, shape: ShapeType.SQUARE, stressGain: 3, precision: 18, requiredCoverage: 0.7 },
  { level: 4, shape: ShapeType.STAR, stressGain: 3.5, precision: 16, requiredCoverage: 0.75 },
  { level: 5, shape: ShapeType.HEART, stressGain: 4, precision: 15, requiredCoverage: 0.75 },
  { level: 6, shape: ShapeType.CLOUD, stressGain: 4.5, precision: 14, requiredCoverage: 0.8 },
  { level: 7, shape: ShapeType.BIRD, stressGain: 5, precision: 12, requiredCoverage: 0.8 },
  { level: 8, shape: ShapeType.BUTTERFLY, stressGain: 5.5, precision: 10, requiredCoverage: 0.85 },
  { level: 9, shape: ShapeType.GHOST, stressGain: 6, precision: 8, requiredCoverage: 0.9 },
  { level: 10, shape: ShapeType.UMBRELLA, stressGain: 7, precision: 6, requiredCoverage: 0.95 },
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [stress, setStress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [totalTimeTaken, setTotalTimeTaken] = useState(0);
  const [feedback, setFeedback] = useState<string>('');
  const [introTip, setIntroTip] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [hallOfFame, setHallOfFame] = useState<RankingRecord[]>([]);
  const [playerName, setPlayerName] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  const pointsToCover = useRef<Point[]>([]);
  const coveredIndices = useRef<Set<number>>(new Set());
  const audioContext = useRef<AudioContext | null>(null);
  const timerInterval = useRef<number | null>(null);

  const currentLevelConfig = LEVEL_CONFIGS[currentLevel - 1];

  // Sound Utility
  const playSound = (freq: number, dur: number, type: OscillatorType = 'sawtooth') => {
    if (!audioContext.current) audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioContext.current.createOscillator();
    const gain = audioContext.current.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioContext.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioContext.current.currentTime + dur);
    gain.gain.setValueAtTime(0.05, audioContext.current.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioContext.current.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioContext.current.destination);
    osc.start();
    osc.stop(audioContext.current.currentTime + dur);
  };

  useEffect(() => {
    getIntroTip().then(setIntroTip);
    const saved = localStorage.getItem('dalgona_hof');
    if (saved) setHallOfFame(JSON.parse(saved));
  }, []);

  // Timer Logic
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      timerInterval.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleGameOver(false);
            return 0;
          }
          if (prev <= 3) playSound(200, 0.1, 'sine');
          return prev - 1;
        });
        setTotalTimeTaken(prev => prev + 1);
      }, 1000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
    }
    return () => { if (timerInterval.current) clearInterval(timerInterval.current); };
  }, [gameState]);

  const initShapeData = (shape: ShapeType) => {
    const points: Point[] = [];
    const cx = 200, cy = 200, sz = 120;
    const interpolate = (p1: Point, p2: Point, steps = 20) => {
      for (let i = 0; i <= steps; i++) points.push({ x: p1.x + (p2.x - p1.x) * (i / steps), y: p1.y + (p2.y - p1.y) * (i / steps) });
    };

    switch (shape) {
      case ShapeType.CIRCLE:
        for (let i = 0; i < 360; i += 2) {
          const r = (i * Math.PI) / 180;
          points.push({ x: cx + Math.cos(r) * sz, y: cy + Math.sin(r) * sz });
        }
        break;
      case ShapeType.TRIANGLE:
        const v1 = { x: cx, y: cy - sz }, v2 = { x: cx - sz, y: cy + sz }, v3 = { x: cx + sz, y: cy + sz };
        interpolate(v1, v2); interpolate(v2, v3); interpolate(v3, v1);
        break;
      case ShapeType.SQUARE:
        const s1 = { x: cx-sz, y: cy-sz }, s2 = { x: cx+sz, y: cy-sz }, s3 = { x: cx+sz, y: cy+sz }, s4 = { x: cx-sz, y: cy+sz };
        interpolate(s1, s2); interpolate(s2, s3); interpolate(s3, s4); interpolate(s4, s1);
        break;
      case ShapeType.STAR:
        const sp: Point[] = [];
        for (let i = 0; i < 10; i++) {
          const r = (i * 36 * Math.PI) / 180, rad = i % 2 === 0 ? sz : sz / 2.5;
          sp.push({ x: cx + Math.sin(r) * rad, y: cy - Math.cos(r) * rad });
        }
        for (let i = 0; i < 10; i++) interpolate(sp[i], sp[(i + 1) % 10], 12);
        break;
      case ShapeType.HEART:
        for (let t = 0; t < Math.PI * 2; t += 0.05) {
            const x = 16 * Math.pow(Math.sin(t), 3);
            const y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
            points.push({ x: cx + x * 8, y: cy + y * 8 });
        }
        break;
      case ShapeType.CLOUD:
        for (let i = 0; i < 360; i += 2) {
            const r = (i * Math.PI) / 180;
            const wobble = 15 * Math.sin(i * 0.1);
            points.push({ x: cx + Math.cos(r) * (sz + wobble), y: cy + Math.sin(r) * (sz + wobble) });
        }
        break;
      case ShapeType.BIRD:
        interpolate({x:cx-sz, y:cy}, {x:cx-sz+40, y:cy-20}, 10); // Beak
        interpolate({x:cx-sz+40, y:cy-20}, {x:cx, y:cy-sz}, 20); // Top
        interpolate({x:cx, y:cy-sz}, {x:cx+sz, y:cy}, 20); // Back
        interpolate({x:cx+sz, y:cy}, {x:cx, y:cy+sz}, 20); // Bottom
        interpolate({x:cx, y:cy+sz}, {x:cx-sz, y:cy}, 20); // Breast
        break;
      case ShapeType.BUTTERFLY:
        for (let t = -Math.PI; t < Math.PI; t += 0.05) {
            const r = Math.exp(Math.cos(t)) - 2 * Math.cos(4*t) + Math.pow(Math.sin(t/12), 5);
            points.push({ x: cx + Math.sin(t) * r * 40, y: cy - Math.cos(t) * r * 40 });
        }
        break;
      case ShapeType.GHOST:
        for (let i = 180; i <= 360; i += 2) {
            const r = (i * Math.PI) / 180;
            points.push({ x: cx + Math.cos(r) * sz, y: cy + Math.sin(r) * sz });
        }
        interpolate({x:cx-sz, y:cy}, {x:cx-sz, y:cy+sz}, 20);
        interpolate({x:cx+sz, y:cy}, {x:cx+sz, y:cy+sz}, 20);
        for(let x=cx-sz; x<=cx+sz; x+=5) {
            const y = cy + sz + Math.sin(x*0.1) * 15;
            points.push({x, y});
        }
        break;
      case ShapeType.UMBRELLA:
        for (let i = 180; i <= 360; i += 5) {
          const r = (i * Math.PI) / 180;
          points.push({ x: cx + Math.cos(r) * sz, y: cy + Math.sin(r) * sz });
        }
        const sw = (sz * 2) / 4;
        for (let i = 0; i < 4; i++) {
            const startX = cx + sz - (i * sw), endX = cx + sz - ((i+1) * sw);
            for(let j=0; j<=10; j++) {
                const step = j/10, x = startX + (endX - startX) * step;
                points.push({ x, y: cy + Math.sin(step * Math.PI) * 15 });
            }
        }
        interpolate({x:cx, y:cy}, {x:cx, y:cy+sz+20}, 15);
        interpolate({x:cx, y:cy+sz+20}, {x:cx-30, y:cy+sz+20}, 10);
        break;
    }
    return points;
  };

  const drawBase = useCallback((ctx: CanvasRenderingContext2D, shape: ShapeType) => {
    ctx.clearRect(0, 0, 400, 400);
    const grad = ctx.createRadialGradient(200, 200, 20, 200, 200, 180);
    grad.addColorStop(0, '#fde047'); grad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(200, 200, 180, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for(let i=0; i<400; i++) { ctx.beginPath(); ctx.arc(Math.random()*400, Math.random()*400, 1, 0, Math.PI*2); ctx.fill(); }

    const pts = initShapeData(shape);
    pointsToCover.current = pts;
    coveredIndices.current = new Set();
    
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }, []);

  const handleLevelStart = (level: number) => {
    setCurrentLevel(level);
    setGameState(GameState.PLAYING);
    setStress(0);
    setTimeLeft(10);
    setFeedback('');
    setTimeout(() => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawBase(ctx, LEVEL_CONFIGS[level - 1].shape);
    }, 50);
  };

  const checkCollision = (p: Point) => {
    if (gameState !== GameState.PLAYING) return;
    let hit = false;
    const precision = currentLevelConfig.precision;
    pointsToCover.current.forEach((t, i) => {
      const d = Math.sqrt((p.x-t.x)**2 + (p.y-t.y)**2);
      if (d < precision) { hit = true; coveredIndices.current.add(i); }
    });

    if (!hit) {
      setStress(prev => {
        const next = prev + currentLevelConfig.stressGain;
        if (next >= 100) handleGameOver(false);
        return next;
      });
      playSound(150, 0.05);
    } else {
      setStress(prev => Math.max(0, prev - 0.1));
      playSound(600 + coveredIndices.current.size, 0.02);
      if (coveredIndices.current.size / pointsToCover.current.length >= currentLevelConfig.requiredCoverage) {
        handleGameOver(true);
      }
    }
  };

  const handleGameOver = async (success: boolean) => {
    if (gameState !== GameState.PLAYING) return;
    setGameState(success ? (currentLevel === 10 ? GameState.VICTORY : GameState.SUCCESS) : GameState.FAILED);
    setIsLoading(true);
    const snap = canvasRef.current?.toDataURL();
    const msg = await getGameFeedback(success ? 'success' : 'failed', currentLevel, snap);
    setFeedback(msg);
    setIsLoading(false);
  };

  const saveRanking = () => {
    if (!playerName.trim()) return;
    const newRecord: RankingRecord = {
      name: playerName,
      level: currentLevel,
      totalTime: totalTimeTaken,
      date: new Date().toLocaleDateString()
    };
    const updated = [...hallOfFame, newRecord]
      .sort((a, b) => b.level - a.level || a.totalTime - b.totalTime)
      .slice(0, 10);
    setHallOfFame(updated);
    localStorage.setItem('dalgona_hof', JSON.stringify(updated));
    setGameState(GameState.START);
    setPlayerName('');
    setTotalTimeTaken(0);
    setCurrentLevel(1);
  };

  const getPos = (e: any): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) * (400 / rect.width), y: (cy - rect.top) * (400 / rect.height) };
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden">
      
      {/* Hall of Fame Background Element */}
      <div className="fixed top-0 left-0 w-full h-full opacity-5 pointer-events-none flex flex-wrap gap-10 p-10 justify-center">
        {Array.from({length:20}).map((_,i) => <div key={i} className="text-8xl font-black">달고나 게임</div>)}
      </div>

      {gameState === GameState.START && (
        <div className="z-10 w-full max-w-2xl flex flex-col items-center animate-in fade-in duration-1000">
          <h1 className="text-7xl font-black text-pink-600 tracking-tighter mb-2 italic">달고나 게임</h1>
          <div className="w-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl mb-8">
            <h2 className="text-center text-xs font-bold tracking-[0.4em] uppercase text-zinc-500 mb-4">Survivor Ranking Top 10</h2>
            <div className="space-y-2">
              {hallOfFame.length === 0 ? (
                <p className="text-center text-zinc-600 py-10 italic">기록이 없습니다. 첫 번째 생존자가 되십시오.</p>
              ) : (
                hallOfFame.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center space-x-4">
                      <span className="font-black text-pink-600 w-6">{i+1}</span>
                      <span className="font-bold">{r.name}</span>
                    </div>
                    <div className="flex space-x-6 text-sm font-mono">
                      <span className="text-green-500">LV.{r.level}</span>
                      <span className="text-zinc-400">{r.totalTime}s</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="text-center mb-8 italic text-zinc-400 max-w-md">"{introTip}"</div>
          
          <button 
            onClick={() => handleLevelStart(1)}
            className="px-16 py-5 bg-white text-zinc-950 text-xl font-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            게임 시작
          </button>
        </div>
      )}

      {gameState === GameState.PLAYING && (
        <div className="z-10 flex flex-col items-center w-full max-w-md">
          {/* Timer & Level UI */}
          <div className="w-full flex justify-between items-end mb-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Level</span>
              <span className="text-3xl font-black text-white italic">{currentLevel}<span className="text-sm text-zinc-600">/10</span></span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Time Left</span>
              <span className={`text-4xl font-mono font-black ${timeLeft <= 3 ? 'text-red-600 animate-pulse' : 'text-pink-600'}`}>{timeLeft}s</span>
            </div>
          </div>

          {/* Stress Bar */}
          <div className="w-full h-1 bg-zinc-900 rounded-full mb-6 overflow-hidden">
            <div className={`h-full transition-all duration-75 ${stress > 80 ? 'bg-red-600' : 'bg-pink-600'}`} style={{width: `${stress}%`}} />
          </div>

          <div className={`relative p-3 bg-zinc-900 rounded-[40px] shadow-2xl border-4 ${stress > 80 ? 'border-red-600/50 scale-105' : 'border-white/5'} transition-all`}>
            <canvas
              ref={canvasRef} width={400} height={400}
              className="rounded-[32px] cursor-crosshair touch-none bg-zinc-800"
              onMouseDown={(e)=>{isDrawing.current=true; lastPoint.current=getPos(e); checkCollision(getPos(e))}}
              onMouseMove={(e)=>{
                if(!isDrawing.current) return;
                const p = getPos(e); const ctx = canvasRef.current?.getContext('2d')!;
                ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=3; ctx.lineCap='round';
                ctx.beginPath(); ctx.moveTo(lastPoint.current!.x, lastPoint.current!.y); ctx.lineTo(p.x, p.y); ctx.stroke();
                checkCollision(p); lastPoint.current=p;
              }}
              onMouseUp={()=>isDrawing.current=false}
              onMouseLeave={()=>isDrawing.current=false}
              onTouchStart={(e)=>{isDrawing.current=true; lastPoint.current=getPos(e); checkCollision(getPos(e))}}
              onTouchMove={(e)=>{
                if(!isDrawing.current) return;
                const p = getPos(e); checkCollision(p); lastPoint.current=p;
              }}
              onTouchEnd={()=>isDrawing.current=false}
            />
          </div>
          <p className="mt-6 text-zinc-500 text-xs font-bold uppercase tracking-[0.5em]">{currentLevelConfig.shape}</p>
        </div>
      )}

      {(gameState === GameState.SUCCESS || gameState === GameState.FAILED || gameState === GameState.VICTORY) && (
        <div className="z-10 flex flex-col items-center text-center animate-in zoom-in duration-300 max-w-md">
          <div className={`text-8xl font-black mb-4 tracking-tighter italic ${gameState === GameState.FAILED ? 'text-red-700' : 'text-green-500'}`}>
            {gameState === GameState.FAILED ? 'ELIMINATED' : 'PASSED'}
          </div>
          <div className="p-8 bg-zinc-900/90 rounded-3xl border border-white/10 mb-8 min-h-[140px] flex flex-col items-center justify-center shadow-2xl">
            {isLoading ? <div className="animate-pulse text-pink-600 font-black">분석 중...</div> : <p className="text-lg text-zinc-300 italic">"{feedback}"</p>}
          </div>

          <div className="w-full space-y-4">
            {gameState === GameState.SUCCESS && (
              <button onClick={()=>handleLevelStart(currentLevel+1)} className="w-full py-5 bg-white text-zinc-950 text-xl font-black rounded-2xl uppercase italic">Next Level</button>
            )}
            {(gameState === GameState.FAILED || gameState === GameState.VICTORY) && (
              <div className="w-full flex flex-col space-y-4">
                <input 
                  type="text" value={playerName} onChange={e=>setPlayerName(e.target.value.slice(0,10))}
                  placeholder="당신의 이름을 입력하십시오"
                  className="w-full bg-zinc-800 border border-white/10 p-4 rounded-2xl text-center text-xl font-bold focus:outline-none focus:border-pink-600"
                />
                <button onClick={saveRanking} className="w-full py-5 bg-pink-600 text-white text-xl font-black rounded-2xl uppercase italic shadow-lg shadow-pink-600/20">명예의 전당 등록</button>
              </div>
            )}
            <button onClick={() => setGameState(GameState.START)} className="text-zinc-600 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">Main Menu</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
