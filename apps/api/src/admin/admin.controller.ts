import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  type ApproveApplicationInput,
  approveApplicationSchema,
  type ChangePlanInput,
  changePlanSchema,
  type CreatePlanInput,
  createPlanSchema,
  type DecideAbuseInput,
  decideAbuseSchema,
  type PlanPriceInput,
  planPriceSchema,
  type ReasonInput,
  reasonSchema,
  type SetSwitchInput,
  setSwitchSchema,
  type SuspendGalleryInput,
  suspendGallerySchema,
  type SwitchKey,
  SwitchKeys,
} from '@photnoo/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { AdminPrincipal } from './admin-auth.service';
import { AdminGuard, CurrentAdmin, MinRole } from './admin.guard';
import { AdminService } from './admin.service';

const ip = (req: Request) => req.ip ?? null;
const pick = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const reason = new ZodValidationPipe(reasonSchema);

/**
 * Admin API (PRD section 8). Support reads; Operations runs the queues and suspensions; Super
 * Admin also manages plans, emergency switches and abuse-case content access.
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  // ---------- A-01 ----------

  @Get('applications')
  applications(@Query('status') status?: string) {
    return this.admin.listApplications(pick(status, ['pending', 'approved', 'rejected'] as const, 'pending'));
  }

  @Post('applications/:id/approve')
  @MinRole('operations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async approveApplication(
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(approveApplicationSchema)) body: ApproveApplicationInput,
  ) {
    await this.admin.approveApplication(admin, ip(req), id, body.grantTrial);
  }

  @Post('applications/:id/reject')
  @MinRole('operations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rejectApplication(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body(reason) body: ReasonInput) {
    await this.admin.rejectApplication(admin, ip(req), id, body.reason);
  }

  // ---------- A-02 ----------

  @Get('payments')
  payments(@Query('status') status?: string) {
    return this.admin.listPayments(pick(status, ['open', 'approved', 'rejected'] as const, 'open'));
  }

  @Get('payments/:id/proof')
  proof(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.paymentProof(admin, ip(req), id);
  }

  @Post('payments/:id/approve')
  @MinRole('operations')
  @HttpCode(HttpStatus.OK)
  approvePayment(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approvePayment(admin, ip(req), id);
  }

  @Post('payments/:id/reject')
  @MinRole('operations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rejectPayment(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body(reason) body: ReasonInput) {
    await this.admin.rejectPayment(admin, ip(req), id, body.reason);
  }

  // ---------- A-03 ----------

  @Get('photographers')
  photographers(@Query('q') q?: string, @Query('cursor') cursor?: string) {
    return this.admin.listPhotographers(q, cursor);
  }

  @Get('photographers/:id')
  photographer(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.photographer(id);
  }

  @Post('photographers/:id/suspend')
  @MinRole('operations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspend(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body(reason) body: ReasonInput) {
    await this.admin.suspendPhotographer(admin, ip(req), id, body.reason, true);
  }

  @Post('photographers/:id/unsuspend')
  @MinRole('operations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsuspend(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body(reason) body: ReasonInput) {
    await this.admin.suspendPhotographer(admin, ip(req), id, body.reason, false);
  }

  @Post('photographers/:id/force-logout')
  @MinRole('operations')
  @HttpCode(HttpStatus.OK)
  forceLogout(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body(reason) body: ReasonInput) {
    return this.admin.forceLogout(admin, ip(req), id, body.reason);
  }

  @Post('photographers/:id/change-plan')
  @MinRole('operations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePlan(
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(changePlanSchema)) body: ChangePlanInput,
  ) {
    await this.admin.changePlan(admin, ip(req), id, body.planId, body.reason);
  }

  @Post('photographers/:id/grant-trial')
  @MinRole('operations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async grantTrial(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body(reason) body: ReasonInput) {
    await this.admin.grantTrial(admin, ip(req), id, body.reason);
  }

  // ---------- A-05 per gallery ----------

  @Post('galleries/:id/suspend')
  @MinRole('operations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspendGallery(
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(suspendGallerySchema)) body: SuspendGalleryInput,
  ) {
    await this.admin.suspendGallery(admin, ip(req), id, body.reason, body.hours);
  }

  @Post('galleries/:id/unsuspend')
  @MinRole('operations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsuspendGallery(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body(reason) body: ReasonInput) {
    await this.admin.unsuspendGallery(admin, ip(req), id, body.reason);
  }

  // ---------- A-07 ----------

  @Get('abuse')
  abuse(@Query('status') status?: string) {
    return this.admin.listAbuse(pick(status, ['open', 'actioned', 'dismissed'] as const, 'open'));
  }

  @Post('abuse/:id/decide')
  @MinRole('operations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async decide(
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decideAbuseSchema)) body: DecideAbuseInput,
  ) {
    await this.admin.decideAbuse(admin, ip(req), id, body);
  }

  @Post('abuse/:id/view')
  @MinRole('super_admin')
  @HttpCode(HttpStatus.OK)
  viewCase(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body(reason) body: ReasonInput) {
    return this.admin.viewCase(admin, ip(req), id, body.reason);
  }

  // ---------- A-04 ----------

  @Get('plans')
  plans() {
    return this.admin.listPlans();
  }

  @Post('plans')
  @MinRole('super_admin')
  createPlan(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Body(new ZodValidationPipe(createPlanSchema)) body: CreatePlanInput) {
    return this.admin.createPlan(admin, ip(req), body);
  }

  @Post('plans/:id/price')
  @MinRole('super_admin')
  @HttpCode(HttpStatus.OK)
  changePrice(
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(planPriceSchema)) body: PlanPriceInput,
  ) {
    return this.admin.changePrice(admin, ip(req), id, body.priceEgp);
  }

  @Post('plans/:id/retire')
  @MinRole('super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retirePlan(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body(reason) body: ReasonInput) {
    await this.admin.retirePlan(admin, ip(req), id, body.reason);
  }

  // ---------- A-05 ----------

  @Get('switches')
  switches() {
    return this.admin.switches();
  }

  @Put('switches/:key')
  @MinRole('super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setSwitch(
    @CurrentAdmin() admin: AdminPrincipal,
    @Req() req: Request,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(setSwitchSchema)) body: SetSwitchInput,
  ) {
    if (!SwitchKeys.includes(key as SwitchKey)) throw new BadRequestException({ code: 'unknown_switch', message: 'Unknown switch.' });
    await this.admin.setSwitch(admin, ip(req), key as SwitchKey, body.on, body.reason);
  }

  @Post('switches/logout-all')
  @MinRole('super_admin')
  @HttpCode(HttpStatus.OK)
  logoutAll(@CurrentAdmin() admin: AdminPrincipal, @Req() req: Request, @Body(reason) body: ReasonInput) {
    return this.admin.logoutAllPhotographers(admin, ip(req), body.reason);
  }

  // ---------- A-08 ----------

  @Get('audit')
  audit(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetId') targetId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('before') before?: string,
  ) {
    if (before && !/^\d+$/.test(before)) throw new BadRequestException({ code: 'validation_failed', message: 'Bad cursor.' });
    return this.admin.auditLog({ action, actorId, targetId, from, to, before });
  }

  @Get('audit/verify')
  @MinRole('super_admin')
  verifyAudit() {
    return this.admin.verifyAudit();
  }

  @Get('admins')
  @MinRole('super_admin')
  admins() {
    return this.admin.listAdmins();
  }
}
