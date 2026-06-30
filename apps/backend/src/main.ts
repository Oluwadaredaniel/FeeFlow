import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true
  });

  // Security: Add helmet middleware
  app.use(helmet());

  // Use pino-logger for structured logging
  app.useLogger(app.get(Logger));

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false
    }),
  );

  // Swagger Documentation setup
  const config = new DocumentBuilder()
    .setTitle('FeeFlow API')
    .setDescription('The official financial engine for NACOS OAU. Secure, Auditable, and Multi-tenant.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running on: http://localhost:${port}`);
  console.log(`API Documentation available at: http://localhost:${port}/docs`);
}
bootstrap();
