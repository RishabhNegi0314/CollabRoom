export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
}

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  isMuted: boolean;
  isSpeaking: boolean;
  activeFileId: string | null;
  cursorIndex?: number;
}

export interface GitCommit {
  id: string;
  message: string;
  author: string;
  timestamp: string;
  files: Record<string, string>; // path -> content snapshot
}

export interface GitState {
  currentBranch: string;
  branches: string[];
  commits: GitCommit[];
  stagedFiles: string[]; // file paths staged
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  assignee: string;
  priority: 'low' | 'medium' | 'high';
  points: number;
}

export interface CanvasElement {
  id: string;
  type: 'button' | 'input' | 'card' | 'text' | 'navbar' | 'image' | 'header';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  bgColor: string;
  borderColor: string;
  borderRadius: string;
}

export interface FileLock {
  fileId: string;
  userId: string;
  username: string;
  lockedAt: number;
}

export interface UserPresence {
  userId: string;
  username: string;
  avatar: string;
  currentFile: string | null;
  cursorPosition: number;
  selectionRange: { start: number; end: number } | null;
  typingStatus: boolean;
  color: string;
}

export interface CollabState {
  files: ProjectFile[];
  users: CollabUser[];
  git: GitState;
  tasks: KanbanTask[];
  canvasElements: CanvasElement[];
}
