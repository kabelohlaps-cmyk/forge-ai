"use client";

import { useEffect, useRef, useState } from "react";

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

interface PlacedPart {
  instanceId: string;
  partId: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
}

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  strokes: Stroke[];
  parts: PlacedPart[];
}

export interface SketchPart {
  id: string;
  label: string;
  category: string;
  url: string;
}

interface SketchCanvasProps {
  onSave: (dataUri: string) => void;
  onCancel?: () => void;
  guideOverlayUrl?: string | null;
  parts?: SketchPart[];
}

type DrawingState =
  | { mode: null }
  | { mode: "draw"; layerId: string; stroke: Stroke }
  | {
      mode: "drag";
      layerId: string;
      partInstanceId: string;
      startX: number;
      startY: number;
      partStartX: number;
      partStartY: number;
    };

interface LayerRenderCacheEntry {
  strokes: Stroke[];
  parts: PlacedPart[];
  canvas: HTMLCanvasElement;
  devW: number;
  devH: number;
}

const BRUSH_PRESETS = { small: 3, medium: 8, large: 16 } as const;
const COLORS = ["#1a1a1a", "#c0392b", "#2980b9", "#27ae60", "#f39c12"];
const MAX_UNDO = 50;
const SELECTION_COLOR = "#e8c468";

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function cloneLayers(layers: Layer[]): Layer[] {
  return layers.map((l) => ({
    ...l,
    strokes: l.strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })),
    parts: l.parts.map((p) => ({ ...p })),
  }));
}

