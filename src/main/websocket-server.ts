import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { secureLog } from '../shared/SecurityService';
import { NewMessageEvent, HeartbeatEvent } from '../shared/types';

const WS_PORT = 8765;

let wss: WebSocketServer | null = null;
let messageInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let chatIds: string[] = [];

const senders = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
const templates = [
  'Just checking in!',
  'Did you get my last message?',
  'Found something interesting',
  'Can we talk later?',
  'Thanks for the update',
  'Let me know your thoughts',
  'Working on it now',
  'Almost done',
  'Have a great day!',
  'Quick question',
];

export function startWebSocketServer(availableChatIds: string[]): void {
  chatIds = availableChatIds;
  if (wss) {
    secureLog.info('WS server already running');
    return;
  }

  wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws: WebSocket) => {
    secureLog.info('Client connected');
    startMessageGenerator(ws);
    startHeartbeat(ws);

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'HEARTBEAT_ACK') {
          secureLog.debug('Heartbeat ack received');
        }
      } catch {
        secureLog.error('Failed to parse WS message');
      }
    });

    ws.on('close', () => {
      secureLog.info('Client disconnected');
      stopMessageGenerator();
      stopHeartbeat();
    });

    ws.on('error', (err) => secureLog.error('WS error', err as Error));
  });

  wss.on('error', (err) => secureLog.error('WS server error', err as Error));
  secureLog.info('WS server started', { port: WS_PORT });
}

function startMessageGenerator(ws: WebSocket): void {
  const send = () => {
    if (ws.readyState !== WebSocket.OPEN || chatIds.length === 0) return;

    const event: NewMessageEvent = {
      type: 'NEW_MESSAGE',
      chatId: chatIds[Math.floor(Math.random() * chatIds.length)],
      messageId: uuidv4(),
      ts: Date.now(),
      sender: senders[Math.floor(Math.random() * senders.length)],
      body: templates[Math.floor(Math.random() * templates.length)],
    };

    secureLog.info('Sending message event', { chatId: event.chatId, messageId: event.messageId });
    ws.send(JSON.stringify(event));

    const nextDelay = 1000 + Math.random() * 2000;
    messageInterval = setTimeout(send, nextDelay);
  };

  messageInterval = setTimeout(send, 1000);
}

function startHeartbeat(ws: WebSocket): void {
  heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const event: HeartbeatEvent = { type: 'HEARTBEAT', timestamp: Date.now() };
      ws.send(JSON.stringify(event));
      secureLog.debug('Heartbeat sent');
    }
  }, 10000);
}

function stopMessageGenerator(): void {
  if (messageInterval) {
    clearTimeout(messageInterval);
    messageInterval = null;
  }
}

function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export function simulateConnectionDrop(): void {
  if (!wss) {
    secureLog.info('No WS server running');
    return;
  }
  secureLog.info('Simulating connection drop');
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close(1000, 'Simulated drop');
    }
  });
}

export function updateChatIds(ids: string[]): void {
  chatIds = ids;
}

export function stopWebSocketServer(): void {
  stopMessageGenerator();
  stopHeartbeat();
  if (wss) {
    wss.close(() => secureLog.info('WS server stopped'));
    wss = null;
  }
}

export function getWebSocketPort(): number {
  return WS_PORT;
}
