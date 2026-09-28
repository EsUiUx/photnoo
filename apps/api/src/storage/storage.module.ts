import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { LocalStorage } from './local.storage';
import { LocalStorageController } from './local-storage.controller';
import { S3Storage } from './s3.storage';
import { STORAGE } from './storage';

@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [
    {
      provide: STORAGE,
      inject: [ENV],
      useFactory: (env: Env) => (env.STORAGE_DRIVER === 'local' ? new LocalStorage(env) : new S3Storage(env)),
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
