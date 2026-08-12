import i18n from '../i18n';

// Axios/HTTP xatosini foydalanuvchi tiliga (uz / uzc / ru) moslab, tushunarli
// xabarга aylantiradi. Xom inglizcha "Request failed with status code 413"
// kabi xabarlar hech qachon ko'rsatilmaydi.
//
// Ustuvorlik:
//   1) Backend'ning aniq xabari (odatda o'zbekcha) bo'lsa — o'shani ishlatamiz.
//   2) Bo'lmasa — HTTP status kodi (yoki tarmoq/timeout) bo'yicha tarjima.
export function localizeApiError(err: any): string {
  const t = (key: string) => i18n.t(key) as string;

  // 1) Backend bergan aniq xabar (string yoki massiv)
  const backendMsg = err?.response?.data?.message;
  if (backendMsg) {
    return Array.isArray(backendMsg) ? backendMsg.join(', ') : String(backendMsg);
  }

  // 2) Javob umuman kelmagan — server o'chgan, tarmoq uzilgan yoki timeout
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message ?? '')) {
      return t('errors.timeout');
    }
    return t('errors.network');
  }

  // 3) HTTP status kodi bo'yicha
  switch (err.response.status) {
    case 400:
      return t('errors.bad_request');
    case 401:
      return t('errors.unauthorized');
    case 403:
      return t('errors.forbidden');
    case 404:
      return t('errors.not_found');
    case 413:
      return t('errors.file_too_large');
    case 429:
      return t('errors.too_many');
    case 500:
      return t('errors.server');
    case 502:
    case 503:
    case 504:
      return t('errors.gateway');
    default:
      return t('errors.generic');
  }
}
