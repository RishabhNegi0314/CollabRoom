import React, { useState, useRef, useCallback, useEffect } from "react";
import { CanvasElement } from "../types.js";
import {
  LayoutGrid, Palette, Trash2, Eye, Sparkles,
  Move, RefreshCw, Layers, Copy, ZoomIn, ZoomOut,
  AlignCenter, Square, Type, MousePointer2
} from "lucide-react";

interface MockupCanvasProps {
  elements: CanvasElement[];
  onElementUpdate: (id: string, updates: Partial<CanvasElement>) => void;
  onElementCreate: (type: CanvasElement["type"], customParams?: Partial<CanvasElement>) => void;
  onElementDelete: (id: string) => void;
}

// Utility: clamp a number between min and max
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

// Snap to 10px grid
const snap = (val: number) => Math.round(val / 10) * 10;

const ELEMENT_PRESETS: { label: string; type: CanvasElement["type"]; tag: string; tagColor: string }[] = [
  { label: "Navigation Bar", type: "navbar", tag: "Header", tagColor: "bg-indigo-950 text-indigo-400" },
  { label: "Content Card", type: "card", tag: "Box", tagColor: "bg-blue-950 text-blue-400" },
  { label: "Action Button", type: "button", tag: "Action", tagColor: "bg-emerald-950 text-emerald-400" },
  { label: "Form Input", type: "input", tag: "Form", tagColor: "bg-purple-950 text-purple-400" },
  { label: "Text Block", type: "text", tag: "Text", tagColor: "bg-amber-950 text-amber-400" },
  { label: "Header Title", type: "header", tag: "Title", tagColor: "bg-rose-950 text-rose-400" },
];

const COLOR_SWATCHES = [
  "#3b82f6", "#10b981", "#ef4444", "#a855f7",
  "#1e293b", "#0f172a", "#f59e0b", "#6366f1",
  "#06b6d4", "#ec4899", "#64748b", "#ffffff"
];

