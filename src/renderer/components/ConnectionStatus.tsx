import React from 'react';
import { Box, Chip, Button, Tooltip } from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SyncIcon from '@mui/icons-material/Sync';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { simulateConnectionDrop, connectWebSocket } from '../store/connectionSlice';

export const ConnectionStatus: React.FC = () => {
  const dispatch = useAppDispatch();
  const { status } = useAppSelector((s) => s.connection);

  const getColor = () => {
    if (status === 'connected') return 'success';
    if (status === 'reconnecting') return 'warning';
    return 'error';
  };

  const getIcon = () => {
    if (status === 'connected') return <WifiIcon fontSize="small" />;
    if (status === 'reconnecting') return <SyncIcon fontSize="small" sx={{ animation: 'spin 1s linear infinite' }} />;
    return <WifiOffIcon fontSize="small" />;
  };

  const getLabel = () => {
    if (status === 'connected') return 'Connected';
    if (status === 'reconnecting') return 'Reconnecting...';
    return 'Offline';
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: '8px 16px', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Chip icon={getIcon()} label={getLabel()} color={getColor()} size="small" variant="outlined" />

      {status === 'connected' && (
        <Tooltip title="Test reconnection behavior">
          <Button size="small" variant="outlined" color="warning" onClick={() => dispatch(simulateConnectionDrop())}>
            Simulate Connection Drop
          </Button>
        </Tooltip>
      )}

      {status === 'offline' && (
        <Button size="small" variant="contained" color="primary" onClick={() => dispatch(connectWebSocket())}>
          Reconnect
        </Button>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Box>
  );
};

export default ConnectionStatus;
