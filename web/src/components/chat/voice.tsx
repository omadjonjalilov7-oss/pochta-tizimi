import { useEffect, useRef, useState } from 'react';
import { Mic, Trash2, Send, Play, Pause, Loader2, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

// ─── Ovozli xabar: yozib olish va o'ynatish (Telegramdek) ──────────────────────
//
// Yozib olish: brauzerning MediaRecorder API'si mikrofondan audio oladi va
// uni oddiy fayl (audio/webm yoki audio/mp4) sifatida mavjud chat yuborish
// endpointiga jo'natadi. Server tomonida o'zgarish shart emas — audio ham
// biriktirilgan fayl (attachment) bo'lib boradi.
//
// Eslatma (platformalararo): Android/Chrome webm/opus yozadi; iPhone (Safari)
// webm'ni O'YNATA olmaydi. Shu sabab yozishda imkon bo'lsa mp4 (Safari),
// aks holda webm tanlanadi; o'ynatishda xato bo'lsa — "yuklab olish" tugmasi
// ko'rsatiladi. To'liq iPhone mosligi uchun keyinchalik serverda ffmpeg orqali
// mp4'ga o'girish qo'shiladi.

const MAX_SECONDS = 300; // 5 daqiqa — juda katta fayl bo'lmasligi uchun

function pickMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  const MR = (window as unknown as { MediaRecorder?: typeof MediaRecorder })
    .MediaRecorder;
  if (MR && typeof MR.isTypeSupported === 'function') {
    for (const c of candidates) {
      if (MR.isTypeSupported(c)) return c;
    }
  }
  return '';
}

function extFor(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

function mmss(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Brauzer ovoz yozishni umuman qo'llab-quvvatlaydimi?
export function voiceRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder !==
      'undefined'
  );
}

// ─── Yozib olish tugmasi + yozilish paneli ─────────────────────────────────────
export function VoiceRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (file: File) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Komponent yo'qolsa — mikrofonni albatta bo'shatamiz.
  useEffect(() => () => stopStream(), []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;
      const mime = pickMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stopStream();
        const type = mr.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        setRecording(false);
        setSeconds(0);
        if (!cancelledRef.current && blob.size > 0) {
          const file = new File([blob], `voice-${Date.now()}.${extFor(type)}`, {
            type,
          });
          onRecorded(file);
        }
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) {
            // Avtomatik to'xtatib yuboramiz (juda uzun bo'lmasin)
            cancelledRef.current = false;
            mediaRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      setError(t('edo.chat.voice_no_mic'));
    }
  };

  const stopAndSend = () => {
    cancelledRef.current = false;
    mediaRef.current?.stop();
  };
  const cancel = () => {
    cancelledRef.current = true;
    mediaRef.current?.stop();
  };

  if (recording) {
    // Yozilish paneli — composer qatorini ustidan yopadi (absolute inset-0).
    return (
      <div className="absolute inset-0 z-10 flex items-center gap-3 px-3 bg-white">
        <button
          type="button"
          onClick={cancel}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
          title={t('edo.chat.voice_cancel')}
        >
          <Trash2 size={18} />
        </button>
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-sm font-medium text-slate-700 tabular-nums w-12">
          {mmss(seconds)}
        </span>
        <span className="flex-1 text-sm text-slate-400 truncate">
          {t('edo.chat.voice_recording')}
        </span>
        <button
          type="button"
          onClick={stopAndSend}
          className="p-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
          title={t('edo.chat.voice_send')}
        >
          <Send size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-brand-50 disabled:opacity-40"
      title={error ?? t('edo.chat.voice_record')}
    >
      <Mic size={18} />
    </button>
  );
}

// ─── Ovozli xabarni o'ynatuvchi (inline pleer) ─────────────────────────────────
export function VoiceMessagePlayer({
  apiPath,
  filename,
  mimeType,
  mine,
}: {
  apiPath: string;
  filename: string;
  mimeType: string;
  mine: boolean;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const ensureUrl = async (): Promise<string | null> => {
    if (urlRef.current) return urlRef.current;
    setLoading(true);
    try {
      const res = await api.get(apiPath, { responseType: 'blob' });
      // Content-Type to'g'ri bo'lishi uchun mimeType bilan qayta o'raymiz.
      const blob = new Blob([res.data as Blob], { type: mimeType || 'audio/webm' });
      const u = URL.createObjectURL(blob);
      urlRef.current = u;
      setUrl(u);
      return u;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    const a = audioRef.current;
    if (playing && a) {
      a.pause();
      return;
    }
    const u = await ensureUrl();
    if (!u) return;
    // src yangi o'rnatilgan bo'lsa — DOM yangilanishini kutib keyin play qilamiz.
    setTimeout(() => {
      audioRef.current?.play().catch(() => setFailed(true));
    }, 0);
  };

  // MediaRecorder webm'da duration ba'zan Infinity bo'ladi — majburan hisoblatamiz.
  const onLoadedMetadata = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.duration === Infinity || Number.isNaN(a.duration)) {
      const fix = () => {
        a.currentTime = 0;
        setDur(Number.isFinite(a.duration) ? a.duration : 0);
        a.removeEventListener('timeupdate', fix);
      };
      a.addEventListener('timeupdate', fix);
      a.currentTime = 1e7;
    } else {
      setDur(a.duration);
    }
  };

  if (failed) {
    // O'ynab bo'lmasa (masalan iPhone + webm) — yuklab olish imkoni qoladi.
    return (
      <button
        type="button"
        onClick={() => {
          const link = document.createElement('a');
          link.href = urlRef.current || '#';
          if (urlRef.current) {
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
          } else {
            void ensureUrl();
          }
        }}
        className={cnPlayer(mine)}
        title={t('edo.chat.voice_download')}
      >
        <Download size={14} />
        <span className="text-xs">{t('edo.chat.voice_label')}</span>
      </button>
    );
  }

  const progress = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
  const shownTime = playing || cur > 0 ? mmss(cur) : dur > 0 ? mmss(dur) : '--:--';

  return (
    <div className={`flex items-center gap-2 min-w-[180px] ${mine ? 'text-white' : 'text-slate-700'}`}>
      <button
        type="button"
        onClick={toggle}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          mine ? 'bg-white/20 hover:bg-white/30' : 'bg-brand-100 hover:bg-brand-200 text-brand-700'
        }`}
        title={t('edo.chat.voice_label')}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : playing ? (
          <Pause size={16} />
        ) : (
          <Play size={16} />
        )}
      </button>
      <div className="flex-1 min-w-[80px]">
        <div className={`h-1.5 rounded-full ${mine ? 'bg-white/25' : 'bg-slate-200'}`}>
          <div
            className={`h-1.5 rounded-full ${mine ? 'bg-white' : 'bg-brand-600'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className={`text-[10px] tabular-nums shrink-0 ${mine ? 'text-brand-100' : 'text-slate-400'}`}>
        {shownTime}
      </span>
      <audio
        ref={audioRef}
        src={url ?? undefined}
        preload="none"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={() => setCur(audioRef.current?.currentTime ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCur(0);
        }}
        onError={() => setFailed(true)}
        className="hidden"
      />
    </div>
  );
}

function cnPlayer(mine: boolean): string {
  return `flex items-center gap-1.5 text-xs underline ${
    mine ? 'text-brand-100 hover:text-white' : 'text-brand-600 hover:text-brand-800'
  }`;
}
