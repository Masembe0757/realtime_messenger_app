import { contextBridge, ipcRenderer } from 'electron';
import {
  IpcChannel, GetChatsParams, GetMessagesParams, SearchMessagesParams,
  Chat, Message, PaginatedResponse, ConnectionState,
} from '../shared/types';

export interface ElectronAPI {
  getChats: (params: GetChatsParams) => Promise<PaginatedResponse<Chat>>;
  getMessages: (params: GetMessagesParams) => Promise<PaginatedResponse<Message>>;
  searchMessages: (params: SearchMessagesParams) => Promise<PaginatedResponse<Message>>;
  markChatAsRead: (chatId: string) => Promise<void>;
  seedDatabase: () => Promise<void>;
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => Promise<void>;
  simulateConnectionDrop: () => Promise<void>;
  onConnectionStateChange: (callback: (state: ConnectionState) => void) => () => void;
  onNewMessage: (callback: (message: Message & { chatId: string }) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  getChats: (params) => ipcRenderer.invoke(IpcChannel.DB_GET_CHATS, params),
  getMessages: (params) => ipcRenderer.invoke(IpcChannel.DB_GET_MESSAGES, params),
  searchMessages: (params) => ipcRenderer.invoke(IpcChannel.DB_SEARCH_MESSAGES, params),
  markChatAsRead: (chatId) => ipcRenderer.invoke(IpcChannel.DB_MARK_CHAT_READ, chatId),
  seedDatabase: () => ipcRenderer.invoke(IpcChannel.DB_SEED_DATA),
  connectWebSocket: () => ipcRenderer.invoke(IpcChannel.WS_CONNECT),
  disconnectWebSocket: () => ipcRenderer.invoke(IpcChannel.WS_DISCONNECT),
  simulateConnectionDrop: () => ipcRenderer.invoke(IpcChannel.WS_SIMULATE_DROP),

  onConnectionStateChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: ConnectionState) => callback(state);
    ipcRenderer.on(IpcChannel.WS_STATE_CHANGE, handler);
    return () => ipcRenderer.removeListener(IpcChannel.WS_STATE_CHANGE, handler);
  },

  onNewMessage: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, message: Message & { chatId: string }) => callback(message);
    ipcRenderer.on(IpcChannel.WS_NEW_MESSAGE, handler);
    return () => ipcRenderer.removeListener(IpcChannel.WS_NEW_MESSAGE, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
