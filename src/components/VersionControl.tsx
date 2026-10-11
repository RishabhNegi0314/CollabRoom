import React, { useState } from "react";
import { GitState, ProjectFile, GitCommit } from "../types.js";
import { GitBranch, GitCommit as CommitIcon, GitPullRequest, ArrowRight, Check, RefreshCw, FolderGit, Eye, HelpCircle } from "lucide-react";

interface VersionControlProps {
  git: GitState;
  files: ProjectFile[];
  onStageFile: (path: string) => void;
  onCommit: (message: string) => void;
  onBranchSelect: (branch: string) => void;
  onBranchCreate: (name: string) => void;
  onOpenTimeline?: () => void;
}

export default function VersionControl({
  git,
  files,
  onStageFile,
  onCommit,
  onBranchSelect,
  onBranchCreate,
  onOpenTimeline
}: VersionControlProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [selectedCommitSnapshot, setSelectedCommitSnapshot] = useState<GitCommit | null>(null);

  // Unstaged files are simply any files that aren't already staged
  const unstagedFiles = files
    .map((f) => f.path)
    .filter((path) => !git.stagedFiles.includes(path));

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    onBranchCreate(newBranchName.trim());
    setNewBranchName("");
    setIsCreatingBranch(false);
  };

  const handleCommitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim() || git.stagedFiles.length === 0) return;
    onCommit(commitMessage.trim());
    setCommitMessage("");
  };

  return (
    <div id="git-version-control-section" className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-transparent p-0 border-0">
      
      {/* 1. Staging area panel */}
      <div className="bg-[#0a0a0a] rounded-2xl p-5 border border-zinc-800 flex flex-col h-[400px] shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <FolderGit className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Source Control</h3>
          </div>
          <span className="text-[10px] px-2.5 py-1 bg-[#050505] border border-zinc-800 rounded-xl font-mono text-zinc-500">
            {git.currentBranch}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {/* Staged list */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-green-500 font-bold uppercase tracking-wider mb-2">
              <span>Staged Changes ({git.stagedFiles.length})</span>
            </div>
            {git.stagedFiles.length === 0 ? (
              <p className="text-xs text-zinc-600 italic px-2 leading-relaxed">No changes staged. Click on files below to stage.</p>
            ) : (
              <div className="space-y-1">
                {git.stagedFiles.map((f) => (
                  <div
                    key={f}
                    onClick={() => onStageFile(f)}
                    className="flex items-center justify-between px-3 py-2 bg-emerald-950/10 hover:bg-emerald-950/20 border border-emerald-900/40 rounded-xl text-xs text-emerald-300 cursor-pointer transition"
                  >
                    <span className="font-mono truncate">{f}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 rounded-md font-semibold text-emerald-400 font-mono">A</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unstaged list */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
              <span>Modified files ({unstagedFiles.length})</span>
            </div>
            {unstagedFiles.length === 0 ? (
              <p className="text-xs text-zinc-600 italic px-2 leading-relaxed">All files clean. Workspace fully synchronized.</p>
            ) : (
              <div className="space-y-1">
                {unstagedFiles.map((f) => (
                  <div
                    key={f}
                    onClick={() => onStageFile(f)}
                    className="flex items-center justify-between px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 cursor-pointer hover:bg-zinc-850 transition"
                  >
                    <span className="font-mono truncate">{f}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/20 rounded-md font-semibold text-indigo-400 font-mono">M</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Commit interface form */}
        <form onSubmit={handleCommitSubmit} className="space-y-2.5 pt-3 border-t border-zinc-800">
          <input
            type="text"
            required
            placeholder="Commit message (e.g. fix calculation bug)"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            disabled={git.stagedFiles.length === 0}
            className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-white placeholder-zinc-750 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={git.stagedFiles.length === 0}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
          >
            Commit to {git.currentBranch}
          </button>
        </form>
      </div>

      {/* 2. Branch management and checkout panel */}
      <div className="bg-[#0a0a0a] rounded-2xl p-5 border border-zinc-800 flex flex-col h-[400px] shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Branches</h3>
          </div>
          <button
            onClick={() => setIsCreatingBranch(!isCreatingBranch)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition font-bold cursor-pointer"
          >
            + New Branch
          </button>
        </div>

        {isCreatingBranch && (
          <form onSubmit={handleCreateBranch} className="mb-4 bg-black/40 p-3 rounded-xl border border-zinc-800 flex gap-2">
            <input
              type="text"
              required
              placeholder="feature/auth-hooks"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="flex-1 bg-[#050505] border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Add
            </button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          {git.branches.map((b) => {
            const isActive = b === git.currentBranch;
            return (
              <div
                key={b}
                onClick={() => onBranchSelect(b)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                  isActive
                    ? "bg-zinc-900 border-zinc-750 text-white shadow-sm"
                    : "bg-black/20 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-black/40"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <GitPullRequest className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-emerald-500" : "text-zinc-655"}`} />
                  <span className="text-xs font-mono font-medium truncate">{b}</span>
                </div>
                {isActive && (
                  <span className="text-[9px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
                    Active
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800 text-[10px] text-zinc-600 font-mono flex items-center justify-between">
          <span>Git status: UP-TO-DATE</span>
          <span>Remote: Origin</span>
        </div>
      </div>

      {/* 3. Commit timeline graph panel */}
      <div className="bg-[#0a0a0a] rounded-2xl p-5 border border-zinc-800 flex flex-col h-[400px] shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <CommitIcon className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Commit Timeline Graph</h3>
          </div>
          {onOpenTimeline && (
            <button
              onClick={onOpenTimeline}
              className="text-xs text-purple-400 hover:text-purple-300 transition font-bold cursor-pointer flex items-center gap-1"
            >
              <span>Full Visual Timeline &rarr;</span>
            </button>
          )}
        </div>

        {/* Commit Graph and details */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {git.commits.map((commit, index) => {
            const isSelected = selectedCommitSnapshot?.id === commit.id;
            return (
              <div
                key={commit.id}
                onClick={() => setSelectedCommitSnapshot(isSelected ? null : commit)}
                className={`p-3 rounded-xl border cursor-pointer transition flex flex-col space-y-1.5 ${
                  isSelected
                    ? "bg-purple-950/10 border-purple-800/80"
                    : "bg-[#050505] border-zinc-900 hover:bg-black/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500 ring-4 ring-purple-950" />
                    <span className="text-[11px] font-mono font-bold text-zinc-400">{commit.id}</span>
                  </div>
                  <span className="text-[10px] text-zinc-600 font-mono">{commit.timestamp}</span>
                </div>
                <h4 className="text-xs font-semibold text-zinc-200 line-clamp-1">{commit.message}</h4>
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Author: {commit.author}</span>
                  <span className="text-purple-400 hover:underline flex items-center gap-0.5">
                    <Eye className="w-3 h-3" />
                    {isSelected ? "Hide files" : "View files"}
                  </span>
                </div>

                {/* Expanded snapshot files viewer */}
                {isSelected && (
                  <div className="mt-2.5 pt-2 border-t border-purple-950 space-y-1.5">
                    <span className="text-[9px] font-bold text-purple-300 uppercase block tracking-wider font-mono">Snapshotted files:</span>
                    <div className="space-y-1">
                      {Object.keys(commit.files).map((filePath) => (
                        <div key={filePath} className="p-2 bg-black/40 border border-zinc-800 rounded-lg font-mono text-[10px] text-zinc-300 flex items-center justify-between">
                          <span className="truncate">{filePath}</span>
                          <span className="text-zinc-500 font-semibold">{commit.files[filePath].split("\n").length} lines</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 text-[10px] text-zinc-600 text-center font-mono">
          Interactive nodes click to inspect snapshot code
        </div>
      </div>

    </div>
  );
}
