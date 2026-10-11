import React, { useState, useEffect, useMemo } from "react";
import { CollabState, ProjectFile, CollabUser, GitState, KanbanTask, CanvasElement } from "../types.js";
import EditorWorkspace from "./EditorWorkspace.tsx";
import VoiceRoom from "./VoiceRoom.tsx";
import VersionControl from "./VersionControl.tsx";
import TaskBoard from "./TaskBoard.tsx";
import MockupCanvas from "./MockupCanvas.tsx";
import CloudDeployment from "./CloudDeployment.tsx";
import { CollaborationClient } from "../lib/collaboration.ts";
import { FileLock } from "../../backend/collaboration/roomManager.js";
import { useAuth } from "../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import {
  Code,
  GitBranch,
  ListTodo,
  Palette,
  Server,
  Clock,
  LogOut,
  ArrowLeft,
  RefreshCw,
  LayoutDashboard,
  Link2,
  Check,
  Copy,
  ExternalLink,
  GitCommit as CommitIcon
} from "lucide-react";
import { saveWorkspaceToFirestore, loadWorkspaceFromFirestore } from "../lib/firestoreService.js";
import { GoogleIcon } from "./GoogleIcon.tsx";
import { GoogleSignInModal } from "./GoogleSignInModal.tsx";
import VisualTimeline from "./VisualTimeline.tsx";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Get room ID from URL search params or fallback to 'remix-default'
  const roomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || "remix-default";
  }, []);

  // If for some reason we got here without a user, fallback safely
  const activeUserId = user?.uid || "user-rishabh";
  const activeUserName = user?.name || "Rishabh";
  const activeUserPhoto = user?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(activeUserId)}`;

  const [state, setState] = useState<CollabState>({
    files: [],
    users: [],
    git: { currentBranch: "main", branches: ["main"], commits: [], stagedFiles: [] },
    tasks: [],
    canvasElements: []
  } as CollabState);

  const [activeTab, setActiveTab] = useState<"editor" | "git" | "timeline" | "tasks" | "canvas" | "cloud">("editor");
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error" | "reconnecting">("synced");
  const [fileLocks, setFileLocks] = useState<FileLock[]>([]);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isGoogleSignInOpen, setIsGoogleSignInOpen] = useState(false);

  // Single static instance of the real-time collaboration client, linked to the authenticated user
  const collabClient = useMemo(() => {
    return new CollaborationClient(roomId, activeUserId, activeUserName, activeUserPhoto);
  }, [roomId, activeUserId, activeUserName, activeUserPhoto]);

  // Load state from full-stack backend with Firestore cloud backup fallback
  const fetchState = async (silent = false) => {
    if (!silent) setSyncStatus("syncing");
    try {
      const res = await fetch(`/api/state?room=${encodeURIComponent(roomId)}`, {
        headers: { "x-room-id": roomId }
      });
      if (!res.ok) throw new Error("Network response error");
      const data: CollabState = await res.json();
      if (!data.files || data.files.length === 0) {
        // Fallback to Firestore persistent cloud store
        const firestoreData = await loadWorkspaceFromFirestore(roomId);
        if (firestoreData && firestoreData.files.length > 0) {
          setState(firestoreData);
          if (!activeFileId && firestoreData.files.length > 0) {
            setActiveFileId(firestoreData.files[0].id);
            collabClient.openFile(firestoreData.files[0].id);
          }
          setSyncStatus("synced");
          return;
        }
      }
      setState(data);
      if (syncStatus !== "reconnecting") {
        setSyncStatus("synced");
      }
      // Pick first file if none is active
      if (data.files.length > 0 && !activeFileId) {
        setActiveFileId(data.files[0].id);
        collabClient.openFile(data.files[0].id);
      }
    } catch (err) {
      console.warn("Backend state fetch failed, attempting Firestore fallback:", err);
      try {
        const firestoreData = await loadWorkspaceFromFirestore(roomId);
        if (firestoreData && firestoreData.files.length > 0) {
          setState(firestoreData);
          if (!activeFileId && firestoreData.files.length > 0) {
            setActiveFileId(firestoreData.files[0].id);
            collabClient.openFile(firestoreData.files[0].id);
          }
          setSyncStatus("synced");
          return;
        }
      } catch (fErr) {
        console.error("Firestore fallback error:", fErr);
      }
      setSyncStatus("error");
    }
  };

  // Debounced auto-save to Firestore for cross-session cloud backup
  useEffect(() => {
    if (state.files.length === 0) return;
    const timer = setTimeout(() => {
      saveWorkspaceToFirestore(roomId, state);
    }, 2000);
    return () => clearTimeout(timer);
  }, [state, roomId]);

  useEffect(() => {
    fetchState();

    // Connect to the real-time collaboration Socket.IO channel
    collabClient.connect({
      onConnectionStatus: (status) => {
        if (status === "online") {
          setSyncStatus("synced");
        } else if (status === "reconnecting") {
          setSyncStatus("reconnecting");
        } else {
          setSyncStatus("error");
        }
      },
      onPresenceUpdate: (users) => {
        setState((prev) => {
          const updatedUsers = [...prev.users];
          users.forEach((p) => {
            const idx = updatedUsers.findIndex((u) => u.id === p.userId);
            if (idx !== -1) {
              updatedUsers[idx] = {
                ...updatedUsers[idx],
                name: p.username,
                color: p.color,
                activeFileId: p.currentFile,
                cursorIndex: p.cursorPosition
              };
            } else {
              updatedUsers.push({
                id: p.userId,
                name: p.username,
                color: p.color,
                isMuted: false,
                isSpeaking: false,
                activeFileId: p.currentFile,
                cursorIndex: p.cursorPosition
              });
            }
          });
          return { ...prev, users: updatedUsers };
        });
      },
      onEditorChanged: (data) => {
        setState((prev) => ({
          ...prev,
          files: prev.files.map((f) => (f.id === data.fileId ? { ...f, content: data.content } : f))
        }));
      },
      onFileLocksUpdate: (locks) => {
        setFileLocks(locks);
      },
      onFileCreated: (newFile) => {
        setState((prev) => {
          if (prev.files.some((f) => f.id === newFile.id)) return prev;
          return { ...prev, files: [...prev.files, newFile] };
        });
      },
      onFileRenamed: (updatedFile) => {
        setState((prev) => ({
          ...prev,
          files: prev.files.map((f) => (f.id === updatedFile.id ? updatedFile : f))
        }));
      },
      onFileDeleted: (data) => {
        setState((prev) => ({
          ...prev,
          files: prev.files.filter((f) => f.id !== data.id)
        }));
      },
      onTaskUpdated: (task) => {
        setState((prev) => {
          const idx = prev.tasks.findIndex((t) => t.id === task.id);
          const newTasks = [...prev.tasks];
          if (idx !== -1) {
            newTasks[idx] = task;
          } else {
            newTasks.push(task);
          }
          return { ...prev, tasks: newTasks };
        });
      },
      onTaskDeleted: (id) => {
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== id)
        }));
      },
      onCanvasUpdated: (element) => {
        setState((prev) => {
          const idx = prev.canvasElements.findIndex((e) => e.id === element.id);
          const newElements = [...prev.canvasElements];
          if (idx !== -1) {
            newElements[idx] = element;
          } else {
            newElements.push(element);
          }
          return { ...prev, canvasElements: newElements };
        });
      },
      onCanvasDeleted: (id) => {
        setState((prev) => ({
          ...prev,
          canvasElements: prev.canvasElements.filter((e) => e.id !== id)
        }));
      }
    });

    // Dynamic ticking clock
    const clock = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toUTCString().replace("GMT", "UTC"));
    }, 1000);

    return () => {
      collabClient.disconnect();
      clearInterval(clock);
    };
  }, [activeUserId]);

  // General Post Helper to avoid repetition
  const postUpdate = async (endpoint: string, body: object) => {
    setSyncStatus("syncing");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-room-id": roomId },
        body: JSON.stringify({ ...body, roomId })
      });
      if (res.ok) {
        await fetchState(true);
      } else {
        setSyncStatus("error");
      }
    } catch (err) {
      console.error(`Error sending update to ${endpoint}`, err);
      setSyncStatus("error");
    }
  };

  // Callback methods

  const handleFileSelect = (id: string) => {
    setActiveFileId(id);
    collabClient.openFile(id);
    postUpdate("/api/users/update", { id: activeUserId, activeFileId: id });
  };

  const handleFileUpdate = (id: string, content: string) => {
    setState((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.id === id ? { ...f, content } : f))
    }));
    collabClient.emitEditorChange(id, content);
  };

  const handleFileCreate = (fullName: string, language: string) => {
    const cleanPath = fullName.replace(/^\/+/, "");
    const parts = cleanPath.split("/");
    const name = parts[parts.length - 1];
    collabClient.emitFileCreate(name, cleanPath, language);
  };

  const handleFileDelete = (id: string) => {
    collabClient.emitFileDelete(id);
  };

  const handleUserUpdate = (id: string, updates: Partial<CollabUser>) => {
    postUpdate("/api/users/update", { id, ...updates });
  };

  const handleStageFile = (filePath: string) => {
    postUpdate("/api/git/stage", { filePath });
  };

  const handleCommit = (message: string) => {
    postUpdate("/api/git/commit", { message, author: activeUserName });
  };

  const handleBranchSelect = (branch: string) => {
    postUpdate("/api/git/branch", { branchName: branch });
  };

  const handleBranchCreate = (name: string) => {
    postUpdate("/api/git/branch", { branchName: name, create: true });
  };

  const handleRestoreCommit = async (commitId: string) => {
    try {
      const res = await fetch("/api/git/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitId, roomId })
      });
      const data = await res.json();
      if (data.success && data.files) {
        setState((prev) => ({ ...prev, files: data.files }));
        fetchState(true);
      }
    } catch (err) {
      console.error("Failed to restore commit:", err);
    }
  };

  const handleTaskUpdate = (id: string, updates: Partial<KanbanTask>) => {
    const existingTask = state.tasks.find(t => t.id === id);
    if (existingTask) {
      const updated = { ...existingTask, ...updates };
      collabClient.emitTaskUpdate(updated);
    }
  };

  const handleTaskCreate = (
    title: string,
    description: string,
    assignee: string,
    priority: "low" | "medium" | "high",
    points: number
  ) => {
    const id = `task-${Date.now()}`;
    const newTask: KanbanTask = { id, title, description, assignee, priority, points, status: "todo" };
    collabClient.emitTaskUpdate(newTask);
  };

  const handleTaskDelete = (id: string) => {
    collabClient.emitTaskDelete(id);
  };

  const handleElementUpdate = (id: string, updates: Partial<CanvasElement>) => {
    setState((prev) => ({
      ...prev,
      canvasElements: prev.canvasElements.map((e) => (e.id === id ? { ...e, ...updates } : e))
    }));
    const existing = state.canvasElements.find(e => e.id === id);
    if (existing) {
      collabClient.emitCanvasUpdate({ ...existing, ...updates });
    }
  };

  const handleElementCreate = (type: CanvasElement["type"], customParams?: Partial<CanvasElement>) => {
    const id = `el-${Date.now()}`;
    const newElement: CanvasElement = {
      id,
      type,
      x: 100,
      y: 100,
      width: type === "button" ? 120 : 200,
      height: type === "button" ? 40 : 150,
      text: type === "button" ? "Click me" : type === "header" ? "New Header" : "Text element content",
      color: "#4f46e5",
      bgColor: "#ffffff",
      borderColor: "#cccccc",
      borderRadius: "4px",
      ...customParams
    };
    collabClient.emitCanvasUpdate(newElement);
  };

  const handleElementDelete = (id: string) => {
    collabClient.emitCanvasDelete(id);
  };

  const [isCopied, setIsCopied] = useState(false);
  const [shortInviteUrl, setShortInviteUrl] = useState<string>("");
  const [isShortening, setIsShortening] = useState<boolean>(false);

  // Shorten invite link using URL shortener backend
  useEffect(() => {
    let isMounted = true;
    const fullUrl = `${window.location.origin}/dashboard?room=${roomId}`;
    setIsShortening(true);

    fetch("/api/url/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fullUrl, roomId })
    })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.shortUrl) {
          setShortInviteUrl(data.shortUrl);
        }
      })
      .catch((err) => {
        console.warn("URL shortening notice:", err);
      })
      .finally(() => {
        if (isMounted) setIsShortening(false);
      });

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  const handleCopyLink = () => {
    const urlToCopy = shortInviteUrl || `${window.location.origin}/dashboard?room=${roomId}`;
    navigator.clipboard.writeText(urlToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleLogoutClick = () => {
    setIsLogoutConfirmOpen(true);
  };

  const executeLogout = async () => {
    setIsLogoutConfirmOpen(false);
    // Navigate first to landing page, then clear auth state
    // This prevents any flash of the protected route during Firebase signOut
    navigate("/", { replace: true });
    await logout();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e4e4e7] flex flex-col font-sans select-none selection:bg-indigo-600/30 relative">
      
      {/* 1. Primary Header */}
      <header className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl px-6 py-4 flex flex-col xl:flex-row items-center justify-between gap-4 mt-6 mx-6">
        
        {/* Brand logo & dynamic status */}
        <div className="flex items-center gap-4">
          <div
            onClick={() => navigate("/")}
            className="w-10 h-10 bg-gradient-to-tr from-[#6366F1] to-[#06B6D4] rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-600/20 cursor-pointer hover:opacity-90 active:scale-95 transition"
            title="Back to Landing Page"
          >
            Ω
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-white uppercase">ROOM: {roomId}</h1>
              <span className={`w-2 h-2 rounded-full ${
                syncStatus === "synced"
                  ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                  : syncStatus === "syncing"
                  ? "bg-indigo-400 animate-pulse"
                  : "bg-rose-500"
              }`} />
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <div
                className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800/80 rounded-lg px-2.5 py-1 text-[11px] font-mono text-zinc-300 shadow-inner max-w-[280px] sm:max-w-none"
                title={`Original full link: ${window.location.origin}/dashboard?room=${roomId}`}
              >
                <Link2 className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
                <span className="text-[10px] text-zinc-500 font-sans uppercase font-bold tracking-wider shrink-0">Invite:</span>
                <span className="text-cyan-300 font-semibold select-all truncate">
                  {shortInviteUrl
                    ? shortInviteUrl
                    : isShortening
                    ? "Generating short link..."
                    : `${window.location.origin}/dashboard?room=${roomId}`}
                </span>
              </div>
              <button
                onClick={handleCopyLink}
                className="text-[10px] text-[#06B6D4] hover:text-white hover:bg-[#06B6D4] font-bold px-2.5 py-1 bg-cyan-950/40 rounded-lg border border-cyan-800/40 transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                title="Copy shortened invite link"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Copied Short Link!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Short Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tab menu controller */}
        <nav className="flex bg-black/40 p-1 rounded-xl border border-zinc-800 gap-1 flex-wrap justify-center">
          <button
            onClick={() => setActiveTab("editor")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "editor"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Code className="w-3.5 h-3.5" /> Code & AI
          </button>
          <button
            onClick={() => setActiveTab("git")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "git"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" /> Source Control
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "timeline"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <CommitIcon className="w-3.5 h-3.5 text-purple-400" /> Timeline & History
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "tasks"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" /> Tasks & Progress
          </button>
          <button
            onClick={() => setActiveTab("canvas")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "canvas"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Palette className="w-3.5 h-3.5" /> Mockups Canva
          </button>
          <button
            onClick={() => setActiveTab("cloud")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "cloud"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Server className="w-3.5 h-3.5" /> Cloud Hosting
          </button>
        </nav>

        {/* Global timestamps, metrics, and Profile avatar */}
        <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
          <div className="hidden sm:flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-600" />
            <span>{currentTime || "UTC clock..."}</span>
          </div>

          {/* User profile picture details with Google integration & logout */}
          <div className="flex items-center gap-2">
            {user?.isGuest ? (
              <button
                onClick={() => setIsGoogleSignInOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-[11px] rounded-xl shadow-sm transition cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Sign in directly with your Google account"
              >
                <GoogleIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign in with Google</span>
              </button>
            ) : (
              <button
                onClick={() => setIsGoogleSignInOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/90 hover:bg-zinc-850 text-zinc-300 font-mono text-[10px] rounded-lg border border-zinc-800 transition cursor-pointer"
                title="Google account connected - click to switch"
              >
                <GoogleIcon className="w-3 h-3" />
                <span className="text-emerald-400 font-semibold">Google</span>
              </button>
            )}

            <div className="flex items-center gap-2 bg-zinc-900/80 px-2.5 py-1.5 rounded-xl border border-zinc-800">
              <img
                referrerPolicy="no-referrer"
                src={activeUserPhoto}
                alt={activeUserName}
                className="w-5.5 h-5.5 rounded-full border border-[#6366F1]/40"
              />
              <span className="text-[11px] font-sans font-bold text-white max-w-[85px] truncate">
                {activeUserName}
              </span>
              <button
                onClick={handleLogoutClick}
                className="p-1 hover:bg-zinc-800 rounded-lg text-rose-400 hover:text-rose-300 transition cursor-pointer"
                title="Log out session"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      </header>

      {/* 2. Main Content area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Editor tab (Also renders Voice Room right below for streamlined multi-screen workflow!) */}
        {activeTab === "editor" && (
          <div className="space-y-6">
            <EditorWorkspace
              files={state.files}
              users={state.users}
              activeFileId={activeFileId}
              onFileSelect={handleFileSelect}
              onFileUpdate={handleFileUpdate}
              onFileCreate={handleFileCreate}
              onFileDelete={handleFileDelete}
              onRefreshState={() => fetchState(true)}
              collabClient={collabClient}
              fileLocks={fileLocks}
            />
            <VoiceRoom
              users={state.users}
              activeUserId={activeUserId}
              onUserUpdate={handleUserUpdate}
            />
          </div>
        )}

        {/* Git Version control */}
        {activeTab === "git" && (
          <VersionControl
            git={state.git}
            files={state.files}
            onStageFile={handleStageFile}
            onCommit={handleCommit}
            onBranchSelect={handleBranchSelect}
            onBranchCreate={handleBranchCreate}
            onOpenTimeline={() => setActiveTab("timeline")}
          />
        )}

        {/* Visual Timeline and Git Commit History */}
        {activeTab === "timeline" && (
          <VisualTimeline
            git={state.git}
            files={state.files}
            activeUserId={activeUserId}
            activeUserName={activeUserName}
            onCommit={handleCommit}
            onBranchSelect={handleBranchSelect}
            onBranchCreate={handleBranchCreate}
            onRestoreCommit={handleRestoreCommit}
            onFileSelect={handleFileSelect}
          />
        )}

        {/* Kanban Task tracking */}
        {activeTab === "tasks" && (
          <TaskBoard
            tasks={state.tasks}
            onTaskUpdate={handleTaskUpdate}
            onTaskCreate={handleTaskCreate}
            onTaskDelete={handleTaskDelete}
          />
        )}

        {/* Interface canvas designer */}
        {activeTab === "canvas" && (
          <MockupCanvas
            elements={state.canvasElements}
            onElementUpdate={handleElementUpdate}
            onElementCreate={handleElementCreate}
            onElementDelete={handleElementDelete}
          />
        )}

        {/* Cloud deployment */}
        {activeTab === "cloud" && (
          <CloudDeployment />
        )}

      </main>

      {/* 3. Global Footer */}
      <footer className="h-12 mt-6 flex items-center justify-between text-[10px] font-mono text-zinc-600 border-t border-zinc-900 px-8">
        <div className="flex gap-6">
          <span>COLLAB: <span className="text-zinc-400">ACTIVE</span></span>
          <span>ENV: <span className="text-zinc-400">production</span></span>
          <span>UPTIME: <span className="text-zinc-400">99.98%</span></span>
        </div>
        <div className="flex gap-4">
          <span className="text-indigo-400">Connected to Peer Network (12 ms)</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> SYSTEM SECURE</span>
        </div>
      </footer>

      {/* Logout confirmation modal */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-[#05070d]/85 backdrop-blur-sm" onClick={() => setIsLogoutConfirmOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#0B1020]/90 border border-zinc-800 rounded-2xl p-6 shadow-2xl overflow-hidden text-center">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 to-indigo-500" />
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider font-mono">Terminate Active Session?</h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Are you sure you want to log out and end your active collaboration session?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-zinc-300 rounded-xl border border-zinc-800 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                onClick={executeLogout}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-500 hover:opacity-90 text-xs font-bold text-white rounded-xl shadow-md shadow-red-950/20 cursor-pointer transition"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sign In / Account Switcher Modal */}
      <GoogleSignInModal
        isOpen={isGoogleSignInOpen}
        onClose={() => setIsGoogleSignInOpen(false)}
        allowGuest={false}
        title="Google Account"
        subtitle="Sign in or switch to another Google account directly."
      />

    </div>
  );
}
