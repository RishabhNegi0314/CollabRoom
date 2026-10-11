import { io, Socket } from 'socket.io-client';
import { UserPresence } from '../../backend/collaboration/presenceManager.js';
import { FileLock } from '../../backend/collaboration/roomManager.js';

export interface CollabClientEvents {
  onPresenceUpdate?: (users: UserPresence[]) => void;
  onCursorUpdated?: (data: { socketId: string; userId: string; username: string; color: string; fileId: string | null; cursorIndex: number }) => void;
  onSelectionUpdated?: (data: { socketId: string; userId: string; username: string; color: string; fileId: string | null; selectionRange: { start: number; end: number } | null }) => void;
  onEditorChanged?: (data: { socketId: string; fileId: string; content: string }) => void;
  onUserTyping?: (data: { userId: string; username: string; isTyping: boolean; fileId: string | null }) => void;
  onFileLocksUpdate?: (locks: FileLock[]) => void;
  onConnectionStatus?: (status: 'online' | 'offline' | 'reconnecting') => void;
  
  // Real-time state synchronizations
  onFileCreated?: (file: any) => void;
  onFileRenamed?: (file: any) => void;
  onFileDeleted?: (data: { id: string }) => void;
  onTaskUpdated?: (task: any) => void;
  onTaskDeleted?: (id: string) => void;
  onCanvasUpdated?: (element: any) => void;
  onCanvasDeleted?: (id: string) => void;
}

export class CollaborationClient {
  private socket: Socket | null = null;
  private roomId: string = 'remix-default';
  private userId: string = 'user-rishabh';
  private username: string = 'Rishabh';
  private avatar: string = '';
  private currentFileId: string | null = null;
  private connectionStatus: 'online' | 'offline' | 'reconnecting' = 'offline';

  // Queue to preserve offline changes and sync them back on reconnection
  private offlineMutationQueue: Array<{ event: string; data: any }> = [];

  private listeners: CollabClientEvents = {};

  // For throttling cursor updates (approx 25 updates per sec)
  private lastCursorUpdateTime = 0;
  private cursorThrottleMs = 40; // ~25fps

  constructor(roomId: string, userId: string, username: string, avatar?: string) {
    this.roomId = roomId || 'remix-default';
    this.userId = userId;
    this.username = username;
    this.avatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;
  }

  public connect(listeners: CollabClientEvents) {
    this.listeners = listeners;

    // Connect to the same host using relative namespace pathing (compliant with proxy layers)
    this.socket = io({
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.connectionStatus = 'online';
      this.listeners.onConnectionStatus?.('online');

      // Join workspace immediately on connection or reconnection
      this.socket?.emit('workspace:join', {
        roomId: this.roomId,
        userId: this.userId,
        username: this.username,
        avatar: this.avatar
      });

      // Restore open file state if reconnecting
      if (this.currentFileId) {
        this.socket?.emit('file:open', { fileId: this.currentFileId });
      }

      // Flush queue of offline mutations
      this.flushOfflineQueue();
      console.log('Real-Time Collaboration: Connected and synced successfully.');
    });

    this.socket.on('disconnect', (reason) => {
      this.connectionStatus = 'offline';
      this.listeners.onConnectionStatus?.('offline');
      console.warn('Real-Time Collaboration: Disconnected, reason:', reason);
    });

    this.socket.on('connect_error', () => {
      if (this.connectionStatus !== 'reconnecting') {
        this.connectionStatus = 'reconnecting';
        this.listeners.onConnectionStatus?.('reconnecting');
      }
    });

    // Handle real-time presence, cursors and editing events
    this.socket.on('presence:update', (users: UserPresence[]) => {
      this.listeners.onPresenceUpdate?.(users);
    });

    this.socket.on('cursor:updated', (data) => {
      this.listeners.onCursorUpdated?.(data);
    });

    this.socket.on('selection:updated', (data) => {
      this.listeners.onSelectionUpdated?.(data);
    });

    this.socket.on('editor:changed', (data) => {
      this.listeners.onEditorChanged?.(data);
    });

    this.socket.on('user:typing:updated', (data) => {
      this.listeners.onUserTyping?.(data);
    });

    this.socket.on('file:locks:update', (locks: FileLock[]) => {
      this.listeners.onFileLocksUpdate?.(locks);
    });

    // Real-Time File changes
    this.socket.on('file:created', (file) => {
      this.listeners.onFileCreated?.(file);
    });

    this.socket.on('file:renamed', (file) => {
      this.listeners.onFileRenamed?.(file);
    });

    this.socket.on('file:deleted', (data) => {
      this.listeners.onFileDeleted?.(data);
    });

    // Real-Time Task Changes
    this.socket.on('task:updated', (task) => {
      this.listeners.onTaskUpdated?.(task);
    });

    this.socket.on('task:deleted', (id) => {
      this.listeners.onTaskDeleted?.(id);
    });

    // Real-Time Canvas mockup updates
    this.socket.on('canvas:updated', (el) => {
      this.listeners.onCanvasUpdated?.(el);
    });

    this.socket.on('canvas:deleted', (id) => {
      this.listeners.onCanvasDeleted?.(id);
    });
  }

  // Event emitters with fallback offline queuing support
  private emitOrQueue(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      // Queue mutation to execute upon successful network reconnection
      this.offlineMutationQueue.push({ event, data });
    }
  }

  private flushOfflineQueue() {
    if (!this.socket || !this.socket.connected) return;
    while (this.offlineMutationQueue.length > 0) {
      const item = this.offlineMutationQueue.shift();
      if (item) {
        this.socket.emit(item.event, item.data);
      }
    }
  }

  public openFile(fileId: string | null) {
    this.currentFileId = fileId;
    this.emitOrQueue('file:open', { fileId });
  }

  public updateCursor(cursorIndex: number, fileId: string | null) {
    const now = Date.now();
    if (now - this.lastCursorUpdateTime > this.cursorThrottleMs) {
      this.lastCursorUpdateTime = now;
      this.emitOrQueue('cursor:update', { cursorIndex, fileId });
    }
  }

  public updateSelection(selectionRange: { start: number; end: number } | null, fileId: string | null) {
    this.emitOrQueue('selection:update', { selectionRange, fileId });
  }

  public emitEditorChange(fileId: string, content: string) {
    this.emitOrQueue('editor:change', { fileId, content });
  }

  public emitTyping(isTyping: boolean, fileId: string | null) {
    this.emitOrQueue('user:typing', { isTyping, fileId });
  }

  // Soft locks
  public acquireLock(fileId: string) {
    this.emitOrQueue('file:lock:acquire', { fileId });
  }

  public releaseLock(fileId: string) {
    this.emitOrQueue('file:lock:release', { fileId });
  }

  // Structural adjustments
  public emitFileCreate(name: string, path: string, language: string) {
    this.emitOrQueue('file:create', { name, path, language });
  }

  public emitFileRename(id: string, name: string, path: string) {
    this.emitOrQueue('file:rename', { id, name, path });
  }

  public emitFileDelete(id: string) {
    this.emitOrQueue('file:delete', { id });
  }

  // Kanban Tasks
  public emitTaskUpdate(task: any) {
    this.emitOrQueue('task:update', { task });
  }

  public emitTaskDelete(id: string) {
    this.emitOrQueue('task:delete', { id });
  }

  // Canvas elements
  public emitCanvasUpdate(element: any) {
    this.emitOrQueue('canvas:update', { element });
  }

  public emitCanvasDelete(id: string) {
    this.emitOrQueue('canvas:delete', { id });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
