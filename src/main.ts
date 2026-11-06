import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { setupSwagger } from './swagger.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfigService);
  app.set('trust proxy', config.get('TRUST_PROXY'));
  app.enableCors();
  app.enableShutdownHooks();
  setupSwagger(app);
  await app.listen(config.get('PORT'));
}

await bootstrap();
