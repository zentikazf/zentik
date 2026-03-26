'use client';

import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    socketRef.current = getSocket();
    connectSocket();

    if (events) {
      Object.entries(events).forEach(([event, handler]) => {
        socketRef.current?.on(event, handler);
      });
    }

    return () => {
      if (events) {
        Object.entries(events).forEach(([event, handler]) => {
          socketRef.current?.off(event, handler);
        });
      }
    };
  }, []);

  const emit = (event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  };

  const joinRoom = (room: string) => {
    socketRef.current?.emit('channel:join', { channelId: room });
  };

  const leaveRoom = (room: string) => {
    socketRef.current?.emit('channel:leave', { channelId: room });
  };

  return { socket: socketRef.current, emit, joinRoom, leaveRoom, disconnect: disconnectSocket };
}
