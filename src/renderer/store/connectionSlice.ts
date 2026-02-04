import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ConnectionState } from '../../shared/types';

interface ConnectionSliceState {
  status: ConnectionState;
  lastHeartbeat: number | null;
}

const initialState: ConnectionSliceState = {
  status: 'offline',
  lastHeartbeat: null,
};

export const connectWebSocket = createAsyncThunk('connection/connect', async () => {
  await window.electronAPI.connectWebSocket();
});

export const disconnectWebSocket = createAsyncThunk('connection/disconnect', async () => {
  await window.electronAPI.disconnectWebSocket();
});

export const simulateConnectionDrop = createAsyncThunk('connection/simulateDrop', async () => {
  await window.electronAPI.simulateConnectionDrop();
});

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnectionState: (state, action: PayloadAction<ConnectionState>) => {
      state.status = action.payload;
    },
    updateHeartbeat: (state) => {
      state.lastHeartbeat = Date.now();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(connectWebSocket.pending, (state) => { state.status = 'reconnecting'; })
      .addCase(disconnectWebSocket.fulfilled, (state) => { state.status = 'offline'; });
  },
});

export const { setConnectionState, updateHeartbeat } = connectionSlice.actions;
export default connectionSlice.reducer;
