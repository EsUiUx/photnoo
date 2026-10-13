import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './app.factory';
import { AppModule } from './app.module';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let handler: Promise<Handler> | undefined;

/** The API as one request handler, for Vercel Functions (api/index.js). Built once per instance. */
export function getHandler(): Promise<Handler> {
  handler ??= (async () => {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
    configureApp(app);
    await app.init();
    return app.getHttpAdapter().getInstance() as Handler;
  })();
  return handler;
}
