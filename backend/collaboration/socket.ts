import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { WorkspaceManager } from './workspaceManager.js';
import { registerEventHandlers } from './eventHandlers.js';
import { CollabState } from '../../src/types.js';

let ioInstance: SocketServer | null = null;
let workspaceManagerInstance: WorkspaceManager | null = null;

type RoomActivityUpdater = (roomId: string, memberDelta: number) => void;

export function initCollaborationServer(
  httpServer: HttpServer,
  getStateByRoomId: (roomId: string) => CollabState,
  saveStateCallback: (roomId: string) => Promise<void>,
  updateRoomActivity?: RoomActivityUpdater
): { io: SocketServer; workspace: WorkspaceManager } {
  // Create Socket.IO server mounted on the main HTTP server
  const io = new SocketServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    // Prevent disconnect/reconnect jitter on minor network blips
    pingTimeout: 20000,
    pingInterval: 10000
  });

  const workspace = new WorkspaceManager(getStateByRoomId, saveStateCallback);

  io.on('connection', (socket) => {
    registerEventHandlers(io, socket, workspace, updateRoomActivity);
  });

  ioInstance = io;
  workspaceManagerInstance = workspace;

  console.log('--- Socket.IO Real-Time Collaboration Server Initialized Successfully ---');
  return { io, workspace };
}

export function getIO(): SocketServer {
  if (!ioInstance) {
    throw new Error('Socket.IO is not initialized yet. Call initCollaborationServer first.');
  }
  return ioInstance;
}

export function getWorkspaceManager(): WorkspaceManager {
  if (!workspaceManagerInstance) {
    throw new Error('WorkspaceManager is not initialized yet. Call initCollaborationServer first.');
  }
  return workspaceManagerInstance;
}
