// Zoom (video konferensiya) ilovasi manzili.
//   - Lokal ishlab chiqishda: http://localhost:3000 (zoom client dev server).
//   - Production'da: web/.env ga VITE_ZOOM_URL=https://meet.asaka-motors.uz
//     kabi HTTPS manzilni qo'ying (kamera/mikrofon faqat HTTPS'da ishlaydi).
export const ZOOM_URL =
  (import.meta.env.VITE_ZOOM_URL as string | undefined)?.trim() ||
  'http://localhost:3000';
