import { useRef } from 'react';

interface Props {
  onResize: (deltaX: number) => void;
}

export function Resizer({ onResize }: Props) {
  const lastXRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    lastXRef.current = e.clientX;

    const handleMove = (ev: MouseEvent) => {
      const delta = ev.clientX - lastXRef.current;
      lastXRef.current = ev.clientX;
      if (delta !== 0) onResize(delta);
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-1 cursor-col-resize bg-transparent hover:bg-brand-300 active:bg-brand-500 flex-shrink-0 transition-colors"
    />
  );
}
