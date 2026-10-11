import React, { useState, useEffect, useRef, useMemo } from "react";
import { ProjectFile, CollabUser, FileLock } from "../types.js";
import { CollaborationClient } from "../lib/collaboration.ts";
import { 
  Play, Sparkles, AlertCircle, FileCode, Trash2, Plus, 
  Terminal, RefreshCw, Eye, Code, Layers, FileJson, Check,
  ChevronDown, ChevronRight, Folder, FolderOpen, Maximize2, Minimize2,
  Search, X, Edit3, Copy, EyeOff, List, AlignLeft, Keyboard, HelpCircle,
  Menu, PanelLeftClose, PanelLeft, FileText, Settings, Coffee, Binary,
  Zap, Bot, Wand2, RotateCcw, RotateCw
} from "lucide-react";

import FileIcon, { FolderIcon } from "./FileIcon.tsx";
import QuickSearchModal from "./QuickSearchModal.tsx";
import ContextMenu from "./ContextMenu.tsx";
import CreateModal from "./CreateModal.tsx";
import { CodeSuggestion, getCodeSuggestions, QUICK_PRE_PROMPTS } from "../lib/snippets.ts";

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  fileId?: string;
  children: Record<string, TreeNode>;
}

// Helper to calculate exact character index coordinates inside a standard <textarea>
function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
  // Create a mirror element
  const div = document.createElement("div");
  const style = window.getComputedStyle(element);

  for (const prop of Array.from(style)) {
    div.style.setProperty(prop, style.getPropertyValue(prop));
  }

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordBreak = "break-all";
  div.style.overflow = "hidden";
  div.style.width = element.clientWidth + "px";
  div.style.height = element.clientHeight + "px";

  const content = element.value || "";
  const before = content.substring(0, Math.min(position, content.length));
  const after = content.substring(Math.min(position, content.length));

  const textNodeBefore = document.createTextNode(before);
  const textNodeAfter = document.createTextNode(after);
  const span = document.createElement("span");
  span.textContent = "|";

  div.appendChild(textNodeBefore);
  div.appendChild(span);
  div.appendChild(textNodeAfter);

  document.body.appendChild(div);

  // Subtract scroll positions of textarea to make it line up exactly
  const x = span.offsetLeft - element.scrollLeft;
  const y = span.offsetTop - element.scrollTop;

  document.body.removeChild(div);

  return { x, y };
}

interface EditorWorkspaceProps {
  files: ProjectFile[];
  users: CollabUser[];
  activeFileId: string | null;
  onFileSelect: (id: string) => void;
  onFileUpdate: (id: string, content: string) => void;
  onFileCreate: (name: string, language: string) => void;
  onFileDelete: (id: string) => void;
  onRefreshState?: () => void;
  collabClient?: CollaborationClient;
  fileLocks?: FileLock[];
}