export default function MockupCanvas({
  elements,
  onElementUpdate,
  onElementCreate,
  onElementDelete
}: MockupCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // ─── RAF-based Drag System ──────────────────────────────────────────────────
  // We use refs (not state) for drag data so pointerMove never triggers a re-render.
  // The dragged element's DOM node is moved directly via its style property.
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
    rafId: number | null;
    domEl: HTMLElement | null;
  } | null>(null);

  // Map from element id → DOM element ref
  const elementDomRefs = useRef<Map<string, HTMLElement>>(new Map());

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      elementDomRefs.current.set(id, el);
    } else {
      elementDomRefs.current.delete(id);
    }
  }, []);

  // ─── AI Suggestions ─────────────────────────────────────────────────────────
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;

  const getAISuggestions = async () => {
    setIsSuggesting(true);
    setSuggestionError(null);
    try {
      const res = await fetch("/api/ai/suggest-element", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentElements: elements, taskContext: [] })
      });
      const data = await res.json();
      if (data.success) {
        setSuggestions(data.suggestions);
      } else {
        setSuggestionError(data.error || "Failed to generate suggestions.");
      }
    } catch (err: any) {
      setSuggestionError(`Error reaching Gemini AI: ${err.message}`);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleCreate = (type: CanvasElement["type"]) => {
    onElementCreate(type, {
      x: snap(60 + (elements.length * 20) % 260),
      y: snap(80 + (elements.length * 20) % 180),
    });
  };

  const handleAddSuggested = (sug: any) => {
    onElementCreate(sug.type, {
      text: sug.text,
      width: sug.width,
      height: sug.height,
      x: sug.x,
      y: sug.y,
      color: sug.color,
      bgColor: sug.bgColor,
      borderColor: sug.borderColor,
      borderRadius: sug.borderRadius
    });
    if (suggestions) {
      setSuggestions(suggestions.filter(s => s.title !== sug.title));
    }
  };

  // ─── Pointer Handlers ────────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent, el: CanvasElement) => {
    if (isPreviewMode) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(el.id);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    const domEl = elementDomRefs.current.get(el.id) ?? null;

    dragRef.current = {
      id: el.id,
      offsetX: startX - el.x,
      offsetY: startY - el.y,
      currentX: el.x,
      currentY: el.y,
      rafId: null,
      domEl
    };

    // Elevate dragged element visually
    if (domEl) {
      domEl.style.willChange = "transform";
      domEl.style.zIndex = "100";
      domEl.style.transition = "box-shadow 0.15s ease";
      domEl.style.boxShadow = "0 12px 40px rgba(99, 102, 241, 0.35), 0 4px 16px rgba(0,0,0,0.5)";
    }

    (e.target as Element).setPointerCapture(e.pointerId);
  }, [isPreviewMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Find element dimensions for boundary clamping
    const el = elements.find(e => e.id === drag.id);
    const elW = el?.width ?? 100;
    const elH = el?.height ?? 40;

    const newX = snap(clamp(mouseX - drag.offsetX, 0, rect.width - elW));
    const newY = snap(clamp(mouseY - drag.offsetY, 0, rect.height - elH));

    drag.currentX = newX;
    drag.currentY = newY;

    // Use RAF to update DOM — silky smooth, zero React re-renders
    if (drag.rafId !== null) {
      cancelAnimationFrame(drag.rafId);
    }
    drag.rafId = requestAnimationFrame(() => {
      if (drag.domEl) {
        drag.domEl.style.left = `${newX}px`;
        drag.domEl.style.top = `${newY}px`;
      }
      drag.rafId = null;
    });
  }, [elements]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    // Cancel any pending RAF
    if (drag.rafId !== null) {
      cancelAnimationFrame(drag.rafId);
    }

    // Restore DOM element styling
    if (drag.domEl) {
      drag.domEl.style.willChange = "";
      drag.domEl.style.zIndex = "";
      drag.domEl.style.boxShadow = "";
      drag.domEl.style.transition = "";
      // Sync final position to DOM immediately (no lag)
      drag.domEl.style.left = `${drag.currentX}px`;
      drag.domEl.style.top = `${drag.currentY}px`;
    }

    // Commit the final position to React state (and trigger network sync)
    onElementUpdate(drag.id, { x: drag.currentX, y: drag.currentY });

    (e.target as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }, [onElementUpdate]);

  // Deselect on canvas background click
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedId(null);
    }
  };

  // ─── Resize Handles ──────────────────────────────────────────────────────────
  const resizeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    direction: "se" | "sw" | "ne" | "nw";
    domEl: HTMLElement | null;
  } | null>(null);

  const handleResizePointerDown = (
    e: React.PointerEvent,
    el: CanvasElement,
    direction: "se" | "sw" | "ne" | "nw"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const domEl = elementDomRefs.current.get(el.id) ?? null;
    resizeRef.current = {
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      startW: el.width,
      startH: el.height,
      direction,
      domEl
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    const newW = snap(Math.max(60, r.startW + (r.direction.includes("e") ? dx : -dx)));
    const newH = snap(Math.max(30, r.startH + (r.direction.includes("s") ? dy : -dy)));
    if (r.domEl) {
      r.domEl.style.width = `${newW}px`;
      r.domEl.style.height = `${newH}px`;
    }
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    const newW = snap(Math.max(60, r.startW + (r.direction.includes("e") ? dx : -dx)));
    const newH = snap(Math.max(30, r.startH + (r.direction.includes("s") ? dy : -dy)));
    onElementUpdate(r.id, { width: newW, height: newH });
    (e.target as Element).releasePointerCapture(e.pointerId);
    resizeRef.current = null;
  };

  // ─── Unified canvas-level pointer events for both drag and resize ─────────────
  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (resizeRef.current) {
      handleResizePointerMove(e);
    } else {
      handlePointerMove(e);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent) => {
    if (resizeRef.current) {
      handleResizePointerUp(e);
    } else {
      handlePointerUp(e);
    }
  };

  return (
    <div
      id="visual-mockup-designer-section"
      className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-[#0a0a0a] p-5 rounded-2xl border border-zinc-800 shadow-xl"
      style={{ height: "640px" }}
    >

      {/* ─── Left Sidebar: Element Presets + AI ─────────────────────────────── */}
      <div className="lg:col-span-1 bg-black/30 rounded-2xl p-4 border border-zinc-800/80 flex flex-col gap-3 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/80">
          <LayoutGrid className="w-4 h-4 text-indigo-400 shrink-0" />
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">UI Elements</h3>
        </div>

        <p className="text-[10px] text-zinc-500 leading-relaxed">
          Click to add elements, then drag to position. Select to resize &amp; style.
        </p>

        {/* Presets */}
        <div className="space-y-1.5">
          {ELEMENT_PRESETS.map(({ label, type, tag, tagColor }) => (
            <button
              key={type}
              onClick={() => handleCreate(type)}
              className="w-full flex items-center justify-between px-3 py-2 bg-[#050505] hover:bg-zinc-900/60 text-zinc-300 rounded-xl border border-zinc-800 hover:border-zinc-700 text-xs font-semibold transition-all cursor-pointer group"
            >
              <span className="group-hover:text-white transition-colors">{label}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${tagColor}`}>{tag}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800/80 pt-2 space-y-2">
          {/* AI Suggestions */}
          <button
            onClick={getAISuggestions}
            disabled={isSuggesting}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSuggesting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isSuggesting ? "Analyzing..." : "AI Suggestions"}
          </button>

          {suggestions && suggestions.length > 0 && (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase block font-mono">
                Suggested ({suggestions.length}):
              </span>
              {suggestions.map((sug, idx) => (
                <div key={idx} className="bg-zinc-950 p-2.5 rounded-xl border border-indigo-900/30 space-y-1.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-zinc-200">{sug.title}</span>
                    <span className="text-[8px] uppercase px-1.5 bg-indigo-900/40 text-indigo-300 rounded font-bold">
                      {sug.type}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-500 leading-snug">{sug.description}</p>
                  <button
                    onClick={() => handleAddSuggested(sug)}
                    className="w-full py-1 text-center bg-indigo-600/20 hover:bg-indigo-600 hover:text-white text-indigo-400 rounded font-bold cursor-pointer transition-all text-[9px]"
                  >
                    + Add to Canvas
                  </button>
                </div>
              ))}
            </div>
          )}

          {suggestionError && (
            <p className="text-[9px] text-rose-400 font-mono italic leading-relaxed">{suggestionError}</p>
          )}
        </div>

        {/* Preview Toggle */}
        <div className="mt-auto pt-2 border-t border-zinc-800/80">
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold text-xs transition-all shadow cursor-pointer ${
              isPreviewMode
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
            }`}
          >
            <Eye className="w-4 h-4" />
            {isPreviewMode ? "Back to Edit" : "Preview UI"}
          </button>
        </div>
      </div>

      {/* ─── Center Canvas ────────────────────────────────────────────────────── */}
      <div className="lg:col-span-2 bg-black/30 rounded-2xl border border-zinc-800/80 flex flex-col overflow-hidden relative">
        {/* Canvas Toolbar */}
        <div className="px-4 py-2 bg-[#050505] border-b border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 font-mono shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-zinc-600">CANVAS</span>
            <span>{elements.length} element{elements.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 ${isPreviewMode ? "text-emerald-400" : "text-indigo-400"}`}>
              {isPreviewMode ? <Eye className="w-3 h-3" /> : <MousePointer2 className="w-3 h-3" />}
              {isPreviewMode ? "Preview" : "Drag & Drop"}
            </span>
            <span className="text-zinc-700">• Snap 10px</span>
          </div>
        </div>

        {/* Canvas Grid */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden select-none"
          style={{ cursor: isPreviewMode ? "default" : "crosshair" }}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onClick={handleCanvasClick}
        >
          {/* Dot-grid background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle, #3f3f46 1px, transparent 1px)",
              backgroundSize: "20px 20px"
            }}
          />

          {/* Elements */}
          {elements.map((el) => {
            const isSelected = el.id === selectedId && !isPreviewMode;
            return (
              <div
                key={el.id}
                ref={(node) => registerRef(el.id, node)}
                onPointerDown={(e) => handlePointerDown(e, el)}
                className={`absolute select-none touch-none overflow-hidden ${
                  isSelected
                    ? "cursor-grab active:cursor-grabbing"
                    : isPreviewMode
                    ? "cursor-default"
                    : "cursor-pointer hover:ring-1 hover:ring-indigo-500/40"
                }`}
                style={{
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  backgroundColor: el.bgColor,
                  color: el.color,
                  border: el.borderColor ? `1px solid ${el.borderColor}` : "none",
                  borderRadius: el.borderRadius,
                  fontSize: el.type === "navbar" ? "13px" : el.type === "header" ? "16px" : "11px",
                  fontWeight: el.type === "button" || el.type === "navbar" || el.type === "header" ? "700" : "500",
                  outline: isSelected ? "2px solid #6366f1" : "none",
                  outlineOffset: isSelected ? "2px" : "0",
                }}
              >
                {/* Content */}
                <div className="w-full h-full p-2 overflow-hidden flex items-center justify-center text-center font-sans whitespace-pre-line leading-normal pointer-events-none">
                  {el.type === "input" ? (
                    <span className="opacity-50">{el.text || "Type something..."}</span>
                  ) : (
                    el.text
                  )}
                </div>

                {/* Selected label */}
                {isSelected && (
                  <div className="absolute top-1 left-1 bg-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md shadow flex items-center gap-1 uppercase select-none pointer-events-none font-mono">
                    <Move className="w-2.5 h-2.5" /> {el.type}
                  </div>
                )}

                {/* Resize handle (SE corner) — only when selected */}
                {isSelected && (
                  <>
                    {(["se", "sw", "ne", "nw"] as const).map((dir) => (
                      <div
                        key={dir}
                        onPointerDown={(e) => handleResizePointerDown(e, el, dir)}
                        className={`absolute w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-sm z-50 pointer-events-auto ${
                          dir === "se" ? "bottom-0 right-0 cursor-se-resize" :
                          dir === "sw" ? "bottom-0 left-0 cursor-sw-resize" :
                          dir === "ne" ? "top-0 right-0 cursor-ne-resize" :
                          "top-0 left-0 cursor-nw-resize"
                        }`}
                        style={{ touchAction: "none" }}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {elements.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 text-xs font-mono space-y-2 pointer-events-none">
              <Layers className="w-10 h-10 text-zinc-800 animate-pulse" />
              <span className="text-zinc-600">Canvas is empty</span>
              <span className="text-[10px] text-zinc-700">Add elements from the left panel</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Right Panel: Property Inspector ─────────────────────────────────── */}
      <div className="lg:col-span-1 bg-black/30 rounded-2xl p-4 border border-zinc-800/80 flex flex-col gap-3 overflow-y-auto">
        {selectedElement ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
              <div>
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Properties</span>
                <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-indigo-950 text-indigo-400 rounded font-bold uppercase">
                  {selectedElement.type}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Duplicate button */}
                <button
                  onClick={() => {
                    onElementCreate(selectedElement.type, {
                      ...selectedElement,
                      x: selectedElement.x + 20,
                      y: selectedElement.y + 20
                    });
                  }}
                  className="p-1.5 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-950/40 rounded-lg transition-all cursor-pointer"
                  title="Duplicate"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {/* Delete button */}
                <button
                  onClick={() => {
                    onElementDelete(selectedElement.id);
                    setSelectedId(null);
                  }}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Text content */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1.5">
                <Type className="w-3 h-3 inline mr-1" />Text Content
              </label>
              <textarea
                value={selectedElement.text}
                onChange={(e) => onElementUpdate(selectedElement.id, { text: e.target.value })}
                rows={3}
                className="w-full bg-[#050505] border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 resize-none font-sans transition-colors"
              />
            </div>

            {/* Position display */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-900 text-center">
                <span className="text-[9px] text-zinc-600 block font-mono">X</span>
                <span className="text-xs text-indigo-400 font-bold font-mono">{selectedElement.x}px</span>
              </div>
              <div className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-900 text-center">
                <span className="text-[9px] text-zinc-600 block font-mono">Y</span>
                <span className="text-xs text-indigo-400 font-bold font-mono">{selectedElement.y}px</span>
              </div>
            </div>

            {/* Size inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">W (px)</label>
                <input
                  type="number"
                  value={selectedElement.width}
                  onChange={(e) => onElementUpdate(selectedElement.id, { width: Number(e.target.value) })}
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                  min={40}
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">H (px)</label>
                <input
                  type="number"
                  value={selectedElement.height}
                  onChange={(e) => onElementUpdate(selectedElement.id, { height: Number(e.target.value) })}
                  className="w-full bg-[#050505] border border-zinc-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                  min={24}
                />
              </div>
            </div>

            {/* Border radius */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1">Border Radius</label>
              <select
                value={selectedElement.borderRadius}
                onChange={(e) => onElementUpdate(selectedElement.id, { borderRadius: e.target.value })}
                className="w-full bg-[#050505] border border-zinc-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono cursor-pointer transition-colors"
              >
                <option value="0px">None (0px)</option>
                <option value="4px">Small (4px)</option>
                <option value="8px">Medium (8px)</option>
                <option value="12px">Large (12px)</option>
                <option value="0.375rem">Rounded (6px)</option>
                <option value="0.5rem">Rounded-lg (8px)</option>
                <option value="9999px">Pill (full)</option>
              </select>
            </div>

            {/* Background color */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1.5">Background</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLOR_SWATCHES.map((color) => (
                  <button
                    key={color}
                    onClick={() => onElementUpdate(selectedElement.id, { bgColor: color })}
                    className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer hover:scale-110 ${
                      selectedElement.bgColor === color ? "border-white scale-110 shadow-md" : "border-zinc-700"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Text color */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase font-mono mb-1.5">Text Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {["#ffffff", "#e4e4e7", "#94a3b8", "#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#000000"].map((color) => (
                  <button
                    key={color}
                    onClick={() => onElementUpdate(selectedElement.id, { color })}
                    className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer hover:scale-110 ${
                      selectedElement.color === color ? "border-white scale-110" : "border-zinc-700"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Element ID footer */}
            <div className="text-[9px] text-zinc-700 font-mono text-center pt-2 border-t border-zinc-900 mt-auto">
              ID: {selectedElement.id}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center px-4 space-y-3">
            <Palette className="w-9 h-9 text-zinc-800 animate-pulse" />
            <span className="text-xs font-bold text-zinc-400">Property Inspector</span>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Click any element on the canvas to inspect and customize its style, size, and content.
            </p>
            {elements.length > 0 && (
              <div className="mt-2 space-y-1 w-full">
                <p className="text-[9px] text-zinc-700 uppercase font-mono mb-2">Quick Select:</p>
                {elements.slice(0, 5).map(el => (
                  <button
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    className="w-full text-left px-2 py-1.5 bg-zinc-950/60 hover:bg-zinc-900 rounded-lg text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer border border-zinc-900 flex items-center gap-2"
                  >
                    <Square className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span className="truncate">{el.text?.split("\n")[0] || el.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
