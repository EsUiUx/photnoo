import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { invoiceNumber } from '@photnoo/shared';
import { AppModule } from '../app.module';
import { BillingService, egp, planLabel } from '../billing/billing.service';
import { PrismaService } from '../prisma/prisma.service';

const GB = 1024 ** 3;

/**
 * Placeholder catalogue (PRD B-01 steps) until the owner sets real prices in the admin app.
 * Annual costs ten months: two months free.
 */
const PLACEHOLDER_PLANS: Array<{ tier: string; gb: number; monthlyEgp: number }> = [
  { tier: '100GB', gb: 100, monthlyEgp: 20 },
  { tier: '250GB', gb: 250, monthlyEgp: 80 },
  { tier: '500GB', gb: 500, monthlyEgp: 150 },
  { tier: '1TB', gb: 1024, monthlyEgp: 250 },
  { tier: '2TB', gb: 2048, monthlyEgp: 450 },
];

/**
 * Billing operations until the admin app exists (PRD A-02, A-04).
 *   node dist/cli/billing.js seed-plans
 *   node dist/cli/billing.js payments
 *   node dist/cli/billing.js approve <paymentId>
 *   node dist/cli/billing.js reject <paymentId> "<reason>"
 */
async function main(): Promise<void> {
  const [command, id, ...rest] = process.argv.slice(2);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const billing = app.get(BillingService);
    const prisma = app.get(PrismaService).client;

    if (command === 'seed-plans') {
      if ((await prisma.plan.count()) > 0) {
        console.log('Plans already exist; nothing changed.');
        return;
      }
      await prisma.plan.createMany({
        data: PLACEHOLDER_PLANS.flatMap((p) => [
          { tier: p.tier, allowanceBytes: BigInt(p.gb * GB), cycle: 'monthly' as const, priceEgp: p.monthlyEgp },
          { tier: p.tier, allowanceBytes: BigInt(p.gb * GB), cycle: 'annual' as const, priceEgp: p.monthlyEgp * 10 },
        ]),
      });
      console.log(`Created ${PLACEHOLDER_PLANS.length * 2} placeholder plans.`);
    } else if (command === 'payments') {
      const pending = await prisma.payment.findMany({
        where: { status: { in: ['awaiting_proof', 'pending'] } },
        orderBy: { createdAt: 'asc' },
        include: { plan: true },
      });
      console.table(
        pending.map((p) => ({
          id: p.id,
          reference: p.reference,
          status: p.status,
          kind: p.kind,
          plan: `${planLabel(p.plan)} ${p.plan.cycle}`,
          amount: egp(p.amountEgp),
          declared: p.declaredAmountEgp ? egp(p.declaredAmountEgp) : null,
          method: p.method,
        })),
      );
    } else if (command === 'approve' && id) {
      const invoice = await billing.approve(id);
      console.log(`Approved. Invoice ${invoiceNumber(invoice.number)} issued.`);
    } else if (command === 'reject' && id && rest[0]) {
      await billing.reject(id, rest[0]);
      console.log('Rejected.');
    } else {
      console.log('Usage: billing seed-plans | payments | approve <id> | reject <id> "<reason>"');
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void main();
