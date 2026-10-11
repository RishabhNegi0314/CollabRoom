import { Server, Socket } from 'socket.io';
import { WorkspaceManager } from './workspaceManager.js';
import { UserPresence } from './presenceManager.js';

// Activity tracker callback — provided by server.ts to update the room registry
type RoomActivityUpdater = (roomId: string, memberDelta: number) => void;

export function registerEventHandlers(
  io: Server,
  socket: Socket,
  workspace: WorkspaceManager,
  updateRoomActivity?: RoomActivityUpdater
) {
  // 1. Join Workspace Room
  socket.on('workspace:join', async (data: { roomId: string; userId: string; username: string; avatar?: string }) => {
    const { roomId, userId, username, avatar } = data;
    if (!roomId || !userId || !username) {
      return socket.emit('error', 'Invalid join parameters');
    }

    // Join room
    socket.join(roomId);
    workspace.roomManager.joinRoom(roomId, socket.id);

    // Update room activity counter
    updateRoomActivity?.(roomId, 1);

    // Get color
    const color = workspace.cursorManager.getUserColor(userId);

    // Register presence
    workspace.presenceManager.addPresence(socket.id, {
      userId,
      username,
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      currentFile: null,
      cursorPosition: 0,
      selectionRange: null,
      typingStatus: false,
      color
    });

    // Update state.users for this specific room
    await workspace.syncCollaboratorsFromPresence(roomId);

    // Broadcast updated presence to the room
    const members = workspace.roomManager.getSocketsInRoom(roomId)
      .map(sid => workspace.presenceManager.getPresence(sid))
      .filter(Boolean) as UserPresence[];

    io.to(roomId).emit('presence:update', members);
    
    // Send back current soft file locks
    socket.emit('file:locks:update', workspace.roomManager.getSoftLocks(roomId));
    
    console.log(`[JOIN] Socket=${socket.id} Room=${roomId} User=${userId} (${username}) Members=${members.length}`);
  });

  // 2. Open / Switch File
  socket.on('file:open', async (data: { fileId: string | null }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    workspace.presenceManager.updatePresence(socket.id, { currentFile: data.fileId });
    await workspace.syncCollaboratorsFromPresence(roomId);

    const members = workspace.roomManager.getSocketsInRoom(roomId)
      .map(sid => workspace.presenceManager.getPresence(sid))
      .filter(Boolean) as UserPresence[];

    io.to(roomId).emit('presence:update', members);
  });

  // 3. Cursor Update
  socket.on('cursor:update', (data: { cursorIndex: number; fileId: string | null }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    const presence = workspace.presenceManager.getPresence(socket.id);
    if (!presence) return;

    workspace.presenceManager.updatePresence(socket.id, {
      cursorPosition: data.cursorIndex,
      currentFile: data.fileId
    });

    socket.to(roomId).emit('cursor:updated', {
      socketId: socket.id,
      userId: presence.userId,
      username: presence.username,
      color: presence.color,
      fileId: data.fileId,
      cursorIndex: data.cursorIndex
    });
  });

  // 4. Selection Range Update
  socket.on('selection:update', (data: { selectionRange: { start: number; end: number } | null; fileId: string | null }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    const presence = workspace.presenceManager.getPresence(socket.id);
    if (!presence) return;

    workspace.presenceManager.updatePresence(socket.id, {
      selectionRange: data.selectionRange,
      currentFile: data.fileId
    });

    socket.to(roomId).emit('selection:updated', {
      socketId: socket.id,
      userId: presence.userId,
      username: presence.username,
      color: presence.color,
      fileId: data.fileId,
      selectionRange: data.selectionRange
    });
  });

  // 5. Real-Time Text Sync / Editor Change
  socket.on('editor:change', async (data: { fileId: string; content: string }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    // Update in-memory file content
    await workspace.updateFile(roomId, data.fileId, data.content);

    // Broadcast exact change/content state to other room members instantly
    socket.to(roomId).emit('editor:changed', {
      socketId: socket.id,
      fileId: data.fileId,
      content: data.content
    });
  });

  // 6. Typing Indicator
  socket.on('user:typing', (data: { isTyping: boolean; fileId: string | null }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    const presence = workspace.presenceManager.getPresence(socket.id);
    if (!presence) return;

    workspace.presenceManager.updatePresence(socket.id, { typingStatus: data.isTyping });

    socket.to(roomId).emit('user:typing:updated', {
      userId: presence.userId,
      username: presence.username,
      isTyping: data.isTyping,
      fileId: data.fileId
    });
  });

  // 7. Soft Locks Management
  socket.on('file:lock:acquire', (data: { fileId: string }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    const presence = workspace.presenceManager.getPresence(socket.id);
    if (!presence) return;

    workspace.roomManager.acquireSoftLock(roomId, data.fileId, presence.userId, presence.username);
    io.to(roomId).emit('file:locks:update', workspace.roomManager.getSoftLocks(roomId));
  });

  socket.on('file:lock:release', (data: { fileId: string }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    const presence = workspace.presenceManager.getPresence(socket.id);
    if (!presence) return;

    workspace.roomManager.releaseSoftLock(roomId, data.fileId, presence.userId);
    io.to(roomId).emit('file:locks:update', workspace.roomManager.getSoftLocks(roomId));
  });

  // 8. File Structure Updates (Create, Rename, Delete)
  socket.on('file:create', async (data: { name: string; path: string; language: string }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    const newFile = await workspace.createFile(roomId, data.name, data.path, data.language);
    io.to(roomId).emit('file:created', newFile);
  });

  socket.on('file:rename', async (data: { id: string; name: string; path: string }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    const updated = await workspace.renameFile(roomId, data.id, data.name, data.path);
    if (updated) {
      io.to(roomId).emit('file:renamed', updated);
    }
  });

  socket.on('file:delete', async (data: { id: string }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    const deleted = await workspace.deleteFile(roomId, data.id);
    if (deleted) {
      io.to(roomId).emit('file:deleted', { id: data.id });
    }
  });

  // 9. Task Updates (Kanban)
  socket.on('task:update', async (data: { task: any }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    await workspace.updateTask(roomId, data.task);
    io.to(roomId).emit('task:updated', data.task);
  });

  socket.on('task:delete', async (data: { id: string }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    await workspace.deleteTask(roomId, data.id);
    io.to(roomId).emit('task:deleted', data.id);
  });

  // 10. Canvas Updates (Visual builder elements)
  socket.on('canvas:update', async (data: { element: any }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    await workspace.updateCanvasElement(roomId, data.element);
    io.to(roomId).emit('canvas:updated', data.element);
  });

  socket.on('canvas:delete', async (data: { id: string }) => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    await workspace.deleteCanvasElement(roomId, data.id);
    io.to(roomId).emit('canvas:deleted', data.id);
  });

  // 11. Disconnect and Leave Room Cleanup
  socket.on('disconnect', async () => {
    const roomId = workspace.roomManager.getRoomOfSocket(socket.id);
    if (!roomId) return;

    const presence = workspace.presenceManager.removePresence(socket.id);
    workspace.roomManager.leaveRoom(socket.id);

    // Update room activity counter
    updateRoomActivity?.(roomId, -1);

    if (presence) {
      // Release any locks held by the disconnected user
      workspace.roomManager.releaseAllLocksOfUser(roomId, presence.userId);
      io.to(roomId).emit('file:locks:update', workspace.roomManager.getSoftLocks(roomId));
      console.log(`[LEAVE] Socket=${socket.id} Room=${roomId} User=${presence.userId} (${presence.username})`);
    }

    // Recalculate presences list
    const remainingMembers = workspace.roomManager.getSocketsInRoom(roomId)
      .map(sid => workspace.presenceManager.getPresence(sid))
      .filter(Boolean) as UserPresence[];

    io.to(roomId).emit('presence:update', remainingMembers);

    await workspace.syncCollaboratorsFromPresence(roomId);
    console.log(`[DISCONNECT] Socket=${socket.id} Room=${roomId} remaining=${remainingMembers.length} members`);
  });
}
