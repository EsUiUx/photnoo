import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req, res) => {
          const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        // Never log credentials, tokens or cookies (PRD section 10).
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    PrismaModule,
    RedisModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
