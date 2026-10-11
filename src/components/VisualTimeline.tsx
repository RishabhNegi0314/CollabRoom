import React, { useState, useMemo } from "react";
import { GitState, ProjectFile, GitCommit } from "../types.js";
import { GoogleIcon } from "./GoogleIcon.tsx";
import {
  GitCommit as CommitIcon,
  GitBranch,
  GitPullRequest,
  Clock,
  User,
  FolderGit,
  Eye,
  RotateCcw,
  Copy,
  Check,
  Search,
  Filter,
  Plus,
  Sparkles,
  FileCode,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Activity,
  CloudCheck
} from "lucide-react";

export interface WorkspaceEvent {
  id: string;
  type: "commit" | "file_save" | "file_create" | "branch_switch" | "cloud_sync";
  title: string;
  author: string;
  timestamp: string;
  branch?: string;
  commitId?: string;
  files?: string[];
  description?: string;
}

interface VisualTimelineProps {
  git: GitState;
  files: ProjectFile[];
  activeUserId?: string;
  activeUserName?: string;
  onCommit: (message: string) => void;
  onBranchSelect: (branch: string) => void;
  onBranchCreate: (name: string) => void;
  onRestoreCommit?: (commitId: string) => void;
  onFileSelect?: (fileId: string) => void;
}

