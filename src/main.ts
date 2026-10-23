import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Browsers only (the mobile apps are not subject to CORS): the MatiStore website.
  // CORS_ORIGINS = comma-separated list, e.g. "https://app.matistore.tech,http://localhost:8081".
  const origins = (process.env.CORS_ORIGINS ?? 'https://app.matistore.tech')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
