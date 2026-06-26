import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type SecretInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Container className (input o'rab turuvchi div). */
  wrapperClassName?: string;
  /** Boshlang'ich holatda ko'rinadigan bo'lsa true. Default: false (yashirin). */
  initialReveal?: boolean;
};

/**
 * Parol/PIN uchun input — Chrome'ning "Save password" so'rovini yo'q qiladi
 * (type="text" + WebkitTextSecurity: 'disc') va o'ng tomonda ko'z ikonkasi orqali
 * ko'rinadigan/yashirinadigan rejimga o'tkazadi.
 */
export const SecretInput = forwardRef<HTMLInputElement, SecretInputProps>(
  function SecretInput(
    {
      wrapperClassName = '',
      className = '',
      initialReveal = false,
      autoComplete = 'off',
      style,
      ...rest
    },
    ref,
  ) {
    const [reveal, setReveal] = useState(initialReveal);

    return (
      <div className={`relative ${wrapperClassName}`}>
        <input
          ref={ref}
          type="text"
          autoComplete={autoComplete}
          data-form-type="other"
          spellCheck={false}
          {...rest}
          className={`pr-9 ${className}`}
          style={{
            ...(reveal ? {} : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)),
            ...style,
          }}
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded"
          title={reveal ? 'Yashirish' : "Ko'rsatish"}
          aria-label={reveal ? 'Yashirish' : "Ko'rsatish"}
        >
          {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);
