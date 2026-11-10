import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getSocket } from '../socket';
import { api } from '../api';
import { CallOverlay } from './CallOverlay';

// ─── 1-ga-1 ovozli/video qo'ng'iroq (WebRTC) ───────────────────────────────────
//
// Signalizatsiya mavjud socket (/realtime) orqali yuriladi (call:* eventlari).
// Ovoz/video oqimi serverdan O'TMAYDI — to'g'ridan-to'g'ri ikki brauzer orasida.
// Har xil tarmoqdagilar (uy/mobil) uchun TURN server kerak (/chat/ice-servers).

export interface CallPeer {
  id: string;
  fullName: string;
  avatarPath?: string | null;
}

type CallStatus =
  | 'idle'
  | 'outgoing' // chaqiryapmiz, javob kutyapmiz
  | 'incoming' // bizni chaqiryapti
  | 'connecting' // qabul qilindi, ulanmoqda
  | 'active'; // suhbat ketyapti

interface CallContextValue {
  status: CallStatus;
  startCall: (peer: CallPeer, video: boolean) => void;
  callAvailable: boolean;
}

const CallContext = createContext<CallContextValue>({
  status: 'idle',
  startCall: () => undefined,
  callAvailable: false,
});

export function useCall() {
  return useContext(CallContext);
}

const callSupported =
  typeof window !== 'undefined' &&
  typeof RTCPeerConnection !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function';

interface Session {
  callId: string;
  peerId: string;
  isCaller: boolean;
  video: boolean;
  pc: RTCPeerConnection | null;
  remoteDescSet: boolean;
  pendingIce: RTCIceCandidateInit[];
}

let iceCache: RTCIceServer[] | null = null;
async function getIceServers(): Promise<RTCIceServer[]> {
  if (iceCache) return iceCache;
  try {
    const { data } = await api.get<{ iceServers: RTCIceServer[] }>(
      '/chat/ice-servers',
    );
    iceCache = data.iceServers || [];
  } catch {
    iceCache = [{ urls: 'stun:stun.l.google.com:19302' }];
  }
  return iceCache;
}

