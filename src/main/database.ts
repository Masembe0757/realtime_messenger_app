import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Chat, Message, GetChatsParams, GetMessagesParams, SearchMessagesParams, PaginatedResponse } from '../shared/types';
import { encrypt, secureLog } from '../shared/SecurityService';

let db: Database.Database | null = null;

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'messenger.db');
  secureLog.info('Initializing database', { path: dbPath });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      lastMessageAt INTEGER NOT NULL,
      unreadCount INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT NOT NULL,
      ts INTEGER NOT NULL,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      FOREIGN KEY (chatId) REFERENCES chats(id)
    );

    CREATE INDEX IF NOT EXISTS idx_chats_lastMessageAt ON chats(lastMessageAt DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_chatId_ts ON messages(chatId, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_body ON messages(body);
  `);

  secureLog.info('Database initialized');
}

function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function seedDatabase(): void {
  const database = getDb();

  const chatCount = database.prepare('SELECT COUNT(*) as count FROM chats').get() as { count: number };
  if (chatCount.count > 0) {
    secureLog.info('Database already seeded');
    return;
  }

  secureLog.info('Seeding database...');
  const startTime = Date.now();

  const insertChat = database.prepare('INSERT INTO chats (id, title, lastMessageAt, unreadCount) VALUES (?, ?, ?, ?)');
  const insertMessage = database.prepare('INSERT INTO messages (id, chatId, ts, sender, body) VALUES (?, ?, ?, ?, ?)');

  const chats: { id: string; title: string }[] = [];
  const senders = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const templates = [
    'Hey, how are you?',
    'Did you see the news?',
    'Meeting at 3pm',
    'Can you send me the file?',
    'Thanks!',
    'Let me know when free',
    'Sounds good',
    'Will check and get back',
    'Great work!',
    'See you later',
    'What do you think?',
    'Question about the implementation',
    'Deadline is next week',
    'Discuss tomorrow?',
    'I agree',
  ];

  const seedTransaction = database.transaction(() => {
    for (let i = 0; i < 200; i++) {
      const chatId = uuidv4();
      const title = `Chat ${i + 1} - ${senders[i % senders.length]}`;
      chats.push({ id: chatId, title });
    }

    const totalMessages = 20000;
    const perChat = Math.floor(totalMessages / chats.length);
    const extra = totalMessages % chats.length;
    let baseTs = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (let ci = 0; ci < chats.length; ci++) {
      const chat = chats[ci];
      const msgCount = perChat + (ci < extra ? 1 : 0);
      let lastTs = baseTs;

      for (let j = 0; j < msgCount; j++) {
        const ts = baseTs + j * 60000 + Math.floor(Math.random() * 30000);
        const sender = senders[Math.floor(Math.random() * senders.length)];
        const body = encrypt(`${templates[Math.floor(Math.random() * templates.length)]} [${j + 1}]`);
        insertMessage.run(uuidv4(), chat.id, ts, sender, body);
        lastTs = Math.max(lastTs, ts);
      }

      const unread = Math.floor(Math.random() * 10);
      insertChat.run(chat.id, chat.title, lastTs, unread);
    }
  });

  seedTransaction();
  secureLog.info('Seeding complete', { duration: `${Date.now() - startTime}ms` });
}

export function getChats(params: GetChatsParams): PaginatedResponse<Chat> {
  const database = getDb();
  const { limit, offset } = params;

  const chats = database
    .prepare('SELECT id, title, lastMessageAt, unreadCount FROM chats ORDER BY lastMessageAt DESC LIMIT ? OFFSET ?')
    .all(limit + 1, offset) as Chat[];

  const hasMore = chats.length > limit;
  if (hasMore) chats.pop();

  return { data: chats, hasMore };
}

export function getMessages(params: GetMessagesParams): PaginatedResponse<Message> {
  const database = getDb();
  const { chatId, limit, beforeTs } = params;

  let query = 'SELECT id, chatId, ts, sender, body FROM messages WHERE chatId = ?';
  const queryParams: (string | number)[] = [chatId];

  if (beforeTs !== undefined) {
    query += ' AND ts < ?';
    queryParams.push(beforeTs);
  }

  query += ' ORDER BY ts DESC LIMIT ?';
  queryParams.push(limit + 1);

  const messages = database.prepare(query).all(...queryParams) as Message[];
  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();
  messages.reverse();

  return { data: messages, hasMore };
}

export function searchMessages(params: SearchMessagesParams): PaginatedResponse<Message> {
  const database = getDb();
  const { chatId, query, limit } = params;

  const messages = database
    .prepare('SELECT id, chatId, ts, sender, body FROM messages WHERE chatId = ? AND body LIKE ? ORDER BY ts DESC LIMIT ?')
    .all(chatId, `%${query}%`, limit + 1) as Message[];

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  return { data: messages, hasMore };
}

export function markChatAsRead(chatId: string): void {
  const database = getDb();
  database.prepare('UPDATE chats SET unreadCount = 0 WHERE id = ?').run(chatId);
  secureLog.info('Marked chat as read', { chatId });
}

export function insertMessage(message: Omit<Message, 'body'> & { body: string }): void {
  const database = getDb();
  const encryptedBody = encrypt(message.body);

  const transaction = database.transaction(() => {
    database
      .prepare('INSERT INTO messages (id, chatId, ts, sender, body) VALUES (?, ?, ?, ?, ?)')
      .run(message.id, message.chatId, message.ts, message.sender, encryptedBody);

    database
      .prepare('UPDATE chats SET lastMessageAt = MAX(lastMessageAt, ?), unreadCount = unreadCount + 1 WHERE id = ?')
      .run(message.ts, message.chatId);
  });

  transaction();
  secureLog.info('Inserted message', { messageId: message.id, chatId: message.chatId });
}

export function getChatById(chatId: string): Chat | null {
  const database = getDb();
  return database.prepare('SELECT * FROM chats WHERE id = ?').get(chatId) as Chat | null;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    secureLog.info('Database closed');
  }
}
