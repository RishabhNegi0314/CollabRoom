export interface UserPresence {
  userId: string;
  username: string;
  avatar: string;
  socketId: string;
  currentFile: string | null;
  cursorPosition: number;
  selectionRange: { start: number; end: number } | null;
  typingStatus: boolean;
  connectionStatus: 'online' | 'offline' | 'reconnecting';
  lastSeen: number;
  color: string;
}

export class PresenceManager {
  // Map of socketId -> UserPresence
  private activePresences = new Map<string, UserPresence>();

  public addPresence(socketId: string, presence: Omit<UserPresence, 'socketId' | 'lastSeen' | 'connectionStatus'>): UserPresence {
    const fullPresence: UserPresence = {
      ...presence,
      socketId,
      connectionStatus: 'online',
      lastSeen: Date.now()
    };
    this.activePresences.set(socketId, fullPresence);
    return fullPresence;
  }

  public updatePresence(socketId: string, updates: Partial<Omit<UserPresence, 'socketId'>>): UserPresence | null {
    const existing = this.activePresences.get(socketId);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      lastSeen: Date.now()
    };
    this.activePresences.set(socketId, updated);
    return updated;
  }

  public removePresence(socketId: string): UserPresence | null {
    const presence = this.activePresences.get(socketId);
    if (presence) {
      this.activePresences.delete(socketId);
      return presence;
    }
    return null;
  }

  public getPresence(socketId: string): UserPresence | undefined {
    return this.activePresences.get(socketId);
  }

  public getPresencesForUsers(userIds: string[]): UserPresence[] {
    const list: UserPresence[] = [];
    for (const p of this.activePresences.values()) {
      if (userIds.includes(p.userId)) {
        list.push(p);
      }
    }
    return list;
  }

  public getAll(): UserPresence[] {
    return Array.from(this.activePresences.values());
  }
}
