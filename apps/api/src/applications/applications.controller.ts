import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { type ApplicationInput, applicationSchema } from '@photnoo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ApplicationsService } from './applications.service';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  /** Public "Request access" form. Always 202 so it reveals nothing about existing accounts. */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async apply(@Body(new ZodValidationPipe(applicationSchema)) body: ApplicationInput) {
    await this.applications.apply(body);
    return { status: 'received' };
  }
}
