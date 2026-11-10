import { useEffect, useRef, useState } from 'react';
import { Mic, Play, Pause, Loader2, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

// ─── Ovozli xabar: yozib olish va o'ynatish (Telegramdek) ──────────────────────
//
// Yozish: brauzerning MediaRecorder API'si mikrofondan audio oladi va uni oddiy
// fayl sifatida mavjud chat endpointiga jo'natadi. Server (ffmpeg) uni m4a'ga
// o'giradi — iPhone/Android/desktop hammasida o'ynaydi.
//
// Yozish uslubi: mikrofonni BOSIB TURGANDA yoziladi, QO'YIB YUBORILGANDA
// avtomatik yuboriladi (juda qisqa bo'lsa — bekor qilinadi).

const MAX_SECONDS = 300; // 5 daqiqa cheklov
const MIN_MS = 600; // bundan qisqa bosilsa — tasodifiy deb bekor qilamiz

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

export function voiceRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder !==
      'undefined'
  );
}

// ─── Yozib olish tugmasi (bosib turib yozish) ──────────────────────────────────
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
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const startingRef = useRef(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => stopStream(), []);

  const begin = async () => {
    if (startingRef.current || recording) return;
    startingRef.current = true;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Agar foydalanuvchi ruxsat so'ralgan vaqtda allaqachon qo'yib yuborgan
      // bo'lsa — darhol to'xtatamiz (yozmaymiz).
      if (cancelledRef.current) {
        stream.getTracks().forEach((tr) => tr.stop());
        startingRef.current = false;
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = pickMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stopStream();
        const type = mr.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const elapsed = Date.now() - startedAtRef.current;
        setRecording(false);
        setSeconds(0);
        startingRef.current = false;
        if (!cancelledRef.current && blob.size > 0 && elapsed >= MIN_MS) {
          const file = new File([blob], `voice-${Date.now()}.${extFor(type)}`, {
            type,
          });
          onRecorded(file);
        } else if (!cancelledRef.current && elapsed < MIN_MS) {
          setError(t('edo.chat.voice_too_short'));
          window.setTimeout(() => setError(null), 1500);
        }
      };
      mediaRef.current = mr;
      startedAtRef.current = Date.now();
      mr.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) {
            cancelledRef.current = false;
            mediaRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      setError(t('edo.chat.voice_no_mic'));
      startingRef.current = false;
      window.setTimeout(() => setError(null), 2000);
    }
  };

  const finish = () => {
    cancelledRef.current = false;
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    } else {
      // Hali boshlanmagan bo'lsa (ruxsat kutilyapti) — boshlanmasin.
      startingRef.current = false;
      setRecording(false);
    }
  };

  // Bosganda yozishni boshlaymiz.
  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    cancelledRef.current = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // pointer capture qo'llab-quvvatlanmasa — e'tiborsiz
    }
    void begin();
  };
  // Qo'yib yuborganda yakunlab yuboramiz.
  const onPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // e'tiborsiz
    }
    finish();
  };

  return (
    <>
      {recording && (
        <div className="absolute inset-0 z-10 flex items-center gap-3 px-3 bg-white pointer-events-none">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-sm font-medium text-slate-700 tabular-nums w-12">
            {mmss(seconds)}
          </span>
          <span className="flex-1 text-sm text-slate-400 truncate">
            {t('edo.chat.voice_release_hint')}
          </span>
          <Mic size={18} className="text-red-500" />
        </div>
      )}
      {error && !recording && (
        <div className="absolute inset-x-0 -top-7 z-10 flex justify-center">
          <span className="text-xs bg-slate-800 text-white px-2 py-1 rounded-md shadow">
            {error}
          </span>
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => finish()}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
        className={`p-1.5 rounded-lg select-none ${
          recording
            ? 'text-red-600 bg-red-50'
            : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50'
        } disabled:opacity-40`}
        title={t('edo.chat.voice_hold_hint')}
      >
        <Mic size={18} />
      </button>
    </>
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const ensureUrl = async (): Promise<string | null> => {
    if (urlRef.current) return urlRef.current;
    if (loadingRef.current) return null;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await api.get(apiPath, { responseType: 'blob' });
      const blob = new Blob([res.data as Blob], { type: mimeType || 'audio/mp4' });
      const u = URL.createObjectURL(blob);
      urlRef.current = u;
      setUrl(u);
      return u;
    } catch {
      setFailed(true);
      return null;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  // Xabar ekranga ko'ringanda OLDINDAN yuklab qo'yamiz — shunda bosilganda
  // (iOS'da ham) to'g'ridan-to'g'ri, darhol o'ynaydi va davomiyligi ko'rinadi.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      void ensureUrl();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void ensureUrl();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }
    if (!urlRef.current) {
      // Hali yuklanmagan bo'lsa — yuklaymiz (keyingi bosishda o'ynaydi).
      void ensureUrl();
      return;
    }
    // Gesture ichida to'g'ridan-to'g'ri o'ynatamiz (iOS talabi).
    a.play().catch(() => setFailed(true));
  };

  // m4a'da duration odatda to'g'ri keladi; webm (fallback) da Infinity bo'lsa —
  // majburan hisoblatamiz.
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
    return (
      <button
        type="button"
        onClick={() => {
          if (urlRef.current) {
            const link = document.createElement('a');
            link.href = urlRef.current;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
          } else {
            void ensureUrl();
          }
        }}
        className={`flex items-center gap-1.5 text-xs underline ${
          mine ? 'text-brand-100 hover:text-white' : 'text-brand-600 hover:text-brand-800'
        }`}
        title={t('edo.chat.voice_download')}
      >
        <Download size={14} />
        <span className="text-xs">{t('edo.chat.voice_label')}</span>
      </button>
    );
  }

  const progress = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
  // Davomiylik: o'ynayotganda — joriy vaqt; aks holda — umumiy davomiylik.
  const shownTime =
    playing || cur > 0 ? mmss(cur) : dur > 0 ? mmss(dur) : loading ? '' : '--:--';

  return (
    <div
      ref={rootRef}
      className={`flex items-center gap-2 min-w-[180px] ${mine ? 'text-white' : 'text-slate-700'}`}
    >
      <button
        type="button"
        onClick={toggle}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          mine ? 'bg-white/20 hover:bg-white/30' : 'bg-brand-100 hover:bg-brand-200 text-brand-700'
        }`}
        title={t('edo.chat.voice_label')}
      >
        {loading && !urlRef.current ? (
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
      <span
        className={`text-[10px] tabular-nums shrink-0 w-9 text-right ${
          mine ? 'text-brand-100' : 'text-slate-400'
        }`}
      >
        {shownTime}
      </span>
      <audio
        ref={audioRef}
        src={url ?? undefined}
        preload="metadata"
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
