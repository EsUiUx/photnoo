import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PortfolioController, PublicProfileController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { PublicProfileService } from './public-profile.service';

/** Portfolio manager (photographer) and the public profile page data (/v1/public/p/:slug). */
@Module({
  imports: [AuthModule, MediaModule],
  controllers: [PortfolioController, PublicProfileController],
  providers: [PortfolioService, PublicProfileService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
