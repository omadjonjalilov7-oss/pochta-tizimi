interface Props {
  size?: number;
  className?: string;
}

/**
 * Asaka Motors "A" logotipi — faqat EDO (hujjat aylanmasi) bo'limida ishlatiladi.
 * Rasm fayli: web/public/asaka-logo.png
 * Pochta tizimi eski `Logo` komponentida qoladi.
 */
export function AsakaLogo({ size = 28, className }: Props) {
  return (
    <img
      src="/asaka-logo.png"
      width={size}
      height={size}
      alt="Asaka Motors"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
