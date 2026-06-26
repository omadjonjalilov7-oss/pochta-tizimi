import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import type { MessageRecipientItem } from '../../lib/types';
import { getSocket, disconnectSocket } from '../../lib/socket';

export function useLayoutData() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<string | null>(null);

  const { data: unread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () =>
      (await api.get<{ count: number }>('/messages/unread-count')).data.count,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const handler = (msg: any) => {
      const from = msg?.payload?.message?.fromUser?.fullName || 'Yangi xabar';
      const subject = msg?.payload?.message?.subject || '';
      setNotification(`${from}: ${subject}`);
      setTimeout(() => setNotification(null), 5000);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Pochta — yangi xabar', { body: `${from}\n${subject}` });
      }
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    };
    socket.on('new_message', handler);

    const recallHandler = (msg: any) => {
      const subject = msg?.payload?.subject || 'Xabar';
      const recalledId = msg?.payload?.messageId;
      setNotification(`Xabar qaytarib olindi: ${subject}`);
      setTimeout(() => setNotification(null), 5000);
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      // If the recalled message is currently open, push the user back to inbox
      if (recalledId && window.location.pathname.endsWith(`/messages/${recalledId}`)) {
        navigate('/inbox');
      }
    };
    socket.on('message_recalled', recallHandler);

    return () => {
      socket.off('new_message', handler);
      socket.off('message_recalled', recallHandler);
    };
  }, [user, queryClient, navigate]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleLogout = () => {
    disconnectSocket();
    logout();
    navigate('/login');
  };

  const handleInboxClick = async (e: React.MouseEvent) => {
    if (unread !== 1) return;
    e.preventDefault();
    try {
      const { data } = await api.get<MessageRecipientItem[]>('/messages', {
        params: { folder: 'inbox' },
      });
      const single = data.find((it) => !it.isRead);
      if (single) {
        navigate(`/messages/${single.messageId}`);
      } else {
        navigate('/inbox');
      }
    } catch {
      navigate('/inbox');
    }
  };

  return {
    user: user!,
    unread,
    notification,
    handleLogout,
    handleInboxClick,
  };
}
