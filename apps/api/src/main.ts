import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { environment } from './config/environment';
import { ApiFilter } from './common/filters/api.filter';
import { localBoundary } from './common/middleware/local-boundary';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api');
  app.use(
    localBoundary(environment.API_PORT, environment.WEB_ORIGIN, environment.INTERNAL_API_TOKEN),
  );
  app.use(json({ limit: '80kb' }));
  app.use(urlencoded({ extended: false, limit: '80kb' }));
  app.useGlobalFilters(new ApiFilter());
  app.enableShutdownHooks();
  await app.listen(environment.API_PORT, '127.0.0.1');
}
void bootstrap();