function newCallId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CallProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [endNote, setEndNote] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringRef = useRef<{ stop: () => void } | null>(null);
  const statusRef = useRef<CallStatus>('idle');
  statusRef.current = status;

  const emit = (event: string, data: Record<string, unknown>) => {
    try {
      getSocket().emit(event, data);
    } catch {
      // socket yo'q bo'lsa — e'tiborsiz
    }
  };

  // ─── Ringtone (oddiy WebAudio "bip-bip") ───────────────────────────────────
  const startRing = (incoming: boolean) => {
    stopRing();
    try {
      const Ctx =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      let timer: number | null = null;
      const beep = () => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = incoming ? 520 : 440;
        g.gain.value = 0.0001;
        o.connect(g);
        g.connect(ctx.destination);
        const now = ctx.currentTime;
        g.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        o.start(now);
        o.stop(now + 0.42);
      };
      beep();
      timer = window.setInterval(beep, incoming ? 1200 : 2500);
      if (incoming && navigator.vibrate) {
        try {
          navigator.vibrate([400, 800, 400, 800]);
        } catch {
          // e'tiborsiz
        }
      }
      ringRef.current = {
        stop: () => {
          if (timer) window.clearInterval(timer);
          ctx.close().catch(() => undefined);
          if (navigator.vibrate) {
            try {
              navigator.vibrate(0);
            } catch {
              // e'tiborsiz
            }
          }
        },
      };
    } catch {
      // ringtone chiqmasa ham qo'ng'iroq ishlayveradi
    }
  };
  const stopRing = () => {
    ringRef.current?.stop();
    ringRef.current = null;
  };

  // ─── Tozalash ──────────────────────────────────────────────────────────────
  const cleanup = useCallback((note: string | null) => {
    stopRing();
    const s = sessionRef.current;
    if (s?.pc) {
      try {
        s.pc.ontrack = null;
        s.pc.onicecandidate = null;
        s.pc.onconnectionstatechange = null;
        s.pc.close();
      } catch {
        // e'tiborsiz
      }
    }
    localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    sessionRef.current = null;
    setStatus('idle');
    setPeer(null);
    setMuted(false);
    setCamOff(false);
    setStartedAt(null);
    setEndNote(note);
    if (note) window.setTimeout(() => setEndNote(null), 2500);
  }, []);

  const attachLocalPreview = () => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  };

  const createPeer = useCallback(
    async (video: boolean): Promise<RTCPeerConnection> => {
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      pc.onicecandidate = (e) => {
        const s = sessionRef.current;
        if (e.candidate && s) {
          emit('call:ice', {
            toUserId: s.peerId,
            callId: s.callId,
            candidate: e.candidate.toJSON(),
          });
        }
      };
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (!stream) return;
        // Video elementga tasvir; ovoz esa ALOHIDA audio element orqali chiqadi
        // (video element muted — ikki marta ovoz/eko bo'lmasligi uchun).
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          // autoPlay ba'zi brauzerlarda bloklanadi — ochiq play() chaqiramiz.
          remoteAudioRef.current.play().catch(() => undefined);
        }
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') {
          setStatus('active');
          setStartedAt((prev) => prev ?? Date.now());
          stopRing();
        } else if (st === 'failed' || st === 'closed') {
          cleanup(null);
        }
      };
      // Lokal treklarni qo'shamiz
      const stream = localStreamRef.current;
      if (stream) stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
      void video;
      return pc;
    },
    [cleanup],
  );

  const getMedia = async (video: boolean): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { facingMode: 'user' } : false,
    });
    localStreamRef.current = stream;
    setTimeout(attachLocalPreview, 0);
    return stream;
  };

  // ─── Chaqirish (chaqiruvchi) ───────────────────────────────────────────────
  const startCall = useCallback(
    (p: CallPeer, video: boolean) => {
      if (!callSupported || !enabled || statusRef.current !== 'idle') return;
      const callId = newCallId();
      sessionRef.current = {
        callId,
        peerId: p.id,
        isCaller: true,
        video,
        pc: null,
        remoteDescSet: false,
        pendingIce: [],
      };
      setPeer(p);
      setIsVideo(video);
      setEndNote(null);
      setStatus('outgoing');
      startRing(false);
      (async () => {
        try {
          await getMedia(video);
          const pc = await createPeer(video);
          if (!sessionRef.current || sessionRef.current.callId !== callId) return;
          sessionRef.current.pc = pc;
          emit('call:invite', {
            toUserId: p.id,
            callId,
            video,
            fromName: p.fullName,
          });
        } catch {
          cleanup('Mikrofon/kameraga ruxsat berilmadi');
        }
      })();
    },
    [createPeer, cleanup, enabled],
  );

  // ─── Qabul qilish (chaqirilgan) ────────────────────────────────────────────
  const acceptCall = useCallback(() => {
    const s = sessionRef.current;
    if (!s || statusRef.current !== 'incoming') return;
    stopRing();
    setStatus('connecting');
    (async () => {
      try {
        await getMedia(s.video);
        const pc = await createPeer(s.video);
        if (!sessionRef.current) return;
        sessionRef.current.pc = pc;
        emit('call:accept', { toUserId: s.peerId, callId: s.callId });
      } catch {
        emit('call:reject', { toUserId: s.peerId, callId: s.callId });
        cleanup('Mikrofon/kameraga ruxsat berilmadi');
      }
    })();
  }, [createPeer, cleanup]);

  const rejectCall = useCallback(() => {
    const s = sessionRef.current;
    if (s) emit('call:reject', { toUserId: s.peerId, callId: s.callId });
    cleanup(null);
  }, [cleanup]);

  const hangup = useCallback(() => {
    const s = sessionRef.current;
    if (s) emit('call:hangup', { toUserId: s.peerId, callId: s.callId });
    cleanup(null);
  }, [cleanup]);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((tr) => (tr.enabled = !next));
    setMuted(next);
  };
  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOff;
    stream.getVideoTracks().forEach((tr) => (tr.enabled = !next));
    setCamOff(next);
  };

  // ─── Socket signallari ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!callSupported || !enabled) return;
    const socket = getSocket();

    const flushIce = async (pc: RTCPeerConnection, s: Session) => {
      for (const c of s.pendingIce) {
        try {
          await pc.addIceCandidate(c);
        } catch {
          // e'tiborsiz
        }
      }
      s.pendingIce = [];
    };

    const onIncoming = (d: any) => {
      // Band bo'lsak — "band" signalini qaytaramiz.
      if (statusRef.current !== 'idle') {
        socket.emit('call:busy', { toUserId: d.fromUserId, callId: d.callId });
        return;
      }
      sessionRef.current = {
        callId: d.callId,
        peerId: d.fromUserId,
        isCaller: false,
        video: !!d.video,
        pc: null,
        remoteDescSet: false,
        pendingIce: [],
      };
      setPeer({ id: d.fromUserId, fullName: d.fromName || 'Foydalanuvchi' });
      setIsVideo(!!d.video);
      setEndNote(null);
      setStatus('incoming');
      startRing(true);
    };

    // Chaqiruvchi: suhbatdosh qabul qildi → offer yuboramiz.
    const onAccept = async (d: any) => {
      const s = sessionRef.current;
      if (!s || s.callId !== d.callId || !s.isCaller || !s.pc) return;
      stopRing();
      setStatus('connecting');
      try {
        const offer = await s.pc.createOffer();
        await s.pc.setLocalDescription(offer);
        emit('call:offer', {
          toUserId: s.peerId,
          callId: s.callId,
          sdp: offer,
        });
      } catch {
        hangup();
      }
    };

    // Chaqirilgan: offer keldi → answer yuboramiz.
    const onOffer = async (d: any) => {
      const s = sessionRef.current;
      if (!s || s.callId !== d.callId || s.isCaller || !s.pc) return;
      try {
        await s.pc.setRemoteDescription(d.sdp);
        s.remoteDescSet = true;
        await flushIce(s.pc, s);
        const answer = await s.pc.createAnswer();
        await s.pc.setLocalDescription(answer);
        emit('call:answer', {
          toUserId: s.peerId,
          callId: s.callId,
          sdp: answer,
        });
      } catch {
        hangup();
      }
    };

    // Chaqiruvchi: answer keldi.
    const onAnswer = async (d: any) => {
      const s = sessionRef.current;
      if (!s || s.callId !== d.callId || !s.isCaller || !s.pc) return;
      try {
        await s.pc.setRemoteDescription(d.sdp);
        s.remoteDescSet = true;
        await flushIce(s.pc, s);
      } catch {
        hangup();
      }
    };

    const onIce = async (d: any) => {
      const s = sessionRef.current;
      if (!s || s.callId !== d.callId || !d.candidate) return;
      if (s.pc && s.remoteDescSet) {
        try {
          await s.pc.addIceCandidate(d.candidate);
        } catch {
          // e'tiborsiz
        }
      } else {
        s.pendingIce.push(d.candidate);
      }
    };

    const onReject = (d: any) => {
      const s = sessionRef.current;
      if (!s || s.callId !== d.callId) return;
      cleanup('Qo‘ng‘iroq rad etildi');
    };
    const onHangup = (d: any) => {
      const s = sessionRef.current;
      if (!s || s.callId !== d.callId) return;
      cleanup('Qo‘ng‘iroq tugadi');
    };
    const onBusy = (d: any) => {
      const s = sessionRef.current;
      if (!s || s.callId !== d.callId) return;
      cleanup('Band');
    };
    const onUnavailable = (d: any) => {
      const s = sessionRef.current;
      if (!s || s.callId !== d.callId) return;
      cleanup('Ulanmagan yoki javob bermadi');
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:accept', onAccept);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice', onIce);
    socket.on('call:reject', onReject);
    socket.on('call:hangup', onHangup);
    socket.on('call:busy', onBusy);
    socket.on('call:peer_unavailable', onUnavailable);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accept', onAccept);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce);
      socket.off('call:reject', onReject);
      socket.off('call:hangup', onHangup);
      socket.off('call:busy', onBusy);
      socket.off('call:peer_unavailable', onUnavailable);
    };
  }, [cleanup, createPeer, hangup, enabled]);

  return (
    <CallContext.Provider value={{ status, startCall, callAvailable: callSupported }}>
      {children}
      {status !== 'idle' && (
        <CallOverlay
          status={status}
          peer={peer}
          isVideo={isVideo}
          muted={muted}
          camOff={camOff}
          startedAt={startedAt}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          onAccept={acceptCall}
          onReject={rejectCall}
          onHangup={hangup}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
        />
      )}
      {/* Ovoz har doim eshitilishi uchun alohida audio element */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
      {endNote && status === 'idle' && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {endNote}
        </div>
      )}
    </CallContext.Provider>
  );
}
