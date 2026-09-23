"use client";

import { useRef, useEffect, useState, useCallback } from "react";

const BRUSH_SIZES = { small: 3, medium: 8, large: 16 } as const;
type BrushSize = keyof typeof BRUSH_SIZES;

const COLORS = ["#1a1a1a", "#c0392b", "#2980b9", "#27ae60", "#f39c12"];

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  size: number;
  erase: boolean;
}

interface SketchCanvasProps {
  onSave: (dataUri: string) => void;
  onCancel?: () => void;
  guideOverlayUrl?: string | null;
}

export default function SketchCanvas({ onSave, onCancel, guideOverlayUrl }: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const drawingRef = useRef(false);

  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState<BrushSize>("medium");
  const [erasing, setErasing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [canUndo, setCanUndo] = useState(false);

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke);
    }
  }, []);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = stroke.erase ? "#ffffff" : stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = getCtx();
      if (ctx) ctx.scale(dpr, dpr);
      redrawAll();
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const stroke: Stroke = {
      points: [getPoint(e)],
      color,
      size: BRUSH_SIZES[brushSize],
      erase: erasing,
    };
    currentStrokeRef.current = stroke;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const point = getPoint(e);
    const stroke = currentStrokeRef.current;
    const prev = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = stroke.erase ? "#ffffff" : stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const finishStroke = () => {
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      strokesRef.current.push(currentStrokeRef.current);
      setCanUndo(true);
    }
    currentStrokeRef.current = null;
    drawingRef.current = false;
  };

  const handleUndo = () => {
    strokesRef.current.pop();
    setCanUndo(strokesRef.current.length > 0);
    redrawAll();
  };

  const handleClear = () => {
    if (strokesRef.current.length === 0) return;
    if (window.confirm("Clear the whole drawing? This can't be undone.")) {
      strokesRef.current = [];
      setCanUndo(false);
      redrawAll();
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div className="eden-panel flex flex-col gap-3 p-3">
      <div className="relative w-full" style={{ aspectRatio: "4 / 5" }} ref={containerRef}>
        {guideOverlayUrl && showGuide && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={guideOverlayUrl}
            alt="Drawing guide"
            className="absolute inset-0 h-full w-full object-contain opacity-40 pointer-events-none select-none"
            draggable={false}
          />
        )}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none rounded-md bg-white"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
          onPointerCancel={finishStroke}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              setErasing(false);
            }}
            className="h-7 w-7 rounded-full border-2"
            style={{
              backgroundColor: c,
              borderColor: !erasing && color === c ? "#d4af37" : "transparent",
            }}
            aria-label={`Color ${c}`}
          />
        ))}

        <button
          onClick={() => setErasing((v) => !v)}
          className={`eden-btn px-3 py-1 text-sm ${erasing ? "text-eden-gold-light" : ""}`}
        >
          Eraser
        </button>

        <div className="flex items-center gap-1">
          {(Object.keys(BRUSH_SIZES) as BrushSize[]).map((s) => (
            <button
              key={s}
              onClick={() => setBrushSize(s)}
              className={`eden-btn px-2 py-1 text-xs ${brushSize === s ? "text-eden-gold-light" : ""}`}
            >
              {s[0].toUpperCase()}
            </button>
          ))}
        </div>

        {guideOverlayUrl && (
          <button
            onClick={() => setShowGuide((v) => !v)}
            className={`eden-btn px-3 py-1 text-sm ${showGuide ? "text-eden-gold-light" : ""}`}
          >
            Guide
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button onClick={handleUndo} disabled={!canUndo} className="eden-btn px-3 py-1 text-sm disabled:opacity-40">
            Undo
          </button>
          <button onClick={handleClear} className="eden-btn px-3 py-1 text-sm">
            Clear
          </button>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button onClick={onCancel} className="eden-btn px-3 py-1 text-sm">
              Cancel
            </button>
          )}
          <button onClick={handleSave} className="eden-btn px-4 py-1 text-sm text-eden-gold-light">
            Use This Sketch
          </button>
        </div>
      </div>
    </div>
  );
}
