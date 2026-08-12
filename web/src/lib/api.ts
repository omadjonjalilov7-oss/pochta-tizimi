import axios from 'axios';
import { localizeApiError } from './apiError';

const API_BASE = '/api';
const TOKEN_KEY = 'pochta_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      setToken(null);
      if (location.pathname !== '/login') {
        location.href = '/login';
      }
    }
    // Xom inglizcha xato xabarini (masalan "Request failed with status code
    // 413") foydalanuvchi tiliga moslangan xabar bilan almashtiramiz. Shu
    // sabab ilovadagi har bir `e.message` fallback avtomat tarjima bo'ladi.
    try {
      err.message = localizeApiError(err);
    } catch {
      // i18n hali tayyor bo'lmasa — xom xabar qoladi (kamdan-kam holat)
    }
    return Promise.reject(err);
  },
);

// Login/parolsiz OMMAVIY so'rovlar uchun (QR skaner). Auth header ham,
// 401 redirect ham yo'q — foydalanuvchi tizimga kirmagan bo'lishi mumkin.
export const publicApi = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
});

// Ommaviy so'rovlarda ham xato xabarini foydalanuvchi tiliga moslaymiz.
publicApi.interceptors.response.use(
  (res) => res,
  (err) => {
    try {
      err.message = localizeApiError(err);
    } catch {
      // ignore
    }
    return Promise.reject(err);
  },
);
