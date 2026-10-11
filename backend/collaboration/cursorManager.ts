export interface CursorUpdate {
  userId: string;
  username: string;
  socketId: string;
  fileId: string;
  cursorIndex: number;
  selectionRange: { start: number; end: number } | null;
  color: string;
}

export class CursorManager {
  private colors = [
    '#f43f5e', // Rose
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#ec4899', // Pink
  ];

  private userColors = new Map<string, string>(); // userId -> color

  public getUserColor(userId: string): string {
    let color = this.userColors.get(userId);
    if (!color) {
      const idx = this.userColors.size % this.colors.length;
      color = this.colors[idx];
      this.userColors.set(userId, color);
    }
    return color;
  }
}
