import { type FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Eye, EyeOff, Languages } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SUPPORTED_LANGUAGES, setLanguage, getLanguage, type LanguageCode } from '../i18n';
import { cn } from '../lib/utils';
import { localizeApiError } from '../lib/apiError';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentLang, setCurrentLang] = useState<LanguageCode>(getLanguage());

  if (user) {
    return <Navigate to="/inbox" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginValue, password, rememberMe);
      navigate('/inbox', { replace: true });
    } catch (err: any) {
      setError(localizeApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const handleChangeLang = (code: LanguageCode) => {
    setLanguage(code);
    setCurrentLang(code);
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4 py-8 relative">
      {/* Til tanlash — yuqori o'ng burchakda */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-white/70 backdrop-blur-sm rounded-full p-1 shadow-sm border border-slate-200">
        <Languages size={14} className="ml-2 text-slate-500" />
        {SUPPORTED_LANGUAGES.map((opt) => (
          <button
            key={opt.code}
            type="button"
            onClick={() => handleChangeLang(opt.code)}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-full transition',
              currentLang === opt.code
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {opt.code.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white mb-4 shadow-lg shadow-brand-600/20">
            <Mail size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Pochta</h1>
          <p className="text-sm text-slate-500 mt-1">{t('auth.subtitle')}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl shadow-slate-200 p-8 space-y-5"
        >
          <h2 className="text-xl font-semibold text-slate-900 mb-1">{t('auth.title')}</h2>
          <p className="text-sm text-slate-500 mb-4">{t('auth.login_placeholder')}</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('auth.login_label')}
            </label>
            <input
              type="text"
              autoComplete="username"
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              placeholder={t('auth.login_placeholder')}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('auth.password_label')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password_placeholder')}
                required
                className="w-full px-4 py-2.5 pr-11 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {t('auth.remember_me')}
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {submitting ? t('auth.signing_in') : t('auth.sign_in')}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} {t('auth.subtitle')}
        </p>
      </div>
    </div>
  );
}
