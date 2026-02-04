export interface Chat {
  id: string;
  title: string;
  lastMessageAt: number;
  unreadCount: number;
}

export interface Message {
  id: string;
  chatId: string;
  ts: number;
  sender: string;
  body: string;
}

export interface NewMessageEvent {
  type: 'NEW_MESSAGE';
  chatId: string;
  messageId: string;
  ts: number;
  sender: string;
  body: string;
}

export interface HeartbeatEvent {
  type: 'HEARTBEAT';
  timestamp: number;
}

export interface HeartbeatAckEvent {
  type: 'HEARTBEAT_ACK';
  timestamp: number;
}

export type WSEvent = NewMessageEvent | HeartbeatEvent | HeartbeatAckEvent;

export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

export enum IpcChannel {
  DB_GET_CHATS = 'db:get-chats',
  DB_GET_MESSAGES = 'db:get-messages',
  DB_SEARCH_MESSAGES = 'db:search-messages',
  DB_MARK_CHAT_READ = 'db:mark-chat-read',
  DB_SEED_DATA = 'db:seed-data',
  DB_INSERT_MESSAGE = 'db:insert-message',
  WS_CONNECT = 'ws:connect',
  WS_DISCONNECT = 'ws:disconnect',
  WS_SIMULATE_DROP = 'ws:simulate-drop',
  WS_STATE_CHANGE = 'ws:state-change',
  WS_NEW_MESSAGE = 'ws:new-message',
}

export interface GetChatsParams {
  limit: number;
  offset: number;
}

export interface GetMessagesParams {
  chatId: string;
  limit: number;
  beforeTs?: number;
}

export interface SearchMessagesParams {
  chatId: string;
  query: string;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
}
