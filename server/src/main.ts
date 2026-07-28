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
