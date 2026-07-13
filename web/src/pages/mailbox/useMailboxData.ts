import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { MessageRecipientItem, MessageFolder } from '../../lib/types';

export interface MailGroup {
  key: string;
  name: string;
  color: string | null;
  items: MessageRecipientItem[];
  unreadCount: number;
  latestSentAt: string;
}

const FOLDER_TITLE_KEYS: Record<string, string> = {
  inbox: 'mailbox.title_inbox',
  sent: 'mailbox.title_sent',
  trash: 'mailbox.title_trash',
  archive: 'mailbox.title_archive',
  starred: 'mailbox.title_starred',
};

const SEARCH_DEBOUNCE_MS = 250;

export function useMailboxData(folder: MessageFolder, starredOnly?: boolean) {
  const { t } = useTranslation();
  // Qidiruv URL `?q=` parametridan o'qiladi — shu bilan header (LayoutGmail/Outlook)
  // global qidirish maydoni va mailbox ichidagi inline maydoni sinxron ishlaydi.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());
  const queryClient = useQueryClient();

  const setSearch = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set('q', value);
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Foydalanuvchi yozayotganda har bir harfga so'rov yubormaymiz —
  // 250 ms tinch turgandan keyin queryni yangilaymiz.
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === debouncedSearch) return;
    const handle = window.setTimeout(() => {
      setDebouncedSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [search, debouncedSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ['messages', folder, debouncedSearch],
    queryFn: async () => {
      const params: Record<string, string> = { folder };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get<MessageRecipientItem[]>('/messages', { params });
      return res.data;
    },
  });

  const filtered = starredOnly ? (data ?? []).filter((it) => it.isStarred) : data ?? [];

  // Unique sender/recipient bo'yicha grupalash (har bir foydalanuvchi 1 marta)
  const groupedItems = useMemo<MailGroup[] | null>(() => {
    const isSearching = debouncedSearch.length > 0;
    // Qidiruv → oddiy ro'yxat
    if (isSearching) return null;

    const map = new Map<string, MailGroup>();

    for (const item of filtered) {
      // Kiruvchi → yuboruvchi, chiquvchi → birinchi qabul qiluvchi
      let contactKey: string | null = null;
      let contactName: string | null = null;

      if (folder === 'sent') {
        // Chiquvchi: birinchi recipient bo'yicha (ichki yoki tashqi)
        const recipient = (item.message.recipients?.[0] as any);
        if (recipient?.userId) {
          contactKey = recipient.userId;
          contactName = recipient.fullName ?? recipient.email ?? 'Unknown';
        } else if (item.message.externalToEmails?.length) {
          // Agar faqat tashqi qabul qiluvchi bo'lsa
          contactKey = item.message.externalToEmails[0];
          contactName = item.message.externalToEmails[0];
        }
      } else {
        // Kiruvchi: sender bo'yicha (ichki yoki tashqi)
        if (item.message.fromUserId) {
          // Ichki user
          contactKey = item.message.fromUserId;
          contactName = item.message.fromUser?.fullName ?? 'Unknown';
        } else if (item.message.externalFromEmail) {
          // Tashqi pochta (external)
          contactKey = item.message.externalFromEmail;
          contactName = item.message.externalFromName ?? item.message.externalFromEmail ?? 'Unknown';
        }
      }

      // Agar kontakt topilmasa - skip
      if (!contactKey || !contactName) continue;

      // Har bir foydalanuvchi FAQAT 1 marta ro'yxatda tursin
      if (!map.has(contactKey)) {
        map.set(contactKey, {
          key: contactKey,
          name: contactName,
          color: null,
          items: [],
          unreadCount: 0,
          latestSentAt: item.message.sentAt,
        });
      }
      const group = map.get(contactKey)!;
      group.items.push(item);
      if (!item.isRead) group.unreadCount += 1;
      if (item.message.sentAt > group.latestSentAt) {
        group.latestSentAt = item.message.sentAt;
      }
    }

    const result: MailGroup[] = Array.from(map.values());
    // O'qilmagan (yangi) xabari bor foydalanuvchilar eng tepada; ular orasida va
    // qolganlar orasida — eng so'nggi xabar vaqti bo'yicha kamayish tartibida.
    result.sort((a, b) => {
      const aHasUnread = a.unreadCount > 0 ? 1 : 0;
      const bHasUnread = b.unreadCount > 0 ? 1 : 0;
      if (aHasUnread !== bHasUnread) return bHasUnread - aHasUnread;
      return b.latestSentAt.localeCompare(a.latestSentAt);
    });
    return result.length > 0 ? result : null;
  }, [filtered, folder, debouncedSearch]);

  const toggleStar = async (e: React.MouseEvent, item: MessageRecipientItem) => {
    e.preventDefault();
    e.stopPropagation();
    await api.patch(`/messages/${item.messageId}/star`);
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  };

  const titleKey = starredOnly ? FOLDER_TITLE_KEYS.starred : FOLDER_TITLE_KEYS[folder];

  return {
    search,
    setSearch,
    isSearching: debouncedSearch.length > 0,
    isLoading,
    filtered,
    groupedItems,
    toggleStar,
    title: t(titleKey),
  };
}
