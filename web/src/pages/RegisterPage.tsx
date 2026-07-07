import { type FormEvent, useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Eye, EyeOff, Languages, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { SUPPORTED_LANGUAGES, setLanguage, getLanguage, type LanguageCode } from '../i18n';
import { cn } from '../lib/utils';

export function RegisterPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentLang, setCurrentLang] = useState<LanguageCode>(getLanguage());

  if (user) {
    return <Navigate to="/inbox" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!fullName.trim()) {
      setError(t('auth.error_name_required') || 'Ism majburiy');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError(t('auth.error_email_invalid') || 'Email noto\'g\'ri');
      return;
    }
    if (!login.trim() || login.length < 3) {
      setError(t('auth.error_login_min') || 'Login kamida 3 belgidan iborat bo\'lishi kerak');
      return;
    }
    if (!password || password.length < 6) {
      setError(t('auth.error_password_min') || 'Parol kamida 6 belgidan iborat bo\'lishi kerak');
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.error_password_mismatch') || 'Parollar mos kelmadi');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/register', {
        fullName: fullName.trim(),
        email: email.trim(),
        login: login.trim(),
        password,
        externalMailLogin: email.trim(),
        externalMailPassword: password,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('auth.error_generic') || 'Ro\'yxatdan o\'tishda xatolik');
    } finally {
      setSubmitting(false);
    }
  }

  const handleChangeLang = (code: LanguageCode) => {
    setLanguage(code);
    setCurrentLang(code);
  };

  if (success) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 text-green-600 mb-4">
              <UserPlus size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Muvaffaqiyat!</h1>
            <p className="text-slate-600 mb-4">Akkauntingiz yaratildi. Login sahifasiga yo\'naltirilmoqdasiz...</p>
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-semibold">
              Darhol o'tish
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          className="bg-white rounded-2xl shadow-xl shadow-slate-200 p-8 space-y-4"
        >
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-1">Yangi akkaunt yaratish</h2>
            <p className="text-sm text-slate-500 mb-4">Pochta tizimiga ro'yxatdan o'ting</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              To'liq ism
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Pochta manzili
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
            />
            <p className="text-xs text-slate-400 mt-1">Tashqi pochtangizning manzili</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Foydalanuvchi nomi
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="username"
              required
              minLength={3}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
            />
            <p className="text-xs text-slate-400 mt-1">Kamida 3 ta belgidan iborat</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Parol
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
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
            <p className="text-xs text-slate-400 mt-1">Kamida 6 ta belgidan iborat</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Parolni tasdiqlash
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-2.5 pr-11 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {submitting ? 'Ro\'yxatdan o\'tilyapti...' : 'Ro\'yxatdan o\'tish'}
          </button>

          <div className="text-center text-sm text-slate-600">
            Akkauntingiz bor?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-semibold">
              Kirish
            </Link>
          </div>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} {t('auth.subtitle')}
        </p>
      </div>
    </div>
  );
}
