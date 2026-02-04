import React, { useCallback, useEffect, memo, useMemo } from 'react';
import { List, RowComponentProps, useListRef } from 'react-window';
import { Box, Typography, Badge, Avatar, Divider, CircularProgress } from '@mui/material';
import { Chat } from '../../shared/types';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { fetchChats, selectChat, markChatAsRead } from '../store/chatsSlice';
import { fetchMessages, clearChatMessages } from '../store/messagesSlice';

const ITEM_HEIGHT = 72;

interface ChatItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
}

const ChatItem = memo<ChatItemProps>(({ chat, isSelected, onClick }) => {
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const today = new Date().toDateString() === d.toDateString();
    return today
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: '12px 16px',
        cursor: 'pointer',
        bgcolor: isSelected ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: isSelected ? 'action.selected' : 'action.hover' },
        borderLeft: isSelected ? '3px solid' : '3px solid transparent',
        borderLeftColor: isSelected ? 'primary.main' : 'transparent',
      }}
    >
      <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
        {chat.title.charAt(0).toUpperCase()}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" noWrap sx={{ fontWeight: chat.unreadCount > 0 ? 600 : 400 }}>
            {chat.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {formatTime(chat.lastMessageAt)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            Click to view messages
          </Typography>
          {chat.unreadCount > 0 && (
            <Badge badgeContent={chat.unreadCount} color="primary" sx={{ ml: 1 }} />
          )}
        </Box>
      </Box>
    </Box>
  );
});
ChatItem.displayName = 'ChatItem';

interface ChatRowProps {
  chats: Chat[];
  selectedChatId: string | null;
  onChatClick: (id: string) => void;
}

const ChatRow = ({ index, style, chats, selectedChatId, onChatClick }: RowComponentProps<ChatRowProps>) => {
  const chat = chats[index];
  return (
    <div style={style}>
      <ChatItem
        chat={chat}
        isSelected={selectedChatId === chat.id}
        onClick={() => onChatClick(chat.id)}
      />
      <Divider />
    </div>
  );
};

interface ChatListProps {
  height: number;
}

export const ChatList: React.FC<ChatListProps> = ({ height }) => {
  const dispatch = useAppDispatch();
  const listRef = useListRef();
  const { items: chats, loading, hasMore, selectedChatId } = useAppSelector((s) => s.chats);

  useEffect(() => {
    if (chats.length === 0) dispatch(fetchChats({ reset: true }));
  }, [dispatch, chats.length]);

  const handleChatClick = useCallback((chatId: string) => {
    if (selectedChatId === chatId) return;
    dispatch(selectChat(chatId));
    if (selectedChatId) dispatch(clearChatMessages(selectedChatId));
    dispatch(fetchMessages({ chatId }));
    dispatch(markChatAsRead(chatId));
  }, [dispatch, selectedChatId]);

  const handleRowsRendered = useCallback(({ stopIndex }: { startIndex: number; stopIndex: number }) => {
    if (!loading && hasMore && stopIndex >= chats.length - 10) {
      dispatch(fetchChats({ reset: false }));
    }
  }, [dispatch, loading, hasMore, chats.length]);

  const rowProps = useMemo(() => ({
    chats,
    selectedChatId,
    onChatClick: handleChatClick,
  }), [chats, selectedChatId, handleChatClick]);

  if (loading && chats.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height, overflow: 'hidden' }}>
      <List
        listRef={listRef}
        style={{ height, width: '100%' }}
        rowCount={chats.length}
        rowHeight={ITEM_HEIGHT}
        rowComponent={ChatRow}
        rowProps={rowProps}
        onRowsRendered={handleRowsRendered}
      />
      {loading && chats.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};

export default ChatList;
