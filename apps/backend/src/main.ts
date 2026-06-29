import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody:true exposes req.rawBody — REQUIRED for verifying the Nomba webhook
  // HMAC signature over the exact bytes (re-serializing JSON would break it).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
