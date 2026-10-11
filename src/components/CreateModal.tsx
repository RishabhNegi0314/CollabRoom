import React, { useState, useEffect, useRef } from "react";
import { X, Folder, FilePlus, Edit3 } from "lucide-react";

interface CreateModalProps {
  isOpen: boolean;
  type: "file" | "folder";
  parentPath: string; // The folder path in which it's being created
  existingNames: string[]; // List of existing sibling names to check for duplicates
  onClose: () => void;
  onSubmit: (name: string, parentPath: string) => void;
  renameOriginalName?: string; // If provided, modal operates in Rename mode
}

export default function CreateModal({
  isOpen,
  type,
  parentPath,
  existingNames,
  onClose,
  onSubmit,
  renameOriginalName
}: CreateModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRename = !!renameOriginalName;

  useEffect(() => {
    if (isOpen) {
      setName(renameOriginalName || "");
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        if (renameOriginalName && inputRef.current) {
          // Select file name without extension for nice UX, like VS Code!
          const dotIndex = renameOriginalName.lastIndexOf(".");
          if (dotIndex > 0 && type === "file") {
            inputRef.current.setSelectionRange(0, dotIndex);
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, renameOriginalName, type]);

  const validate = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setError(`${type === "file" ? "File" : "Folder"} name cannot be empty.`);
      return false;
    }

    // Skip duplicate check if the name didn't change in rename mode
    if (isRename && trimmed.toLowerCase() === renameOriginalName.toLowerCase()) {
      setError(null);
      return true;
    }

    if (existingNames.map(n => n.toLowerCase()).includes(trimmed.toLowerCase())) {
      setError(`A ${type} with this name already exists in this folder.`);
      return false;
    }

    if (type === "file" && trimmed.includes("/")) {
      setError(`File names cannot contain slashes.`);
      return false;
    }

    setError(null);
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (error) {
      // Clear error as user types or validate on the fly
      validate(val);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (validate(trimmed)) {
      onSubmit(trimmed, parentPath);
      onClose();
    }
  };

  // Close on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-200 animate-fade-in" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div 
        className="relative w-full max-w-sm bg-[#09090b] border border-zinc-850 rounded-2xl shadow-2xl overflow-hidden z-10 transform scale-100 transition-all duration-200 animate-fade-scale"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900 bg-zinc-950/20">
          <div className="flex items-center gap-2">
            {isRename ? (
              <Edit3 className="w-4 h-4 text-indigo-400" />
            ) : type === "folder" ? (
              <Folder className="w-4 h-4 text-indigo-400" />
            ) : (
              <FilePlus className="w-4 h-4 text-indigo-400" />
            )}
            <h3 className="text-sm font-bold text-zinc-200">
              {isRename ? "Rename" : "Create"} {type === "file" ? "File" : "Folder"}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
          {parentPath && !isRename && (
            <div className="text-[10px] font-mono text-zinc-500 bg-zinc-950/40 border border-zinc-900 rounded-lg px-2.5 py-1.5 truncate">
              <span className="text-zinc-600">Location:</span> {parentPath}/
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
              {isRename ? "New Name" : type === "file" ? "File Name" : "Folder Name"}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={handleChange}
              placeholder={type === "file" ? "e.g. app.py, style.css" : "e.g. components, routes"}
              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 font-mono transition-colors"
            />
          </div>

          {/* Inline Validation Error Message */}
          {error && (
            <div className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg font-mono">
              ⚠️ {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2.5 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer shadow-md shadow-indigo-600/10"
            >
              {isRename ? "Rename" : `Create ${type === "file" ? "File" : "Folder"}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
