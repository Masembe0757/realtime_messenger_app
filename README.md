# Secure Messenger Desktop

Desktop messenger app built with Electron, React, and TypeScript. Focuses on efficient local storage, real-time sync, and UI performance with large datasets.

## Getting Started

```bash
npm install
npm run build:electron
npm run dev
```

For production:
```bash
npm run build
npm run package
```

## Architecture

```
src/
├── main/           # Electron main process
│   ├── main.ts     # Entry point, IPC setup
│   ├── database.ts # SQLite operations
│   ├── websocket-server.ts
│   └── preload.ts
├── renderer/       # React app
│   ├── components/
│   ├── store/      # Redux slices
│   └── services/
└── shared/         # Types, SecurityService
```

### Data Flow

1. Renderer requests data via IPC
2. Main process queries SQLite with pagination
3. Results go through Redux to React
4. WebSocket events update both DB and UI in real-time

## Database

Using `better-sqlite3` for synchronous, fast queries.

```sql
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  lastMessageAt INTEGER NOT NULL,
  unreadCount INTEGER DEFAULT 0
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL,
  ts INTEGER NOT NULL,
  sender TEXT NOT NULL,
  body TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_chats_lastMessageAt ON chats(lastMessageAt DESC);
CREATE INDEX idx_messages_chatId_ts ON messages(chatId, ts DESC);
CREATE INDEX idx_messages_body ON messages(body);
```

Seeds 200 chats and 20k+ messages on first run.

## WebSocket Sync

Local WS server emits new message events every 1-3s. Client handles:
- Connection state tracking (connected/reconnecting/offline)
- Heartbeat every 10s
- Exponential backoff on disconnect (1s base, 30s max)
- "Simulate drop" button for testing recovery

## Security

`SecurityService` defines encrypt/decrypt boundaries. Currently placeholder implementations - in production would use AES-256-GCM.

Key points:
- Message bodies encrypted before storage
- `secureLog` redacts sensitive fields from logs
- CSP headers in index.html
- contextIsolation enabled, nodeIntegration disabled

Where encryption would happen in a real system:
- Before SQLite write (at-rest encryption)
- Before WebSocket transmission (in-transit)
- Keys stored via Electron's safeStorage API

Preventing leaks:
- No message content in console logs
- Disable DevTools in production builds
- Clear decrypted data from memory when not displayed

## Performance

- Chat list virtualized with react-window
- Message list also virtualized
- Memoized components to prevent re-renders
- Paginated queries (50 items per page)
- No full table loads

## Trade-offs

| Choice | Why |
|--------|-----|
| better-sqlite3 | Sync API is simpler, good perf for this use case |
| Redux Toolkit | Familiar, good devtools, handles async well |
| In-process WS server | Simplifies demo setup |
| Fixed row height | react-window v2 works best this way |

## TODO (with more time)

- FTS5 for better search performance
- Database migrations
- Offline message queue
- Variable height message rows
- Unit tests for reducers and queries
- E2E tests
