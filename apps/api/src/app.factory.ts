import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ENV, type Env } from './config/env';

/** Apply the HTTP pipeline shared by the server and the integration tests. */
export function configureApp(app: NestExpressApplication): INestApplication {
  const env = app.get<Env>(ENV);

  app.useLogger(app.get(Logger));
  // Hops of trusted proxies in front of the API (Cloudflare + load balancer), so req.ip is the client.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  // same-site (not the default same-origin) so the web app (app.photnoo.com, or :3000 locally)
  // can show images the API serves; other sites still cannot embed them.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  // ETag must be readable so the browser uploader can complete multipart uploads.
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true, exposedHeaders: ['ETag'] });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.enableShutdownHooks();
  return app;
}
