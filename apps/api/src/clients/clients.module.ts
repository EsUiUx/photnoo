import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

/** Global so galleries and orders can attach their client by phone. */
@Global()
@Module({ imports: [AuthModule], controllers: [ClientsController], providers: [ClientsService], exports: [ClientsService] })
export class ClientsModule {}
