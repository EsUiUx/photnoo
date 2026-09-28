import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { type ListOrdersQuery, listOrdersQuerySchema, type UpdateOrderInput, updateOrderSchema } from '@photnoo/shared';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdersService } from './orders.service';

/** The photographer's store and print orders. Every query is scoped to the signed-in photographer. */
@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentAuth() auth: AccessClaims, @Query(new ZodValidationPipe(listOrdersQuerySchema)) query: ListOrdersQuery) {
    return this.orders.list(auth.photographerId, query);
  }

  @Get(':id')
  get(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(auth.photographerId, id);
  }

  /** Mark paid or unpaid, and move the status. */
  @Patch(':id')
  update(
    @CurrentAuth() auth: AccessClaims,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateOrderSchema)) body: UpdateOrderInput,
  ) {
    return this.orders.update(auth.photographerId, id, body);
  }
}
