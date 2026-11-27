// Tashqi pochta (asaka-motors.uz / billur) butunlay yoqilganmi?
//
// MUHIM: standart holat — O'CHIRIQ (false). Tashqi pochtaga BARCHA ulanishlar
// (IMAP polling, sync, SMTP yuborish, ulanishni tekshirish) shu bayroq orqali
// o'chiriladi. Kod o'chirilmaydi — kelajakda yoqish uchun .env ga quyidagini
// qo'shish kifoya:
//     EXTERNAL_MAIL_ENABLED=true
// Belgilanmagan yoki "true" dan boshqa qiymat — O'CHIRIQ hisoblanadi.
export function externalMailEnabled(): boolean {
  return (process.env.EXTERNAL_MAIL_ENABLED || '').trim().toLowerCase() === 'true';
}
