import { contextBridge, ipcRenderer } from 'electron';

// IPC Channel constants - inline to avoid import issues in preload
const IpcChannel = {
  DB_GET_CHATS: 'db:get-chats',
  DB_GET_MESSAGES: 'db:get-messages',
  DB_SEARCH_MESSAGES: 'db:search-messages',
  DB_MARK_CHAT_READ: 'db:mark-chat-read',
  DB_SEED_DATA: 'db:seed-data',
  WS_CONNECT: 'ws:connect',
  WS_DISCONNECT: 'ws:disconnect',
  WS_SIMULATE_DROP: 'ws:simulate-drop',
  WS_STATE_CHANGE: 'ws:state-change',
  WS_NEW_MESSAGE: 'ws:new-message',
} as const;

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  getChats: (params: { limit: number; offset: number }) =>
    ipcRenderer.invoke(IpcChannel.DB_GET_CHATS, params),
  getMessages: (params: { chatId: string; limit: number; beforeTs?: number }) =>
    ipcRenderer.invoke(IpcChannel.DB_GET_MESSAGES, params),
  searchMessages: (params: { chatId: string; query: string; limit: number }) =>
    ipcRenderer.invoke(IpcChannel.DB_SEARCH_MESSAGES, params),
  markChatAsRead: (chatId: string) =>
    ipcRenderer.invoke(IpcChannel.DB_MARK_CHAT_READ, chatId),
  seedDatabase: () =>
    ipcRenderer.invoke(IpcChannel.DB_SEED_DATA),

  // WebSocket operations
  connectWebSocket: () => ipcRenderer.invoke(IpcChannel.WS_CONNECT),
  disconnectWebSocket: () => ipcRenderer.invoke(IpcChannel.WS_DISCONNECT),
  simulateConnectionDrop: () => ipcRenderer.invoke(IpcChannel.WS_SIMULATE_DROP),

  // Event listeners
  onConnectionStateChange: (callback: (state: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: string) => callback(state);
    ipcRenderer.on(IpcChannel.WS_STATE_CHANGE, handler);
    return () => ipcRenderer.removeListener(IpcChannel.WS_STATE_CHANGE, handler);
  },

  onNewMessage: (callback: (message: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: unknown) => callback(message);
    ipcRenderer.on(IpcChannel.WS_NEW_MESSAGE, handler);
    return () => ipcRenderer.removeListener(IpcChannel.WS_NEW_MESSAGE, handler);
  },

  // Platform info
  platform: process.platform,
  isElectron: true,
});
