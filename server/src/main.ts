import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

// Prisma BigInt fields (masalan, fayl o'lchami sizeBytes) JSON.stringify orqali
// avtomatik serializatsiya qilinmaydi → Express javob qaytarayotganda 500 xatolik
// chiqarayapdi. Number'ga aylantirish — fayl o'lchami uchun xavfsiz, chunki amaliy
// fayllar 50 MB-dan oshmaydi (MAX_SAFE_INTEGER bilan solishtirganda juda kichik).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  const n = Number(this);
  return Number.isSafeInteger(n) ? n : this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  // Shablonlar base64 rasm bilan yuborilganda default ~100kb limit oshib ketadi
  // (HTTP 413 "request entity too large") → limitni oshiramiz.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

  app.use(
    helmet({
      contentSecurityPolicy: false, // SPA + WS uchun
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // API javoblari KESHLANMASIN. Aks holda brauzer/proksi (nginx) eski GET
  // javobini xotirada saqlab, ma'lumot o'zgargach ham eskisini ko'rsatib qoladi
  // (foydalanuvchi Ctrl+F5 bosishga majbur bo'ladi). ETag'ni ham o'chiramiz.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('etag', false);
  app.use((req: any, res: any, next: any) => {
    // Alohida kontroller o'z sarlavhasini qo'ysa (masalan, kuzatuv-piksel),
    // u keyin ishlab, buni ustidan yozadi — shuning uchun bu xavfsiz default.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);

  Logger.log(`Pochta server ishga tushdi: http://${host}:${port}`, 'Bootstrap');
}

bootstrap();