function getPos(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.beginPath();
  const [first, ...rest] = stroke.points;
  ctx.moveTo(first.x, first.y);
  if (rest.length === 0) {
    ctx.lineTo(first.x + 0.01, first.y + 0.01);
  } else {
    for (const pt of rest) ctx.lineTo(pt.x, pt.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPart(
  ctx: CanvasRenderingContext2D,
  part: PlacedPart,
  imageCache: Map<string, HTMLImageElement>
) {
  const img = imageCache.get(part.url);
  if (!img) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.translate(part.x, part.y);
  ctx.rotate(part.rotation);
  const w = part.width * part.scale;
  const h = part.height * part.scale;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawSelectionOutline(ctx: CanvasRenderingContext2D, part: PlacedPart) {
  ctx.save();
  ctx.translate(part.x, part.y);
  ctx.rotate(part.rotation);
  const w = part.width * part.scale;
  const h = part.height * part.scale;
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
  ctx.restore();
}

function hitTestPart(part: PlacedPart, x: number, y: number): boolean {
  const dx = x - part.x;
  const dy = y - part.y;
  const cos = Math.cos(-part.rotation);
  const sin = Math.sin(-part.rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  const w = part.width * part.scale;
  const h = part.height * part.scale;
  return Math.abs(localX) <= w / 2 && Math.abs(localY) <= h / 2;
}

export default function SketchCanvas({
  onSave,
  onCancel,
  guideOverlayUrl,
  parts = [],
}: SketchCanvasProps) {
  const [layers, setLayers] = useState<Layer[]>(() => [
    { id: "layer-1", name: "Layer 1", visible: true, strokes: [], parts: [] },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>("layer-1");
  const [selectedPartInstanceId, setSelectedPartInstanceId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Layer[][]>([]);

  const [brushColor, setBrushColor] = useState<string>(COLORS[0]);
  const [brushSize, setBrushSize] = useState<number>(BRUSH_PRESETS.medium);
  const [erase, setErase] = useState(false);

  const [showGuide, setShowGuide] = useState(true);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [partsPanelOpen, setPartsPanelOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const layersRef = useRef<Layer[]>(layers);
  const selectedPartInstanceIdRef = useRef<string | null>(selectedPartInstanceId);
  const undoStackRef = useRef<Layer[][]>(undoStack);
  const suppressSelectionRef = useRef(false);

  const drawingRef = useRef<DrawingState>({ mode: null });

  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const layerCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const layerCacheRef = useRef<Map<string, LayerRenderCacheEntry>>(new Map());

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  useEffect(() => {
    selectedPartInstanceIdRef.current = selectedPartInstanceId;
  }, [selectedPartInstanceId]);
  useEffect(() => {
    undoStackRef.current = undoStack;
  }, [undoStack]);

  function loadImage(url: string) {
    if (imageCache.current.has(url)) return;
    const img = new Image();
    img.onload = () => {
      imageCache.current.set(url, img);
      drawAll();
    };
    img.onerror = () => {
      // eslint-disable-next-line no-console
      console.warn("SketchCanvas: failed to load part image", url);
    };
    img.src = url;
  }

  useEffect(() => {
    parts.forEach((p) => loadImage(p.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts]);

  function ensureLayerCanvas(id: string, devW: number, devH: number): HTMLCanvasElement {
    let lc = layerCanvasesRef.current.get(id);
    if (!lc) {
      lc = document.createElement("canvas");
      layerCanvasesRef.current.set(id, lc);
    }
    if (lc.width !== devW || lc.height !== devH) {
      lc.width = devW;
      lc.height = devH;
    }
    return lc;
  }

  function renderLayerCanvas(layer: Layer, dpr: number, devW: number, devH: number): HTMLCanvasElement {
    const state = drawingRef.current;
    const isActiveTarget =
      (state.mode === "draw" || state.mode === "drag") &&
      (state as { layerId?: string }).layerId === layer.id;
    const cache = layerCacheRef.current.get(layer.id);
    if (
      !isActiveTarget &&
      cache &&
      cache.strokes === layer.strokes &&
      cache.parts === layer.parts &&
      cache.devW === devW &&
      cache.devH === devH
    ) {
      return cache.canvas;
    }

    const lc = ensureLayerCanvas(layer.id, devW, devH);
    const lctx = lc.getContext("2d");
    if (!lctx) return lc;
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, devW, devH);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (const stroke of layer.strokes) drawStroke(lctx, stroke);
    if (state.mode === "draw" && state.layerId === layer.id) {
      drawStroke(lctx, state.stroke);
    }
    for (const part of layer.parts) drawPart(lctx, part, imageCache.current);

    layerCacheRef.current.set(layer.id, {
      strokes: layer.strokes,
      parts: layer.parts,
      canvas: lc,
      devW,
      devH,
    });
    return lc;
  }

  function drawAll() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const devW = canvas.width;
    const devH = canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, devW, devH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, devW, devH);

    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      const lc = renderLayerCanvas(layer, dpr, devW, devH);
      ctx.drawImage(lc, 0, 0);
    }

    if (!suppressSelectionRef.current && selectedPartInstanceIdRef.current) {
      let found: PlacedPart | null = null;
      for (const l of layersRef.current) {
        const p = l.parts.find((pp) => pp.instanceId === selectedPartInstanceIdRef.current);
        if (p) {
          found = p;
          break;
        }
      }
      if (found) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawSelectionOutline(ctx, found);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
  }

  useEffect(() => {
    drawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, selectedPartInstanceId]);

  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      drawAll();
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushUndoSnapshot() {
    setUndoStack((prev) => {
      const snap = cloneLayers(layersRef.current);
      const next = prev.length >= MAX_UNDO ? [...prev.slice(1), snap] : [...prev, snap];
      return next;
    });
  }

  function handleUndo() {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const snap = stack[stack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setLayers(snap);
    setSelectedPartInstanceId(null);
    drawingRef.current = { mode: null };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const pos = getPos(e, canvas);
    const layer = layersRef.current.find((l) => l.id === activeLayerId);
    if (!layer) return;

    for (let i = layer.parts.length - 1; i >= 0; i--) {
      const part = layer.parts[i];
      if (hitTestPart(part, pos.x, pos.y)) {
        pushUndoSnapshot();
        setSelectedPartInstanceId(part.instanceId);
        drawingRef.current = {
          mode: "drag",
          layerId: layer.id,
          partInstanceId: part.instanceId,
          startX: pos.x,
          startY: pos.y,
          partStartX: part.x,
          partStartY: part.y,
        };
        return;
      }
    }

    setSelectedPartInstanceId(null);
    pushUndoSnapshot();
    const stroke: Stroke = { points: [pos], color: brushColor, size: brushSize, erase };
    drawingRef.current = { mode: "draw", layerId: layer.id, stroke };
    drawAll();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = drawingRef.current;
    if (state.mode === "draw") {
      e.preventDefault();
      const pos = getPos(e, canvas);
      state.stroke.points.push(pos);
      drawAll();
    } else if (state.mode === "drag") {
      e.preventDefault();
      const pos = getPos(e, canvas);
      const dx = pos.x - state.startX;
      const dy = pos.y - state.startY;
      const layer = layersRef.current.find((l) => l.id === state.layerId);
      const part = layer?.parts.find((p) => p.instanceId === state.partInstanceId);
      if (part) {
        part.x = state.partStartX + dx;
        part.y = state.partStartY + dy;
        drawAll();
      }
    }
  }

  function finishPointer() {
    const state = drawingRef.current;
    if (state.mode === "draw") {
      const { layerId, stroke } = state;
      if (stroke.points.length > 0) {
        setLayers((prev) =>
          prev.map((l) => (l.id === layerId ? { ...l, strokes: [...l.strokes, stroke] } : l))
        );
      }
    } else if (state.mode === "drag") {
      setLayers(() => cloneLayers(layersRef.current));
    }
    drawingRef.current = { mode: null };
  }

  function transformSelectedPart(mutate: (p: PlacedPart) => PlacedPart) {
    if (!selectedPartInstanceId) return;
    pushUndoSnapshot();
    setLayers((prev) =>
      prev.map((l) => {
        if (!l.parts.some((p) => p.instanceId === selectedPartInstanceId)) return l;
        return {
          ...l,
          parts: l.parts.map((p) => (p.instanceId === selectedPartInstanceId ? mutate(p) : p)),
        };
      })
    );
  }
  function scaleUpSelected() {
    transformSelectedPart((p) => ({ ...p, scale: Math.min(4, +(p.scale * 1.15).toFixed(3)) }));
  }
  function scaleDownSelected() {
    transformSelectedPart((p) => ({ ...p, scale: Math.max(0.15, +(p.scale / 1.15).toFixed(3)) }));
  }
  function rotateSelectedLeft() {
    transformSelectedPart((p) => ({ ...p, rotation: p.rotation - Math.PI / 12 }));
  }
  function rotateSelectedRight() {
    transformSelectedPart((p) => ({ ...p, rotation: p.rotation + Math.PI / 12 }));
  }
  function deleteSelectedPart() {
    if (!selectedPartInstanceId) return;
    pushUndoSnapshot();
    setLayers((prev) =>
      prev.map((l) => {
        if (!l.parts.some((p) => p.instanceId === selectedPartInstanceId)) return l;
        return { ...l, parts: l.parts.filter((p) => p.instanceId !== selectedPartInstanceId) };
      })
    );
    setSelectedPartInstanceId(null);
  }

  function placePart(part: SketchPart) {
    pushUndoSnapshot();
    const img = imageCache.current.get(part.url);
    let width = 120;
    let height = 120;
    if (img && img.naturalWidth && img.naturalHeight) {
      const maxDim = 140;
      const ar = img.naturalWidth / img.naturalHeight;
      if (ar >= 1) {
        width = maxDim;
        height = maxDim / ar;
      } else {
        height = maxDim;
        width = maxDim * ar;
      }
    } else {
      loadImage(part.url);
    }
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.clientWidth / 2 : 150;
    const cy = canvas ? canvas.clientHeight / 2 : 150;
    const newPart: PlacedPart = {
      instanceId: genId("part"),
      partId: part.id,
      url: part.url,
      x: cx,
      y: cy,
      width,
      height,
      scale: 1,
      rotation: 0,
    };
    setLayers((prev) =>
      prev.map((l) => (l.id === activeLayerId ? { ...l, parts: [...l.parts, newPart] } : l))
    );
    setSelectedPartInstanceId(newPart.instanceId);
  }

  function addLayer() {
    pushUndoSnapshot();
    const id = genId("layer");
    setLayers((prev) => [
      ...prev,
      { id, name: `Layer ${prev.length + 1}`, visible: true, strokes: [], parts: [] },
    ]);
    setActiveLayerId(id);
  }

  function deleteLayer(id: string) {
    cons
