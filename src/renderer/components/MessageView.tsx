import React, { useCallback, useEffect, useState, memo, useMemo } from 'react';
import { List, RowComponentProps, useListRef, ListImperativeAPI } from 'react-window';
import { Box, Typography, Paper, Button, TextField, InputAdornment, IconButton, CircularProgress, Chip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { Message } from '../../shared/types';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchMessages, searchMessages, clearSearchResults, setSearchQuery } from '../store/messagesSlice';
import { decryptMessage } from '../services/decryptMessage';

const MESSAGE_HEIGHT = 80;

interface MessageItemProps {
  message: Message;
  isHighlighted?: boolean;
}

const MessageItem = memo<MessageItemProps>(({ message, isHighlighted }) => {
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const body = decryptMessage(message.body);

  return (
    <Paper
      elevation={0}
      sx={{
        p: '8px 16px',
        m: '4px 16px',
        bgcolor: isHighlighted ? 'warning.light' : 'grey.100',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="subtitle2" color="primary">{message.sender}</Typography>
        <Typography variant="caption" color="text.secondary">{formatTime(message.ts)}</Typography>
      </Box>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{body}</Typography>
    </Paper>
  );
});
MessageItem.displayName = 'MessageItem';

interface MessageRowProps {
  messages: Message[];
  searchQuery: string;
  searchResultIds: Set<string>;
}

const MessageRow = ({ index, style, messages, searchQuery, searchResultIds }: RowComponentProps<MessageRowProps>) => {
  const msg = messages[index];
  const highlighted = searchQuery && searchResultIds.has(msg.id);
  return (
    <div style={style}>
      <MessageItem message={msg} isHighlighted={highlighted} />
    </div>
  );
};

interface MessageViewProps {
  height: number;
}

export const MessageView: React.FC<MessageViewProps> = ({ height }) => {
  const dispatch = useAppDispatch();
  const listRef = useListRef();
  const [searchInput, setSearchInput] = useState('');

  const selectedChatId = useAppSelector((s) => s.chats.selectedChatId);
  const selectedChat = useAppSelector((s) => s.chats.items.find((c) => c.id === selectedChatId));
  const messages = useAppSelector((s) => selectedChatId ? s.messages.byChat[selectedChatId] || [] : []);
  const { loading, hasMore, searchResults, searchQuery, searchLoading } = useAppSelector((s) => s.messages);

  const displayMessages = searchQuery ? searchResults : messages;
  const searchResultIds = useMemo(() => new Set(searchResults.map((m) => m.id)), [searchResults]);

  useEffect(() => {
    if (!searchQuery && listRef.current && messages.length > 0) {
      setTimeout(() => {
        (listRef.current as ListImperativeAPI)?.scrollToRow({ index: messages.length - 1, align: 'end' });
      }, 0);
    }
  }, [messages.length, searchQuery, listRef]);

  const handleLoadOlder = useCallback(() => {
    if (selectedChatId && !loading && hasMore[selectedChatId]) {
      dispatch(fetchMessages({ chatId: selectedChatId, loadOlder: true }));
    }
  }, [dispatch, selectedChatId, loading, hasMore]);

  const handleSearch = useCallback(() => {
    if (selectedChatId && searchInput.trim()) {
      dispatch(setSearchQuery(searchInput.trim()));
      dispatch(searchMessages({ chatId: selectedChatId, query: searchInput.trim() }));
    }
  }, [dispatch, selectedChatId, searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    dispatch(clearSearchResults());
  }, [dispatch]);

  const rowProps = useMemo(() => ({
    messages: displayMessages,
    searchQuery,
    searchResultIds,
  }), [displayMessages, searchQuery, searchResultIds]);

  if (!selectedChatId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height, bgcolor: 'grey.50' }}>
        <Typography variant="h6" color="text.secondary">Select a chat to view messages</Typography>
      </Box>
    );
  }

  const chatHasMore = selectedChatId && hasMore[selectedChatId];
  const contentHeight = height - 180;

  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="h6">{selectedChat?.title || 'Chat'}</Typography>
      </Box>

      <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search messages..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
            endAdornment: searchInput && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch}><ClearIcon /></IconButton>
              </InputAdornment>
            ),
          }}
        />
        {searchQuery && (
          <Box sx={{ mt: 1 }}>
            <Chip
              label={`Search: "${searchQuery}" (${searchResults.length} results)`}
              onDelete={handleClearSearch}
              size="small"
              color="primary"
            />
          </Box>
        )}
      </Box>

      {!searchQuery && chatHasMore && (
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Button variant="text" onClick={handleLoadOlder} disabled={loading} size="small">
            {loading ? <CircularProgress size={20} /> : 'Load older messages'}
          </Button>
        </Box>
      )}

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {(loading || searchLoading) && displayMessages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : displayMessages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography color="text.secondary">{searchQuery ? 'No messages found' : 'No messages yet'}</Typography>
          </Box>
        ) : (
          <List
            listRef={listRef}
            style={{ height: contentHeight, width: '100%' }}
            rowCount={displayMessages.length}
            rowHeight={MESSAGE_HEIGHT}
            rowComponent={MessageRow}
            rowProps={rowProps}
          />
        )}
      </Box>
    </Box>
  );
};

export default MessageView;
