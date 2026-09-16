import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Menambahkan prefix /api ke seluruh endpoint, misalnya POST /api/auth/register.
  app.setGlobalPrefix('api');
  
  app.useGlobalPipes(
  new ValidationPipe({
    // whitelist: hanya field yang ada di DTO yang dianggap valid
    whitelist: true,
    // forbidNonWhitelisted: field asing, misalnya client mengirim passwordHash, langsung ditolak dengan 400.
    forbidNonWhitelisted: true,
    // transform: NestJS dapat memproses body menjadi DTO yang sesuai.
    transform: true,
  }),
);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
