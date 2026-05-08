interface Props {
  size?: number;
  className?: string;
}

export function Logo({ size = 24, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
    >
      <path
        d="M 6 28 L 32 4 L 58 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M 6 28 L 6 60 L 58 60 L 58 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M 6 28 L 58 28" stroke="currentColor" strokeWidth="3.5" />
      <g
        transform="translate(32 44)"
        stroke="currentColor"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="0" cy="0" r="6.5" />
        <circle cx="1.6" cy="0.3" r="3" />
        <path d="M 6.5 0.3 L 6.5 2.8 A 3 3 0 0 0 9.5 5.5" />
      </g>
    </svg>
  );
}
