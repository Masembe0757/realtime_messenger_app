import { configureStore } from '@reduxjs/toolkit';
import chatsReducer from './chatsSlice';
import messagesReducer from './messagesSlice';
import connectionReducer from './connectionSlice';

export const store = configureStore({
  reducer: {
    chats: chatsReducer,
    messages: messagesReducer,
    connection: connectionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
