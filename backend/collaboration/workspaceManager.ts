import { CollabState, ProjectFile, KanbanTask, CanvasElement, CollabUser } from '../../src/types.js';
import { PresenceManager, UserPresence } from './presenceManager.js';
import { CursorManager } from './cursorManager.js';
import { RoomManager } from './roomManager.js';

export class WorkspaceManager {
  private getStateByRoomId: (roomId: string) => CollabState;
  private saveStateCallback: (roomId: string) => Promise<void>;

  public presenceManager = new PresenceManager();
  public cursorManager = new CursorManager();
  public roomManager = new RoomManager();

  constructor(
    getStateByRoomId: (roomId: string) => CollabState,
    saveStateCallback: (roomId: string) => Promise<void>
  ) {
    this.getStateByRoomId = getStateByRoomId;
    this.saveStateCallback = saveStateCallback;
  }

  // File synchronization and state mutations
  public async createFile(roomId: string, name: string, path: string, language: string): Promise<ProjectFile> {
    const id = `file-${Date.now()}`;
    const newFile: ProjectFile = { id, name, path, language, content: '' };
    const state = this.getStateByRoomId(roomId);
    state.files.push(newFile);
    await this.saveStateCallback(roomId);
    return newFile;
  }

  public async updateFile(roomId: string, id: string, content: string): Promise<ProjectFile | null> {
    const state = this.getStateByRoomId(roomId);
    const file = state.files.find(f => f.id === id);
    if (file) {
      file.content = content;
      await this.saveStateCallback(roomId);
      return file;
    }
    return null;
  }

  public async renameFile(roomId: string, id: string, newName: string, newPath: string): Promise<ProjectFile | null> {
    const state = this.getStateByRoomId(roomId);
    const file = state.files.find(f => f.id === id);
    if (file) {
      file.name = newName;
      file.path = newPath;
      await this.saveStateCallback(roomId);
      return file;
    }
    return null;
  }

  public async deleteFile(roomId: string, id: string): Promise<ProjectFile | null> {
    const state = this.getStateByRoomId(roomId);
    const index = state.files.findIndex(f => f.id === id);
    if (index !== -1) {
      const deleted = state.files.splice(index, 1)[0];
      await this.saveStateCallback(roomId);
      return deleted;
    }
    return null;
  }

  // Synchronize task and canvas mockup elements
  public async updateTask(roomId: string, task: KanbanTask): Promise<void> {
    const state = this.getStateByRoomId(roomId);
    const idx = state.tasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      state.tasks[idx] = task;
    } else {
      state.tasks.push(task);
    }
    await this.saveStateCallback(roomId);
  }

  public async deleteTask(roomId: string, id: string): Promise<void> {
    const state = this.getStateByRoomId(roomId);
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      state.tasks.splice(idx, 1);
      await this.saveStateCallback(roomId);
    }
  }

  public async updateCanvasElement(roomId: string, element: CanvasElement): Promise<void> {
    const state = this.getStateByRoomId(roomId);
    const idx = state.canvasElements.findIndex(e => e.id === element.id);
    if (idx !== -1) {
      state.canvasElements[idx] = element;
    } else {
      state.canvasElements.push(element);
    }
    await this.saveStateCallback(roomId);
  }

  public async deleteCanvasElement(roomId: string, id: string): Promise<void> {
    const state = this.getStateByRoomId(roomId);
    const idx = state.canvasElements.findIndex(e => e.id === id);
    if (idx !== -1) {
      state.canvasElements.splice(idx, 1);
      await this.saveStateCallback(roomId);
    }
  }

  // Synced User/Collaborator list updates
  public async syncCollaboratorsFromPresence(roomId: string): Promise<void> {
    const state = this.getStateByRoomId(roomId);
    const socketsInRoom = this.roomManager.getSocketsInRoom(roomId);
    
    const activePresencesInRoom: UserPresence[] = [];
    for (const sid of socketsInRoom) {
      const p = this.presenceManager.getPresence(sid);
      if (p) {
        activePresencesInRoom.push(p);
      }
    }
    
    const activeUserIds = new Set(activePresencesInRoom.map(p => p.userId));

    // Filter out users who are not active in this specific room
    const filteredUsers = state.users.filter(u =>
      activeUserIds.has(u.id)
    );

    // Update details of active users or add new ones
    for (const p of activePresencesInRoom) {
      const existing = filteredUsers.find(u => u.id === p.userId);
      if (existing) {
        existing.name = p.username;
        existing.color = p.color;
        existing.activeFileId = p.currentFile;
        existing.cursorIndex = p.cursorPosition;
      } else {
        filteredUsers.push({
          id: p.userId,
          name: p.username,
          color: p.color,
          isMuted: false,
          isSpeaking: false,
          activeFileId: p.currentFile,
          cursorIndex: p.cursorPosition
        });
      }
    }

    state.users = filteredUsers;
  }
}
