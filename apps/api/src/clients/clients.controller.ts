import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { type ClientInput, clientSchema, type UpdateClientInput, updateClientSchema } from '@photnoo/shared';
import type { Client, Order } from '@photnoo/db';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ClientsService } from './clients.service';

const UUID = /^[0-9a-f-]{36}$/i;

function clientJson(c: Client) {
  return { id: c.id, name: c.name, phone: c.phone, email: c.email, notes: c.notes, createdAt: c.createdAt };
}

function orderJson(o: Order & { items: Array<{ quantity: number }> }) {
  return {
    id: o.id,
    number: o.number,
    kind: o.kind,
    status: o.status,
    itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
    totalEgp: Number(o.totalEgp),
    createdAt: o.createdAt,
  };
}

@Controller('clients')
@UseGuards(AuthGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  async list(@CurrentAuth() auth: AccessClaims, @Query('q') q?: string, @Query('cursor') cursor?: string) {
    const page = await this.clients.list(auth.photographerId, {
      q: q?.trim().slice(0, 80) || undefined,
      cursor: cursor && UUID.test(cursor) ? cursor : undefined,
    });
    return {
      items: page.items.map((item) => ({ ...clientJson(item.client), galleryCount: item.galleryCount, lastDeliveryAt: item.lastDeliveryAt })),
      nextCursor: page.nextCursor,
    };
  }

  @Get(':id')
  async detail(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    const { client, galleries, orderCount } = await this.clients.detail(auth.photographerId, id);
    return { ...clientJson(client), galleries, orderCount };
  }

  @Post()
  async create(@CurrentAuth() auth: AccessClaims, @Body(new ZodValidationPipe(clientSchema)) body: ClientInput) {
    return clientJson(await this.clients.create(auth.photographerId, body));
  }

  @Patch(':id')
  async update(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateClientSchema)) body: UpdateClientInput,
  ) {
    return clientJson(await this.clients.update(auth.photographerId, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.remove(auth.photographerId, id);
  }

  @Get(':id/orders')
  async orders(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string, @Query('page') page?: string) {
    const n = Math.min(10_000, Math.max(1, Number.parseInt(page ?? '1', 10) || 1));
    const result = await this.clients.orders(auth.photographerId, id, n);
    return { items: result.rows.map(orderJson), total: result.total, page: result.page, pageSize: result.pageSize };
  }
}
