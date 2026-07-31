import { initials } from '../lib/utils';

interface AvatarProps {
  fullName: string;
  size?: 'sm' | 'md' | 'lg';
  avatarPath?: string | null;
}

const SIZE_CLASS = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
};

export function avatarUrl(avatarPath?: string | null): string | null {
  // Avatarlar /api/avatars ostida beriladi (API bilan bir xil proksi orqali).
  return avatarPath ? `/api/avatars/${avatarPath}` : null;
}

export function Avatar({ fullName, size = 'md', avatarPath }: AvatarProps) {
  const src = avatarUrl(avatarPath);
  if (src) {
    return (
      <img
        src={src}
        alt={fullName}
        className={`${SIZE_CLASS[size]} rounded-full object-cover bg-slate-200`}
      />
    );
  }
  return (
    <div
      className={`${SIZE_CLASS[size]} rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center select-none`}
    >
      {initials(fullName)}
    </div>
  );
}
