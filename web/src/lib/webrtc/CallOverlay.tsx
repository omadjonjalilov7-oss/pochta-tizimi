import { useEffect, useState, type RefObject } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CallPeer } from './CallProvider';

type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active';

function Timer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return <span className="tabular-nums">{`${m}:${String(s).padStart(2, '0')}`}</span>;
}

function BigAvatar({ peer }: { peer: CallPeer | null }) {
  const letter = (peer?.fullName || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="w-28 h-28 rounded-full bg-white/15 flex items-center justify-center text-5xl font-semibold text-white">
      {letter}
    </div>
  );
}

export function CallOverlay({
  status,
  peer,
  isVideo,
  muted,
  camOff,
  startedAt,
  localVideoRef,
  remoteVideoRef,
  onAccept,
  onReject,
  onHangup,
  onToggleMute,
  onToggleCamera,
}: {
  status: CallStatus;
  peer: CallPeer | null;
  isVideo: boolean;
  muted: boolean;
  camOff: boolean;
  startedAt: number | null;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}) {
  const { t } = useTranslation();
  const showVideoStage = isVideo && (status === 'active' || status === 'connecting');

  const statusText =
    status === 'incoming'
      ? isVideo
        ? t('edo.call.incoming_video')
        : t('edo.call.incoming_voice')
      : status === 'outgoing'
        ? t('edo.call.calling')
        : status === 'connecting'
          ? t('edo.call.connecting')
          : '';

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900 text-white flex flex-col">
      {/* Video sahna */}
      {showVideoStage ? (
        <div className="relative flex-1 bg-black overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 w-28 h-40 object-cover rounded-xl border-2 border-white/40 shadow-lg bg-slate-800"
          />
          <div className="absolute top-4 left-0 right-0 text-center">
            <div className="text-lg font-semibold drop-shadow">{peer?.fullName}</div>
            <div className="text-sm text-white/80 drop-shadow">
              {status === 'active' ? <Timer startedAt={startedAt} /> : statusText}
            </div>
          </div>
        </div>
      ) : (
        // Ovozli (yoki hali ulanmagan) — avatar + ism + holat
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <BigAvatar peer={peer} />
          <div className="text-center">
            <div className="text-2xl font-semibold">{peer?.fullName}</div>
            <div className="text-sm text-white/70 mt-1">
              {status === 'active' ? <Timer startedAt={startedAt} /> : statusText}
            </div>
          </div>
        </div>
      )}

      {/* Boshqaruv tugmalari */}
      <div className="shrink-0 pb-10 pt-4 px-6">
        {status === 'incoming' ? (
          <div className="flex items-center justify-center gap-16">
            <button
              onClick={onReject}
              className="flex flex-col items-center gap-2"
              title={t('edo.call.decline')}
            >
              <span className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center">
                <PhoneOff size={26} />
              </span>
              <span className="text-xs text-white/70">{t('edo.call.decline')}</span>
            </button>
            <button
              onClick={onAccept}
              className="flex flex-col items-center gap-2"
              title={t('edo.call.accept')}
            >
              <span className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center animate-pulse">
                <Phone size={26} />
              </span>
              <span className="text-xs text-white/70">{t('edo.call.accept')}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={onToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                muted ? 'bg-white text-slate-900' : 'bg-white/15 hover:bg-white/25'
              }`}
              title={muted ? t('edo.call.unmute') : t('edo.call.mute')}
            >
              {muted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            {isVideo && (
              <button
                onClick={onToggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  camOff ? 'bg-white text-slate-900' : 'bg-white/15 hover:bg-white/25'
                }`}
                title={camOff ? t('edo.call.cam_on') : t('edo.call.cam_off')}
              >
                {camOff ? <VideoOff size={22} /> : <VideoIcon size={22} />}
              </button>
            )}
            <button
              onClick={onHangup}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
              title={t('edo.call.hangup')}
            >
              <PhoneOff size={26} />
            </button>
          </div>
        )}
        {status !== 'active' && status !== 'incoming' && (
          <div className="text-center text-sm text-white/60 mt-4">{statusText}</div>
        )}
      </div>
    </div>
  );
}
