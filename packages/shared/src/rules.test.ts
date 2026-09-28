import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCycle, annualSavingPercent, cycleAllowanceBytes, invoiceNumber, paymentReference, prorateUpgrade } from './billing';
import { downloadCapBytes, isAcceptedFile, isPreviewable } from './rules';

test('accepts RAW and rejects video', () => {
  assert.equal(isAcceptedFile('IMG_0001.CR3'), true);
  assert.equal(isAcceptedFile('clip.mp4'), false);
  assert.equal(isAcceptedFile('noextension'), false);
});

test('previews only JPG and PNG', () => {
  assert.equal(isPreviewable('a.JPEG'), true);
  assert.equal(isPreviewable('a.nef'), false);
});

test('cap is twice the gallery size', () => {
  assert.equal(downloadCapBytes(9_000_000_000n), 18_000_000_000n);
});

test('upgrade is prorated by days left and rounded up', () => {
  const cycleStart = new Date('2026-01-01T00:00:00Z');
  const cycleEnd = addCycle(cycleStart, 'annual');
  assert.equal(cycleEnd.toISOString(), '2027-01-01T00:00:00.000Z');
  // 183 of 365 days left (partial days count as a full day), 1000 EGP more per year: 501.4 rounds up.
  const now = new Date(cycleStart.getTime() + 182.5 * 86_400_000);
  assert.equal(prorateUpgrade({ newPriceEgp: 3000, oldPriceEgp: 2000, cycleStart, cycleEnd, now }), 502);
  assert.equal(prorateUpgrade({ newPriceEgp: 3000, oldPriceEgp: 2000, cycleStart, cycleEnd, now: cycleEnd }), 0);
});

test('monthly cycles keep the day of month, clamped to short months', () => {
  assert.equal(addCycle(new Date('2026-01-31T10:00:00Z'), 'monthly').toISOString(), '2026-02-28T10:00:00.000Z');
  assert.equal(addCycle(new Date('2026-03-15T10:00:00Z'), 'monthly').toISOString(), '2026-04-15T10:00:00.000Z');
});

test('monthly allowance is a twelfth of the annual tier', () => {
  assert.equal(cycleAllowanceBytes(1200n, 'monthly'), 100n);
  assert.equal(cycleAllowanceBytes(1200n, 'annual'), 1200n);
});

test('references avoid look-alike characters', () => {
  const ref = paymentReference(new Uint8Array([0, 1, 2, 3, 4, 255]));
  assert.match(ref, /^PHN-[2-9A-HJ-NP-Z]{6}$/);
  assert.equal(annualSavingPercent(100, 1000), 17);
  assert.equal(invoiceNumber(42), 'INV-000042');
});