export default function EditorWorkspace({
  files,
  users,
  activeFileId,
  onFileSelect,
  onFileUpdate,
  onFileCreate,
  onFileDelete,
  onRefreshState,
  collabClient,
  fileLocks = []
}: EditorWorkspaceProps) {
  // --- Sidebar & Explorer States ---
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});
  
  // Custom virtual folders (to support empty directories like VS Code)
  const [virtualFolders, setVirtualFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("virtual_folders_list");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("virtual_folders_list", JSON.stringify(virtualFolders));
      }
    } catch {
      // Ignore sandbox iframe storage restrictions
    }
  }, [virtualFolders]);

  // Expand all initially
  useEffect(() => {
    if (files.length > 0 && Object.keys(collapsedPaths).length === 0) {
      const initialCollapsed: Record<string, boolean> = {};
      files.forEach(f => {
        const parts = f.path.split("/");
        if (parts.length > 1) {
          // Keep root folders expanded, subfolders collapsed or expanded
          initialCollapsed[parts[0]] = false;
        }
      });
      setCollapsedPaths(initialCollapsed);
    }
  }, [files]);

  // --- Header Creation Menu State ---
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // Close creation menu on click outside
  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, []);

  // --- Modals (Create Folder / Create File / Rename) States ---
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<"file" | "folder">("file");
  const [createModalParentPath, setCreateModalParentPath] = useState("");
  const [renameOriginalName, setRenameOriginalName] = useState<string | undefined>(undefined);
  const [renameTargetPath, setRenameTargetPath] = useState("");

  // --- Context Menu State ---
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "file" | "folder";
    targetId?: string;
    targetPath: string;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, type: "file" | "folder", targetPath: string, targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      targetId,
      targetPath
    });
  };

  // --- Ctrl+P Quick Search Modal ---
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);

  // --- Drag and Drop States ---
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  // --- Tabs States ---
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  // Initialize tabs when files change
  useEffect(() => {
    if (files.length > 0) {
      if (openFileIds.length === 0) {
        if (activeFileId) {
          setOpenFileIds([activeFileId]);
        } else {
          setOpenFileIds([files[0].id]);
        }
      } else {
        // Remove closed files from open tabs
        const validIds = openFileIds.filter(id => files.some(f => f.id === id));
        if (validIds.length !== openFileIds.length) {
          setOpenFileIds(validIds);
        }
      }
    }
  }, [files, activeFileId]);

  // Open file helper
  const openFile = (id: string) => {
    if (!openFileIds.includes(id)) {
      setOpenFileIds(prev => [...prev, id]);
    }
    onFileSelect(id);
  };

  const closeTab = (idToClose: string) => {
    const isClosingActive = activeFileId === idToClose;
    const remainingTabs = openFileIds.filter(id => id !== idToClose);
    
    setOpenFileIds(remainingTabs);

    if (isClosingActive && remainingTabs.length > 0) {
      // Open the last tab
      onFileSelect(remainingTabs[remainingTabs.length - 1]);
    } else if (remainingTabs.length === 0 && files.length > 0) {
      // Back to default file
      onFileSelect(files[0].id);
    }
  };

  // --- Keyboard Shortcuts (Ctrl+P, Ctrl+W, Ctrl+Tab, Escape) ---
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Ctrl+P / Cmd+P - Quick File Search
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setQuickSearchOpen(true);
      }

      // Alt+W or Ctrl+W - Close Tab (Alt+W is safer because browsers intercept Ctrl+W)
      if ((e.altKey && e.key?.toLowerCase() === "w") || (e.ctrlKey && e.key === "w" && activeFileId)) {
        if (activeFileId && openFileIds.includes(activeFileId)) {
          e.preventDefault();
          closeTab(activeFileId);
        }
      }

      // Ctrl+Tab - Switch Tab
      if (e.ctrlKey && e.key === "Tab" && openFileIds.length > 1) {
        e.preventDefault();
        const currentIndex = openFileIds.indexOf(activeFileId || "");
        const nextIndex = (currentIndex + 1) % openFileIds.length;
        onFileSelect(openFileIds[nextIndex]);
      }

      // Escape - Exit Focus Mode
      if (e.key === "Escape") {
        setFocusMode("normal");
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [activeFileId, openFileIds]);

  // --- Folder Management Helpers ---
  const getAllFolders = (): string[] => {
    const foldersSet = new Set<string>();
    
    // 1. Scan folders from current file paths
    files.forEach(f => {
      const parts = f.path.split('/').filter(Boolean);
      for (let i = 1; i < parts.length; i++) {
        foldersSet.add(parts.slice(0, i).join('/'));
      }
    });

    // 2. Add empty virtual folders
    virtualFolders.forEach(vf => foldersSet.add(vf));

    return Array.from(foldersSet).sort();
  };

  const getSiblingNames = (parentPath: string, type: "file" | "folder"): string[] => {
    if (type === "folder") {
      const folders = getAllFolders();
      return folders
        .filter(f => {
          const parent = f.substring(0, f.lastIndexOf("/")) || "";
          return parent === parentPath;
        })
        .map(f => f.split("/").pop() || "");
    } else {
      return files
        .filter(f => {
          const parent = f.path.substring(0, f.path.lastIndexOf("/")) || "";
          return parent === parentPath;
        })
        .map(f => f.name);
    }
  };

  // --- Collaborative editor states & synced typing input ---
  const [localContent, setLocalContent] = useState("");
  const [wordWrap, setWordWrap] = useState(true);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [matchedBracketLine, setMatchedBracketLine] = useState<number | null>(null);

  // Professional IDE states and refs to eliminate cursor jumps and lag
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const lastSavedContentRef = useRef("");
  const lastLocalEditTimeRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevActiveFileIdRef = useRef<string | null>(null);
  const fileStatesRef = useRef<Record<string, {
    cursorStart: number;
    cursorEnd: number;
    scrollTop: number;
  }>>({});

  const compilerAbortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // --- Undo / Redo History Stack (Ctrl+Z / Ctrl+Y) ---
  interface HistorySnapshot {
    content: string;
    cursor: number;
  }
  const undoStackRef = useRef<HistorySnapshot[]>([]);
  const redoStackRef = useRef<HistorySnapshot[]>([]);
  const isUndoRedoRef = useRef<boolean>(false);
  const suggestionDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to display suggestions and automatically remove them after 2 seconds
  const setSuggestionsWithAutoDismiss = (newSuggestions: CodeSuggestion[]) => {
    if (suggestionDismissTimerRef.current) {
      clearTimeout(suggestionDismissTimerRef.current);
      suggestionDismissTimerRef.current = null;
    }
    setSuggestions(newSuggestions);
    if (newSuggestions.length > 0) {
      suggestionDismissTimerRef.current = setTimeout(() => {
        setSuggestions([]);
      }, 2000);
    }
  };

  const clearSuggestionsImmediate = () => {
    if (suggestionDismissTimerRef.current) {
      clearTimeout(suggestionDismissTimerRef.current);
      suggestionDismissTimerRef.current = null;
    }
    setSuggestions([]);
  };

  // Helper to update local content, set dirty state, and debounce autosave
  const updateLocalContent = (newValue: string, recordUndo = true, cursorPosition?: number) => {
    // Record previous state in undo stack for Ctrl+Z
    if (recordUndo && !isUndoRedoRef.current && localContent !== newValue) {
      const pos = cursorPosition ?? textareaRef.current?.selectionStart ?? 0;
      undoStackRef.current.push({ content: localContent, cursor: pos });
      if (undoStackRef.current.length > 100) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
    }

    setLocalContent(newValue);
    isDirtyRef.current = true;
    setIsDirty(true);
    lastLocalEditTimeRef.current = Date.now();

    // Broadcast typing status to active room
    if (collabClient && activeFile) {
      collabClient.emitTyping(true, activeFile.id);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (collabClient && activeFile) {
          collabClient.emitTyping(false, activeFile.id);
        }
      }, 1500);
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (activeFile) {
        onFileUpdate(activeFile.id, newValue);
        lastSavedContentRef.current = newValue;
        isDirtyRef.current = false;
        setIsDirty(false);
      }
    }, 1000);
  };

  // Perform Undo (Ctrl+Z / Cmd+Z)
  const handleUndo = () => {
    if (undoStackRef.current.length === 0) return;
    const curPos = textareaRef.current?.selectionStart ?? 0;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push({ content: localContent, cursor: curPos });

    isUndoRedoRef.current = true;
    updateLocalContent(prev.content, false);
    isUndoRedoRef.current = false;

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(prev.cursor, prev.cursor);
      }
    }, 0);
  };

  // Perform Redo (Ctrl+Y / Cmd+Y / Ctrl+Shift+Z)
  const handleRedo = () => {
    if (redoStackRef.current.length === 0) return;
    const curPos = textareaRef.current?.selectionStart ?? 0;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push({ content: localContent, cursor: curPos });

    isUndoRedoRef.current = true;
    updateLocalContent(next.content, false);
    isUndoRedoRef.current = false;

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(next.cursor, next.cursor);
      }
    }, 0);
  };

  // Helper to immediately flush any unsaved changes to the server
  const flushSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (activeFile && isDirtyRef.current) {
      onFileUpdate(activeFile.id, localContent);
      lastSavedContentRef.current = localContent;
      isDirtyRef.current = false;
      setIsDirty(false);
    }
  };

  // --- Intelligent Code Suggestions & Autocomplete State ---
  const [suggestions, setSuggestions] = useState<CodeSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [suggestionPosition, setSuggestionPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [prefixStartIndex, setPrefixStartIndex] = useState(0);
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const [aiCopilotEnabled, setAiCopilotEnabled] = useState(true);
  const [compilerDuration, setCompilerDuration] = useState<number | null>(null);
  const [stdinInput, setStdinInput] = useState("");
  const [isStdinOpen, setIsStdinOpen] = useState(false);
  const aiSuggestDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Automatically dismiss code suggestions after exactly 2 seconds of inactivity
  useEffect(() => {
    if (suggestions.length > 0) {
      if (suggestionDismissTimerRef.current) {
        clearTimeout(suggestionDismissTimerRef.current);
      }
      suggestionDismissTimerRef.current = setTimeout(() => {
        setSuggestions([]);
      }, 2000);
    }
    return () => {
      if (suggestionDismissTimerRef.current) {
        clearTimeout(suggestionDismissTimerRef.current);
        suggestionDismissTimerRef.current = null;
      }
    };
  }, [suggestions]);

  // Global window listener for Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleGlobalUndoRedo = (e: KeyboardEvent) => {
      // Ignore if user is inside a separate text input (e.g. search / rename modal)
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "INPUT") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleGlobalUndoRedo);
    return () => window.removeEventListener("keydown", handleGlobalUndoRedo);
  }, [localContent]);

  // Apply a selected code suggestion / snippet into editor
  const applySuggestion = (sug: CodeSuggestion) => {
    if (!textareaRef.current) return;
    const tx = textareaRef.current;
    const currentVal = tx.value;
    const beforePrefix = currentVal.substring(0, prefixStartIndex);
    const afterCursor = currentVal.substring(tx.selectionStart);

    // Clean snippet placeholders like ${1:default} -> default
    const cleanInsert = sug.insertText.replace(/\$\{\d+:([^}]+)\}/g, "$1").replace(/\$\{\d+\}/g, "");

    const newVal = beforePrefix + cleanInsert + afterCursor;
    updateLocalContent(newVal);
    clearSuggestionsImmediate();

    const newCursorPos = prefixStartIndex + cleanInsert.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Insert a quick pre-prompt boilerplate snippet from the toolbar
  const insertPrePrompt = (snippetText: string) => {
    if (!textareaRef.current) return;
    const tx = textareaRef.current;
    const start = tx.selectionStart;
    const end = tx.selectionEnd;
    const currentVal = tx.value;

    const cleanInsert = snippetText.replace(/\$\{\d+:([^}]+)\}/g, "$1").replace(/\$\{\d+\}/g, "");

    const textBefore = currentVal.substring(0, start);
    const textAfter = currentVal.substring(end);
    const needsNewline = textBefore.length > 0 && !textBefore.endsWith("\n");
    const prefix = needsNewline ? "\n" : "";

    const newVal = textBefore + prefix + cleanInsert + textAfter;
    updateLocalContent(newVal);

    const targetPos = start + prefix.length + cleanInsert.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(targetPos, targetPos);
      }
    }, 0);
  };

  // Trigger Gemini AI code completion at current cursor location
  const triggerAICompletion = async () => {
    if (!textareaRef.current || !activeFile) return;
    const tx = textareaRef.current;
    const pos = tx.selectionStart;
    const val = tx.value;
    const textBefore = val.substring(0, pos);
    const lastLine = textBefore.split("\n").pop() || "";
    const wordMatch = textBefore.match(/[a-zA-Z0-9_$]+$/);
    const prefix = wordMatch ? wordMatch[0] : "";
    const prefixStart = wordMatch ? pos - prefix.length : pos;

    setIsAISuggesting(true);
    try {
      const res = await fetch("/api/ai/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: val,
          language: activeFile.language,
          line: lastLine,
          prefix,
          surroundingCode: val.substring(Math.max(0, pos - 600), Math.min(val.length, pos + 200))
        })
      });
      const data = await res.json();
      if (data.success && data.completion) {
        const aiSug: CodeSuggestion = {
          label: data.completion.split("\n")[0].slice(0, 45) + (data.completion.includes("\n") ? "..." : ""),
          insertText: data.completion,
          detail: `✨ AI Copilot (${activeFile.language})`,
          kind: "ai",
          doc: "Smart completion generated by Gemini AI"
        };
        const coords = getCaretCoordinates(tx, pos);
        setSuggestionPosition(coords);
        setPrefixStartIndex(prefixStart);
        setCurrentPrefix(prefix);
        setSuggestions(prev => [aiSug, ...prev.filter(s => s.kind !== "ai")]);
        setSelectedSuggestionIndex(0);
      }
    } catch (err) {
      console.warn("AI Autocomplete error:", err);
    } finally {
      setIsAISuggesting(false);
    }
  };

  // Save on component unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // --- Real-time Peer Collaboration States ---
  const [peerCursors, setPeerCursors] = useState<Record<string, {
    userId: string;
    username: string;
    color: string;
    cursorIndex: number;
    fileId: string | null;
  }>>({});

  const [renderedCursors, setRenderedCursors] = useState<Array<{
    socketId: string;
    userId: string;
    username: string;
    color: string;
    x: number;
    y: number;
  }>>([]);

  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const typingTimeoutRef = useRef<any>(null);

  // Recalculate physical cursor coordinates inside textarea
  const recalculateCursors = () => {
    const tx = textareaRef.current;
    if (!tx || !activeFile) return;

    const newList = Object.entries(peerCursors)
      .filter(([_, pc]: [string, any]) => pc.fileId === activeFile.id)
      .map(([socketId, pc]: [string, any]) => {
        try {
          const coords = getCaretCoordinates(tx, pc.cursorIndex);
          return {
            socketId,
            userId: pc.userId,
            username: pc.username,
            color: pc.color,
            x: coords.x,
            y: coords.y,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as any[];

    setRenderedCursors(newList);
  };

  useEffect(() => {
    recalculateCursors();
  }, [peerCursors, localContent, activeFileId]);

  // Synchronize peer updates from the real-time collaboration channel
  useEffect(() => {
    if (!collabClient || !activeFile) return;

    // Register active file selection upon mount/file change
    collabClient.openFile(activeFile.id);

    // Also acquire soft lock for active file
    collabClient.acquireLock(activeFile.id);

    // Track when other users update cursor / selection / typing
    const originalListeners = (collabClient as any).listeners;

    const customListeners = {
      ...originalListeners,
      onCursorUpdated: (data: any) => {
        setPeerCursors((prev) => ({
          ...prev,
          [data.socketId]: {
            userId: data.userId,
            username: data.username,
            color: data.color,
            cursorIndex: data.cursorIndex,
            fileId: data.fileId
          }
        }));
        originalListeners?.onCursorUpdated?.(data);
      },
      onUserTyping: (data: any) => {
        if (data.fileId === activeFile.id && data.userId !== "user-rishabh") {
          setTypingUsers((prev) => ({
            ...prev,
            [data.userId]: data.isTyping
          }));
        }
        originalListeners?.onUserTyping?.(data);
      }
    };

    // Temporarily register custom listeners
    (collabClient as any).listeners = customListeners;

    return () => {
      // Revert/cleanup
      if (collabClient) {
        collabClient.releaseLock(activeFile.id);
        (collabClient as any).listeners = originalListeners;
      }
    };
  }, [collabClient, activeFileId, activeFile?.id]);

  // Restore cursor and scroll position for a file
  const restoreFileState = (fileId: string) => {
    const tx = textareaRef.current;
    if (tx) {
      const saved = fileStatesRef.current[fileId];
      if (saved) {
        requestAnimationFrame(() => {
          tx.focus();
          tx.setSelectionRange(saved.cursorStart, saved.cursorEnd);
          tx.scrollTop = saved.scrollTop;
          if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = saved.scrollTop;
          }
        });
      } else {
        requestAnimationFrame(() => {
          tx.focus();
          tx.setSelectionRange(0, 0);
          tx.scrollTop = 0;
          if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = 0;
          }
        });
      }
    }
  };

  // Synchronize on active file changes (restoring cursor and scroll state cleanly)
  useEffect(() => {
    if (activeFile) {
      const currentActiveId = activeFile.id;

      // 1. Save old file state and flush unsaved changes
      if (prevActiveFileIdRef.current && prevActiveFileIdRef.current !== currentActiveId) {
        const oldId = prevActiveFileIdRef.current;
        const tx = textareaRef.current;
        if (tx) {
          fileStatesRef.current[oldId] = {
            cursorStart: tx.selectionStart,
            cursorEnd: tx.selectionEnd,
            scrollTop: tx.scrollTop
          };
        }

        if (isDirtyRef.current && lastSavedContentRef.current !== localContent) {
          onFileUpdate(oldId, localContent);
        }
      }

      // 2. Load new active file content
      setLocalContent(activeFile.content);
      lastSavedContentRef.current = activeFile.content;
      isDirtyRef.current = false;
      setIsDirty(false);
      setActiveLineIndex(0);
      setMatchedBracketLine(null);

      // Restore position
      restoreFileState(currentActiveId);

      // Update the tracker
      prevActiveFileIdRef.current = currentActiveId;
    }
  }, [activeFileId]);

  // Synchronize with background / polling updates without overriding active typing
  useEffect(() => {
    if (activeFile && activeFile.id === activeFileId) {
      const isFocused = document.activeElement === textareaRef.current;
      const isRecentlyEdited = Date.now() - lastLocalEditTimeRef.current < 5000;

      // Skip overwriting if the user is currently typing
      if (isDirtyRef.current || (isFocused && isRecentlyEdited)) {
        return;
      }

      // Smooth background update for clean/idle editor
      if (activeFile.content !== localContent) {
        const tx = textareaRef.current;
        const start = tx ? tx.selectionStart : null;
        const end = tx ? tx.selectionEnd : null;

        setLocalContent(activeFile.content);
        lastSavedContentRef.current = activeFile.content;

        if (tx && start !== null && end !== null) {
          requestAnimationFrame(() => {
            tx.setSelectionRange(start, end);
          });
        }
      }
    }
  }, [activeFile?.content, activeFileId]);

  // Synchronize Scroll
  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    recalculateCursors();
  };

  // Select/Caret index tracker for active line rendering and bracket matching
  const handleEditorSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const tx = e.currentTarget;
    const start = tx.selectionStart;
    const val = tx.value;

    // Emit local cursor & selection to socket room
    if (collabClient && activeFile) {
      collabClient.updateCursor(start, activeFile.id);
      if (tx.selectionStart !== tx.selectionEnd) {
        collabClient.updateSelection({ start: tx.selectionStart, end: tx.selectionEnd }, activeFile.id);
      } else {
        collabClient.updateSelection(null, activeFile.id);
      }
    }

    // Track active line number
    const textBeforeCursor = val.substring(0, start);
    const lineNum = textBeforeCursor.split("\n").length - 1;
    setActiveLineIndex(lineNum);

    // Dynamic bracket matching helper
    const char = val[start - 1] || "";
    const openBrackets = ["{", "[", "("];
    const closeBrackets = ["}", "]", ")"];
    
    if (openBrackets.includes(char) || closeBrackets.includes(char)) {
      // Find partner
      const partner: Record<string, string> = {
        "{": "}", "[": "]", "(": ")",
        "}": "{", "]": "[", ")": "("
      };
      const matchChar = partner[char];
      const searchForward = openBrackets.includes(char);
      
      let balance = 1;
      let matchedIndex = -1;

      if (searchForward) {
        for (let i = start; i < val.length; i++) {
          if (val[i] === char) balance++;
          else if (val[i] === matchChar) balance--;
          
          if (balance === 0) {
            matchedIndex = i;
            break;
          }
        }
      } else {
        for (let i = start - 2; i >= 0; i--) {
          if (val[i] === char) balance++;
          else if (val[i] === matchChar) balance--;
          
          if (balance === 0) {
            matchedIndex = i;
            break;
          }
        }
      }

      if (matchedIndex !== -1) {
        const line = val.substring(0, matchedIndex).split("\n").length - 1;
        setMatchedBracketLine(line);
      } else {
        setMatchedBracketLine(null);
      }
    } else {
      setMatchedBracketLine(null);
    }
  };

  // Interactive typing mechanics (Auto closing brackets/quotes & auto indent)
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const tx = e.currentTarget;
    const start = tx.selectionStart;
    const end = tx.selectionEnd;
    const val = tx.value;

    // Support Ctrl+Space or Cmd+Space for AI Autocomplete
    if ((e.ctrlKey || e.metaKey) && e.key === " ") {
      e.preventDefault();
      triggerAICompletion();
      return;
    }

    // Handle suggestion menu navigation when visible
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        applySuggestion(suggestions[selectedSuggestionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestions([]);
        return;
      }
    }

    // Support Ctrl+S / Cmd+S for immediate save
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      flushSave();
      return;
    }

    // Support Ctrl+Z / Cmd+Z (Undo) and Ctrl+Y / Cmd+Y / Ctrl+Shift+Z (Redo)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      handleRedo();
      return;
    }

    // 1. Indent & Outdent tabs (Tab key)
    if (e.key === "Tab") {
      e.preventDefault();
      if (start !== end) {
        // Multiline indentation block
        const textBefore = val.substring(0, start);
        const textAfter = val.substring(end);
        const selectedText = val.substring(start, end);
        const lines = selectedText.split("\n");
        
        let newLines = [];
        if (e.shiftKey) {
          // Outdent
          newLines = lines.map(line => line.startsWith("  ") ? line.substring(2) : line.startsWith(" ") ? line.substring(1) : line);
        } else {
          // Indent
          newLines = lines.map(line => "  " + line);
        }

        const newSelectedText = newLines.join("\n");
        const newValue = textBefore + newSelectedText + textAfter;
        updateLocalContent(newValue);

        setTimeout(() => {
          tx.setSelectionRange(start, start + newSelectedText.length);
        }, 0);
      } else {
        // Single line indent
        const indent = "  ";
        const newValue = val.substring(0, start) + indent + val.substring(end);
        updateLocalContent(newValue);
        setTimeout(() => {
          tx.setSelectionRange(start + indent.length, start + indent.length);
        }, 0);
      }
      return;
    }

    // 2. Auto closing bracket insertion
    const openChars = ["{", "[", "(", "\"", "'", "`"];
    const closeChars = ["}", "]", ")", "\"", "'", "`"];
    const pairs: Record<string, string> = {
      "{": "}", "[": "]", "(": ")",
      "\"": "\"", "'": "'", "`": "`"
    };

    if (openChars.includes(e.key)) {
      e.preventDefault();
      const openChar = e.key;
      const closeChar = pairs[openChar];

      if (start !== end) {
        // Wrap selection
        const selectionText = val.substring(start, end);
        const wrapped = openChar + selectionText + closeChar;
        const newValue = val.substring(0, start) + wrapped + val.substring(end);
        updateLocalContent(newValue);
        setTimeout(() => {
          tx.setSelectionRange(start + 1, end + 1);
        }, 0);
      } else {
        // Standard insertion
        const newValue = val.substring(0, start) + openChar + closeChar + val.substring(end);
        updateLocalContent(newValue);
        setTimeout(() => {
          tx.setSelectionRange(start + 1, start + 1);
        }, 0);
      }
      return;
    }

    // Overwrite closing character
    if (closeChars.includes(e.key) && start === end && val[start] === e.key) {
      e.preventDefault();
      tx.setSelectionRange(start + 1, start + 1);
      return;
    }

    // Backspacing empty matching pair deletes both
    if (e.key === "Backspace" && start === end && start > 0) {
      const prev = val[start - 1];
      const next = val[start];
      if (pairs[prev] === next) {
        e.preventDefault();
        const newValue = val.substring(0, start - 1) + val.substring(start + 1);
        updateLocalContent(newValue);
        setTimeout(() => {
          tx.setSelectionRange(start - 1, start - 1);
        }, 0);
        return;
      }
    }

    // 3. Auto indent newline on Enter
    if (e.key === "Enter") {
      e.preventDefault();
      const textBeforeCursor = val.substring(0, start);
      const linesBefore = textBeforeCursor.split("\n");
      const currentLine = linesBefore[linesBefore.length - 1];

      const match = currentLine.match(/^(\s*)/);
      let indent = match ? match[1] : "";

      const lastChar = currentLine.trim().slice(-1);
      let extraIndent = "";
      if (["{", "[", "("].includes(lastChar)) {
        extraIndent = "  ";
      }

      const insertion = "\n" + indent + extraIndent;
      const newValue = val.substring(0, start) + insertion + val.substring(end);
      updateLocalContent(newValue);

      setTimeout(() => {
        const cur = start + insertion.length;
        tx.setSelectionRange(cur, cur);
        if (lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = tx.scrollTop;
        }
      }, 0);
      return;
    }
  };

  const handleLocalContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    updateLocalContent(value);

    // Extract current word prefix at caret
    const tx = e.target;
    const pos = tx.selectionStart;
    const textBefore = value.substring(0, pos);
    const wordMatch = textBefore.match(/[a-zA-Z0-9_$]+$/);

    if (wordMatch && activeFile) {
      const prefix = wordMatch[0];
      const start = pos - prefix.length;
      setCurrentPrefix(prefix);
      setPrefixStartIndex(start);

      // Instant zero-latency local suggestions and pre-prompts for half-typed code
      const list = getCodeSuggestions(prefix, activeFile.language, value);
      if (list.length > 0) {
        const coords = getCaretCoordinates(tx, pos);
        setSuggestionPosition(coords);
        setSuggestionsWithAutoDismiss(list);
        setSelectedSuggestionIndex(0);
      } else {
        clearSuggestionsImmediate();
      }

      // Safe trigger only when explicit AI comment prefixes are typed (e.g. "// ai:" or "/* ai:")
      if (aiCopilotEnabled && (textBefore.endsWith("// ai:") || textBefore.endsWith("/* ai:"))) {
        if (aiSuggestDebounceRef.current) clearTimeout(aiSuggestDebounceRef.current);
        aiSuggestDebounceRef.current = setTimeout(() => {
          triggerAICompletion();
        }, 600);
      }
    } else {
      setSuggestions([]);
      setCurrentPrefix("");
    }
  };

  // --- Tree Generation (Files & Folders) ---
  const buildTree = (filesList: ProjectFile[]): TreeNode => {
    const root: TreeNode = {
      name: "root",
      path: "",
      isFile: false,
      children: {}
    };

    // Add folder structures
    const folderList = getAllFolders();
    folderList.forEach(folderPath => {
      const parts = folderPath.split("/").filter(Boolean);
      let current = root;
      let acc = "";
      parts.forEach(part => {
        acc = acc ? `${acc}/${part}` : part;
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: acc,
            isFile: false,
            children: {}
          };
        }
        current = current.children[part];
      });
    });

    // Populate file list nodes
    filesList.forEach(file => {
      const filePath = file.path || file.name;
      const parts = filePath.split("/").filter(Boolean);
      let current = root;
      let acc = "";
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        acc = acc ? `${acc}/${part}` : part;
        const isLast = i === parts.length - 1;

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: acc,
            isFile: isLast,
            fileId: isLast ? file.id : undefined,
            children: {}
          };
        } else if (isLast) {
          current.children[part].isFile = true;
          current.children[part].fileId = file.id;
        }
        current = current.children[part];
      }
    });

    return root;
  };

  // --- Recursive Search Filter ---
  const filterTree = (node: TreeNode, query: string): TreeNode | null => {
    if (!query.trim()) return node;
    const lq = query.toLowerCase();

    if (node.isFile) {
      if (node.name.toLowerCase().includes(lq) || node.path.toLowerCase().includes(lq)) {
        return node;
      }
      return null;
    }

    const filteredChildren: Record<string, TreeNode> = {};
    let childMatched = false;

    Object.keys(node.children).forEach(key => {
      const result = filterTree(node.children[key], query);
      if (result) {
        filteredChildren[key] = result;
        childMatched = true;
      }
    });

    const selfMatched = node.name.toLowerCase().includes(lq) || node.path.toLowerCase().includes(lq);

    if (childMatched || selfMatched) {
      return {
        ...node,
        children: filteredChildren
      };
    }

    return null;
  };

  // Automatically expand matched folders during typing search
  useEffect(() => {
    if (workspaceSearchQuery.trim()) {
      const q = workspaceSearchQuery.toLowerCase();
      const expansions: Record<string, boolean> = {};

      files.forEach(f => {
        if (f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) {
          const parts = f.path.split("/");
          let acc = "";
          for (let i = 0; i < parts.length - 1; i++) {
            acc = acc ? `${acc}/${parts[i]}` : parts[i];
            expansions[acc] = false; // setting value false maps to "expanded" (since we map collapsedPaths[path] = true for collapsed)
          }
        }
      });

      setCollapsedPaths(prev => {
        const next = { ...prev };
        Object.keys(expansions).forEach(k => {
          next[k] = false; // force expand
        });
        return next;
      });
    }
  }, [workspaceSearchQuery, files]);

  // --- Folder Right Click Action Trigger Helpers ---
  const handleFolderRenameSubmit = async (newName: string, oldPath: string) => {
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/")) || "";
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    try {
      const res = await fetch("/api/files/rename-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldFolderPath: oldPath, newFolderPath: newPath })
      });
      if (res.ok) {
        // Also update virtualFolders list if it contains this path
        setVirtualFolders(prev => 
          prev.map(p => {
            if (p === oldPath) return newPath;
            if (p.startsWith(oldPath + "/")) return newPath + p.substring(oldPath.length);
            return p;
          })
        );
        onRefreshState?.();
      }
    } catch (err) {
      console.error("Error renaming folder path on backend", err);
    }
  };

  const handleFileRenameSubmit = async (newName: string, oldPath: string) => {
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/")) || "";
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    const fileToRename = files.find(f => f.path === oldPath);
    if (!fileToRename) return;

    // Detect language
    let detectedLang = fileToRename.language;
    const ext = newName.split('.').pop()?.toLowerCase();
    if (ext === "java") detectedLang = "java";
    else if (ext === "html" || ext === "htm") detectedLang = "html";
    else if (ext === "css") detectedLang = "css";
    else if (ext === "js") detectedLang = "javascript";
    else if (ext === "py") detectedLang = "python";
    else if (ext === "ts" || ext === "tsx") detectedLang = "typescript";

    try {
      const res = await fetch("/api/files/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileToRename.id, name: newName, path: newPath, language: detectedLang })
      });
      if (res.ok) {
        onRefreshState?.();
      }
    } catch (err) {
      console.error("Error renaming file path", err);
    }
  };

  const handleNewFolderSubmit = (folderName: string, parentPath: string) => {
    const newPath = parentPath ? `${parentPath}/${folderName}` : folderName;
    if (!virtualFolders.includes(newPath)) {
      setVirtualFolders(prev => [...prev, newPath]);
    }
    // Expand parent path
    if (parentPath) {
      setCollapsedPaths(prev => ({ ...prev, [parentPath]: false }));
    }
  };

  const handleNewFileSubmit = (fileName: string, parentPath: string) => {
    const newPath = parentPath ? `${parentPath}/${fileName}` : fileName;
    
    // Auto detect language
    let detectedLang = "javascript";
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === "java") detectedLang = "java";
    else if (ext === "html" || ext === "htm") detectedLang = "html";
    else if (ext === "css") detectedLang = "css";
    else if (ext === "js") detectedLang = "javascript";
    else if (ext === "py") detectedLang = "python";
    else if (ext === "ts" || ext === "tsx") detectedLang = "typescript";

    onFileCreate(newPath, detectedLang);
    // Expand parent path
    if (parentPath) {
      setCollapsedPaths(prev => ({ ...prev, [parentPath]: false }));
    }
  };

  const handleFileDuplicate = async (fileId: string) => {
    const original = files.find(f => f.id === fileId);
    if (!original) return;

    const parentPath = original.path.substring(0, original.path.lastIndexOf("/")) || "";
    const ext = original.path.split('.').pop();
    const baseName = original.name.substring(0, original.name.lastIndexOf("."));
    
    let duplicateName = `${baseName} - Copy.${ext}`;
    let duplicatePath = parentPath ? `${parentPath}/${duplicateName}` : duplicateName;

    // Check sibling collisions
    let counter = 1;
    while (files.some(f => f.path === duplicatePath)) {
      duplicateName = `${baseName} - Copy (${counter}).${ext}`;
      duplicatePath = parentPath ? `${parentPath}/${duplicateName}` : duplicateName;
      counter++;
    }

    try {
      const res = await fetch("/api/files/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileId, newName: duplicateName, newPath: duplicatePath })
      });
      if (res.ok) {
        onRefreshState?.();
      }
    } catch (err) {
      console.error("Error duplicating file", err);
    }
  };

  const handleFolderDelete = async (folderPath: string) => {
    if (!confirm(`Are you sure you want to delete folder "${folderPath}" and all its contents?`)) {
      return;
    }

    try {
      const res = await fetch("/api/files/delete-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath })
      });
      if (res.ok) {
        // Also remove virtual folders matching this path prefix
        setVirtualFolders(prev => prev.filter(p => p !== folderPath && !p.startsWith(folderPath + "/")));
        onRefreshState?.();
      }
    } catch (err) {
      console.error("Error deleting folder on backend:", err);
    }
  };

  // --- Drag & Drop Operations ---
  const handleDragStart = (e: React.DragEvent, type: "file" | "folder", path: string, id?: string) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type, path, id }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    if (dragOverPath !== folderPath) {
      setDragOverPath(folderPath);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    setDragOverPath(null);

    try {
      const dragDataStr = e.dataTransfer.getData("application/json");
      if (!dragDataStr) return;

      const dragData = JSON.parse(dragDataStr) as { type: "file" | "folder"; path: string; id?: string };
      const sourcePath = dragData.path;

      // Prevent dropping item into itself or same folder
      if (sourcePath === targetFolderPath) return;
      if (targetFolderPath.startsWith(sourcePath + "/")) return;

      const parts = sourcePath.split("/");
      const itemName = parts[parts.length - 1];
      const destinationPath = targetFolderPath ? `${targetFolderPath}/${itemName}` : itemName;

      if (dragData.type === "file") {
        if (!dragData.id) return;
        // Move single file
        const res = await fetch("/api/files/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: dragData.id, path: destinationPath })
        });
        if (res.ok) {
          onRefreshState?.();
        }
      } else {
        // Move folder
        const res = await fetch("/api/files/rename-folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldFolderPath: sourcePath, newFolderPath: destinationPath })
        });
        if (res.ok) {
          // Update virtual folders local state
          setVirtualFolders(prev => 
            prev.map(p => {
              if (p === sourcePath) return destinationPath;
              if (p.startsWith(sourcePath + "/")) return destinationPath + p.substring(sourcePath.length);
              return p;
            })
          );
          onRefreshState?.();
        }
      }
    } catch (err) {
      console.error("Error performing file drag drop update", err);
    }
  };

  // --- Keyboard Tree Navigation state ---
  const [focusedPath, setFocusedPath] = useState<string | null>(null);

  const getVisibleNodes = (node: TreeNode, visibleList: TreeNode[] = []): TreeNode[] => {
    const keys = Object.keys(node.children).sort((a, b) => {
      const aN = node.children[a];
      const bN = node.children[b];
      if (aN.isFile !== bN.isFile) return aN.isFile ? 1 : -1;
      return a.localeCompare(b);
    });

    keys.forEach(k => {
      const child = node.children[k];
      visibleList.push(child);
      const isCollapsed = collapsedPaths[child.path];
      if (!child.isFile && !isCollapsed) {
        getVisibleNodes(child, visibleList);
      }
    });

    return visibleList;
  };

  // Listen to keyboard navigation over tree nodes
  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    const visibleNodes = getVisibleNodes(buildTree(files));
    if (visibleNodes.length === 0) return;

    const currentIndex = visibleNodes.findIndex(node => node.path === focusedPath);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextNode = visibleNodes[(currentIndex + 1) % visibleNodes.length];
      if (nextNode) setFocusedPath(nextNode.path);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevNode = visibleNodes[(currentIndex - 1 + visibleNodes.length) % visibleNodes.length];
      if (prevNode) setFocusedPath(prevNode.path);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (focusedPath) {
        const node = visibleNodes.find(n => n.path === focusedPath);
        if (node && !node.isFile) {
          if (collapsedPaths[focusedPath]) {
            // Expand
            setCollapsedPaths(prev => ({ ...prev, [focusedPath]: false }));
          } else {
            // Move into children
            const childKeys = Object.keys(node.children);
            if (childKeys.length > 0) {
              setFocusedPath(node.children[childKeys[0]].path);
            }
          }
        }
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (focusedPath) {
        const node = visibleNodes.find(n => n.path === focusedPath);
        if (node && !node.isFile && !collapsedPaths[focusedPath]) {
          // Collapse
          setCollapsedPaths(prev => ({ ...prev, [focusedPath]: true }));
        } else {
          // Move to parent
          const parentPath = focusedPath.substring(0, focusedPath.lastIndexOf("/"));
          if (parentPath) {
            setFocusedPath(parentPath);
          }
        }
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedPath) {
        const node = visibleNodes.find(n => n.path === focusedPath);
        if (node) {
          if (node.isFile && node.fileId) {
            openFile(node.fileId);
          } else {
            setCollapsedPaths(prev => ({ ...prev, [focusedPath]: !prev[focusedPath] }));
          }
        }
      }
    } else if (e.key === "Delete") {
      e.preventDefault();
      if (focusedPath) {
        const node = visibleNodes.find(n => n.path === focusedPath);
        if (node) {
          if (node.isFile && node.fileId) {
            if (confirm(`Are you sure you want to delete ${node.name}?`)) {
              onFileDelete(node.fileId);
            }
          } else {
            handleFolderDelete(node.path);
          }
        }
      }
    } else if (e.key === "F2") {
      e.preventDefault();
      if (focusedPath) {
        const node = visibleNodes.find(n => n.path === focusedPath);
        if (node) {
          setRenameOriginalName(node.name);
          setRenameTargetPath(node.path);
          setCreateModalType(node.isFile ? "file" : "folder");
          setCreateModalOpen(true);
        }
      }
    }
  };

  // --- Rendering single Tree Nodes ---
  const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const childKeys = Object.keys(node.children).sort((a, b) => {
      const aNode = node.children[a];
      const bNode = node.children[b];
      if (aNode.isFile !== bNode.isFile) {
        return aNode.isFile ? 1 : -1;
      }
      return a.localeCompare(b);
    });

    const isCollapsed = collapsedPaths[node.path];

    return (
      <div key={node.path || "root"} className="space-y-0.5 animate-fade-in">
        {node.path && (
          node.isFile ? (
            // File item Row
            (() => {
              const isSelected = node.fileId === activeFileId;
              const isFocused = node.path === focusedPath;
              const viewers = users.filter((u) => u.activeFileId === node.fileId && u.id !== "user-rishabh");
              
              return (
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, "file", node.path, node.fileId)}
                  onClick={() => node.fileId && openFile(node.fileId)}
                  onContextMenu={(e) => handleContextMenu(e, "file", node.path, node.fileId)}
                  className={`group flex items-center justify-between py-1.5 px-2.5 rounded-lg cursor-pointer transition-all select-none border-l-2 outline-none ${
                    isSelected 
                      ? "bg-indigo-600/15 text-white font-semibold border-indigo-500 shadow-sm" 
                      : "text-zinc-400 hover:bg-zinc-900/30 hover:text-zinc-200 border-transparent"
                  } ${isFocused ? "ring-1 ring-indigo-500/50" : ""}`}
                  style={{ paddingLeft: `${depth * 10 + 8}px` }}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="flex-shrink-0"><FileIcon fileName={node.name} /></span>
                    <span className="text-xs font-mono truncate">{node.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {viewers.map((u) => (
                      <span
                        key={u.id}
                        className="w-1.5 h-1.5 rounded-full ring-1 ring-[#050505] transform animate-pulse"
                        style={{ backgroundColor: u.color }}
                        title={`${u.name} is working here`}
                      />
                    ))}
                    {files.length > 1 && node.fileId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete ${node.name}?`)) {
                            onFileDelete(node.fileId!);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-rose-400 rounded transition cursor-pointer"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            // Folder item Row
            (() => {
              const isFolderCollapsed = collapsedPaths[node.path];
              const isFocused = node.path === focusedPath;
              const isDragTarget = dragOverPath === node.path;

              return (
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, "folder", node.path)}
                  onDragOver={(e) => handleDragOver(e, node.path)}
                  onDrop={(e) => handleDrop(e, node.path)}
                  onContextMenu={(e) => handleContextMenu(e, "folder", node.path)}
                  onClick={() => {
                    setCollapsedPaths(prev => ({
                      ...prev,
                      [node.path]: !prev[node.path]
                    }));
                  }}
                  className={`group flex items-center justify-between py-1.5 px-2.5 rounded-lg cursor-pointer transition-all select-none hover:bg-zinc-900/30 text-zinc-300 font-mono text-xs hover:text-zinc-100 ${
                    isFocused ? "ring-1 ring-indigo-500/50" : ""
                  } ${isDragTarget ? "bg-indigo-600/20 border-l-2 border-indigo-400" : ""}`}
                  style={{ paddingLeft: `${depth * 10 + 4}px` }}
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {isFolderCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 transition-transform duration-200" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 transition-transform duration-200 transform rotate-0" />
                    )}
                    <FolderIcon isOpen={!isFolderCollapsed} />
                    <span className="truncate font-semibold text-zinc-300">{node.name}</span>
                  </div>

                  <div className="flex items-center opacity-0 group-hover:opacity-100 gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCreateModalParentPath(node.path);
                        setCreateModalType("file");
                        setRenameOriginalName(undefined);
                        setCreateModalOpen(true);
                      }}
                      className="p-0.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition cursor-pointer"
                      title="New File inside folder"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })()
          )
        )}

        {/* Child Items */}
        {(!node.path || !isCollapsed) && childKeys.length > 0 && (
          <div className="space-y-0.5 pl-0.5">
            {childKeys.map(key => renderTreeNode(node.children[key], depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // --- Real-time voice and review API methods ---
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<"review" | "debug">("review");
  const [debugQuery, setDebugQuery] = useState("");

  const [isCompiling, setIsCompiling] = useState(false);
  const [compilerOutput, setCompilerOutput] = useState<string | null>(null);
  const [compilerMode, setCompilerMode] = useState<"terminal" | "preview">("terminal");
  const [previewKey, setPreviewKey] = useState(0);

  const [focusMode, setFocusMode] = useState<"normal" | "editor" | "output">("normal");
  const [isAIOpenedFloating, setIsAIOpenedFloating] = useState(false);
  const aiOverlayRef = useRef<HTMLDivElement>(null);

  // Click outside to collapse floating AI assistant
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isAIOpenedFloating &&
        aiOverlayRef.current &&
        !aiOverlayRef.current.contains(event.target as Node)
      ) {
        const clickedOpenBtn = (event.target as HTMLElement).closest('[aria-label="Open AI Assistant"]');
        if (!clickedOpenBtn) {
          setIsAIOpenedFloating(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAIOpenedFloating]);

  useEffect(() => {
    if (activeFile) {
      if (activeFile.language === "html" || activeFile.language === "css") {
        setCompilerMode("preview");
      } else {
        setCompilerMode("terminal");
      }
    }
  }, [activeFileId]);

  // Call server-side code reviews
  const runCodeReview = async () => {
    if (!activeFile) return;
    flushSave();
    setIsAILoading(true);
    setAiMode("review");
    setAiResponse(null);

    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: activeFile.name,
          fileContent: localContent,
          language: activeFile.language
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiResponse(data.review);
      } else {
        setAiResponse(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      setAiResponse(`Error conducting AI review: ${err.message}`);
    } finally {
      setIsAILoading(false);
    }
  };

  // Call server debug assistance
  const runAIDebug = async () => {
    if (!activeFile) return;
    flushSave();
    setIsAILoading(true);
    setAiMode("debug");
    setAiResponse(null);

    try {
      const res = await fetch("/api/ai/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: activeFile.name,
          fileContent: localContent,
          language: activeFile.language,
          query: debugQuery
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiResponse(data.suggestions);
      } else {
        setAiResponse(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      setAiResponse(`Error generating debug suggestions: ${err.message}`);
    } finally {
      setIsAILoading(false);
    }
  };

  // Call compiler runtime script
  const runCompiler = async () => {
    if (!activeFile) return;

    // Prevent duplicate compilation/zombie processes
    if (compilerAbortControllerRef.current) {
      compilerAbortControllerRef.current.abort();
    }

    flushSave();
    setIsCompiling(true);
    setCompilerOutput("Initializing compiler container... executing...\n");

    // If running code that uses Scanner or console input, auto-open Stdin input drawer
    const needsStdin = localContent.includes("Scanner") || localContent.includes("System.in") || localContent.includes("input(") || localContent.includes("cin >>");
    if (needsStdin && !isStdinOpen) {
      setIsStdinOpen(true);
    }

    const abortController = new AbortController();
    compilerAbortControllerRef.current = abortController;

    // Add 10-second timeout to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      if (compilerAbortControllerRef.current === abortController) {
        abortController.abort();
      }
    }, 10000);

    try {
      const res = await fetch("/api/compiler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeFile.id,
          content: localContent,
          code: localContent,
          language: activeFile.language,
          name: activeFile.name,
          stdin: stdinInput
        }),
        signal: abortController.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (data.success) {
        setCompilerOutput(data.output);
        if (data.executionTimeMs !== undefined) {
          setCompilerDuration(data.executionTimeMs);
        }
        if (data.isVisual) {
          setCompilerMode("preview");
        }
        setPreviewKey(prev => prev + 1);
      } else {
        setCompilerOutput(`Compilation Error:\n${data.error || data.message || "Execution failed"}`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setCompilerOutput("Compilation cancelled or timed out.");
      } else {
        setCompilerOutput(`Failed to reach compiler executor: ${err.message}`);
      }
    } finally {
      if (compilerAbortControllerRef.current === abortController) {
        setIsCompiling(false);
        compilerAbortControllerRef.current = null;
      }
    }
  };

  const generateLivePreviewSrcDoc = () => {
    let htmlFile = files.find(f => f.language === "html");
    if (!htmlFile && activeFile?.language === "html") {
      htmlFile = activeFile;
    }

    if (!htmlFile) {
      return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { background-color: #0b0f19; color: #64748b; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .msg { text-align: center; border: 1px dashed #334155; padding: 24px; border-radius: 12px; max-width: 350px; }
    h3 { color: #f1f5f9; margin-top: 0; }
  </style>
</head>
<body>
  <div class="msg">
    <h3>Design Live Sandbox Viewport</h3>
    <p>Please select, edit, or create an <b>index.html</b> file to render the web page layout on-the-fly!</p>
  </div>
</body>
</html>`;
    }

    let htmlContent = htmlFile.content;
    const cssFile = files.find(f => f.language === "css" || f.name.endsWith(".css"));
    if (cssFile) {
      const inlineStyle = `<style>\n${cssFile.content}\n</style>`;
      if (htmlContent.includes("</head>")) {
        htmlContent = htmlContent.replace("</head>", `${inlineStyle}\n</head>`);
      } else {
        htmlContent = inlineStyle + htmlContent;
      }
    }

    const jsFile = files.find(f => f.language === "javascript" || f.name.endsWith(".js"));
    if (jsFile) {
      const inlineScript = `<script>\n(function() {\n  const originalLog = console.log;\n  console.log = function(...args) {\n    originalLog.apply(console, args);\n    window.parent.postMessage({ type: 'LIVE_CONSOLE_LOG', text: args.join(' ') }, '*');\n  };\n})();\n${jsFile.content}\n</script>`;
      if (htmlContent.includes("</body>")) {
        htmlContent = htmlContent.replace("</body>", `${inlineScript}\n</body>`);
      } else {
        htmlContent = htmlContent + inlineScript;
      }
    }

    return htmlContent;
  };

  useEffect(() => {
    const handleLogMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'LIVE_CONSOLE_LOG') {
        setCompilerOutput(prev => {
          const prefix = prev && prev.includes("Initializing compiler") ? "" : (prev || "");
          return prefix + `[Live Preview Console]: ${e.data.text}\n`;
        });
      }
    };
    window.addEventListener("message", handleLogMessage);
    return () => window.removeEventListener("message", handleLogMessage);
  }, []);

  const activeFileUsers = users.filter((u) => u.activeFileId === activeFile?.id);

  const renderAIAssistantContent = (isFloating: boolean) => {
    return (
      <div className="flex flex-col h-full animate-fade-in">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-850">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">AI Assistant</h3>
          </div>
          {isFloating && (
            <button
              onClick={() => setIsAIOpenedFloating(false)}
              className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center"
              title="Minimize AI Assistant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-xl mb-4 border border-zinc-850">
          <button
            onClick={() => {
              setAiMode("review");
              setAiResponse(null);
            }}
            className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              aiMode === "review" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-500 hover:text-white"
            }`}
          >
            Code Review
          </button>
          <button
            onClick={() => {
              setAiMode("debug");
              setAiResponse(null);
            }}
            className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              aiMode === "debug" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-500 hover:text-white"
            }`}
          >
            AI Debugger
          </button>
        </div>

        {aiMode === "debug" && (
          <div className="mb-3 space-y-2">
            <label className="block text-[10px] text-zinc-500 font-mono">DESCRIBE THE BUG / ISSUE</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Why is index out of bounds here?"
                value={debugQuery}
                onChange={(e) => setDebugQuery(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={runAIDebug}
                disabled={isAILoading}
                className="px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Go
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-black/40 rounded-xl p-3.5 border border-zinc-850 font-sans text-xs text-zinc-350 leading-relaxed select-text">
          {isAILoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-t-indigo-500 rounded-full animate-spin" />
              </div>
              <span className="text-zinc-500 text-[10px] font-mono animate-pulse">Consulting Gemini models...</span>
            </div>
          ) : aiResponse ? (
            <div className="space-y-2 whitespace-pre-line prose prose-invert">
              {aiResponse}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center px-2 space-y-2">
              <Sparkles className="w-8 h-8 text-zinc-700 animate-pulse" />
              <p className="text-[11px] text-zinc-500 leading-normal">Request a <strong className="text-zinc-400">Gemini Code Review</strong> of your active file, or use the <strong className="text-zinc-400">AI Debugger</strong> to resolve specific runtime questions.</p>
            </div>
          )}
        </div>

        <div className="mt-3 text-[10px] text-zinc-600 text-center font-mono uppercase tracking-wider">
          Powered by Gemini 3.5 Flash
        </div>
      </div>
    );
  };

  // Compile lines of editor code
  const lines = localContent.split("\n");

  return (
    <div id="ide-workspace-root" className="flex flex-col lg:flex-row gap-6 relative">
      
      {/* 1. File Explorer / Project Workspace Panel */}
      <div
        style={{
          transition: "flex-basis 250ms ease-in-out, width 250ms ease-in-out, opacity 250ms ease-in-out"
        }}
        className={`flex-grow-0 flex-shrink-0 bg-[#0a0a0c] rounded-2xl border border-zinc-850 flex flex-col h-[680px] shadow-2xl relative transition-all overflow-hidden ${
          sidebarCollapsed 
            ? "lg:basis-[60px] w-14 p-2 items-center" 
            : "w-full lg:w-auto lg:basis-[23%] p-4"
        }`}
      >
        {sidebarCollapsed ? (
          // Sleek sidebar mini control rail
          <div className="flex flex-col items-center gap-4 py-2 w-full h-full text-zinc-400">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-2 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
              title="Expand Explorer Panel"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <div className="border-b border-zinc-850 w-full my-1"></div>
            <button
              onClick={() => setQuickSearchOpen(true)}
              className="p-2.5 bg-zinc-900/40 hover:bg-zinc-900 text-indigo-400 hover:text-indigo-300 rounded-lg transition cursor-pointer"
              title="Search Files (Ctrl+P)"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setCreateModalParentPath("");
                setCreateModalType("file");
                setRenameOriginalName(undefined);
                setCreateModalOpen(true);
              }}
              className="p-2.5 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded-lg transition cursor-pointer"
              title="New File"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // Comprehensive Full Size Explorer Panel
          <>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-850">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Project Workspace</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const allPaths = getAllFolders();
                    const collapsed: Record<string, boolean> = {};
                    allPaths.forEach(p => { collapsed[p] = true; });
                    setCollapsedPaths(collapsed);
                  }}
                  className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 rounded transition cursor-pointer"
                  title="Collapse All"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setCollapsedPaths({});
                  }}
                  className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 rounded transition cursor-pointer"
                  title="Expand All"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <div ref={createMenuRef} className="relative">
                  <button
                    onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                    className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded transition cursor-pointer flex items-center justify-center"
                    title="Create Menu"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  {isCreateMenuOpen && (
                    <div className="absolute right-0 top-6 w-36 bg-[#0e0e11] border border-zinc-800 rounded-xl shadow-2xl p-1 z-50 text-xs text-zinc-300 flex flex-col space-y-0.5 animate-fade-scale">
                      <button
                        onClick={() => {
                          setIsCreateMenuOpen(false);
                          setCreateModalParentPath("");
                          setCreateModalType("file");
                          setRenameOriginalName(undefined);
                          setCreateModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white rounded-lg transition text-left cursor-pointer"
                      >
                        <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                        New File
                      </button>
                      <button
                        onClick={() => {
                          setIsCreateMenuOpen(false);
                          setCreateModalParentPath("");
                          setCreateModalType("folder");
                          setRenameOriginalName(undefined);
                          setCreateModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white rounded-lg transition text-left cursor-pointer"
                      >
                        <Folder className="w-3.5 h-3.5 text-indigo-400" />
                        New Folder
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 rounded transition cursor-pointer"
                  title="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Sticky Search bar */}
            <div className="relative mb-3 sticky top-0 z-10 bg-[#0a0a0c] pb-1">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search files... (Ctrl+P)"
                value={workspaceSearchQuery}
                onChange={(e) => setWorkspaceSearchQuery(e.target.value)}
                className="w-full bg-[#050505] border border-zinc-850 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-600 font-mono"
              />
              {workspaceSearchQuery && (
                <button 
                  onClick={() => setWorkspaceSearchQuery("")}
                  className="absolute right-2.5 top-2 hover:bg-zinc-900 p-0.5 rounded text-zinc-500 hover:text-white transition"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Navigation Instruction Tip */}
            <div className="flex items-center gap-1.5 px-2 py-1 mb-2 bg-zinc-950 border border-zinc-900 rounded-lg text-[9px] font-mono text-zinc-500 select-none">
              <Keyboard className="w-3 h-3 text-zinc-600" />
              <span><b>Arrows</b> navigate, <b>Enter</b> opens, <b>F2</b> renames</span>
            </div>

            {/* Tree root box */}
            <div 
              tabIndex={0}
              onKeyDown={handleTreeKeyDown}
              onDragOver={(e) => handleDragOver(e, "")}
              onDrop={(e) => handleDrop(e, "")}
              className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono outline-none scrollbar-thin scrollbar-thumb-zinc-800"
            >
              {renderTreeNode(filterTree(buildTree(files), workspaceSearchQuery) || buildTree(files), -1)}
            </div>

            {/* Sync diagnostics indicator */}
            <div className="mt-3 pt-2.5 border-t border-zinc-850 flex items-center justify-between text-[10px] font-mono text-zinc-500 select-none">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Collab Live Sync</span>
              </div>
              <span className="text-[9px] text-zinc-600 uppercase">IDE v2.0.0</span>
            </div>
          </>
        )}
      </div>

      {/* 2. Professional Tabbed Editor Workspace Frame */}
      <div 
        className={`flex-1 flex flex-col bg-[#050505] border border-zinc-850 rounded-2xl h-[680px] shadow-2xl overflow-hidden transition-all duration-300 ease-in-out ${
          focusMode !== "normal" ? "lg:basis-[100%] z-30" : "lg:basis-[54%]"
        }`}
      >
        {/* Horizontal File Tabs Bar */}
        <div className="bg-zinc-950 border-b border-zinc-900 flex items-center justify-between pl-3 pr-4 h-11 select-none overflow-hidden flex-shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto h-full scrollbar-none max-w-[80%] pr-4">
            {openFileIds.map(tabId => {
              const file = files.find(f => f.id === tabId);
              if (!file) return null;
              const isSelected = tabId === activeFileId;
              const hasDirtyState = isDirty && isSelected;
              
              return (
                <div
                  key={tabId}
                  onClick={() => openFile(tabId)}
                  onMouseDown={(e) => {
                    if (e.button === 1) { // Middle click close
                      e.preventDefault();
                      closeTab(tabId);
                    }
                  }}
                  className={`group flex items-center gap-2 px-3.5 h-full border-b-2 cursor-pointer transition text-xs font-mono select-none ${
                    isSelected 
                      ? "bg-zinc-900/60 text-white font-semibold border-indigo-500" 
                      : "text-zinc-500 hover:bg-zinc-900/20 hover:text-zinc-300 border-transparent"
                  }`}
                >
                  <FileIcon fileName={file.name} className="w-3.5 h-3.5" />
                  <span>{file.name}</span>
                  
                  {/* Close or Unsaved indicator */}
                  <div className="relative w-4 h-4 flex items-center justify-center">
                    {hasDirtyState ? (
                      // Unsaved changes solid circle indicator
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full group-hover:hidden transition-all duration-150" />
                    ) : null}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tabId);
                      }}
                      className={`p-0.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-white transition absolute inset-0 flex items-center justify-center ${
                        hasDirtyState
                          ? "hidden group-hover:flex"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Active Typing indicators list */}
            {Object.keys(typingUsers).filter(uid => typingUsers[uid]).length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-850 animate-pulse mr-1 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                <span>
                  {Object.keys(typingUsers).filter(uid => typingUsers[uid]).map(uId => users.find(u => u.id === uId)?.name || "Peer").join(", ")} typing...
                </span>
              </div>
            )}

            {/* Undo / Redo toolbar buttons */}
            <button
              onClick={handleUndo}
              className="p-1.5 hover:bg-zinc-900 text-zinc-500 hover:text-white rounded-lg transition"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              className="p-1.5 hover:bg-zinc-900 text-zinc-500 hover:text-white rounded-lg transition"
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-1.5 hover:bg-zinc-900 rounded-lg transition-all ${wordWrap ? "text-indigo-400 bg-indigo-500/5" : "text-zinc-500"}`}
              title="Toggle Word Wrap"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              onClick={runCompiler}
              disabled={isCompiling}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm shadow-emerald-600/10 cursor-pointer"
              title="Compile and run current file"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              {isCompiling ? "Running..." : "Run"}
            </button>
            
            {/* Expand Focus Button */}
            <button
              onClick={() => setFocusMode(focusMode === "editor" ? "normal" : "editor")}
              className="hidden lg:flex items-center justify-center p-1.5 hover:bg-zinc-900 text-zinc-500 hover:text-white rounded-lg transition"
              title={focusMode === "editor" ? "Exit Focus Mode (ESC)" : "Code Editor Focus Mode"}
            >
              {focusMode === "editor" ? (
                <Minimize2 className="w-4 h-4 text-indigo-400" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Interactive Editor Window */}
        {activeFile ? (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Soft Lock alert banner */}
            {fileLocks.some(l => l.fileId === activeFile.id && l.userId !== "user-rishabh") && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-400 select-none animate-fade-in flex-shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span>
                    Currently editing: <b>{fileLocks.find(l => l.fileId === activeFile.id && l.userId !== "user-rishabh")?.username}</b>. Be mindful of concurrent edits.
                  </span>
                </div>
                <span className="text-[9px] bg-amber-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">Collab Conflict Alert</span>
              </div>
            )}

            {/* Quick Pre-prompts & Snippets Toolbar */}
            <div className="h-8 bg-[#090d1a] border-b border-zinc-900/80 px-3 flex items-center justify-between text-[11px] font-mono select-none overflow-x-auto flex-shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1 mr-1">
                  <Zap className="w-3 h-3 text-amber-400" /> Pre-prompts:
                </span>
                {(QUICK_PRE_PROMPTS[activeFile.language] || QUICK_PRE_PROMPTS.javascript || []).map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => insertPrePrompt(template.snippet)}
                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-indigo-500/40 rounded text-zinc-300 hover:text-white text-[10px] transition cursor-pointer whitespace-nowrap"
                    title={template.description}
                  >
                    {template.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pl-2">
                <button
                  onClick={() => setAiCopilotEnabled(!aiCopilotEnabled)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer flex items-center gap-1 ${
                    aiCopilotEnabled 
                      ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-500"
                  }`}
                  title="Toggle automatic AI inline suggestions"
                >
                  <Bot className="w-3 h-3" />
                  <span className="hidden sm:inline">Copilot:</span> {aiCopilotEnabled ? "ON" : "OFF"}
                </button>
                <button
                  onClick={triggerAICompletion}
                  disabled={isAISuggesting}
                  className="px-2.5 py-0.5 bg-gradient-to-r from-indigo-600/30 to-cyan-600/30 hover:from-indigo-600/50 hover:to-cyan-600/50 border border-indigo-500/40 rounded-md text-[10px] text-cyan-300 font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-sm"
                  title="Complete line with Gemini AI (Ctrl+Space)"
                >
                  <Sparkles className={`w-3 h-3 text-cyan-400 ${isAISuggesting ? "animate-spin" : ""}`} />
                  {isAISuggesting ? "Thinking..." : "AI Complete"}
                  <span className="text-[8px] text-zinc-400 ml-1 font-normal hidden sm:inline">(Ctrl+Space)</span>
                </button>
              </div>
            </div>

            <div className={`flex overflow-hidden font-mono text-xs leading-relaxed relative bg-[#050505]/60 transition-all duration-300 ease-in-out ${
              focusMode === "output"
                ? "basis-0 h-0 opacity-0 pointer-events-none flex-grow-0 flex-shrink-0 border-none"
                : "flex-1 h-full opacity-100"
            }`}>
              
              {/* Line Numbers column */}
              <div 
                ref={lineNumbersRef}
                className="w-11 select-none text-right pr-3.5 pl-1 py-5 text-zinc-600 bg-zinc-950/60 border-r border-zinc-900 overflow-hidden text-[11px] font-mono leading-[18px]"
                style={{ userSelect: "none" }}
              >
                <pre className="text-right select-none font-mono text-[11px] leading-[18px] text-zinc-650 h-full">
                  {Array.from({ length: lines.length }, (_, i) => i + 1).join("\n")}
                </pre>
              </div>

              {/* Textarea wrapped in layout */}
              <div className="flex-1 relative h-full overflow-hidden">
                {/* Active Line Highlight overlay */}
                <div 
                  className="absolute left-0 right-0 h-[18px] bg-indigo-500/5 border-y border-indigo-500/10 pointer-events-none transition-all duration-75"
                  style={{
                    top: `${activeLineIndex * 18 + 20}px`
                  }}
                />

                {/* Floating IntelliSense / Pre-prompts Suggestions Menu */}
                {suggestions.length > 0 && suggestionPosition && (
                  <div
                    className="absolute z-50 flex items-start gap-1 font-mono text-[11px] animate-in fade-in zoom-in-95 duration-100"
                    style={{
                      left: Math.max(20, Math.min(suggestionPosition.x + 48, (textareaRef.current?.clientWidth || 500) - 340)),
                      top: Math.min(suggestionPosition.y + 36, (textareaRef.current?.clientHeight || 400) - 230)
                    }}
                  >
                    {/* Primary List */}
                    <div className="w-64 bg-[#0c1021]/95 backdrop-blur-xl border border-indigo-500/40 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                      {/* Header */}
                      <div className="bg-[#080b16] px-3 py-1.5 border-b border-zinc-800/80 flex items-center justify-between text-[9px] text-zinc-400 font-semibold select-none">
                        <span className="flex items-center gap-1.5 text-indigo-400">
                          <Sparkles className="w-3 h-3 text-cyan-400" /> IntelliSense
                        </span>
                        <span className="text-zinc-500 text-[8px]">
                          {activeFile?.language?.toUpperCase()} &bull; ⇥ Tab
                        </span>
                      </div>

                      {/* Suggestion Items List */}
                      <div className="max-h-48 overflow-y-auto divide-y divide-zinc-900/50">
                        {suggestions.map((sug, idx) => {
                          const isSelected = idx === selectedSuggestionIndex;
                          return (
                            <div
                              key={idx}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                applySuggestion(sug);
                              }}
                              className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${
                                isSelected ? "bg-indigo-600/30 text-white" : "hover:bg-zinc-800/50 text-zinc-300"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {/* Type Badge */}
                                <span className={`w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold font-mono ${
                                  sug.kind === "ai"
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                    : sug.kind === "snippet"
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                      : sug.kind === "keyword"
                                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                        : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                }`}>
                                  {sug.kind === "ai" ? "✦" : sug.kind === "snippet" ? "⧉" : sug.kind === "keyword" ? "k" : "v"}
                                </span>
                                <span className={`font-semibold ${isSelected ? "text-cyan-300" : "text-white"}`}>
                                  {sug.label}
                                </span>
                              </div>
                              <span className="text-[9px] text-zinc-500 truncate max-w-[80px] ml-1">
                                {sug.detail.split("(")[0]}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer navigation guide */}
                      <div className="bg-[#070913] px-3 py-1 border-t border-zinc-900 text-[8px] text-zinc-500 flex items-center justify-between select-none">
                        <span>↑↓ Select</span>
                        <span>⇥ Tab Insert</span>
                        <span>Esc Close</span>
                      </div>
                    </div>

                    {/* Companion Documentation & Code Preview Pane */}
                    {suggestions[selectedSuggestionIndex] && (
                      <div className="w-56 bg-[#0a0e1c]/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl p-2.5 text-[10px] hidden sm:flex flex-col gap-1.5 select-none animate-in fade-in duration-100">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
                          <span className="font-bold text-white text-[11px] truncate">
                            {suggestions[selectedSuggestionIndex].label}
                          </span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-900 text-indigo-300 font-mono">
                            {suggestions[selectedSuggestionIndex].kind}
                          </span>
                        </div>
                        {suggestions[selectedSuggestionIndex].doc && (
                          <p className="text-zinc-400 text-[10px] leading-tight">
                            {suggestions[selectedSuggestionIndex].doc}
                          </p>
                        )}
                        <div className="bg-zinc-950/80 rounded border border-zinc-900 p-1.5 font-mono text-[9px] text-cyan-300 overflow-hidden max-h-20 whitespace-pre">
                          {suggestions[selectedSuggestionIndex].insertText.replace(/\$\{\d+:([^}]+)\}/g, "$1").replace(/\$\{\d+\}/g, "").slice(0, 140)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Peer Blinking Cursors overlay */}
                {renderedCursors.map((pc) => (
                  <div
                    key={pc.socketId}
                    className="absolute pointer-events-none z-20 flex flex-col items-start transition-all duration-75 ease-out"
                    style={{
                      left: `${pc.x + 20}px`, // matches p-5 padding offset
                      top: `${pc.y + 20}px`
                    }}
                  >
                    {/* Vertical blinking bar */}
                    <div 
                      className="w-[2px] h-[18px]"
                      style={{ backgroundColor: pc.color }}
                    />
                    {/* Floating name badge */}
                    <div 
                      className="mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-sans font-medium text-white shadow-lg flex items-center gap-1 uppercase tracking-wider whitespace-nowrap animate-fade-in"
                      style={{ backgroundColor: pc.color }}
                    >
                      {pc.username}
                    </div>
                  </div>
                ))}
                
                <textarea
                  ref={textareaRef}
                  value={localContent}
                  onChange={handleLocalContentChange}
                  onKeyDown={handleEditorKeyDown}
                  onScroll={handleEditorScroll}
                  onSelect={handleEditorSelection}
                  onBlur={flushSave}
                  spellCheck={false}
                  placeholder="// Begin editing live code..."
                  className={`absolute inset-0 p-5 bg-transparent text-zinc-300 font-mono text-[13px] leading-relaxed focus:outline-none resize-none overflow-y-auto selection:bg-indigo-500/20 selection:text-white caret-indigo-500 ${
                    wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto"
                  }`}
                  style={{
                    lineHeight: "18px",
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
                  }}
                />
              </div>
            </div>

            {/* Bottom Output/Preview Panel */}
            <div 
              className={`bg-black flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
                focusMode === "editor" 
                  ? "basis-0 opacity-0 pointer-events-none flex-grow-0 flex-shrink-0 border-none" 
                  : focusMode === "output"
                    ? "flex-1 border-t-0 opacity-100"
                    : "basis-[220px] border-t border-zinc-900 opacity-100"
              }`}
              style={{
                height: focusMode === "editor" ? "0px" : focusMode === "output" ? "100%" : "220px"
              }}
            >
              {/* Output Tab Selector */}
              <div className="h-9 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between px-4 select-none">
                <div className="flex gap-4">
                  <button
                    onClick={() => setCompilerMode("terminal")}
                    className={`flex items-center gap-1.5 h-full text-xs font-semibold border-b-2 transition ${
                      compilerMode === "terminal" 
                        ? "text-indigo-400 border-indigo-500" 
                        : "text-zinc-500 hover:text-zinc-300 border-transparent"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" /> Output Terminal
                    {compilerDuration !== null && (
                      <span className="text-[10px] text-emerald-400 font-mono font-normal bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 ml-1">
                        ⚡ {compilerDuration}ms
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setCompilerMode("preview")}
                    className={`flex items-center gap-1.5 h-full text-xs font-semibold border-b-2 transition ${
                      compilerMode === "preview" 
                        ? "text-indigo-400 border-indigo-500" 
                        : "text-zinc-500 hover:text-zinc-300 border-transparent"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Live Preview Frame
                  </button>

                  {/* Judge0 CE Engine badge */}
                  <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 my-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Judge0 CE
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {compilerMode === "terminal" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsStdinOpen(!isStdinOpen)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition flex items-center gap-1 cursor-pointer ${
                          isStdinOpen || stdinInput 
                            ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" 
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                        title="Configure standard input (stdin) for interactive executions"
                      >
                        <span>⌨ Stdin</span>
                        {stdinInput && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                      </button>

                      <button
                        onClick={() => setCompilerOutput("")}
                        className="text-[10px] font-mono text-zinc-500 hover:text-white transition cursor-pointer"
                      >
                        Clear
                      </button>
                    </>
                  )}
                  {compilerMode === "preview" && (
                    <button
                      onClick={() => setPreviewKey(prev => prev + 1)}
                      className="p-1 hover:bg-zinc-900 rounded text-zinc-500 hover:text-white transition"
                      title="Force Refresh"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => setFocusMode(focusMode === "output" ? "normal" : "output")}
                    className="p-1 hover:bg-zinc-900 rounded text-zinc-500 hover:text-white transition flex items-center justify-center"
                    title={focusMode === "output" ? "Exit Focus Mode (ESC)" : "Output Preview Focus Mode"}
                  >
                    {focusMode === "output" ? (
                      <Minimize2 className="w-3.5 h-3.5 text-indigo-400" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Panel Content rendering */}
              <div className="flex-1 overflow-hidden relative flex flex-col">
                {compilerMode === "terminal" && isStdinOpen && (
                  <div className="bg-[#0b0e1b] border-b border-zinc-900 px-3 py-1.5 flex items-center gap-2 text-xs font-mono flex-shrink-0 animate-in fade-in duration-100">
                    <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">Stdin:</span>
                    <input
                      type="text"
                      value={stdinInput}
                      onChange={(e) => setStdinInput(e.target.value)}
                      placeholder='Input passed to program stdin (e.g. "Alice")'
                      className="flex-1 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800 text-xs font-mono text-zinc-200 outline-none focus:border-indigo-500 placeholder-zinc-600"
                    />
                    {stdinInput && (
                      <button
                        onClick={() => setStdinInput("")}
                        className="text-[10px] text-zinc-500 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}

                {compilerMode === "terminal" ? (
                  <pre className="flex-1 p-4 font-mono text-xs text-[#a3b3cc] overflow-auto select-text leading-relaxed whitespace-pre bg-zinc-950/20">
                    {compilerOutput || "Terminal output will appear here after compiling. Click 'Run' to compile and execute."}
                  </pre>
                ) : (
                  <iframe
                    key={previewKey}
                    title="Design Live Sandbox Viewport"
                    srcDoc={generateLivePreviewSrcDoc()}
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                    className="w-full h-full bg-white border-0"
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-black/20">
            <FileCode className="w-12 h-12 mb-2 text-zinc-700 animate-bounce" />
            <span className="text-xs">Create or select a workspace file to get coding.</span>
          </div>
        )}

        {/* Editor footer diagnostics */}
        <div className="bg-zinc-950 px-4 py-2.5 border-t border-zinc-900 flex items-center justify-between select-none">
          <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-3">
            <span>Lines: {lines.length} | Chars: {localContent.length}</span>
            <span>Tab size: 2 spaces</span>
            {matchedBracketLine !== null && (
              <span className="text-yellow-400 font-bold bg-yellow-500/10 px-1.5 py-0.5 rounded">Bracket Match: line {matchedBracketLine + 1}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={runCodeReview}
              className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Code Review
            </button>
            <button
              onClick={() => {
                setAiMode("debug");
                setAiResponse(null);
                setIsAIOpenedFloating(true);
              }}
              className="flex items-center gap-1 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold border border-zinc-850 transition-all cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              AI Debugger
            </button>
          </div>
        </div>
      </div>

      {/* 3. Right Sidebar AI Assistant Panel */}
      <div 
        style={{
          transition: "flex-basis 300ms ease-in-out, opacity 300ms ease-in-out, max-width 300ms ease-in-out"
        }}
        className={`w-full lg:w-auto bg-[#0a0a0c] rounded-2xl border border-zinc-850 flex flex-col h-[680px] shadow-2xl overflow-hidden transition-all duration-300 ease-in-out ${
          focusMode === "normal" 
            ? "lg:basis-[23%] flex-grow-0 flex-shrink-0 p-4 opacity-100 pointer-events-auto" 
            : "lg:basis-0 lg:max-w-0 opacity-0 p-0 border-none pointer-events-none"
        }`}
      >
        <div className={`h-full transition-opacity duration-300 ${focusMode === "normal" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          {renderAIAssistantContent(false)}
        </div>
      </div>

      {/* Center Floating overlay container for AI Assistant */}
      <div 
        ref={aiOverlayRef}
        id="floating-ai-overlay"
        style={{
          transition: "transform 300ms ease-in-out, opacity 300ms ease-in-out, scale 300ms ease-in-out"
        }}
        className={`absolute top-0 right-0 h-full w-[380px] bg-[#0a0a0c]/95 backdrop-blur-md rounded-2xl border border-zinc-850 p-4 shadow-2xl flex flex-col z-50 ${
          focusMode !== "normal" && isAIOpenedFloating 
            ? "opacity-100 translate-x-0 scale-100 pointer-events-auto" 
            : "opacity-0 translate-x-12 scale-95 pointer-events-none"
        }`}
      >
        {renderAIAssistantContent(true)}
      </div>

      {/* Floating AI circular launcher */}
      {focusMode !== "normal" && !isAIOpenedFloating && (
        <button
          onClick={() => setIsAIOpenedFloating(true)}
          className="hidden lg:flex absolute bottom-[100px] right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 z-40 cursor-pointer group"
          title="Open AI Assistant"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-6 h-6 animate-pulse group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Render Context Menu popover */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          targetId={contextMenu.targetId}
          targetPath={contextMenu.targetPath}
          onClose={() => setContextMenu(null)}
          onRename={(path, isFile) => {
            setRenameOriginalName(path.split("/").pop());
            setRenameTargetPath(path);
            setCreateModalType(isFile ? "file" : "folder");
            setCreateModalOpen(true);
          }}
          onDelete={(path, isFile, id) => {
            if (isFile && id) {
              if (confirm(`Are you sure you want to delete "${path.split("/").pop()}"?`)) {
                onFileDelete(id);
              }
            } else {
              handleFolderDelete(path);
            }
          }}
          onDuplicate={handleFileDuplicate}
          onNewFile={(parentPath) => {
            setCreateModalParentPath(parentPath);
            setCreateModalType("file");
            setRenameOriginalName(undefined);
            setCreateModalOpen(true);
          }}
          onNewFolder={(parentPath) => {
            setCreateModalParentPath(parentPath);
            setCreateModalType("folder");
            setRenameOriginalName(undefined);
            setCreateModalOpen(true);
          }}
        />
      )}

      {/* Render File Creation Modal */}
      <CreateModal
        isOpen={createModalOpen}
        type={createModalType}
        parentPath={createModalParentPath}
        existingNames={getSiblingNames(createModalParentPath, createModalType)}
        onClose={() => {
          setCreateModalOpen(false);
          setRenameOriginalName(undefined);
          setRenameTargetPath("");
        }}
        onSubmit={(name) => {
          if (renameOriginalName) {
            // Rename mode
            if (createModalType === "file") {
              handleFileRenameSubmit(name, renameTargetPath);
            } else {
              handleFolderRenameSubmit(name, renameTargetPath);
            }
          } else {
            // Create mode
            if (createModalType === "file") {
              handleNewFileSubmit(name, createModalParentPath);
            } else {
              handleNewFolderSubmit(name, createModalParentPath);
            }
          }
        }}
        renameOriginalName={renameOriginalName}
      />

      {/* Render Global Quick Search Modal (Ctrl+P) */}
      <QuickSearchModal
        isOpen={quickSearchOpen}
        onClose={() => setQuickSearchOpen(false)}
        files={files}
        onFileSelect={openFile}
        getFileIcon={(name) => <FileIcon fileName={name} />}
      />

    </div>
  );
}


// import React, { useState, useEffect, useRef, useMemo } from "react";
// import { ProjectFile, CollabUser, FileLock } from "../types.js";
// import { CollaborationClient } from "../lib/collaboration.ts";
// import { 
//   Play, Sparkles, AlertCircle, FileCode, Trash2, Plus, 
//   Terminal, RefreshCw, Eye, Code, Layers, FileJson, Check,
//   ChevronDown, ChevronRight, Folder, FolderOpen, Maximize2, Minimize2,
//   Search, X, Edit3, Copy, EyeOff, List, AlignLeft, Keyboard, HelpCircle,
//   Menu, PanelLeftClose, PanelLeft, FileText, Settings, Coffee, Binary
// } from "lucide-react";

// import FileIcon, { FolderIcon } from "./FileIcon.tsx";
// import QuickSearchModal from "./QuickSearchModal.tsx";
// import ContextMenu from "./ContextMenu.tsx";
// import CreateModal from "./CreateModal.tsx";

// interface TreeNode {
//   name: string;
//   path: string;
//   isFile: boolean;
//   fileId?: string;
//   children: Record<string, TreeNode>;
// }

// // Helper to calculate exact character index coordinates inside a standard <textarea>
// function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
//   // Create a mirror element
//   const div = document.createElement("div");
//   const style = window.getComputedStyle(element);

//   for (const prop of Array.from(style)) {
//     div.style.setProperty(prop, style.getPropertyValue(prop));
//   }

//   div.style.position = "absolute";
//   div.style.visibility = "hidden";
//   div.style.whiteSpace = "pre-wrap";
//   div.style.wordBreak = "break-all";
//   div.style.overflow = "hidden";
//   div.style.width = element.clientWidth + "px";
//   div.style.height = element.clientHeight + "px";

//   const content = element.value || "";
//   const before = content.substring(0, Math.min(position, content.length));
//   const after = content.substring(Math.min(position, content.length));

//   const textNodeBefore = document.createTextNode(before);
//   const textNodeAfter = document.createTextNode(after);
//   const span = document.createElement("span");
//   span.textContent = "|";

//   div.appendChild(textNodeBefore);
//   div.appendChild(span);
//   div.appendChild(textNodeAfter);

//   document.body.appendChild(div);

//   // Subtract scroll positions of textarea to make it line up exactly
//   const x = span.offsetLeft - element.scrollLeft;
//   const y = span.offsetTop - element.scrollTop;

//   document.body.removeChild(div);

//   return { x, y };
// }

// interface EditorWorkspaceProps {
//   files: ProjectFile[];
//   users: CollabUser[];
//   activeFileId: string | null;
//   onFileSelect: (id: string) => void;
//   onFileUpdate: (id: string, content: string) => void;
//   onFileCreate: (name: string, language: string) => void;
//   onFileDelete: (id: string) => void;
//   onRefreshState?: () => void;
//   collabClient?: CollaborationClient;
//   fileLocks?: FileLock[];
// }

// export default function EditorWorkspace({
//   files,
//   users,
//   activeFileId,
//   onFileSelect,
//   onFileUpdate,
//   onFileCreate,
//   onFileDelete,
//   onRefreshState,
//   collabClient,
//   fileLocks = []
// }: EditorWorkspaceProps) {
//   // --- Sidebar & Explorer States ---
//   const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
//   const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
//   const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});
  
//   // Custom virtual folders (to support empty directories like VS Code)
//   const [virtualFolders, setVirtualFolders] = useState<string[]>(() => {
//     try {
//       const saved = localStorage.getItem("virtual_folders_list");
//       return saved ? JSON.parse(saved) : [];
//     } catch {
//       return [];
//     }
//   });

//   useEffect(() => {
//     localStorage.setItem("virtual_folders_list", JSON.stringify(virtualFolders));
//   }, [virtualFolders]);

//   // Expand all initially
//   useEffect(() => {
//     if (files.length > 0 && Object.keys(collapsedPaths).length === 0) {
//       const initialCollapsed: Record<string, boolean> = {};
//       files.forEach(f => {
//         const parts = f.path.split("/");
//         if (parts.length > 1) {
//           // Keep root folders expanded, subfolders collapsed or expanded
//           initialCollapsed[parts[0]] = false;
//         }
//       });
//       setCollapsedPaths(initialCollapsed);
//     }
//   }, [files]);

//   // --- Header Creation Menu State ---
//   const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
//   const createMenuRef = useRef<HTMLDivElement>(null);

//   // Close creation menu on click outside
//   useEffect(() => {
//     const clickOutside = (e: MouseEvent) => {
//       if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
//         setIsCreateMenuOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", clickOutside);
//     return () => document.removeEventListener("mousedown", clickOutside);
//   }, []);

//   // --- Modals (Create Folder / Create File / Rename) States ---
//   const [createModalOpen, setCreateModalOpen] = useState(false);
//   const [createModalType, setCreateModalType] = useState<"file" | "folder">("file");
//   const [createModalParentPath, setCreateModalParentPath] = useState("");
//   const [renameOriginalName, setRenameOriginalName] = useState<string | undefined>(undefined);
//   const [renameTargetPath, setRenameTargetPath] = useState("");

//   // --- Context Menu State ---
//   const [contextMenu, setContextMenu] = useState<{
//     x: number;
//     y: number;
//     type: "file" | "folder";
//     targetId?: string;
//     targetPath: string;
//   } | null>(null);

//   const handleContextMenu = (e: React.MouseEvent, type: "file" | "folder", targetPath: string, targetId?: string) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setContextMenu({
//       x: e.clientX,
//       y: e.clientY,
//       type,
//       targetId,
//       targetPath
//     });
//   };

//   // --- Ctrl+P Quick Search Modal ---
//   const [quickSearchOpen, setQuickSearchOpen] = useState(false);

//   // --- Drag and Drop States ---
//   const [dragOverPath, setDragOverPath] = useState<string | null>(null);

//   // --- Tabs States ---
//   const [openFileIds, setOpenFileIds] = useState<string[]>([]);
//   const activeFile = files.find((f) => f.id === activeFileId) || files[0];

//   // Initialize tabs when files change
//   useEffect(() => {
//     if (files.length > 0) {
//       if (openFileIds.length === 0) {
//         if (activeFileId) {
//           setOpenFileIds([activeFileId]);
//         } else {
//           setOpenFileIds([files[0].id]);
//         }
//       } else {
//         // Remove closed files from open tabs
//         const validIds = openFileIds.filter(id => files.some(f => f.id === id));
//         if (validIds.length !== openFileIds.length) {
//           setOpenFileIds(validIds);
//         }
//       }
//     }
//   }, [files, activeFileId]);

//   // Open file helper
//   const openFile = (id: string) => {
//     if (!openFileIds.includes(id)) {
//       setOpenFileIds(prev => [...prev, id]);
//     }
//     onFileSelect(id);
//   };

//   const closeTab = (idToClose: string) => {
//     const isClosingActive = activeFileId === idToClose;
//     const remainingTabs = openFileIds.filter(id => id !== idToClose);
    
//     setOpenFileIds(remainingTabs);

//     if (isClosingActive && remainingTabs.length > 0) {
//       // Open the last tab
//       onFileSelect(remainingTabs[remainingTabs.length - 1]);
//     } else if (remainingTabs.length === 0 && files.length > 0) {
//       // Back to default file
//       onFileSelect(files[0].id);
//     }
//   };

//   // --- Keyboard Shortcuts (Ctrl+P, Ctrl+W, Ctrl+Tab, Escape) ---
//   useEffect(() => {
//     const handleGlobalShortcuts = (e: KeyboardEvent) => {
//       // Ctrl+P / Cmd+P - Quick File Search
//       if ((e.ctrlKey || e.metaKey) && e.key === "p") {
//         e.preventDefault();
//         setQuickSearchOpen(true);
//       }

//       // Alt+W or Ctrl+W - Close Tab (Alt+W is safer because browsers intercept Ctrl+W)
//       if ((e.altKey && e.key?.toLowerCase() === "w") || (e.ctrlKey && e.key === "w" && activeFileId)) {
//         if (activeFileId && openFileIds.includes(activeFileId)) {
//           e.preventDefault();
//           closeTab(activeFileId);
//         }
//       }

//       // Ctrl+Tab - Switch Tab
//       if (e.ctrlKey && e.key === "Tab" && openFileIds.length > 1) {
//         e.preventDefault();
//         const currentIndex = openFileIds.indexOf(activeFileId || "");
//         const nextIndex = (currentIndex + 1) % openFileIds.length;
//         onFileSelect(openFileIds[nextIndex]);
//       }

//       // Escape - Exit Focus Mode
//       if (e.key === "Escape") {
//         setFocusMode("normal");
//       }
//     };

//     window.addEventListener("keydown", handleGlobalShortcuts);
//     return () => window.removeEventListener("keydown", handleGlobalShortcuts);
//   }, [activeFileId, openFileIds]);

//   // --- Folder Management Helpers ---
//   const getAllFolders = (): string[] => {
//     const foldersSet = new Set<string>();
    
//     // 1. Scan folders from current file paths
//     files.forEach(f => {
//       const parts = f.path.split('/').filter(Boolean);
//       for (let i = 1; i < parts.length; i++) {
//         foldersSet.add(parts.slice(0, i).join('/'));
//       }
//     });

//     // 2. Add empty virtual folders
//     virtualFolders.forEach(vf => foldersSet.add(vf));

//     return Array.from(foldersSet).sort();
//   };

//   const getSiblingNames = (parentPath: string, type: "file" | "folder"): string[] => {
//     if (type === "folder") {
//       const folders = getAllFolders();
//       return folders
//         .filter(f => {
//           const parent = f.substring(0, f.lastIndexOf("/")) || "";
//           return parent === parentPath;
//         })
//         .map(f => f.split("/").pop() || "");
//     } else {
//       return files
//         .filter(f => {
//           const parent = f.path.substring(0, f.path.lastIndexOf("/")) || "";
//           return parent === parentPath;
//         })
//         .map(f => f.name);
//     }
//   };

//   // --- Collaborative editor states & synced typing input ---
//   const [localContent, setLocalContent] = useState("");
//   const [wordWrap, setWordWrap] = useState(true);
//   const [activeLineIndex, setActiveLineIndex] = useState(0);
//   const [matchedBracketLine, setMatchedBracketLine] = useState<number | null>(null);

//   // Professional IDE states and refs to eliminate cursor jumps and lag
//   const [isDirty, setIsDirty] = useState(false);
//   const isDirtyRef = useRef(false);
//   const lastSavedContentRef = useRef("");
//   const lastLocalEditTimeRef = useRef<number>(0);
//   const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
//   const prevActiveFileIdRef = useRef<string | null>(null);
//   const fileStatesRef = useRef<Record<string, {
//     cursorStart: number;
//     cursorEnd: number;
//     scrollTop: number;
//   }>>({});

//   const compilerAbortControllerRef = useRef<AbortController | null>(null);
//   const textareaRef = useRef<HTMLTextAreaElement>(null);
//   const lineNumbersRef = useRef<HTMLDivElement>(null);

//   // Helper to update local content, set dirty state, and debounce autosave
//   const updateLocalContent = (newValue: string) => {
//     setLocalContent(newValue);
//     isDirtyRef.current = true;
//     setIsDirty(true);
//     lastLocalEditTimeRef.current = Date.now();

//     // Broadcast typing status to active room
//     if (collabClient && activeFile) {
//       collabClient.emitTyping(true, activeFile.id);
//       if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
//       typingTimeoutRef.current = setTimeout(() => {
//         if (collabClient && activeFile) {
//           collabClient.emitTyping(false, activeFile.id);
//         }
//       }, 1500);
//     }

//     if (saveTimeoutRef.current) {
//       clearTimeout(saveTimeoutRef.current);
//     }
//     saveTimeoutRef.current = setTimeout(() => {
//       if (activeFile) {
//         onFileUpdate(activeFile.id, newValue);
//         lastSavedContentRef.current = newValue;
//         isDirtyRef.current = false;
//         setIsDirty(false);
//       }
//     }, 1000);
//   };

//   // Helper to immediately flush any unsaved changes to the server
//   const flushSave = () => {
//     if (saveTimeoutRef.current) {
//       clearTimeout(saveTimeoutRef.current);
//       saveTimeoutRef.current = null;
//     }
//     if (activeFile && isDirtyRef.current) {
//       onFileUpdate(activeFile.id, localContent);
//       lastSavedContentRef.current = localContent;
//       isDirtyRef.current = false;
//       setIsDirty(false);
//     }
//   };

//   // Save on component unmount
//   useEffect(() => {
//     return () => {
//       if (saveTimeoutRef.current) {
//         clearTimeout(saveTimeoutRef.current);
//       }
//     };
//   }, []);

//   // --- Real-time Peer Collaboration States ---
//   const [peerCursors, setPeerCursors] = useState<Record<string, {
//     userId: string;
//     username: string;
//     color: string;
//     cursorIndex: number;
//     fileId: string | null;
//   }>>({});

//   const [renderedCursors, setRenderedCursors] = useState<Array<{
//     socketId: string;
//     userId: string;
//     username: string;
//     color: string;
//     x: number;
//     y: number;
//   }>>([]);

//   const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
//   const typingTimeoutRef = useRef<any>(null);

//   // Recalculate physical cursor coordinates inside textarea
//   const recalculateCursors = () => {
//     const tx = textareaRef.current;
//     if (!tx || !activeFile) return;

//     const newList = Object.entries(peerCursors)
//       .filter(([_, pc]: [string, any]) => pc.fileId === activeFile.id)
//       .map(([socketId, pc]: [string, any]) => {
//         try {
//           const coords = getCaretCoordinates(tx, pc.cursorIndex);
//           return {
//             socketId,
//             userId: pc.userId,
//             username: pc.username,
//             color: pc.color,
//             x: coords.x,
//             y: coords.y,
//           };
//         } catch {
//           return null;
//         }
//       })
//       .filter(Boolean) as any[];

//     setRenderedCursors(newList);
//   };

//   useEffect(() => {
//     recalculateCursors();
//   }, [peerCursors, localContent, activeFileId]);

//   // Synchronize peer updates from the real-time collaboration channel
//   useEffect(() => {
//     if (!collabClient || !activeFile) return;

//     // Register active file selection upon mount/file change
//     collabClient.openFile(activeFile.id);

//     // Also acquire soft lock for active file
//     collabClient.acquireLock(activeFile.id);

//     // Track when other users update cursor / selection / typing
//     const originalListeners = (collabClient as any).listeners;

//     const customListeners = {
//       ...originalListeners,
//       onCursorUpdated: (data: any) => {
//         setPeerCursors((prev) => ({
//           ...prev,
//           [data.socketId]: {
//             userId: data.userId,
//             username: data.username,
//             color: data.color,
//             cursorIndex: data.cursorIndex,
//             fileId: data.fileId
//           }
//         }));
//         originalListeners?.onCursorUpdated?.(data);
//       },
//       onUserTyping: (data: any) => {
//         if (data.fileId === activeFile.id && data.userId !== "user-rishabh") {
//           setTypingUsers((prev) => ({
//             ...prev,
//             [data.userId]: data.isTyping
//           }));
//         }
//         originalListeners?.onUserTyping?.(data);
//       }
//     };

//     // Temporarily register custom listeners
//     (collabClient as any).listeners = customListeners;

//     return () => {
//       // Revert/cleanup
//       if (collabClient) {
//         collabClient.releaseLock(activeFile.id);
//         (collabClient as any).listeners = originalListeners;
//       }
//     };
//   }, [collabClient, activeFileId, activeFile?.id]);

//   // Restore cursor and scroll position for a file
//   const restoreFileState = (fileId: string) => {
//     const tx = textareaRef.current;
//     if (tx) {
//       const saved = fileStatesRef.current[fileId];
//       if (saved) {
//         requestAnimationFrame(() => {
//           tx.focus();
//           tx.setSelectionRange(saved.cursorStart, saved.cursorEnd);
//           tx.scrollTop = saved.scrollTop;
//           if (lineNumbersRef.current) {
//             lineNumbersRef.current.scrollTop = saved.scrollTop;
//           }
//         });
//       } else {
//         requestAnimationFrame(() => {
//           tx.focus();
//           tx.setSelectionRange(0, 0);
//           tx.scrollTop = 0;
//           if (lineNumbersRef.current) {
//             lineNumbersRef.current.scrollTop = 0;
//           }
//         });
//       }
//     }
//   };

//   // Synchronize on active file changes (restoring cursor and scroll state cleanly)
//   useEffect(() => {
//     if (activeFile) {
//       const currentActiveId = activeFile.id;

//       // 1. Save old file state and flush unsaved changes
//       if (prevActiveFileIdRef.current && prevActiveFileIdRef.current !== currentActiveId) {
//         const oldId = prevActiveFileIdRef.current;
//         const tx = textareaRef.current;
//         if (tx) {
//           fileStatesRef.current[oldId] = {
//             cursorStart: tx.selectionStart,
//             cursorEnd: tx.selectionEnd,
//             scrollTop: tx.scrollTop
//           };
//         }

//         if (isDirtyRef.current && lastSavedContentRef.current !== localContent) {
//           onFileUpdate(oldId, localContent);
//         }
//       }

//       // 2. Load new active file content
//       setLocalContent(activeFile.content);
//       lastSavedContentRef.current = activeFile.content;
//       isDirtyRef.current = false;
//       setIsDirty(false);
//       setActiveLineIndex(0);
//       setMatchedBracketLine(null);

//       // Restore position
//       restoreFileState(currentActiveId);

//       // Update the tracker
//       prevActiveFileIdRef.current = currentActiveId;
//     }
//   }, [activeFileId]);

//   // Synchronize with background / polling updates without overriding active typing
//   useEffect(() => {
//     if (activeFile && activeFile.id === activeFileId) {
//       const isFocused = document.activeElement === textareaRef.current;
//       const isRecentlyEdited = Date.now() - lastLocalEditTimeRef.current < 5000;

//       // Skip overwriting if the user is currently typing
//       if (isDirtyRef.current || (isFocused && isRecentlyEdited)) {
//         return;
//       }

//       // Smooth background update for clean/idle editor
//       if (activeFile.content !== localContent) {
//         const tx = textareaRef.current;
//         const start = tx ? tx.selectionStart : null;
//         const end = tx ? tx.selectionEnd : null;

//         setLocalContent(activeFile.content);
//         lastSavedContentRef.current = activeFile.content;

//         if (tx && start !== null && end !== null) {
//           requestAnimationFrame(() => {
//             tx.setSelectionRange(start, end);
//           });
//         }
//       }
//     }
//   }, [activeFile?.content, activeFileId]);

//   // Synchronize Scroll
//   const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
//     if (lineNumbersRef.current) {
//       lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
//     }
//     recalculateCursors();
//   };

//   // Select/Caret index tracker for active line rendering and bracket matching
//   const handleEditorSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
//     const tx = e.currentTarget;
//     const start = tx.selectionStart;
//     const val = tx.value;

//     // Emit local cursor & selection to socket room
//     if (collabClient && activeFile) {
//       collabClient.updateCursor(start, activeFile.id);
//       if (tx.selectionStart !== tx.selectionEnd) {
//         collabClient.updateSelection({ start: tx.selectionStart, end: tx.selectionEnd }, activeFile.id);
//       } else {
//         collabClient.updateSelection(null, activeFile.id);
//       }
//     }

//     // Track active line number
//     const textBeforeCursor = val.substring(0, start);
//     const lineNum = textBeforeCursor.split("\n").length - 1;
//     setActiveLineIndex(lineNum);

//     // Dynamic bracket matching helper
//     const char = val[start - 1] || "";
//     const openBrackets = ["{", "[", "("];
//     const closeBrackets = ["}", "]", ")"];
    
//     if (openBrackets.includes(char) || closeBrackets.includes(char)) {
//       // Find partner
//       const partner: Record<string, string> = {
//         "{": "}", "[": "]", "(": ")",
//         "}": "{", "]": "[", ")": "("
//       };
//       const matchChar = partner[char];
//       const searchForward = openBrackets.includes(char);
      
//       let balance = 1;
//       let matchedIndex = -1;

//       if (searchForward) {
//         for (let i = start; i < val.length; i++) {
//           if (val[i] === char) balance++;
//           else if (val[i] === matchChar) balance--;
          
//           if (balance === 0) {
//             matchedIndex = i;
//             break;
//           }
//         }
//       } else {
//         for (let i = start - 2; i >= 0; i--) {
//           if (val[i] === char) balance++;
//           else if (val[i] === matchChar) balance--;
          
//           if (balance === 0) {
//             matchedIndex = i;
//             break;
//           }
//         }
//       }

//       if (matchedIndex !== -1) {
//         const line = val.substring(0, matchedIndex).split("\n").length - 1;
//         setMatchedBracketLine(line);
//       } else {
//         setMatchedBracketLine(null);
//       }
//     } else {
//       setMatchedBracketLine(null);
//     }
//   };

//   // Interactive typing mechanics (Auto closing brackets/quotes & auto indent)
//   const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
//     const tx = e.currentTarget;
//     const start = tx.selectionStart;
//     const end = tx.selectionEnd;
//     const val = tx.value;

//     // Support Ctrl+S / Cmd+S for immediate save
//     if ((e.ctrlKey || e.metaKey) && e.key === "s") {
//       e.preventDefault();
//       flushSave();
//       return;
//     }

//     // 1. Indent & Outdent tabs (Tab key)
//     if (e.key === "Tab") {
//       e.preventDefault();
//       if (start !== end) {
//         // Multiline indentation block
//         const textBefore = val.substring(0, start);
//         const textAfter = val.substring(end);
//         const selectedText = val.substring(start, end);
//         const lines = selectedText.split("\n");
        
//         let newLines = [];
//         if (e.shiftKey) {
//           // Outdent
//           newLines = lines.map(line => line.startsWith("  ") ? line.substring(2) : line.startsWith(" ") ? line.substring(1) : line);
//         } else {
//           // Indent
//           newLines = lines.map(line => "  " + line);
//         }

//         const newSelectedText = newLines.join("\n");
//         const newValue = textBefore + newSelectedText + textAfter;
//         updateLocalContent(newValue);

//         setTimeout(() => {
//           tx.setSelectionRange(start, start + newSelectedText.length);
//         }, 0);
//       } else {
//         // Single line indent
//         const indent = "  ";
//         const newValue = val.substring(0, start) + indent + val.substring(end);
//         updateLocalContent(newValue);
//         setTimeout(() => {
//           tx.setSelectionRange(start + indent.length, start + indent.length);
//         }, 0);
//       }
//       return;
//     }

//     // 2. Auto closing bracket insertion
//     const openChars = ["{", "[", "(", "\"", "'", "`"];
//     const closeChars = ["}", "]", ")", "\"", "'", "`"];
//     const pairs: Record<string, string> = {
//       "{": "}", "[": "]", "(": ")",
//       "\"": "\"", "'": "'", "`": "`"
//     };

//     if (openChars.includes(e.key)) {
//       e.preventDefault();
//       const openChar = e.key;
//       const closeChar = pairs[openChar];

//       if (start !== end) {
//         // Wrap selection
//         const selectionText = val.substring(start, end);
//         const wrapped = openChar + selectionText + closeChar;
//         const newValue = val.substring(0, start) + wrapped + val.substring(end);
//         updateLocalContent(newValue);
//         setTimeout(() => {
//           tx.setSelectionRange(start + 1, end + 1);
//         }, 0);
//       } else {
//         // Standard insertion
//         const newValue = val.substring(0, start) + openChar + closeChar + val.substring(end);
//         updateLocalContent(newValue);
//         setTimeout(() => {
//           tx.setSelectionRange(start + 1, start + 1);
//         }, 0);
//       }
//       return;
//     }

//     // Overwrite closing character
//     if (closeChars.includes(e.key) && start === end && val[start] === e.key) {
//       e.preventDefault();
//       tx.setSelectionRange(start + 1, start + 1);
//       return;
//     }

//     // Backspacing empty matching pair deletes both
//     if (e.key === "Backspace" && start === end && start > 0) {
//       const prev = val[start - 1];
//       const next = val[start];
//       if (pairs[prev] === next) {
//         e.preventDefault();
//         const newValue = val.substring(0, start - 1) + val.substring(start + 1);
//         updateLocalContent(newValue);
//         setTimeout(() => {
//           tx.setSelectionRange(start - 1, start - 1);
//         }, 0);
//         return;
//       }
//     }

//     // 3. Auto indent newline on Enter
//     if (e.key === "Enter") {
//       e.preventDefault();
//       const textBeforeCursor = val.substring(0, start);
//       const linesBefore = textBeforeCursor.split("\n");
//       const currentLine = linesBefore[linesBefore.length - 1];

//       const match = currentLine.match(/^(\s*)/);
//       let indent = match ? match[1] : "";

//       const lastChar = currentLine.trim().slice(-1);
//       let extraIndent = "";
//       if (["{", "[", "("].includes(lastChar)) {
//         extraIndent = "  ";
//       }

//       const insertion = "\n" + indent + extraIndent;
//       const newValue = val.substring(0, start) + insertion + val.substring(end);
//       updateLocalContent(newValue);

//       setTimeout(() => {
//         const cur = start + insertion.length;
//         tx.setSelectionRange(cur, cur);
//         if (lineNumbersRef.current) {
//           lineNumbersRef.current.scrollTop = tx.scrollTop;
//         }
//       }, 0);
//       return;
//     }
//   };

//   const handleLocalContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
//     const value = e.target.value;
//     updateLocalContent(value);
//   };

//   // --- Tree Generation (Files & Folders) ---
//   const buildTree = (filesList: ProjectFile[]): TreeNode => {
//     const root: TreeNode = {
//       name: "root",
//       path: "",
//       isFile: false,
//       children: {}
//     };

//     // Add folder structures
//     const folderList = getAllFolders();
//     folderList.forEach(folderPath => {
//       const parts = folderPath.split("/").filter(Boolean);
//       let current = root;
//       let acc = "";
//       parts.forEach(part => {
//         acc = acc ? `${acc}/${part}` : part;
//         if (!current.children[part]) {
//           current.children[part] = {
//             name: part,
//             path: acc,
//             isFile: false,
//             children: {}
//           };
//         }
//         current = current.children[part];
//       });
//     });

//     // Populate file list nodes
//     filesList.forEach(file => {
//       const filePath = file.path || file.name;
//       const parts = filePath.split("/").filter(Boolean);
//       let current = root;
//       let acc = "";
//       for (let i = 0; i < parts.length; i++) {
//         const part = parts[i];
//         acc = acc ? `${acc}/${part}` : part;
//         const isLast = i === parts.length - 1;

//         if (!current.children[part]) {
//           current.children[part] = {
//             name: part,
//             path: acc,
//             isFile: isLast,
//             fileId: isLast ? file.id : undefined,
//             children: {}
//           };
//         } else if (isLast) {
//           current.children[part].isFile = true;
//           current.children[part].fileId = file.id;
//         }
//         current = current.children[part];
//       }
//     });

//     return root;
//   };

//   // --- Recursive Search Filter ---
//   const filterTree = (node: TreeNode, query: string): TreeNode | null => {
//     if (!query.trim()) return node;
//     const lq = query.toLowerCase();

//     if (node.isFile) {
//       if (node.name.toLowerCase().includes(lq) || node.path.toLowerCase().includes(lq)) {
//         return node;
//       }
//       return null;
//     }

//     const filteredChildren: Record<string, TreeNode> = {};
//     let childMatched = false;

//     Object.keys(node.children).forEach(key => {
//       const result = filterTree(node.children[key], query);
//       if (result) {
//         filteredChildren[key] = result;
//         childMatched = true;
//       }
//     });

//     const selfMatched = node.name.toLowerCase().includes(lq) || node.path.toLowerCase().includes(lq);

//     if (childMatched || selfMatched) {
//       return {
//         ...node,
//         children: filteredChildren
//       };
//     }

//     return null;
//   };

//   // Automatically expand matched folders during typing search
//   useEffect(() => {
//     if (workspaceSearchQuery.trim()) {
//       const q = workspaceSearchQuery.toLowerCase();
//       const expansions: Record<string, boolean> = {};

//       files.forEach(f => {
//         if (f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) {
//           const parts = f.path.split("/");
//           let acc = "";
//           for (let i = 0; i < parts.length - 1; i++) {
//             acc = acc ? `${acc}/${parts[i]}` : parts[i];
//             expansions[acc] = false; // setting value false maps to "expanded" (since we map collapsedPaths[path] = true for collapsed)
//           }
//         }
//       });

//       setCollapsedPaths(prev => {
//         const next = { ...prev };
//         Object.keys(expansions).forEach(k => {
//           next[k] = false; // force expand
//         });
//         return next;
//       });
//     }
//   }, [workspaceSearchQuery, files]);

//   // --- Folder Right Click Action Trigger Helpers ---
//   const handleFolderRenameSubmit = async (newName: string, oldPath: string) => {
//     const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/")) || "";
//     const newPath = parentPath ? `${parentPath}/${newName}` : newName;

//     try {
//       const res = await fetch("/api/files/rename-folder", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ oldFolderPath: oldPath, newFolderPath: newPath })
//       });
//       if (res.ok) {
//         // Also update virtualFolders list if it contains this path
//         setVirtualFolders(prev => 
//           prev.map(p => {
//             if (p === oldPath) return newPath;
//             if (p.startsWith(oldPath + "/")) return newPath + p.substring(oldPath.length);
//             return p;
//           })
//         );
//         onRefreshState?.();
//       }
//     } catch (err) {
//       console.error("Error renaming folder path on backend", err);
//     }
//   };

//   const handleFileRenameSubmit = async (newName: string, oldPath: string) => {
//     const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/")) || "";
//     const newPath = parentPath ? `${parentPath}/${newName}` : newName;

//     const fileToRename = files.find(f => f.path === oldPath);
//     if (!fileToRename) return;

//     // Detect language
//     let detectedLang = fileToRename.language;
//     const ext = newName.split('.').pop()?.toLowerCase();
//     if (ext === "java") detectedLang = "java";
//     else if (ext === "html" || ext === "htm") detectedLang = "html";
//     else if (ext === "css") detectedLang = "css";
//     else if (ext === "js") detectedLang = "javascript";
//     else if (ext === "py") detectedLang = "python";
//     else if (ext === "ts" || ext === "tsx") detectedLang = "typescript";

//     try {
//       const res = await fetch("/api/files/update", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ id: fileToRename.id, name: newName, path: newPath, language: detectedLang })
//       });
//       if (res.ok) {
//         onRefreshState?.();
//       }
//     } catch (err) {
//       console.error("Error renaming file path", err);
//     }
//   };

//   const handleNewFolderSubmit = (folderName: string, parentPath: string) => {
//     const newPath = parentPath ? `${parentPath}/${folderName}` : folderName;
//     if (!virtualFolders.includes(newPath)) {
//       setVirtualFolders(prev => [...prev, newPath]);
//     }
//     // Expand parent path
//     if (parentPath) {
//       setCollapsedPaths(prev => ({ ...prev, [parentPath]: false }));
//     }
//   };

//   const handleNewFileSubmit = (fileName: string, parentPath: string) => {
//     const newPath = parentPath ? `${parentPath}/${fileName}` : fileName;
    
//     // Auto detect language
//     let detectedLang = "javascript";
//     const ext = fileName.split('.').pop()?.toLowerCase();
//     if (ext === "java") detectedLang = "java";
//     else if (ext === "html" || ext === "htm") detectedLang = "html";
//     else if (ext === "css") detectedLang = "css";
//     else if (ext === "js") detectedLang = "javascript";
//     else if (ext === "py") detectedLang = "python";
//     else if (ext === "ts" || ext === "tsx") detectedLang = "typescript";

//     onFileCreate(newPath, detectedLang);
//     // Expand parent path
//     if (parentPath) {
//       setCollapsedPaths(prev => ({ ...prev, [parentPath]: false }));
//     }
//   };

//   const handleFileDuplicate = async (fileId: string) => {
//     const original = files.find(f => f.id === fileId);
//     if (!original) return;

//     const parentPath = original.path.substring(0, original.path.lastIndexOf("/")) || "";
//     const ext = original.path.split('.').pop();
//     const baseName = original.name.substring(0, original.name.lastIndexOf("."));
    
//     let duplicateName = `${baseName} - Copy.${ext}`;
//     let duplicatePath = parentPath ? `${parentPath}/${duplicateName}` : duplicateName;

//     // Check sibling collisions
//     let counter = 1;
//     while (files.some(f => f.path === duplicatePath)) {
//       duplicateName = `${baseName} - Copy (${counter}).${ext}`;
//       duplicatePath = parentPath ? `${parentPath}/${duplicateName}` : duplicateName;
//       counter++;
//     }

//     try {
//       const res = await fetch("/api/files/duplicate", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ id: fileId, newName: duplicateName, newPath: duplicatePath })
//       });
//       if (res.ok) {
//         onRefreshState?.();
//       }
//     } catch (err) {
//       console.error("Error duplicating file", err);
//     }
//   };

//   const handleFolderDelete = async (folderPath: string) => {
//     if (!confirm(`Are you sure you want to delete folder "${folderPath}" and all its contents?`)) {
//       return;
//     }

//     // Identify files to delete
//     const filesToDelete = files.filter(f => f.path.startsWith(folderPath + "/"));
    
//     // Call delete sequentially or parallelized
//     await Promise.all(
//       filesToDelete.map(f => 
//         fetch("/api/files/delete", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ id: f.id })
//         })
//       )
//     );

//     // Also remove virtual folders matching this path prefix
//     setVirtualFolders(prev => prev.filter(p => p !== folderPath && !p.startsWith(folderPath + "/")));

//     onRefreshState?.();
//   };

//   // --- Drag & Drop Operations ---
//   const handleDragStart = (e: React.DragEvent, type: "file" | "folder", path: string, id?: string) => {
//     e.dataTransfer.setData("application/json", JSON.stringify({ type, path, id }));
//     e.dataTransfer.effectAllowed = "move";
//   };

//   const handleDragOver = (e: React.DragEvent, folderPath: string) => {
//     e.preventDefault();
//     if (dragOverPath !== folderPath) {
//       setDragOverPath(folderPath);
//     }
//   };

//   const handleDrop = async (e: React.DragEvent, targetFolderPath: string) => {
//     e.preventDefault();
//     setDragOverPath(null);

//     try {
//       const dragDataStr = e.dataTransfer.getData("application/json");
//       if (!dragDataStr) return;

//       const dragData = JSON.parse(dragDataStr) as { type: "file" | "folder"; path: string; id?: string };
//       const sourcePath = dragData.path;

//       // Prevent dropping item into itself or same folder
//       if (sourcePath === targetFolderPath) return;
//       if (targetFolderPath.startsWith(sourcePath + "/")) return;

//       const parts = sourcePath.split("/");
//       const itemName = parts[parts.length - 1];
//       const destinationPath = targetFolderPath ? `${targetFolderPath}/${itemName}` : itemName;

//       if (dragData.type === "file") {
//         if (!dragData.id) return;
//         // Move single file
//         const res = await fetch("/api/files/update", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ id: dragData.id, path: destinationPath })
//         });
//         if (res.ok) {
//           onRefreshState?.();
//         }
//       } else {
//         // Move folder
//         const res = await fetch("/api/files/rename-folder", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ oldFolderPath: sourcePath, newFolderPath: destinationPath })
//         });
//         if (res.ok) {
//           // Update virtual folders local state
//           setVirtualFolders(prev => 
//             prev.map(p => {
//               if (p === sourcePath) return destinationPath;
//               if (p.startsWith(sourcePath + "/")) return destinationPath + p.substring(sourcePath.length);
//               return p;
//             })
//           );
//           onRefreshState?.();
//         }
//       }
//     } catch (err) {
//       console.error("Error performing file drag drop update", err);
//     }
//   };

//   // --- Keyboard Tree Navigation state ---
//   const [focusedPath, setFocusedPath] = useState<string | null>(null);

//   const getVisibleNodes = (node: TreeNode, visibleList: TreeNode[] = []): TreeNode[] => {
//     const keys = Object.keys(node.children).sort((a, b) => {
//       const aN = node.children[a];
//       const bN = node.children[b];
//       if (aN.isFile !== bN.isFile) return aN.isFile ? 1 : -1;
//       return a.localeCompare(b);
//     });

//     keys.forEach(k => {
//       const child = node.children[k];
//       visibleList.push(child);
//       const isCollapsed = collapsedPaths[child.path];
//       if (!child.isFile && !isCollapsed) {
//         getVisibleNodes(child, visibleList);
//       }
//     });

//     return visibleList;
//   };

//   // Listen to keyboard navigation over tree nodes
//   const handleTreeKeyDown = (e: React.KeyboardEvent) => {
//     const visibleNodes = getVisibleNodes(buildTree(files));
//     if (visibleNodes.length === 0) return;

//     const currentIndex = visibleNodes.findIndex(node => node.path === focusedPath);

//     if (e.key === "ArrowDown") {
//       e.preventDefault();
//       const nextNode = visibleNodes[(currentIndex + 1) % visibleNodes.length];
//       if (nextNode) setFocusedPath(nextNode.path);
//     } else if (e.key === "ArrowUp") {
//       e.preventDefault();
//       const prevNode = visibleNodes[(currentIndex - 1 + visibleNodes.length) % visibleNodes.length];
//       if (prevNode) setFocusedPath(prevNode.path);
//     } else if (e.key === "ArrowRight") {
//       e.preventDefault();
//       if (focusedPath) {
//         const node = visibleNodes.find(n => n.path === focusedPath);
//         if (node && !node.isFile) {
//           if (collapsedPaths[focusedPath]) {
//             // Expand
//             setCollapsedPaths(prev => ({ ...prev, [focusedPath]: false }));
//           } else {
//             // Move into children
//             const childKeys = Object.keys(node.children);
//             if (childKeys.length > 0) {
//               setFocusedPath(node.children[childKeys[0]].path);
//             }
//           }
//         }
//       }
//     } else if (e.key === "ArrowLeft") {
//       e.preventDefault();
//       if (focusedPath) {
//         const node = visibleNodes.find(n => n.path === focusedPath);
//         if (node && !node.isFile && !collapsedPaths[focusedPath]) {
//           // Collapse
//           setCollapsedPaths(prev => ({ ...prev, [focusedPath]: true }));
//         } else {
//           // Move to parent
//           const parentPath = focusedPath.substring(0, focusedPath.lastIndexOf("/"));
//           if (parentPath) {
//             setFocusedPath(parentPath);
//           }
//         }
//       }
//     } else if (e.key === "Enter") {
//       e.preventDefault();
//       if (focusedPath) {
//         const node = visibleNodes.find(n => n.path === focusedPath);
//         if (node) {
//           if (node.isFile && node.fileId) {
//             openFile(node.fileId);
//           } else {
//             setCollapsedPaths(prev => ({ ...prev, [focusedPath]: !prev[focusedPath] }));
//           }
//         }
//       }
//     } else if (e.key === "Delete") {
//       e.preventDefault();
//       if (focusedPath) {
//         const node = visibleNodes.find(n => n.path === focusedPath);
//         if (node) {
//           if (node.isFile && node.fileId) {
//             if (confirm(`Are you sure you want to delete ${node.name}?`)) {
//               onFileDelete(node.fileId);
//             }
//           } else {
//             handleFolderDelete(node.path);
//           }
//         }
//       }
//     } else if (e.key === "F2") {
//       e.preventDefault();
//       if (focusedPath) {
//         const node = visibleNodes.find(n => n.path === focusedPath);
//         if (node) {
//           setRenameOriginalName(node.name);
//           setRenameTargetPath(node.path);
//           setCreateModalType(node.isFile ? "file" : "folder");
//           setCreateModalOpen(true);
//         }
//       }
//     }
//   };

//   // --- Rendering single Tree Nodes ---
//   const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
//     const childKeys = Object.keys(node.children).sort((a, b) => {
//       const aNode = node.children[a];
//       const bNode = node.children[b];
//       if (aNode.isFile !== bNode.isFile) {
//         return aNode.isFile ? 1 : -1;
//       }
//       return a.localeCompare(b);
//     });

//     const isCollapsed = collapsedPaths[node.path];

//     return (
//       <div key={node.path || "root"} className="space-y-0.5 animate-fade-in">
//         {node.path && (
//           node.isFile ? (
//             // File item Row
//             (() => {
//               const isSelected = node.fileId === activeFileId;
//               const isFocused = node.path === focusedPath;
//               const viewers = users.filter((u) => u.activeFileId === node.fileId && u.id !== "user-rishabh");
              
//               return (
//                 <div
//                   draggable
//                   onDragStart={(e) => handleDragStart(e, "file", node.path, node.fileId)}
//                   onClick={() => node.fileId && openFile(node.fileId)}
//                   onContextMenu={(e) => handleContextMenu(e, "file", node.path, node.fileId)}
//                   className={`group flex items-center justify-between py-1.5 px-2.5 rounded-lg cursor-pointer transition-all select-none border-l-2 outline-none ${
//                     isSelected 
//                       ? "bg-indigo-600/15 text-white font-semibold border-indigo-500 shadow-sm" 
//                       : "text-zinc-400 hover:bg-zinc-900/30 hover:text-zinc-200 border-transparent"
//                   } ${isFocused ? "ring-1 ring-indigo-500/50" : ""}`}
//                   style={{ paddingLeft: `${depth * 10 + 8}px` }}
//                 >
//                   <div className="flex items-center gap-2 overflow-hidden">
//                     <span className="flex-shrink-0"><FileIcon fileName={node.name} /></span>
//                     <span className="text-xs font-mono truncate">{node.name}</span>
//                   </div>
                  
//                   <div className="flex items-center gap-1.5 flex-shrink-0">
//                     {viewers.map((u) => (
//                       <span
//                         key={u.id}
//                         className="w-1.5 h-1.5 rounded-full ring-1 ring-[#050505] transform animate-pulse"
//                         style={{ backgroundColor: u.color }}
//                         title={`${u.name} is working here`}
//                       />
//                     ))}
//                     {files.length > 1 && node.fileId && (
//                       <button
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           if (confirm(`Are you sure you want to delete ${node.name}?`)) {
//                             onFileDelete(node.fileId!);
//                           }
//                         }}
//                         className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-rose-400 rounded transition cursor-pointer"
//                         title="Delete file"
//                       >
//                         <Trash2 className="w-3.5 h-3.5" />
//                       </button>
//                     )}
//                   </div>
//                 </div>
//               );
//             })()
//           ) : (
//             // Folder item Row
//             (() => {
//               const isFolderCollapsed = collapsedPaths[node.path];
//               const isFocused = node.path === focusedPath;
//               const isDragTarget = dragOverPath === node.path;

//               return (
//                 <div
//                   draggable
//                   onDragStart={(e) => handleDragStart(e, "folder", node.path)}
//                   onDragOver={(e) => handleDragOver(e, node.path)}
//                   onDrop={(e) => handleDrop(e, node.path)}
//                   onContextMenu={(e) => handleContextMenu(e, "folder", node.path)}
//                   onClick={() => {
//                     setCollapsedPaths(prev => ({
//                       ...prev,
//                       [node.path]: !prev[node.path]
//                     }));
//                   }}
//                   className={`group flex items-center justify-between py-1.5 px-2.5 rounded-lg cursor-pointer transition-all select-none hover:bg-zinc-900/30 text-zinc-300 font-mono text-xs hover:text-zinc-100 ${
//                     isFocused ? "ring-1 ring-indigo-500/50" : ""
//                   } ${isDragTarget ? "bg-indigo-600/20 border-l-2 border-indigo-400" : ""}`}
//                   style={{ paddingLeft: `${depth * 10 + 4}px` }}
//                 >
//                   <div className="flex items-center gap-1.5 overflow-hidden">
//                     {isFolderCollapsed ? (
//                       <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 transition-transform duration-200" />
//                     ) : (
//                       <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 transition-transform duration-200 transform rotate-0" />
//                     )}
//                     <FolderIcon isOpen={!isFolderCollapsed} />
//                     <span className="truncate font-semibold text-zinc-300">{node.name}</span>
//                   </div>

//                   <div className="flex items-center opacity-0 group-hover:opacity-100 gap-1 flex-shrink-0">
//                     <button
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         setCreateModalParentPath(node.path);
//                         setCreateModalType("file");
//                         setRenameOriginalName(undefined);
//                         setCreateModalOpen(true);
//                       }}
//                       className="p-0.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition cursor-pointer"
//                       title="New File inside folder"
//                     >
//                       <Plus className="w-3.5 h-3.5" />
//                     </button>
//                   </div>
//                 </div>
//               );
//             })()
//           )
//         )}

//         {/* Child Items */}
//         {(!node.path || !isCollapsed) && childKeys.length > 0 && (
//           <div className="space-y-0.5 pl-0.5">
//             {childKeys.map(key => renderTreeNode(node.children[key], depth + 1))}
//           </div>
//         )}
//       </div>
//     );
//   };

//   // --- Real-time voice and review API methods ---
//   const [isAILoading, setIsAILoading] = useState(false);
//   const [aiResponse, setAiResponse] = useState<string | null>(null);
//   const [aiMode, setAiMode] = useState<"review" | "debug">("review");
//   const [debugQuery, setDebugQuery] = useState("");

//   const [isCompiling, setIsCompiling] = useState(false);
//   const [compilerOutput, setCompilerOutput] = useState<string | null>(null);
//   const [compilerMode, setCompilerMode] = useState<"terminal" | "preview">("terminal");
//   const [previewKey, setPreviewKey] = useState(0);

//   const [focusMode, setFocusMode] = useState<"normal" | "editor" | "output">("normal");
//   const [isAIOpenedFloating, setIsAIOpenedFloating] = useState(false);
//   const aiOverlayRef = useRef<HTMLDivElement>(null);

//   // Click outside to collapse floating AI assistant
//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (
//         isAIOpenedFloating &&
//         aiOverlayRef.current &&
//         !aiOverlayRef.current.contains(event.target as Node)
//       ) {
//         const clickedOpenBtn = (event.target as HTMLElement).closest('[aria-label="Open AI Assistant"]');
//         if (!clickedOpenBtn) {
//           setIsAIOpenedFloating(false);
//         }
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, [isAIOpenedFloating]);

//   useEffect(() => {
//     if (activeFile) {
//       if (activeFile.language === "html" || activeFile.language === "css") {
//         setCompilerMode("preview");
//       } else {
//         setCompilerMode("terminal");
//       }
//     }
//   }, [activeFileId]);

//   // Call server-side code reviews
//   const runCodeReview = async () => {
//     if (!activeFile) return;
//     flushSave();
//     setIsAILoading(true);
//     setAiMode("review");
//     setAiResponse(null);

//     try {
//       const res = await fetch("/api/ai/review", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           fileName: activeFile.name,
//           fileContent: localContent,
//           language: activeFile.language
//         })
//       });
//       const data = await res.json();
//       if (data.success) {
//         setAiResponse(data.review);
//       } else {
//         setAiResponse(`Failed: ${data.error}`);
//       }
//     } catch (err: any) {
//       setAiResponse(`Error conducting AI review: ${err.message}`);
//     } finally {
//       setIsAILoading(false);
//     }
//   };

//   // Call server debug assistance
//   const runAIDebug = async () => {
//     if (!activeFile) return;
//     flushSave();
//     setIsAILoading(true);
//     setAiMode("debug");
//     setAiResponse(null);

//     try {
//       const res = await fetch("/api/ai/debug", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           fileName: activeFile.name,
//           fileContent: localContent,
//           language: activeFile.language,
//           query: debugQuery
//         })
//       });
//       const data = await res.json();
//       if (data.success) {
//         setAiResponse(data.suggestions);
//       } else {
//         setAiResponse(`Failed: ${data.error}`);
//       }
//     } catch (err: any) {
//       setAiResponse(`Error generating debug suggestions: ${err.message}`);
//     } finally {
//       setIsAILoading(false);
//     }
//   };

//   // --- Judge0 language detection -----------------------------------------
//   // Maps a file's extension to the language identifier the /api/compiler/execute
//   // endpoint (and Judge0) expects. Returns null for anything we can't execute
//   // server-side (e.g. html/css, which are handled by the live preview iframe instead).
//   const detectLanguageFromFile = (fileName: string): "python" | "java" | "cpp" | "javascript" | null => {
//     const ext = fileName.split(".").pop()?.toLowerCase() || "";
//     switch (ext) {
//       case "py":
//         return "python";
//       case "java":
//         return "java";
//       case "cpp":
//       case "cc":
//       case "cxx":
//         return "cpp";
//       case "js":
//       case "mjs":
//       case "cjs":
//         return "javascript";
//       default:
//         return null;
//     }
//   };

//   // Call the real Judge0-backed compiler execution endpoint
//   const runCompiler = async () => {
//     if (!activeFile) return;

//     // Live-previewable files (html/css) don't go through Judge0 - just show the sandbox iframe
//     const runnableLanguage = detectLanguageFromFile(activeFile.name);
//     if (!runnableLanguage) {
//       if (activeFile.language === "html" || activeFile.language === "css" || activeFile.name.endsWith(".html") || activeFile.name.endsWith(".css")) {
//         setCompilerMode("preview");
//         setPreviewKey(prev => prev + 1);
//         return;
//       }
//       setCompilerMode("terminal");
//       setCompilerOutput(`Unsupported file type for execution: "${activeFile.name}".\nSupported languages: Python (.py), Java (.java), C++ (.cpp), JavaScript (.js).`);
//       return;
//     }

//     // Prevent duplicate compilation/zombie processes
//     if (compilerAbortControllerRef.current) {
//       compilerAbortControllerRef.current.abort();
//     }

//     flushSave();
//     setIsCompiling(true);
//     setCompilerMode("terminal");
//     setCompilerOutput("Submitting code to compiler service... executing...\n");

//     const abortController = new AbortController();
//     compilerAbortControllerRef.current = abortController;

//     // Judge0 execution (compile + run + queue time) can take longer than a typical
//     // fetch, so allow a generous 20-second client-side timeout.
//     const timeoutId = setTimeout(() => {
//       if (compilerAbortControllerRef.current === abortController) {
//         abortController.abort();
//       }
//     }, 20000);

//     try {
//       const res = await fetch("/api/compiler/execute", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           language: runnableLanguage,
//           code: localContent,
//           input: "" // no stdin panel wired up yet; reserved for future use
//         }),
//         signal: abortController.signal
//       });

//       clearTimeout(timeoutId);

//       const data = await res.json();

//       // New contract: { output, error, status, executionTime? }
//       if (data.error) {
//         const statusLabel = data.status ? `${data.status}:\n` : "";
//         setCompilerOutput(`${statusLabel}${data.error}`);
//       } else {
//         const timeLine = data.executionTime ? `\n\n[Finished in ${data.executionTime}]` : "";
//         setCompilerOutput(`${data.output || ""}${timeLine}`);
//       }
//     } catch (err: any) {
//       if (err.name === 'AbortError') {
//         setCompilerOutput("Compilation cancelled or timed out.");
//       } else {
//         setCompilerOutput(`Failed to reach compiler executor: ${err.message}`);
//       }
//     } finally {
//       if (compilerAbortControllerRef.current === abortController) {
//         setIsCompiling(false);
//         compilerAbortControllerRef.current = null;
//       }
//     }
//   };

//   const generateLivePreviewSrcDoc = () => {
//     let htmlFile = files.find(f => f.language === "html");
//     if (!htmlFile && activeFile?.language === "html") {
//       htmlFile = activeFile;
//     }

//     if (!htmlFile) {
//       return `<!DOCTYPE html>
// <html>
// <head>
//   <style>
//     body { background-color: #0b0f19; color: #64748b; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
//     .msg { text-align: center; border: 1px dashed #334155; padding: 24px; border-radius: 12px; max-width: 350px; }
//     h3 { color: #f1f5f9; margin-top: 0; }
//   </style>
// </head>
// <body>
//   <div class="msg">
//     <h3>Design Live Sandbox Viewport</h3>
//     <p>Please select, edit, or create an <b>index.html</b> file to render the web page layout on-the-fly!</p>
//   </div>
// </body>
// </html>`;
//     }

//     let htmlContent = htmlFile.content;
//     const cssFile = files.find(f => f.language === "css" || f.name.endsWith(".css"));
//     if (cssFile) {
//       const inlineStyle = `<style>\n${cssFile.content}\n</style>`;
//       if (htmlContent.includes("</head>")) {
//         htmlContent = htmlContent.replace("</head>", `${inlineStyle}\n</head>`);
//       } else {
//         htmlContent = inlineStyle + htmlContent;
//       }
//     }

//     const jsFile = files.find(f => f.language === "javascript" || f.name.endsWith(".js"));
//     if (jsFile) {
//       const inlineScript = `<script>\n(function() {\n  const originalLog = console.log;\n  console.log = function(...args) {\n    originalLog.apply(console, args);\n    window.parent.postMessage({ type: 'LIVE_CONSOLE_LOG', text: args.join(' ') }, '*');\n  };\n})();\n${jsFile.content}\n</script>`;
//       if (htmlContent.includes("</body>")) {
//         htmlContent = htmlContent.replace("</body>", `${inlineScript}\n</body>`);
//       } else {
//         htmlContent = htmlContent + inlineScript;
//       }
//     }

//     return htmlContent;
//   };

//   useEffect(() => {
//     const handleLogMessage = (e: MessageEvent) => {
//       if (e.data && e.data.type === 'LIVE_CONSOLE_LOG') {
//         setCompilerOutput(prev => {
//           const prefix = prev && prev.includes("Initializing compiler") ? "" : (prev || "");
//           return prefix + `[Live Preview Console]: ${e.data.text}\n`;
//         });
//       }
//     };
//     window.addEventListener("message", handleLogMessage);
//     return () => window.removeEventListener("message", handleLogMessage);
//   }, []);

//   const activeFileUsers = users.filter((u) => u.activeFileId === activeFile?.id);

//   const renderAIAssistantContent = (isFloating: boolean) => {
//     return (
//       <div className="flex flex-col h-full animate-fade-in">
//         <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-850">
//           <div className="flex items-center gap-2">
//             <Sparkles className="w-4 h-4 text-indigo-400" />
//             <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">AI Assistant</h3>
//           </div>
//           {isFloating && (
//             <button
//               onClick={() => setIsAIOpenedFloating(false)}
//               className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center"
//               title="Minimize AI Assistant"
//             >
//               <ChevronRight className="w-4 h-4" />
//             </button>
//           )}
//         </div>

//         <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-xl mb-4 border border-zinc-850">
//           <button
//             onClick={() => {
//               setAiMode("review");
//               setAiResponse(null);
//             }}
//             className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
//               aiMode === "review" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-500 hover:text-white"
//             }`}
//           >
//             Code Review
//           </button>
//           <button
//             onClick={() => {
//               setAiMode("debug");
//               setAiResponse(null);
//             }}
//             className={`py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
//               aiMode === "debug" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-500 hover:text-white"
//             }`}
//           >
//             AI Debugger
//           </button>
//         </div>

//         {aiMode === "debug" && (
//           <div className="mb-3 space-y-2">
//             <label className="block text-[10px] text-zinc-500 font-mono">DESCRIBE THE BUG / ISSUE</label>
//             <div className="flex gap-1.5">
//               <input
//                 type="text"
//                 placeholder="Why is index out of bounds here?"
//                 value={debugQuery}
//                 onChange={(e) => setDebugQuery(e.target.value)}
//                 className="flex-1 bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500"
//               />
//               <button
//                 onClick={runAIDebug}
//                 disabled={isAILoading}
//                 className="px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
//               >
//                 Go
//               </button>
//             </div>
//           </div>
//         )}

//         <div className="flex-1 overflow-y-auto bg-black/40 rounded-xl p-3.5 border border-zinc-850 font-sans text-xs text-zinc-350 leading-relaxed select-text">
//           {isAILoading ? (
//             <div className="h-full flex flex-col items-center justify-center space-y-3">
//               <div className="relative w-8 h-8">
//                 <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full" />
//                 <div className="absolute inset-0 border-2 border-t-indigo-500 rounded-full animate-spin" />
//               </div>
//               <span className="text-zinc-500 text-[10px] font-mono animate-pulse">Consulting Gemini models...</span>
//             </div>
//           ) : aiResponse ? (
//             <div className="space-y-2 whitespace-pre-line prose prose-invert">
//               {aiResponse}
//             </div>
//           ) : (
//             <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center px-2 space-y-2">
//               <Sparkles className="w-8 h-8 text-zinc-700 animate-pulse" />
//               <p className="text-[11px] text-zinc-500 leading-normal">Request a <strong className="text-zinc-400">Gemini Code Review</strong> of your active file, or use the <strong className="text-zinc-400">AI Debugger</strong> to resolve specific runtime questions.</p>
//             </div>
//           )}
//         </div>

//         <div className="mt-3 text-[10px] text-zinc-600 text-center font-mono uppercase tracking-wider">
//           Powered by Gemini 3.5 Flash
//         </div>
//       </div>
//     );
//   };

//   // Compile lines of editor code
//   const lines = localContent.split("\n");

//   return (
//     <div id="ide-workspace-root" className="flex flex-col lg:flex-row gap-6 relative">
      
//       {/* 1. File Explorer / Project Workspace Panel */}
//       <div
//         style={{
//           transition: "flex-basis 250ms ease-in-out, width 250ms ease-in-out, opacity 250ms ease-in-out"
//         }}
//         className={`flex-grow-0 flex-shrink-0 bg-[#0a0a0c] rounded-2xl border border-zinc-850 flex flex-col h-[680px] shadow-2xl relative transition-all overflow-hidden ${
//           sidebarCollapsed 
//             ? "lg:basis-[60px] w-14 p-2 items-center" 
//             : "w-full lg:w-auto lg:basis-[23%] p-4"
//         }`}
//       >
//         {sidebarCollapsed ? (
//           // Sleek sidebar mini control rail
//           <div className="flex flex-col items-center gap-4 py-2 w-full h-full text-zinc-400">
//             <button
//               onClick={() => setSidebarCollapsed(false)}
//               className="p-2 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
//               title="Expand Explorer Panel"
//             >
//               <PanelLeft className="w-4 h-4" />
//             </button>
//             <div className="border-b border-zinc-850 w-full my-1"></div>
//             <button
//               onClick={() => setQuickSearchOpen(true)}
//               className="p-2.5 bg-zinc-900/40 hover:bg-zinc-900 text-indigo-400 hover:text-indigo-300 rounded-lg transition cursor-pointer"
//               title="Search Files (Ctrl+P)"
//             >
//               <Search className="w-4 h-4" />
//             </button>
//             <button
//               onClick={() => {
//                 setCreateModalParentPath("");
//                 setCreateModalType("file");
//                 setRenameOriginalName(undefined);
//                 setCreateModalOpen(true);
//               }}
//               className="p-2.5 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded-lg transition cursor-pointer"
//               title="New File"
//             >
//               <Plus className="w-4 h-4" />
//             </button>
//           </div>
//         ) : (
//           // Comprehensive Full Size Explorer Panel
//           <>
//             <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-850">
//               <div className="flex items-center gap-2">
//                 <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Project Workspace</h3>
//               </div>
//               <div className="flex items-center gap-1">
//                 <button
//                   onClick={() => {
//                     const allPaths = getAllFolders();
//                     const collapsed: Record<string, boolean> = {};
//                     allPaths.forEach(p => { collapsed[p] = true; });
//                     setCollapsedPaths(collapsed);
//                   }}
//                   className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 rounded transition cursor-pointer"
//                   title="Collapse All"
//                 >
//                   <EyeOff className="w-3.5 h-3.5" />
//                 </button>
//                 <button
//                   onClick={() => {
//                     setCollapsedPaths({});
//                   }}
//                   className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 rounded transition cursor-pointer"
//                   title="Expand All"
//                 >
//                   <List className="w-3.5 h-3.5" />
//                 </button>
//                 <div ref={createMenuRef} className="relative">
//                   <button
//                     onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
//                     className="p-1 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded transition cursor-pointer flex items-center justify-center"
//                     title="Create Menu"
//                   >
//                     <Plus className="w-4 h-4" />
//                   </button>
//                   {isCreateMenuOpen && (
//                     <div className="absolute right-0 top-6 w-36 bg-[#0e0e11] border border-zinc-800 rounded-xl shadow-2xl p-1 z-50 text-xs text-zinc-300 flex flex-col space-y-0.5 animate-fade-scale">
//                       <button
//                         onClick={() => {
//                           setIsCreateMenuOpen(false);
//                           setCreateModalParentPath("");
//                           setCreateModalType("file");
//                           setRenameOriginalName(undefined);
//                           setCreateModalOpen(true);
//                         }}
//                         className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white rounded-lg transition text-left cursor-pointer"
//                       >
//                         <FileCode className="w-3.5 h-3.5 text-indigo-400" />
//                         New File
//                       </button>
//                       <button
//                         onClick={() => {
//                           setIsCreateMenuOpen(false);
//                           setCreateModalParentPath("");
//                           setCreateModalType("folder");
//                           setRenameOriginalName(undefined);
//                           setCreateModalOpen(true);
//                         }}
//                         className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white rounded-lg transition text-left cursor-pointer"
//                       >
//                         <Folder className="w-3.5 h-3.5 text-indigo-400" />
//                         New Folder
//                       </button>
//                     </div>
//                   )}
//                 </div>
//                 <button
//                   onClick={() => setSidebarCollapsed(true)}
//                   className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 rounded transition cursor-pointer"
//                   title="Collapse Sidebar"
//                 >
//                   <PanelLeftClose className="w-3.5 h-3.5" />
//                 </button>
//               </div>
//             </div>

//             {/* Sticky Search bar */}
//             <div className="relative mb-3 sticky top-0 z-10 bg-[#0a0a0c] pb-1">
//               <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
//               <input
//                 type="text"
//                 placeholder="Search files... (Ctrl+P)"
//                 value={workspaceSearchQuery}
//                 onChange={(e) => setWorkspaceSearchQuery(e.target.value)}
//                 className="w-full bg-[#050505] border border-zinc-850 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-600 font-mono"
//               />
//               {workspaceSearchQuery && (
//                 <button 
//                   onClick={() => setWorkspaceSearchQuery("")}
//                   className="absolute right-2.5 top-2 hover:bg-zinc-900 p-0.5 rounded text-zinc-500 hover:text-white transition"
//                 >
//                   <X className="w-3 h-3" />
//                 </button>
//               )}
//             </div>

//             {/* Navigation Instruction Tip */}
//             <div className="flex items-center gap-1.5 px-2 py-1 mb-2 bg-zinc-950 border border-zinc-900 rounded-lg text-[9px] font-mono text-zinc-500 select-none">
//               <Keyboard className="w-3 h-3 text-zinc-600" />
//               <span><b>Arrows</b> navigate, <b>Enter</b> opens, <b>F2</b> renames</span>
//             </div>

//             {/* Tree root box */}
//             <div 
//               tabIndex={0}
//               onKeyDown={handleTreeKeyDown}
//               onDragOver={(e) => handleDragOver(e, "")}
//               onDrop={(e) => handleDrop(e, "")}
//               className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono outline-none scrollbar-thin scrollbar-thumb-zinc-800"
//             >
//               {renderTreeNode(filterTree(buildTree(files), workspaceSearchQuery) || buildTree(files), -1)}
//             </div>

//             {/* Sync diagnostics indicator */}
//             <div className="mt-3 pt-2.5 border-t border-zinc-850 flex items-center justify-between text-[10px] font-mono text-zinc-500 select-none">
//               <div className="flex items-center gap-1.5">
//                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
//                 <span>Collab Live Sync</span>
//               </div>
//               <span className="text-[9px] text-zinc-600 uppercase">IDE v2.0.0</span>
//             </div>
//           </>
//         )}
//       </div>

//       {/* 2. Professional Tabbed Editor Workspace Frame */}
//       <div 
//         className={`flex-1 flex flex-col bg-[#050505] border border-zinc-850 rounded-2xl h-[680px] shadow-2xl overflow-hidden transition-all duration-300 ease-in-out ${
//           focusMode !== "normal" ? "lg:basis-[100%] z-30" : "lg:basis-[54%]"
//         }`}
//       >
//         {/* Horizontal File Tabs Bar */}
//         <div className="bg-zinc-950 border-b border-zinc-900 flex items-center justify-between pl-3 pr-4 h-11 select-none overflow-hidden flex-shrink-0">
//           <div className="flex items-center gap-1 overflow-x-auto h-full scrollbar-none max-w-[80%] pr-4">
//             {openFileIds.map(tabId => {
//               const file = files.find(f => f.id === tabId);
//               if (!file) return null;
//               const isSelected = tabId === activeFileId;
//               const hasDirtyState = isDirty && isSelected;
              
//               return (
//                 <div
//                   key={tabId}
//                   onClick={() => openFile(tabId)}
//                   onMouseDown={(e) => {
//                     if (e.button === 1) { // Middle click close
//                       e.preventDefault();
//                       closeTab(tabId);
//                     }
//                   }}
//                   className={`group flex items-center gap-2 px-3.5 h-full border-b-2 cursor-pointer transition text-xs font-mono select-none ${
//                     isSelected 
//                       ? "bg-zinc-900/60 text-white font-semibold border-indigo-500" 
//                       : "text-zinc-500 hover:bg-zinc-900/20 hover:text-zinc-300 border-transparent"
//                   }`}
//                 >
//                   <FileIcon fileName={file.name} className="w-3.5 h-3.5" />
//                   <span>{file.name}</span>
                  
//                   {/* Close or Unsaved indicator */}
//                   <div className="relative w-4 h-4 flex items-center justify-center">
//                     {hasDirtyState ? (
//                       // Unsaved changes solid circle indicator
//                       <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full group-hover:hidden transition-all duration-150" />
//                     ) : null}
//                     <button
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         closeTab(tabId);
//                       }}
//                       className={`p-0.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-white transition absolute inset-0 flex items-center justify-center ${
//                         hasDirtyState
//                           ? "hidden group-hover:flex"
//                           : "opacity-0 group-hover:opacity-100"
//                       }`}
//                     >
//                       <X className="w-3 h-3" />
//                     </button>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>

//           <div className="flex items-center gap-2">
//             {/* Active Typing indicators list */}
//             {Object.keys(typingUsers).filter(uid => typingUsers[uid]).length > 0 && (
//               <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-850 animate-pulse mr-1 select-none">
//                 <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
//                 <span>
//                   {Object.keys(typingUsers).filter(uid => typingUsers[uid]).map(uId => users.find(u => u.id === uId)?.name || "Peer").join(", ")} typing...
//                 </span>
//               </div>
//             )}

//             <button
//               onClick={() => setWordWrap(!wordWrap)}
//               className={`p-1.5 hover:bg-zinc-900 rounded-lg transition-all ${wordWrap ? "text-indigo-400 bg-indigo-500/5" : "text-zinc-500"}`}
//               title="Toggle Word Wrap"
//             >
//               <AlignLeft className="w-4 h-4" />
//             </button>
//             <button
//               onClick={runCompiler}
//               disabled={isCompiling}
//               className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm shadow-emerald-600/10 cursor-pointer"
//               title="Compile and run current file"
//             >
//               <Play className="w-3.5 h-3.5 fill-white" />
//               {isCompiling ? "Running..." : "Run"}
//             </button>
            
//             {/* Expand Focus Button */}
//             <button
//               onClick={() => setFocusMode(focusMode === "editor" ? "normal" : "editor")}
//               className="hidden lg:flex items-center justify-center p-1.5 hover:bg-zinc-900 text-zinc-500 hover:text-white rounded-lg transition"
//               title={focusMode === "editor" ? "Exit Focus Mode (ESC)" : "Code Editor Focus Mode"}
//             >
//               {focusMode === "editor" ? (
//                 <Minimize2 className="w-4 h-4 text-indigo-400" />
//               ) : (
//                 <Maximize2 className="w-4 h-4" />
//               )}
//             </button>
//           </div>
//         </div>

//         {/* Interactive Editor Window */}
//         {activeFile ? (
//           <div className="flex-1 flex flex-col overflow-hidden relative">
//             {/* Soft Lock alert banner */}
//             {fileLocks.some(l => l.fileId === activeFile.id && l.userId !== "user-rishabh") && (
//               <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-400 select-none animate-fade-in flex-shrink-0">
//                 <div className="flex items-center gap-2">
//                   <AlertCircle className="w-4 h-4 text-amber-500 animate-pulse" />
//                   <span>
//                     Currently editing: <b>{fileLocks.find(l => l.fileId === activeFile.id && l.userId !== "user-rishabh")?.username}</b>. Be mindful of concurrent edits.
//                   </span>
//                 </div>
//                 <span className="text-[9px] bg-amber-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">Collab Conflict Alert</span>
//               </div>
//             )}

//             <div className={`flex overflow-hidden font-mono text-xs leading-relaxed relative bg-[#050505]/60 transition-all duration-300 ease-in-out ${
//               focusMode === "output"
//                 ? "basis-0 h-0 opacity-0 pointer-events-none flex-grow-0 flex-shrink-0 border-none"
//                 : "flex-1 h-full opacity-100"
//             }`}>
              
//               {/* Line Numbers column */}
//               <div 
//                 ref={lineNumbersRef}
//                 className="w-11 select-none text-right pr-3.5 pl-1 py-5 text-zinc-600 bg-zinc-950/60 border-r border-zinc-900 overflow-hidden text-[11px] font-mono leading-[18px]"
//                 style={{ userSelect: "none" }}
//               >
//                 <pre className="text-right select-none font-mono text-[11px] leading-[18px] text-zinc-650 h-full">
//                   {Array.from({ length: lines.length }, (_, i) => i + 1).join("\n")}
//                 </pre>
//               </div>

//               {/* Textarea wrapped in layout */}
//               <div className="flex-1 relative h-full overflow-hidden">
//                 {/* Active Line Highlight overlay */}
//                 <div 
//                   className="absolute left-0 right-0 h-[18px] bg-indigo-500/5 border-y border-indigo-500/10 pointer-events-none transition-all duration-75"
//                   style={{
//                     top: `${activeLineIndex * 18 + 20}px`
//                   }}
//                 />

//                 {/* Live Peer Blinking Cursors overlay */}
//                 {renderedCursors.map((pc) => (
//                   <div
//                     key={pc.socketId}
//                     className="absolute pointer-events-none z-20 flex flex-col items-start transition-all duration-75 ease-out"
//                     style={{
//                       left: `${pc.x + 20}px`, // matches p-5 padding offset
//                       top: `${pc.y + 20}px`
//                     }}
//                   >
//                     {/* Vertical blinking bar */}
//                     <div 
//                       className="w-[2px] h-[18px]"
//                       style={{ backgroundColor: pc.color }}
//                     />
//                     {/* Floating name badge */}
//                     <div 
//                       className="mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-sans font-medium text-white shadow-lg flex items-center gap-1 uppercase tracking-wider whitespace-nowrap animate-fade-in"
//                       style={{ backgroundColor: pc.color }}
//                     >
//                       {pc.username}
//                     </div>
//                   </div>
//                 ))}
                
//                 <textarea
//                   ref={textareaRef}
//                   value={localContent}
//                   onChange={handleLocalContentChange}
//                   onKeyDown={handleEditorKeyDown}
//                   onScroll={handleEditorScroll}
//                   onSelect={handleEditorSelection}
//                   onBlur={flushSave}
//                   spellCheck={false}
//                   placeholder="// Begin editing live code..."
//                   className={`absolute inset-0 p-5 bg-transparent text-zinc-300 font-mono text-[13px] leading-relaxed focus:outline-none resize-none overflow-y-auto selection:bg-indigo-500/20 selection:text-white caret-indigo-500 ${
//                     wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto"
//                   }`}
//                   style={{
//                     lineHeight: "18px",
//                     fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
//                   }}
//                 />
//               </div>
//             </div>

//             {/* Bottom Output/Preview Panel */}
//             <div 
//               className={`bg-black flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
//                 focusMode === "editor" 
//                   ? "basis-0 opacity-0 pointer-events-none flex-grow-0 flex-shrink-0 border-none" 
//                   : focusMode === "output"
//                     ? "flex-1 border-t-0 opacity-100"
//                     : "basis-[220px] border-t border-zinc-900 opacity-100"
//               }`}
//               style={{
//                 height: focusMode === "editor" ? "0px" : focusMode === "output" ? "100%" : "220px"
//               }}
//             >
//               {/* Output Tab Selector */}
//               <div className="h-9 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between px-4 select-none">
//                 <div className="flex gap-4">
//                   <button
//                     onClick={() => setCompilerMode("terminal")}
//                     className={`flex items-center gap-1.5 h-full text-xs font-semibold border-b-2 transition ${
//                       compilerMode === "terminal" 
//                         ? "text-indigo-400 border-indigo-500" 
//                         : "text-zinc-500 hover:text-zinc-300 border-transparent"
//                     }`}
//                   >
//                     <Terminal className="w-3.5 h-3.5" /> Output Terminal
//                   </button>
//                   <button
//                     onClick={() => setCompilerMode("preview")}
//                     className={`flex items-center gap-1.5 h-full text-xs font-semibold border-b-2 transition ${
//                       compilerMode === "preview" 
//                         ? "text-indigo-400 border-indigo-500" 
//                         : "text-zinc-500 hover:text-zinc-300 border-transparent"
//                     }`}
//                   >
//                     <Eye className="w-3.5 h-3.5" /> Live Preview Frame
//                   </button>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   {compilerMode === "terminal" && (
//                     <button
//                       onClick={() => setCompilerOutput("")}
//                       className="text-[10px] font-mono text-zinc-500 hover:text-white transition"
//                     >
//                       Clear
//                     </button>
//                   )}
//                   {compilerMode === "preview" && (
//                     <button
//                       onClick={() => setPreviewKey(prev => prev + 1)}
//                       className="p-1 hover:bg-zinc-900 rounded text-zinc-500 hover:text-white transition"
//                       title="Force Refresh"
//                     >
//                       <RefreshCw className="w-3 h-3" />
//                     </button>
//                   )}
//                   <button
//                     onClick={() => setFocusMode(focusMode === "output" ? "normal" : "output")}
//                     className="p-1 hover:bg-zinc-900 rounded text-zinc-500 hover:text-white transition flex items-center justify-center"
//                     title={focusMode === "output" ? "Exit Focus Mode (ESC)" : "Output Preview Focus Mode"}
//                   >
//                     {focusMode === "output" ? (
//                       <Minimize2 className="w-3.5 h-3.5 text-indigo-400" />
//                     ) : (
//                       <Maximize2 className="w-3.5 h-3.5" />
//                     )}
//                   </button>
//                 </div>
//               </div>

//               {/* Panel Content rendering */}
//               <div className="flex-1 overflow-hidden relative">
//                 {compilerMode === "terminal" ? (
//                   <pre className="absolute inset-0 p-4 font-mono text-xs text-[#a3b3cc] overflow-auto select-text leading-relaxed whitespace-pre bg-zinc-950/20">
//                     {compilerOutput || "Terminal output will appear here after compiling. Click 'Run' to compile and execute."}
//                   </pre>
//                 ) : (
//                   <iframe
//                     key={previewKey}
//                     title="Design Live Sandbox Viewport"
//                     srcDoc={generateLivePreviewSrcDoc()}
//                     sandbox="allow-scripts"
//                     referrerPolicy="no-referrer"
//                     className="w-full h-full bg-white border-0"
//                   />
//                 )}
//               </div>
//             </div>
//           </div>
//         ) : (
//           <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-black/20">
//             <FileCode className="w-12 h-12 mb-2 text-zinc-700 animate-bounce" />
//             <span className="text-xs">Create or select a workspace file to get coding.</span>
//           </div>
//         )}

//         {/* Editor footer diagnostics */}
//         <div className="bg-zinc-950 px-4 py-2.5 border-t border-zinc-900 flex items-center justify-between select-none">
//           <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-3">
//             <span>Lines: {lines.length} | Chars: {localContent.length}</span>
//             <span>Tab size: 2 spaces</span>
//             {matchedBracketLine !== null && (
//               <span className="text-yellow-400 font-bold bg-yellow-500/10 px-1.5 py-0.5 rounded">Bracket Match: line {matchedBracketLine + 1}</span>
//             )}
//           </div>
//           <div className="flex gap-2">
//             <button
//               onClick={runCodeReview}
//               className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
//             >
//               <Sparkles className="w-3.5 h-3.5" />
//               AI Code Review
//             </button>
//             <button
//               onClick={() => {
//                 setAiMode("debug");
//                 setAiResponse(null);
//                 setIsAIOpenedFloating(true);
//               }}
//               className="flex items-center gap-1 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold border border-zinc-850 transition-all cursor-pointer"
//             >
//               <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
//               AI Debugger
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* 3. Right Sidebar AI Assistant Panel */}
//       <div 
//         style={{
//           transition: "flex-basis 300ms ease-in-out, opacity 300ms ease-in-out, max-width 300ms ease-in-out"
//         }}
//         className={`w-full lg:w-auto bg-[#0a0a0c] rounded-2xl border border-zinc-850 flex flex-col h-[680px] shadow-2xl overflow-hidden transition-all duration-300 ease-in-out ${
//           focusMode === "normal" 
//             ? "lg:basis-[23%] flex-grow-0 flex-shrink-0 p-4 opacity-100 pointer-events-auto" 
//             : "lg:basis-0 lg:max-w-0 opacity-0 p-0 border-none pointer-events-none"
//         }`}
//       >
//         <div className={`h-full transition-opacity duration-300 ${focusMode === "normal" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
//           {renderAIAssistantContent(false)}
//         </div>
//       </div>

//       {/* Center Floating overlay container for AI Assistant */}
//       <div 
//         ref={aiOverlayRef}
//         id="floating-ai-overlay"
//         style={{
//           transition: "transform 300ms ease-in-out, opacity 300ms ease-in-out, scale 300ms ease-in-out"
//         }}
//         className={`absolute top-0 right-0 h-full w-[380px] bg-[#0a0a0c]/95 backdrop-blur-md rounded-2xl border border-zinc-850 p-4 shadow-2xl flex flex-col z-50 ${
//           focusMode !== "normal" && isAIOpenedFloating 
//             ? "opacity-100 translate-x-0 scale-100 pointer-events-auto" 
//             : "opacity-0 translate-x-12 scale-95 pointer-events-none"
//         }`}
//       >
//         {renderAIAssistantContent(true)}
//       </div>

//       {/* Floating AI circular launcher */}
//       {focusMode !== "normal" && !isAIOpenedFloating && (
//         <button
//           onClick={() => setIsAIOpenedFloating(true)}
//           className="hidden lg:flex absolute bottom-[100px] right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 z-40 cursor-pointer group"
//           title="Open AI Assistant"
//           aria-label="Open AI Assistant"
//         >
//           <Sparkles className="w-6 h-6 animate-pulse group-hover:scale-110 transition-transform" />
//         </button>
//       )}

//       {/* Render Context Menu popover */}
//       {contextMenu && (
//         <ContextMenu
//           x={contextMenu.x}
//           y={contextMenu.y}
//           type={contextMenu.type}
//           targetId={contextMenu.targetId}
//           targetPath={contextMenu.targetPath}
//           onClose={() => setContextMenu(null)}
//           onRename={(path, isFile) => {
//             setRenameOriginalName(path.split("/").pop());
//             setRenameTargetPath(path);
//             setCreateModalType(isFile ? "file" : "folder");
//             setCreateModalOpen(true);
//           }}
//           onDelete={(path, isFile, id) => {
//             if (isFile && id) {
//               if (confirm(`Are you sure you want to delete "${path.split("/").pop()}"?`)) {
//                 onFileDelete(id);
//               }
//             } else {
//               handleFolderDelete(path);
//             }
//           }}
//           onDuplicate={handleFileDuplicate}
//           onNewFile={(parentPath) => {
//             setCreateModalParentPath(parentPath);
//             setCreateModalType("file");
//             setRenameOriginalName(undefined);
//             setCreateModalOpen(true);
//           }}
//           onNewFolder={(parentPath) => {
//             setCreateModalParentPath(parentPath);
//             setCreateModalType("folder");
//             setRenameOriginalName(undefined);
//             setCreateModalOpen(true);
//           }}
//         />
//       )}

//       {/* Render File Creation Modal */}
//       <CreateModal
//         isOpen={createModalOpen}
//         type={createModalType}
//         parentPath={createModalParentPath}
//         existingNames={getSiblingNames(createModalParentPath, createModalType)}
//         onClose={() => {
//           setCreateModalOpen(false);
//           setRenameOriginalName(undefined);
//           setRenameTargetPath("");
//         }}
//         onSubmit={(name) => {
//           if (renameOriginalName) {
//             // Rename mode
//             if (createModalType === "file") {
//               handleFileRenameSubmit(name, renameTargetPath);
//             } else {
//               handleFolderRenameSubmit(name, renameTargetPath);
//             }
//           } else {
//             // Create mode
//             if (createModalType === "file") {
//               handleNewFileSubmit(name, createModalParentPath);
//             } else {
//               handleNewFolderSubmit(name, createModalParentPath);
//             }
//           }
//         }}
//         renameOriginalName={renameOriginalName}
//       />

//       {/* Render Global Quick Search Modal (Ctrl+P) */}
//       <QuickSearchModal
//         isOpen={quickSearchOpen}
//         onClose={() => setQuickSearchOpen(false)}
//         files={files}
//         onFileSelect={openFile}
//         getFileIcon={(name) => <FileIcon fileName={name} />}
//       />

//     </div>
//   );
// }
