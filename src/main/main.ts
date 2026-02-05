import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initDatabase, seedDatabase, getChats, getMessages, searchMessages, markChatAsRead, insertMessage, closeDatabase } from './database';
import { startWebSocketServer, stopWebSocketServer, simulateConnectionDrop, getWebSocketPort } from './websocket-server';
import { IpcChannel, GetChatsParams, GetMessagesParams, SearchMessagesParams, ConnectionState, NewMessageEvent, HeartbeatAckEvent } from '../shared/types';
import { secureLog } from '../shared/SecurityService';
import WebSocket from 'ws';

// Disable hardware acceleration to prevent GPU-related crashes on some Linux systems
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
let wsClient: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let heartbeatTimeout: NodeJS.Timeout | null = null;

const MAX_RECONNECT_DELAY = 30000;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Secure Messenger',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

function getReconnectDelay(): number {
  const base = 1000;
  const delay = Math.min(base * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  return delay + Math.random() * 1000;
}

function sendConnectionState(state: ConnectionState): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IpcChannel.WS_STATE_CHANGE, state);
  }
}

function connectToWebSocket(): void {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    secureLog.info('WS already connected');
    return;
  }

  const wsUrl = `ws://localhost:${getWebSocketPort()}`;
  secureLog.info('Connecting to WS', { url: wsUrl });
  wsClient = new WebSocket(wsUrl);

  wsClient.on('open', () => {
    secureLog.info('WS connected');
    reconnectAttempts = 0;
    sendConnectionState('connected');
    startHeartbeatMonitor();
  });

  wsClient.on('message', (data: Buffer) => {
    try {
      const event = JSON.parse(data.toString());
      if (event.type === 'NEW_MESSAGE') {
        handleNewMessage(event as NewMessageEvent);
      } else if (event.type === 'HEARTBEAT') {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          const ack: HeartbeatAckEvent = { type: 'HEARTBEAT_ACK', timestamp: Date.now() };
          wsClient.send(JSON.stringify(ack));
          resetHeartbeatTimeout();
        }
      }
    } catch {
      secureLog.error('Failed to parse WS message');
    }
  });

  wsClient.on('close', (code: number, reason: Buffer) => {
    secureLog.info('WS disconnected', { code, reason: reason.toString() });
    stopHeartbeatMonitor();
    handleDisconnect();
  });

  wsClient.on('error', (err: Error) => secureLog.error('WS error', err));
}

function handleNewMessage(event: NewMessageEvent): void {
  insertMessage({
    id: event.messageId,
    chatId: event.chatId,
    ts: event.ts,
    sender: event.sender,
    body: event.body,
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IpcChannel.WS_NEW_MESSAGE, {
      id: event.messageId,
      chatId: event.chatId,
      ts: event.ts,
      sender: event.sender,
      body: event.body,
    });
  }
}

function handleDisconnect(): void {
  sendConnectionState('reconnecting');
  reconnectAttempts++;
  const delay = getReconnectDelay();
  secureLog.info('Reconnecting', { attempt: reconnectAttempts, delay: `${delay}ms` });
  reconnectTimeout = setTimeout(connectToWebSocket, delay);
}

function startHeartbeatMonitor(): void {
  resetHeartbeatTimeout();
}

function resetHeartbeatTimeout(): void {
  if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
  heartbeatTimeout = setTimeout(() => {
    secureLog.info('Heartbeat timeout');
    if (wsClient) wsClient.terminate();
  }, 30000);
}

function stopHeartbeatMonitor(): void {
  if (heartbeatTimeout) {
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = null;
  }
}

function disconnectFromWebSocket(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  stopHeartbeatMonitor();
  if (wsClient) {
    wsClient.close();
    wsClient = null;
  }
  sendConnectionState('offline');
}

function setupIpcHandlers(): void {
  ipcMain.handle(IpcChannel.DB_GET_CHATS, (_e, params: GetChatsParams) => getChats(params));
  ipcMain.handle(IpcChannel.DB_GET_MESSAGES, (_e, params: GetMessagesParams) => getMessages(params));
  ipcMain.handle(IpcChannel.DB_SEARCH_MESSAGES, (_e, params: SearchMessagesParams) => searchMessages(params));
  ipcMain.handle(IpcChannel.DB_MARK_CHAT_READ, (_e, chatId: string) => markChatAsRead(chatId));

  ipcMain.handle(IpcChannel.DB_SEED_DATA, () => {
    seedDatabase();
    const chats = getChats({ limit: 200, offset: 0 });
    startWebSocketServer(chats.data.map((c) => c.id));
  });

  ipcMain.handle(IpcChannel.WS_CONNECT, () => connectToWebSocket());
  ipcMain.handle(IpcChannel.WS_DISCONNECT, () => disconnectFromWebSocket());
  ipcMain.handle(IpcChannel.WS_SIMULATE_DROP, () => simulateConnectionDrop());
}

app.whenReady().then(() => {
  secureLog.info('App starting');
  initDatabase();
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  secureLog.info('App shutting down');
  disconnectFromWebSocket();
  stopWebSocketServer();
  closeDatabase();
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsed = new URL(url);
    if (parsed.origin !== 'http://localhost:5173' && parsed.protocol !== 'file:') {
      event.preventDefault();
      secureLog.info('Blocked navigation', { url });
    }
  });
});
