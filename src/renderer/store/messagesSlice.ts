import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Message, PaginatedResponse } from '../../shared/types';

interface MessagesState {
  byChat: Record<string, Message[]>;
  loading: boolean;
  hasMore: Record<string, boolean>;
  error: string | null;
  searchResults: Message[];
  searchQuery: string;
  searchLoading: boolean;
}

const initialState: MessagesState = {
  byChat: {},
  loading: false,
  hasMore: {},
  error: null,
  searchResults: [],
  searchQuery: '',
  searchLoading: false,
};

const PAGE_SIZE = 50;

export const fetchMessages = createAsyncThunk<
  PaginatedResponse<Message> & { chatId: string; prepend: boolean },
  { chatId: string; loadOlder?: boolean },
  { state: { messages: MessagesState } }
>('messages/fetchMessages', async ({ chatId, loadOlder = false }, { getState }) => {
  const existing = getState().messages.byChat[chatId] || [];
  const beforeTs = loadOlder && existing.length > 0 ? existing[0].ts : undefined;

  const response = await window.electronAPI.getMessages({ chatId, limit: PAGE_SIZE, beforeTs });
  return { ...response, chatId, prepend: loadOlder };
});

export const searchMessages = createAsyncThunk<
  PaginatedResponse<Message>,
  { chatId: string; query: string }
>('messages/searchMessages', async ({ chatId, query }) => {
  return window.electronAPI.searchMessages({ chatId, query, limit: PAGE_SIZE });
});

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      const msg = action.payload;
      if (!state.byChat[msg.chatId]) state.byChat[msg.chatId] = [];

      const exists = state.byChat[msg.chatId].some((m) => m.id === msg.id);
      if (exists) return;

      const msgs = state.byChat[msg.chatId];
      const insertIdx = msgs.findIndex((m) => m.ts > msg.ts);
      if (insertIdx === -1) {
        msgs.push(msg);
      } else {
        msgs.splice(insertIdx, 0, msg);
      }
    },
    clearChatMessages: (state, action: PayloadAction<string>) => {
      delete state.byChat[action.payload];
      delete state.hasMore[action.payload];
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.searchQuery = '';
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loading = false;
        const { chatId, data, hasMore, prepend } = action.payload;

        if (!state.byChat[chatId]) state.byChat[chatId] = [];

        if (prepend) {
          const existing = new Set(state.byChat[chatId].map((m) => m.id));
          const newMsgs = data.filter((m) => !existing.has(m.id));
          state.byChat[chatId] = [...newMsgs, ...state.byChat[chatId]];
        } else {
          state.byChat[chatId] = data;
        }
        state.hasMore[chatId] = hasMore;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch messages';
      })
      .addCase(searchMessages.pending, (state) => { state.searchLoading = true; })
      .addCase(searchMessages.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload.data;
      })
      .addCase(searchMessages.rejected, (state, action) => {
        state.searchLoading = false;
        state.error = action.error.message || 'Search failed';
      });
  },
});

export const { addMessage, clearChatMessages, clearSearchResults, setSearchQuery } = messagesSlice.actions;
export default messagesSlice.reducer;
