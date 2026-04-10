'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket';

export function useSocket(events?: Record<string, (...args: unknown[]) => void>): {
  socket: Socket | null;
  emit: (event: string, data?: unknown) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  disconnect: () => void;
} {
  const socketRef = useRef<Socket | null>(null);
  const joinedRooms = useRef<Set<string>>(new Set());

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    connectSocket();

    if (events) {
      Object.entries(events).forEach(([event, handler]) => {
        socket.on(event, handler);
      });
    }

    // Re-join rooms on reconnect
    const handleReconnect = () => {
      joinedRooms.current.forEach((room) => {
        socket.emit('channel:join', { channelId: room });
      });
    };
    socket.on('connect', handleReconnect);

    return () => {
      if (events) {
        Object.entries(events).forEach(([event, handler]) => {
          socket.off(event, handler);
        });
      }
      socket.off('connect', handleReconnect);
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const joinRoom = useCallback((room: string) => {
    joinedRooms.current.add(room);
    socketRef.current?.emit('channel:join', { channelId: room });
  }, []);

  const leaveRoom = useCallback((room: string) => {
    joinedRooms.current.delete(room);
    socketRef.current?.emit('channel:leave', { channelId: room });
  }, []);

  return { socket: socketRef.current, emit, joinRoom, leaveRoom, disconnect: disconnectSocket };
}