export default function VisualTimeline({
  git,
  files,
  activeUserName = "Rishabh Negi",
  onCommit,
  onBranchSelect,
  onBranchCreate,
  onRestoreCommit
}: VisualTimelineProps) {
  const [activeView, setActiveView] = useState<"graph" | "feed" | "diff">("graph");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(
    git.commits.length > 0 ? git.commits[git.commits.length - 1] : null
  );
  const [selectedFileInCommit, setSelectedFileInCommit] = useState<string | null>(null);
  const [copiedCommitId, setCopiedCommitId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  // Quick commit form state
  const [newCommitMessage, setNewCommitMessage] = useState<string>("");
  const [isCommitFormOpen, setIsCommitFormOpen] = useState<boolean>(false);

  // Copy commit hash
  const handleCopyHash = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedCommitId(id);
    setTimeout(() => setCopiedCommitId(null), 2000);
  };

  // Restore workspace to selected commit
  const handleRestore = async (commit: GitCommit) => {
    if (!onRestoreCommit) return;
    setIsRestoring(true);
    setRestoreNotice(null);
    try {
      await onRestoreCommit(commit.id);
      setRestoreNotice(`Successfully restored workspace to commit ${commit.id}: "${commit.message}"`);
      setTimeout(() => setRestoreNotice(null), 4000);
    } catch (err: any) {
      setRestoreNotice(`Failed to restore commit: ${err?.message || "Unknown error"}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Create commit directly
  const handleQuickCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommitMessage.trim()) return;
    onCommit(newCommitMessage.trim());
    setNewCommitMessage("");
    setIsCommitFormOpen(false);
  };

  // Filtered commits based on branch and search
  const filteredCommits = useMemo(() => {
    let list = [...git.commits].reverse(); // newest first
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        c =>
          c.message.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.author.toLowerCase().includes(q) ||
          Object.keys(c.files || {}).some(f => f.toLowerCase().includes(q))
      );
    }
    return list;
  }, [git.commits, searchQuery]);

  // Derived workspace activity feed events
  const activityFeed: WorkspaceEvent[] = useMemo(() => {
    const events: WorkspaceEvent[] = [];

    // Commits
    git.commits.forEach(c => {
      events.push({
        id: `event-${c.id}`,
        type: "commit",
        title: c.message,
        author: c.author,
        timestamp: c.timestamp,
        branch: git.currentBranch,
        commitId: c.id,
        files: Object.keys(c.files || {}),
        description: `Committed ${Object.keys(c.files || {}).length} files to ${git.currentBranch}`
      });
    });

    // Cloud Sync event
    events.push({
      id: "event-sync-cloud",
      type: "cloud_sync",
      title: "Firestore Real-Time Cloud Backup Synced",
      author: "System / Firestore",
      timestamp: "Just now",
      description: "All project files synchronized with Cloud Firestore database"
    });

    // File snapshot events
    files.forEach(f => {
      events.push({
        id: `event-file-${f.id}`,
        type: "file_save",
        title: `Updated ${f.name}`,
        author: activeUserName,
        timestamp: "Recently",
        files: [f.path],
        description: `Workspace file ${f.path} modified with active language syntax.`
      });
    });

    return events;
  }, [git.commits, git.currentBranch, files, activeUserName]);

  // When a commit is selected, select its first file if none selected
  const activeSnapshotFiles = useMemo(() => {
    if (!selectedCommit || !selectedCommit.files) return [];
    return Object.keys(selectedCommit.files);
  }, [selectedCommit]);

  const activeFileContent = useMemo(() => {
    if (!selectedCommit || !selectedCommit.files) return "";
    const path = selectedFileInCommit || activeSnapshotFiles[0];
    return selectedCommit.files[path] || "";
  }, [selectedCommit, selectedFileInCommit, activeSnapshotFiles]);

  return (
    <div className="w-full space-y-6">
      
      {/* 1. Header Toolbar & Quick Stats */}
      <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <CommitIcon className="w-4 h-4 text-purple-400" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Visual Git Timeline & Workspace History
              <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono font-medium">
                Branch: {git.currentBranch}
              </span>
            </h2>
          </div>
          <p className="text-xs text-zinc-400 leading-normal max-w-xl">
            Inspect chronological commit tree, compare file snapshots across versions, and track collaborative workspace state updates in real-time.
          </p>
        </div>

        {/* View Switcher & Action buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-black/60 p-1 rounded-xl border border-zinc-800 flex items-center gap-1">
            <button
              onClick={() => setActiveView("graph")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeView === "graph"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Commit Graph</span>
            </button>
            <button
              onClick={() => setActiveView("feed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeView === "feed"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>State Feed</span>
            </button>
            <button
              onClick={() => setActiveView("diff")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeView === "diff"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Snapshot Code</span>
            </button>
          </div>

          <button
            onClick={() => setIsCommitFormOpen(!isCommitFormOpen)}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Checkpoint</span>
          </button>
        </div>
      </div>

      {/* Restore or Error Notification */}
      {restoreNotice && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 px-4 py-3 rounded-xl text-emerald-300 text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{restoreNotice}</span>
          </div>
          <button
            onClick={() => setRestoreNotice(null)}
            className="text-emerald-400 hover:text-white font-bold text-xs ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Quick Commit / Checkpoint Creation Bar */}
      {isCommitFormOpen && (
        <form
          onSubmit={handleQuickCommit}
          className="bg-[#0e1220] border border-purple-500/30 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center gap-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-purple-300 shrink-0">
            <CommitIcon className="w-4 h-4 text-purple-400" />
            <span>New Checkpoint:</span>
          </div>
          <input
            type="text"
            required
            placeholder="Commit message (e.g., refactor algorithm and improve performance)"
            value={newCommitMessage}
            onChange={(e) => setNewCommitMessage(e.target.value)}
            className="flex-1 w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 text-xs text-white rounded-xl px-3 py-2 outline-none font-sans"
            autoFocus
          />
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsCommitFormOpen(false)}
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs rounded-xl border border-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              Save Commit
            </button>
          </div>
        </form>
      )}

      {/* 2. Search & Branch Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0a0a0a] border border-zinc-800 px-4 py-3 rounded-xl">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search commits by message, SHA, author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-zinc-500 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Branch switcher */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Branch:</span>
          <div className="flex gap-1 overflow-x-auto py-1">
            {git.branches.map((b) => (
              <button
                key={b}
                onClick={() => onBranchSelect(b)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1 shrink-0 ${
                  git.currentBranch === b
                    ? "bg-purple-600/20 text-purple-300 border border-purple-500/40"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                <GitBranch className="w-3 h-3" />
                <span>{b}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Main Views Grid */}
      {activeView === "graph" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Commit Nodes Timeline (Left 7 Cols) */}
          <div className="lg:col-span-7 bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 text-xs text-zinc-400 font-bold uppercase tracking-wider">
              <span>Commit Tree ({filteredCommits.length})</span>
              <span className="font-mono text-[10px] text-zinc-500">HEAD &bull; {git.currentBranch}</span>
            </div>

            {filteredCommits.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-xs">
                No commits match your current search query.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-purple-500 before:via-indigo-500/50 before:to-zinc-800">
                {filteredCommits.map((commit, index) => {
                  const isSelected = selectedCommit?.id === commit.id;
                  const isHead = index === 0;
                  const fileCount = Object.keys(commit.files || {}).length;

                  return (
                    <div
                      key={commit.id}
                      onClick={() => {
                        setSelectedCommit(commit);
                        setSelectedFileInCommit(null);
                      }}
                      className={`relative p-4 rounded-xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? "bg-purple-950/20 border-purple-500/80 shadow-md shadow-purple-950/20 ring-1 ring-purple-500/40"
                          : "bg-zinc-950/80 hover:bg-zinc-900/90 border-zinc-800/90 hover:border-zinc-700"
                      }`}
                    >
                      {/* Timeline Node Dot */}
                      <div
                        className={`absolute -left-[30px] top-4.5 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                          isSelected
                            ? "bg-purple-400 border-purple-200 ring-4 ring-purple-900/60"
                            : isHead
                            ? "bg-indigo-400 border-zinc-950 ring-2 ring-indigo-500/30"
                            : "bg-zinc-800 border-zinc-950 group-hover:bg-zinc-600"
                        }`}
                      />

                      {/* Header Row */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Commit SHA badge */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyHash(commit.id, e)}
                            className="px-2 py-0.5 bg-black/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded font-mono text-[10px] text-purple-300 font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Click to copy commit hash"
                          >
                            <span>{commit.id}</span>
                            {copiedCommitId === commit.id ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 text-zinc-500" />
                            )}
                          </button>

                          {isHead && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono font-bold uppercase">
                              HEAD
                            </span>
                          )}

                          <span className="text-[10px] bg-zinc-800/80 text-zinc-400 px-2 py-0.5 rounded font-mono">
                            {git.currentBranch}
                          </span>
                        </div>

                        {/* Relative Timestamp */}
                        <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-600" />
                          <span>{commit.timestamp}</span>
                        </div>
                      </div>

                      {/* Commit Message */}
                      <h3 className="text-xs font-bold text-white mb-2 leading-relaxed">
                        {commit.message}
                      </h3>

                      {/* Author & File Stats Row */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-900 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">
                            {commit.author.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-zinc-300">{commit.author}</span>
                          {commit.author.toLowerCase().includes("rishabh") && (
                            <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" /> Google
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-zinc-500 text-[10px] font-mono">
                          <span className="flex items-center gap-1">
                            <FileCode className="w-3 h-3 text-zinc-400" />
                            <span>{fileCount} {fileCount === 1 ? "file" : "files"}</span>
                          </span>
                          <span className="text-purple-400 hover:text-purple-300 font-sans font-semibold flex items-center gap-1">
                            Inspect &rarr;
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Commit Inspector Panel (Right 5 Cols) */}
          <div className="lg:col-span-5 bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col h-full text-left">
            {selectedCommit ? (
              <div className="space-y-4 flex flex-col h-full">
                {/* Header */}
                <div className="pb-3 border-b border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400 font-bold">
                      Commit Inspector
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyHash(selectedCommit.id, e)}
                      className="text-[10px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{selectedCommit.id}</span>
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-snug">
                    {selectedCommit.message}
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono mt-2">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-zinc-500" />
                      {selectedCommit.author}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {selectedCommit.timestamp}
                    </span>
                  </div>
                </div>

                {/* Actions: Restore Workspace / View Code */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRestore(selectedCommit)}
                    disabled={isRestoring}
                    className="py-2 px-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-purple-500/50 text-zinc-200 hover:text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                    <span>{isRestoring ? "Restoring..." : "Restore State"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("diff")}
                    className="py-2 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-purple-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Snapshot</span>
                  </button>
                </div>

                {/* Snapshotted files list */}
                <div className="flex-1 flex flex-col min-h-0 pt-2">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 font-mono flex items-center justify-between">
                    <span>Snapshotted Files ({activeSnapshotFiles.length})</span>
                    <span className="text-zinc-600 font-normal">Click to preview</span>
                  </div>

                  <div className="space-y-1.5 overflow-y-auto max-h-56 pr-1">
                    {activeSnapshotFiles.map((path) => {
                      const isFileSelected = (selectedFileInCommit || activeSnapshotFiles[0]) === path;
                      const content = selectedCommit.files[path] || "";
                      const lineCount = content.split("\n").length;

                      return (
                        <div
                          key={path}
                          onClick={() => setSelectedFileInCommit(path)}
                          className={`p-2.5 rounded-xl border text-xs font-mono transition cursor-pointer flex items-center justify-between ${
                            isFileSelected
                              ? "bg-purple-950/20 border-purple-500/60 text-purple-200"
                              : "bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="truncate">{path}</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">
                            {lineCount} lines
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Code Quick Preview Snippet */}
                <div className="bg-black/80 border border-zinc-800/90 rounded-xl p-3 flex flex-col">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60 text-[10px] font-mono text-zinc-400">
                    <span className="truncate font-bold text-zinc-300">
                      {selectedFileInCommit || activeSnapshotFiles[0] || "File"}
                    </span>
                    <span className="text-zinc-500">Read-only Snapshot</span>
                  </div>
                  <pre className="text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-36 scrollbar-thin whitespace-pre leading-relaxed select-text">
                    {activeFileContent || "// Empty file"}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-12 text-zinc-500">
                <CommitIcon className="w-8 h-8 text-zinc-700 mb-2" />
                <p className="text-xs">Select any commit on the timeline to inspect its snapshot details.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 4. Workspace Activity Feed View */}
      {activeView === "feed" && (
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-6 shadow-sm text-left">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Workspace State Change Logs
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time timeline capturing file modifications, collaborative locks, git commits, and cloud database events.
              </p>
            </div>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Live Synchronized
            </span>
          </div>

          <div className="space-y-3">
            {activityFeed.map((evt) => {
              const isCommit = evt.type === "commit";
              const isCloud = evt.type === "cloud_sync";

              return (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition flex items-start gap-3.5"
                >
                  {/* Icon badge */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                      isCommit
                        ? "bg-purple-950/40 border-purple-500/40 text-purple-400"
                        : isCloud
                        ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-400"
                        : "bg-indigo-950/40 border-indigo-500/40 text-indigo-400"
                    }`}
                  >
                    {isCommit ? (
                      <CommitIcon className="w-4 h-4" />
                    ) : isCloud ? (
                      <CloudCheck className="w-4 h-4" />
                    ) : (
                      <FileCode className="w-4 h-4" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate">
                        {evt.title}
                      </h4>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        {evt.timestamp}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-normal">
                      {evt.description}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-zinc-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-zinc-600" />
                        <span>{evt.author}</span>
                      </span>
                      {evt.commitId && (
                        <span className="text-purple-400 font-bold bg-purple-950/30 px-1.5 py-0.2 rounded border border-purple-900/50">
                          {evt.commitId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Snapshot Full Diff & Code View */}
      {activeView === "diff" && selectedCommit && (
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-6 shadow-sm text-left space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                  {selectedCommit.id}
                </span>
                <h3 className="text-sm font-bold text-white">
                  {selectedCommit.message}
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Authored by {selectedCommit.author} on {selectedCommit.timestamp}
              </p>
            </div>

            <button
              onClick={() => handleRestore(selectedCommit)}
              disabled={isRestoring}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRestoring ? "Restoring..." : "Restore this commit to Workspace"}</span>
            </button>
          </div>

          {/* File selector tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-zinc-900">
            {activeSnapshotFiles.map((path) => {
              const isSelected = (selectedFileInCommit || activeSnapshotFiles[0]) === path;
              return (
                <button
                  key={path}
                  onClick={() => setSelectedFileInCommit(path)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  <FileCode className="w-3 h-3" />
                  <span>{path}</span>
                </button>
              );
            })}
          </div>

          {/* Code display with line numbers */}
          <div className="bg-[#050505] border border-zinc-800 rounded-xl p-4 overflow-x-auto">
            <div className="font-mono text-xs text-zinc-300 leading-relaxed">
              {activeFileContent.split("\n").map((line, idx) => (
                <div key={idx} className="flex hover:bg-zinc-900/50 py-0.5 px-2 rounded">
                  <span className="w-10 text-zinc-600 select-none text-right pr-4 shrink-0 font-mono text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre">{line || " "}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
