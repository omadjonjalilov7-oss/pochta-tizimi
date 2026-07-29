import { useState, useRef, useEffect } from 'react';
import { X, Loader, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (qrData: string) => void;
  isLoading?: boolean;
  title?: string;
}

export function QrScannerModal({
  isOpen,
  onClose,
  onScan,
  isLoading = false,
  title,
}: QrScannerModalProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inputValue.trim()) {
      setError(t('edo.qr_scanner.err_empty'));
      return;
    }

    onScan(inputValue);
    setInputValue('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{title ?? t('edo.qr_scanner.title')}</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* QR Code Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('edo.qr_scanner.read_label')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('edo.qr_scanner.placeholder')}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-asaka-500 focus:ring-2 focus:ring-asaka-100 outline-none transition disabled:bg-slate-50"
            />
            <p className="text-xs text-slate-500 mt-1">
              {t('edo.qr_scanner.help')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              💡 <strong>{t('edo.qr_scanner.tip_label')}</strong> {t('edo.qr_scanner.tip_body')}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2',
                isLoading || !inputValue.trim()
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-asaka-600 hover:bg-asaka-700',
              )}
            >
              {isLoading && <Loader size={16} className="animate-spin" />}
              {t('edo.qr_scanner.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
