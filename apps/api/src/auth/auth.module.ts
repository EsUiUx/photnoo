import { Module } from '@nestjs/common';
import { ApplicationsController } from '../applications/applications.controller';
import { ApplicationsService } from '../applications/applications.service';
import { MeController } from '../me/me.controller';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';

@Module({
  controllers: [AuthController, ApplicationsController, MeController],
  providers: [AuthService, ApplicationsService, TokensService, AuthGuard],
  exports: [AuthGuard, TokensService, ApplicationsService],
})
export class AuthModule {}
