import { UserPresence } from './presenceManager.js';

export interface FileLock {
  fileId: string;
  userId: string;
  username: string;
  lockedAt: number;
}

export class RoomManager {
  // Map of roomId (workspaceId) -> Set of socketIds
  private rooms = new Map<string, Set<string>>();

  // Map of socketId -> roomId
  private socketToRoom = new Map<string, string>();

  // Map of roomId -> Map of fileId -> FileLock
  private fileLocks = new Map<string, Map<string, FileLock>>();

  public joinRoom(roomId: string, socketId: string): void {
    let sockets = this.rooms.get(roomId);
    if (!sockets) {
      sockets = new Set();
      this.rooms.set(roomId, sockets);
    }
    sockets.add(socketId);
    this.socketToRoom.set(socketId, roomId);
  }

  public leaveRoom(socketId: string): string | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const sockets = this.rooms.get(roomId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.rooms.delete(roomId);
        this.fileLocks.delete(roomId);
      }
    }
    this.socketToRoom.delete(socketId);
    return roomId;
  }

  public getRoomOfSocket(socketId: string): string | null {
    return this.socketToRoom.get(socketId) || null;
  }

  public getSocketsInRoom(roomId: string): string[] {
    const sockets = this.rooms.get(roomId);
    return sockets ? Array.from(sockets) : [];
  }

  // Soft Lock support
  public acquireSoftLock(roomId: string, fileId: string, userId: string, username: string): FileLock {
    let roomLocks = this.fileLocks.get(roomId);
    if (!roomLocks) {
      roomLocks = new Map();
      this.fileLocks.set(roomId, roomLocks);
    }

    const lock: FileLock = {
      fileId,
      userId,
      username,
      lockedAt: Date.now()
    };
    roomLocks.set(fileId, lock);
    return lock;
  }

  public releaseSoftLock(roomId: string, fileId: string, userId: string): boolean {
    const roomLocks = this.fileLocks.get(roomId);
    if (!roomLocks) return false;

    const lock = roomLocks.get(fileId);
    if (lock && lock.userId === userId) {
      roomLocks.delete(fileId);
      return true;
    }
    return false;
  }

  public getSoftLocks(roomId: string): FileLock[] {
    const roomLocks = this.fileLocks.get(roomId);
    return roomLocks ? Array.from(roomLocks.values()) : [];
  }

  public releaseAllLocksOfUser(roomId: string, userId: string): string[] {
    const releasedFileIds: string[] = [];
    const roomLocks = this.fileLocks.get(roomId);
    if (roomLocks) {
      for (const [fileId, lock] of roomLocks.entries()) {
        if (lock.userId === userId) {
          roomLocks.delete(fileId);
          releasedFileIds.push(fileId);
        }
      }
    }
    return releasedFileIds;
  }
}
