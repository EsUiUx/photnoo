import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { SharingService } from './sharing.service';

@Controller('galleries/:id')
@UseGuards(AuthGuard)
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  activate(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.sharing.activate(auth.photographerId, id);
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  regeneratePassword(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.sharing.regeneratePassword(auth.photographerId, id);
  }

  @Get('link')
  link(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.sharing.link(auth.photographerId, id);
  }

  @Post('close')
  @HttpCode(HttpStatus.NO_CONTENT)
  close(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.sharing.close(auth.photographerId, id);
  }

  @Get('activity')
  activity(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.sharing.activity(auth.photographerId, id);
  }
}
