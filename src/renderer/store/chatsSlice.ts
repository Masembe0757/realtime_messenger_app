import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Chat, PaginatedResponse } from '../../shared/types';

interface ChatsState {
  items: Chat[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  selectedChatId: string | null;
}

const initialState: ChatsState = {
  items: [],
  loading: false,
  hasMore: true,
  error: null,
  selectedChatId: null,
};

const PAGE_SIZE = 50;

export const fetchChats = createAsyncThunk<
  PaginatedResponse<Chat>,
  { reset?: boolean },
  { state: { chats: ChatsState } }
>('chats/fetchChats', async ({ reset = false }, { getState }) => {
  const offset = reset ? 0 : getState().chats.items.length;
  return window.electronAPI.getChats({ limit: PAGE_SIZE, offset });
});

export const seedDatabase = createAsyncThunk('chats/seedDatabase', async () => {
  await window.electronAPI.seedDatabase();
});

export const markChatAsRead = createAsyncThunk<string, string>('chats/markAsRead', async (chatId) => {
  await window.electronAPI.markChatAsRead(chatId);
  return chatId;
});

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    selectChat: (state, action: PayloadAction<string | null>) => {
      state.selectedChatId = action.payload;
    },
    updateChatFromMessage: (state, action: PayloadAction<{ chatId: string; ts: number }>) => {
      const { chatId, ts } = action.payload;
      const idx = state.items.findIndex((c) => c.id === chatId);
      if (idx === -1) return;

      const chat = state.items[idx];
      chat.lastMessageAt = Math.max(chat.lastMessageAt, ts);
      if (state.selectedChatId !== chatId) chat.unreadCount += 1;

      // reorder
      state.items.splice(idx, 1);
      const newIdx = state.items.findIndex((c) => c.lastMessageAt < chat.lastMessageAt);
      if (newIdx === -1) {
        state.items.push(chat);
      } else {
        state.items.splice(newIdx, 0, chat);
      }
    },
    resetChats: (state) => {
      state.items = [];
      state.hasMore = true;
      state.error = null;
      state.selectedChatId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.loading = false;
        if (action.meta.arg.reset || state.items.length === 0) {
          state.items = action.payload.data;
        } else {
          const existing = new Set(state.items.map((c) => c.id));
          const newItems = action.payload.data.filter((c) => !existing.has(c.id));
          state.items.push(...newItems);
        }
        state.hasMore = action.payload.hasMore;
      })
      .addCase(fetchChats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch chats';
      })
      .addCase(markChatAsRead.fulfilled, (state, action) => {
        const chat = state.items.find((c) => c.id === action.payload);
        if (chat) chat.unreadCount = 0;
      })
      .addCase(seedDatabase.pending, (state) => { state.loading = true; })
      .addCase(seedDatabase.fulfilled, (state) => { state.loading = false; })
      .addCase(seedDatabase.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to seed database';
      });
  },
});

export const { selectChat, updateChatFromMessage, resetChats } = chatsSlice.actions;
export default chatsSlice.reducer;
