import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useJourneyStore from '../store/journeyStore';

/**
 * Hook to subscribe to real-time journey events via WebSocket.
 * Listens for engagement events and launch progress updates.
 */
export function useRealtimeStats(journeyId) {
  const socketRef = useRef(null);
  const updateNodeStats = useJourneyStore((s) => s.updateNodeStats);
  const setLaunchProgress = useJourneyStore((s) => s.setLaunchProgress);

  useEffect(() => {
    if (!journeyId) return;

    const socketUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3001'
      : window.location.origin;

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
      socket.emit('join:journey', journeyId);
    });

    // Real-time engagement events
    socket.on('engagement_event', (event) => {
      if (event.nodeId && event.eventType) {
        updateNodeStats(event.nodeId, event.eventType);
      }
    });

    // Launch progress updates
    socket.on('journey:status', (data) => {
      setLaunchProgress(data);
    });

    socket.on('launch_progress', (data) => {
      setLaunchProgress(data);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    return () => {
      socket.emit('leave:journey', journeyId);
      socket.disconnect();
    };
  }, [journeyId, updateNodeStats, setLaunchProgress]);

  return socketRef;
}
