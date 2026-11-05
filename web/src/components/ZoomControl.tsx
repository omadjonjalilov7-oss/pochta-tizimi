import { useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, Search, X } from 'lucide-react';
import { ZOOM_LEVELS, getZoom, setZoom } from '../lib/uiZoom';

// Mobil "lupa" — faqat kichik ekranda (telefon) ko'rinadigan suzuvchi tugma.
// Chap pastda turadi (chat tugmasi o'ng pastda). Bosilganda "−  100%  +"
// paneli ochiladi: sahifani kattalashtirish/kichraytirish yoki foizni bosib
// 100% ga qaytarish mumkin.
export function ZoomControl() {
  const [open, setOpen] = useState(false);
  const [zoom, setZoomState] = useState(1);

  useEffect(() => {
    setZoomState(getZoom());
  }, []);

  const idx = ZOOM_LEVELS.indexOf(zoom as (typeof ZOOM_LEVELS)[number]);
  const curIdx = idx < 0 ? ZOOM_LEVELS.indexOf(1 as (typeof ZOOM_LEVELS)[number]) : idx;
  const canSmaller = curIdx > 0;
  const canBigger = curIdx < ZOOM_LEVELS.length - 1;

  const change = (dir: -1 | 1) => {
    const ni = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, curIdx + dir));
    setZoomState(setZoom(ZOOM_LEVELS[ni]));
  };
  const reset = () => setZoomState(setZoom(1));

  return (
    <div className="md:hidden fixed bottom-5 left-5 z-50 flex flex-col items-start gap-2">
      {open && (
        <div className="flex items-center gap-1 bg-white rounded-full shadow-xl border border-slate-200 p-1">
          <button
            type="button"
            onClick={() => change(-1)}
            disabled={!canSmaller}
            aria-label="Kichraytirish"
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30"
          >
            <ZoomOut size={20} />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="100% ga qaytarish"
            className="min-w-[3rem] text-center text-sm font-bold text-slate-700 tabular-nums"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => change(1)}
            disabled={!canBigger}
            aria-label="Kattalashtirish"
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30"
          >
            <ZoomIn size={20} />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Lupa — sahifa kattaligi"
        className="w-12 h-12 rounded-full bg-asaka-600 hover:bg-asaka-700 text-white shadow-lg flex items-center justify-center"
      >
        {open ? <X size={22} /> : <Search size={22} />}
      </button>
    </div>
  );
}
