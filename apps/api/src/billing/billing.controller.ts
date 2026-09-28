import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  BillingRules,
  type CheckoutInput,
  checkoutSchema,
  type NextPlanInput,
  nextPlanSchema,
  type PaymentProofInput,
  paymentProofSchema,
} from '@photnoo/shared';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BillingService, type ProofFile } from './billing.service';

/** Photographer billing (PRD B-01 to B-07). Reviewing payments is an admin action (A-02). */
@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  overview(@CurrentAuth() auth: AccessClaims) {
    return this.billing.overview(auth.photographerId);
  }

  @Post('checkout')
  checkout(@CurrentAuth() auth: AccessClaims, @Body(new ZodValidationPipe(checkoutSchema)) body: CheckoutInput) {
    return this.billing.checkout(auth.photographerId, body.planId);
  }

  @Put('next-plan')
  @HttpCode(HttpStatus.NO_CONTENT)
  async nextPlan(@CurrentAuth() auth: AccessClaims, @Body(new ZodValidationPipe(nextPlanSchema)) body: NextPlanInput) {
    await this.billing.setNextPlan(auth.photographerId, body.planId);
  }

  /** Multipart: `proof` file plus `method` and `declaredAmountEgp` fields. */
  @Post('payments/:id/proof')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    // No storage option: multer keeps the file in memory, which suits a 10 MB receipt.
    FileInterceptor('proof', {
      // One byte over the limit lets the service answer with a clear message instead of multer's.
      limits: { fileSize: BillingRules.proofMaxBytes + 1, files: 1, fields: 5 },
    }),
  )
  submitProof(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: ProofFile | undefined,
    @Body(new ZodValidationPipe(paymentProofSchema)) body: PaymentProofInput,
  ) {
    return this.billing.submitProof(auth.photographerId, id, file, body);
  }

  @Post('payments/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    await this.billing.cancel(auth.photographerId, id);
  }

  @Get('payments/:id/proof')
  proof(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.billing.proofUrl(auth.photographerId, id);
  }

  @Get('invoices/:id/pdf')
  invoice(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.billing.invoiceUrl(auth.photographerId, id);
  }
}

