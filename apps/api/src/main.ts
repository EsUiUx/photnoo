import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ENV, type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const env = app.get<Env>(ENV);

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.enableShutdownHooks();

  await app.listen(env.API_PORT);
}

void bootstrap();
