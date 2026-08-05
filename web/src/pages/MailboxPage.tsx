import type { MessageFolder } from '../lib/types';
import { useDesign } from '../lib/design';
import { MailboxClassic } from './mailbox/MailboxClassic';
import { MailboxGmail } from './mailbox/MailboxGmail';
import { MailboxYandex } from './mailbox/MailboxYandex';

interface Props {
  folder: MessageFolder;
  starredOnly?: boolean;
  external?: boolean;
}

export function MailboxPage(props: Props) {
  const design = useDesign();
  if (design === 'outlook') return null; // LayoutOutlook handles list rendering
  if (design === 'gmail') return <MailboxGmail {...props} />;
  if (design === 'yandex') return <MailboxYandex {...props} />;
  return <MailboxClassic {...props} />;
}
