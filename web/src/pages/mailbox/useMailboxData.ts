import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { MessageRecipientItem, MessageFolder } from '../../lib/types';

export const FOLDER_TITLES: Record<string, string> = {
  inbox: 'Kiruvchi xabarlar',
  sent: 'Yuborilgan xabarlar',
  trash: 'Savatcha',
  archive: 'Arxiv',
  starred: 'Yulduzli xabarlar',
};

export function useMailboxData(folder: MessageFolder, starredOnly?: boolean) {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['messages', folder, search],
    queryFn: async () => {
      const params: Record<string, string> = { folder };
      if (search.trim()) params.search = search.trim();
      const res = await api.get<MessageRecipientItem[]>('/messages', { params });
      return res.data;
    },
  });

  const filtered = starredOnly ? (data ?? []).filter((it) => it.isStarred) : data ?? [];

  const toggleStar = async (e: React.MouseEvent, item: MessageRecipientItem) => {
    e.preventDefault();
    e.stopPropagation();
    await api.patch(`/messages/${item.messageId}/star`);
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  };

  return {
    search,
    setSearch,
    isLoading,
    filtered,
    toggleStar,
    title: starredOnly ? FOLDER_TITLES.starred : FOLDER_TITLES[folder],
  };
}
