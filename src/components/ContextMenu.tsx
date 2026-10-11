import React, { useEffect, useRef } from "react";
import { 
  FilePlus, FolderPlus, Edit3, Trash2, Copy, 
  Eye, FolderMinus, FolderOpen, ArrowRightLeft 
} from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  type: "file" | "folder";
  targetId?: string; // For files: fileId. For folders: folder path.
  targetPath: string; // File path or folder path
  onClose: () => void;
  onRename: (path: string, isFile: boolean) => void;
  onDelete: (path: string, isFile: boolean, id?: string) => void;
  onDuplicate?: (id: string) => void;
  onNewFile?: (parentPath: string) => void;
  onNewFolder?: (parentPath: string) => void;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  onRevealInFolder?: (filePath: string) => void;
}

export default function ContextMenu({
  x,
  y,
  type,
  targetId,
  targetPath,
  onClose,
  onRename,
  onDelete,
  onDuplicate,
  onNewFile,
  onNewFolder,
  onCollapseAll,
  onExpandAll,
  onRevealInFolder
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Adjust positioning to stay within viewport bounds
  const adjustedX = Math.min(x, window.innerWidth - 190);
  const adjustedY = Math.min(y, window.innerHeight - 250);

  return (
    <div
      ref={menuRef}
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
      }}
      className="fixed z-[100] w-44 bg-[#0a0a0c]/95 backdrop-blur-md border border-zinc-850 rounded-xl shadow-2xl p-1.5 flex flex-col space-y-0.5 text-xs text-zinc-300 select-none animate-fade-scale"
    >
      <div className="px-2.5 py-1 text-[10px] text-zinc-500 font-semibold uppercase truncate tracking-wider font-mono border-b border-zinc-850 mb-1">
        {type === "file" ? "File Actions" : "Folder Actions"}
      </div>

      {type === "folder" ? (
        <>
          <button
            onClick={() => {
              onNewFile?.(targetPath);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white rounded-lg transition text-left cursor-pointer font-medium"
          >
            <FilePlus className="w-3.5 h-3.5 text-indigo-400" />
            New File
          </button>
          <button
            onClick={() => {
              onNewFolder?.(targetPath);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white rounded-lg transition text-left cursor-pointer font-medium"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
            New Folder
          </button>
          <button
            onClick={() => {
              onRename(targetPath, false);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white rounded-lg transition text-left cursor-pointer font-medium"
          >
            <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
            Rename
          </button>
          <button
            onClick={() => {
              onDelete(targetPath, false);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-600 hover:text-white rounded-lg transition text-left text-rose-400 cursor-pointer font-medium"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500 group-hover:text-white" />
            Delete
          </button>

          <div className="border-t border-zinc-850 my-1"></div>

          <button
            onClick={() => {
              onCollapseAll?.();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-white rounded-lg transition text-left cursor-pointer text-zinc-400"
          >
            <FolderMinus className="w-3.5 h-3.5" />
            Collapse All
          </button>
          <button
            onClick={() => {
              onExpandAll?.();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 hover:text-white rounded-lg transition text-left cursor-pointer text-zinc-400"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Expand All
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => {
              onRename(targetPath, true);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white rounded-lg transition text-left cursor-pointer font-medium"
          >
            <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
            Rename
          </button>
          <button
            onClick={() => {
              if (targetId && onDuplicate) onDuplicate(targetId);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white rounded-lg transition text-left cursor-pointer font-medium"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
            Duplicate
          </button>
          <button
            onClick={() => {
              if (onRevealInFolder) onRevealInFolder(targetPath);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white rounded-lg transition text-left cursor-pointer text-zinc-450"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-400" />
            Reveal in Folder
          </button>
          <button
            onClick={() => {
              onDelete(targetPath, true, targetId);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-600 hover:text-white rounded-lg transition text-left text-rose-400 cursor-pointer font-medium"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500 group-hover:text-white" />
            Delete
          </button>
        </>
      )}
    </div>
  );
}
