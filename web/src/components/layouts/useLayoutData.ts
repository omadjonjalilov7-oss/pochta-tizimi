import { useEffect, useRef, useState } from 'react';
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

  // O'qilmagan xabarlar sonini interval ichida o'qiy olishimiz uchun ref'da
  // saqlab boramiz (interval har safar yangi qiymatni oladi).
  const unreadRef = useRef(0);
  useEffect(() => {
    unreadRef.current = unread ?? 0;
  }, [unread]);

  // Har 30 daqiqada bir marta, faqat soat 9:00–18:00 orasida va o'qilmagan
  // xabar bo'lsa — brauzer ogohlantirishi chiqaramiz. O'qilmagan xabar
  // bo'lmasa umuman chiqmaydi.
  useEffect(() => {
    const REMINDER_MS = 30 * 60 * 1000;
    const remind = () => {
      const hour = new Date().getHours();
      if (
        unreadRef.current > 0 &&
        hour >= 9 &&
        hour < 18 &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification('Pochta', {
          body: `${unreadRef.current} ta o'qilmagan xabar bor`,
        });
      }
    };
    const id = window.setInterval(remind, REMINDER_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const handler = (msg: any) => {
      // Tashqi pochta sinxronizatsiyasi (IMAP polling) — bu har necha sekundda
      // keladi. Bunda banner yoki brauzer ogohlantirishi chiqarmaymiz, faqat
      // ro'yxatlarni yangilaymiz. Ogohlantirishni pastdagi 30-daqiqali
      // interval hal qiladi (agar o'qilmagan xabar bo'lsa).
      if (msg?.payload?.type === 'external_mail_synced') {
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        return;
      }
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
