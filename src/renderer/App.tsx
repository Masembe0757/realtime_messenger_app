import React, { useEffect, useState, useCallback } from 'react';
import { Provider } from 'react-redux';
import { Box, CssBaseline, ThemeProvider, createTheme, Button, Typography, Alert, CircularProgress } from '@mui/material';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './hooks/useAppDispatch';
import { fetchChats, seedDatabase, updateChatFromMessage } from './store/chatsSlice';
import { addMessage } from './store/messagesSlice';
import { setConnectionState, connectWebSocket } from './store/connectionSlice';
import ChatList from './components/ChatList';
import MessageView from './components/MessageView';
import ConnectionStatus from './components/ConnectionStatus';
import { ConnectionState, Message } from '../shared/types';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
    background: { default: '#f5f5f5' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { margin: 0, padding: 0, overflow: 'hidden' } },
    },
  },
});

const SIDEBAR_WIDTH = 350;

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const [initialized, setInitialized] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  const { items: chats, loading: chatsLoading } = useAppSelector((s) => s.chats);

  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubConn = window.electronAPI.onConnectionStateChange((state: ConnectionState) => {
      dispatch(setConnectionState(state));
    });

    const unsubMsg = window.electronAPI.onNewMessage((msg: Message & { chatId: string }) => {
      dispatch(addMessage(msg));
      dispatch(updateChatFromMessage({ chatId: msg.chatId, ts: msg.ts }));
    });

    return () => { unsubConn(); unsubMsg(); };
  }, [dispatch]);

  const initialize = useCallback(async () => {
    try {
      setSeeding(true);
      setError(null);
      await dispatch(seedDatabase()).unwrap();
      await dispatch(fetchChats({ reset: true })).unwrap();
      await dispatch(connectWebSocket()).unwrap();
      setInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    } finally {
      setSeeding(false);
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchChats({ reset: true }))
      .unwrap()
      .then((result) => {
        if (result.data.length > 0) {
          setInitialized(true);
          dispatch(connectWebSocket());
        }
      })
      .catch(() => {});
  }, [dispatch]);

  const contentHeight = windowHeight - 52;

  if (!initialized && chats.length === 0 && !chatsLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 3, bgcolor: 'background.default' }}>
        <Typography variant="h4" gutterBottom>Secure Messenger</Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" maxWidth={400}>
          Welcome! This app needs to generate seed data (200 chats and 20,000+ messages) to demonstrate efficient data handling.
        </Typography>
        {error && <Alert severity="error" sx={{ maxWidth: 400 }}>{error}</Alert>}
        <Button
          variant="contained"
          size="large"
          onClick={initialize}
          disabled={seeding}
          startIcon={seeding ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {seeding ? 'Initializing...' : 'Initialize Database'}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <ConnectionStatus />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ width: SIDEBAR_WIDTH, borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6">Chats</Typography>
            <Typography variant="caption" color="text.secondary">{chats.length} conversations</Typography>
          </Box>
          <ChatList height={contentHeight - 68} />
        </Box>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <MessageView height={contentHeight} />
        </Box>
      </Box>
    </Box>
  );
};

const App: React.FC = () => (
  <Provider store={store}>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContent />
    </ThemeProvider>
  </Provider>
);

export default App;
