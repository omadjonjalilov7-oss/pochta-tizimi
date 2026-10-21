import { Video } from 'lucide-react';
import { ZOOM_URL } from '../lib/zoom';

// Header o'rtasidagi "ZOOM MEETING" tugmasi.
// Bosilganda video konferensiya loyihasini yangi oynada ochadi (ZOOM_URL).
// Rang (indigo) ham to'q (Classic/Outlook/Edo), ham oq (Yandex/Gmail) header'da ko'rinadi.
export default function ZoomMeetingButton({ className = '' }: { className?: string }) {
  return (
    <a
      href={ZOOM_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="ZOOM MEETING — video konferensiya"
      className={
        'inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 ' +
        'text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 ' +
        'focus:outline-none focus:ring-2 focus:ring-indigo-400 whitespace-nowrap ' +
        className
      }
    >
      <Video size={16} />
      <span>ZOOM MEETING</span>
    </a>
  );
}
