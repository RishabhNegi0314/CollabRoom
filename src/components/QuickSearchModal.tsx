import React, { useState, useEffect, useRef } from "react";
import { ProjectFile } from "../types.js";
import { Search, CornerDownLeft, X, FileCode } from "lucide-react";

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: ProjectFile[];
  onFileSelect: (id: string) => void;
  getFileIcon: (name: string) => React.ReactNode;
}

export default function QuickSearchModal({
  isOpen,
  onClose,
  files,
  onFileSelect,
  getFileIcon
}: QuickSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter files based on case-insensitive query match
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(query.toLowerCase()) ||
    f.path.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    // Reset selection if query changes
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (filteredFiles.length > 0 ? (prev + 1) % filteredFiles.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (filteredFiles.length > 0 ? (prev - 1 + filteredFiles.length) % filteredFiles.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          onFileSelect(filteredFiles[selectedIndex].id);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredFiles, selectedIndex, onFileSelect, onClose]);

  if (!isOpen) return null;

  // Helper to highlight matched query in text
  const renderHighlightedName = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-indigo-500/30 text-indigo-200 rounded px-0.5 font-semibold">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 animate-fade-in" 
        onClick={onClose}
      />
      
      {/* Search box container */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-xl bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-10 transform scale-100 transition-all duration-200 animate-slide-down"
      >
        <div className="flex items-center gap-3 px-4 border-b border-zinc-800/80 py-3 bg-zinc-950/50">
          <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files by name or directory path... (ESC to close)"
            className="flex-1 bg-transparent border-0 outline-none text-sm text-white placeholder-zinc-500 focus:ring-0 focus:outline-none py-0.5 font-mono"
          />
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-md transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search Results */}
        <div className="max-h-[320px] overflow-y-auto p-2 space-y-0.5">
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={file.id}
                  onClick={() => {
                    onFileSelect(file.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition select-none ${
                    isSelected 
                      ? "bg-indigo-600/20 text-white border-l-2 border-indigo-500" 
                      : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200 border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="flex-shrink-0">{getFileIcon(file.name)}</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold font-mono text-zinc-100 truncate">
                        {renderHighlightedName(file.name, query)}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">
                        {renderHighlightedName(file.path, query)}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono flex-shrink-0">
                      <span>open</span>
                      <CornerDownLeft className="w-3 h-3 text-zinc-500" />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-zinc-500 text-xs font-mono">
              No matching files found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center px-4 py-2 border-t border-zinc-800/80 bg-zinc-950/30 text-[9px] font-mono text-zinc-500">
          <div className="flex gap-3">
            <span><b className="text-zinc-400">↑↓</b> Navigation</span>
            <span><b className="text-zinc-400">Enter</b> Open file</span>
          </div>
          <span>{filteredFiles.length} files found</span>
        </div>
      </div>
    </div>
  );
}
