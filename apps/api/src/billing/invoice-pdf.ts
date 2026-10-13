import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { invoiceNumber } from '@photnoo/shared';
import PDFDocument from 'pdfkit';

export type InvoiceData = {
  number: number;
  issuedAt: Date;
  seller: { name: string; address: string; taxId?: string; commercialRegister?: string; email: string };
  buyer: { name: string; studioName: string | null; email: string; phone: string };
  line: { description: string; periodStart: Date; periodEnd: Date };
  reference: string;
  method: string;
  totalEgp: number;
  vatEgp: number;
  vatRate: number;
};

const fonts = (() => {
  const bundled = join(__dirname, '..', 'fonts');
  const dir = existsSync(bundled) ? bundled : join(dirname(require.resolve('@fontsource/ibm-plex-sans-arabic/package.json')), 'files');
  const file = (subset: 'latin' | 'arabic', weight: 400 | 600) => join(dir, `ibm-plex-sans-arabic-${subset}-${weight}-normal.woff`);
  return { latin: file('latin', 400), latinBold: file('latin', 600), arabic: file('arabic', 400), arabicBold: file('arabic', 600) };
})();

const ARABIC = /[؀-ۿ]/;
const GREEN = '#344e41';
const MUTED = '#6b7280';

function money(value: number): string {
  return `EGP ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function day(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Cairo' }).format(date);
}

/**
 * PRD B-04 invoice as a one-page A4 PDF, in English with Arabic names rendered correctly.
 * pdfkit shapes Arabic letters but lays words out left to right, so Arabic strings are drawn
 * with the Arabic font and their word order reversed.
 */
export function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: invoiceNumber(data.number), Author: data.seller.name } });
  doc.registerFont('latin', fonts.latin);
  doc.registerFont('latin-bold', fonts.latinBold);
  doc.registerFont('arabic', fonts.arabic);
  doc.registerFont('arabic-bold', fonts.arabicBold);

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const write = (text: string, options: { bold?: boolean; size?: number; color?: string; x?: number; y?: number; width?: number; align?: 'left' | 'right' } = {}) => {
    const arabic = ARABIC.test(text);
    doc
      .font(`${arabic ? 'arabic' : 'latin'}${options.bold ? '-bold' : ''}`)
      .fontSize(options.size ?? 10)
      .fillColor(options.color ?? '#141b34');
    const value = arabic ? text.split(/\s+/).reverse().join(' ') : text;
    const layout = { width: options.width, align: options.align, ...(arabic ? { features: ['rtla' as const] } : {}) };
    if (options.x !== undefined && options.y !== undefined) doc.text(value, options.x, options.y, layout);
    else doc.text(value, layout);
  };

  const left = 56;
  const right = doc.page.width - 56;
  const width = right - left;

  // Header
  write('PHOTNOO', { bold: true, size: 22, color: GREEN, x: left, y: 56 });
  write('Invoice', { bold: true, size: 22, x: left, y: 56, width, align: 'right' });
  write(invoiceNumber(data.number), { size: 11, color: MUTED, x: left, y: 86, width, align: 'right' });
  write(`Issued ${day(data.issuedAt)}`, { size: 11, color: MUTED, x: left, y: 102, width, align: 'right' });

  // Parties
  const top = 150;
  write('From', { bold: true, size: 10, color: MUTED, x: left, y: top });
  doc.moveDown(0.2);
  write(data.seller.name, { bold: true, size: 11 });
  write(data.seller.address);
  if (data.seller.taxId) write(`Tax ID: ${data.seller.taxId}`);
  if (data.seller.commercialRegister) write(`Commercial register: ${data.seller.commercialRegister}`);
  write(data.seller.email);

  const buyerX = left + width / 2 + 20;
  write('Billed to', { bold: true, size: 10, color: MUTED, x: buyerX, y: top });
  doc.moveDown(0.2);
  write(data.buyer.name, { bold: true, size: 11 });
  if (data.buyer.studioName) write(data.buyer.studioName);
  write(data.buyer.email);
  write(data.buyer.phone);

  // Line items
  let y = 290;
  doc.rect(left, y, width, 26).fill('#e7f0e8');
  write('Description', { bold: true, x: left + 10, y: y + 8 });
  write('Amount', { bold: true, x: left, y: y + 8, width: width - 10, align: 'right' });
  y += 38;
  const net = data.totalEgp - data.vatEgp;
  write(data.line.description, { size: 11, x: left + 10, y });
  write(money(net), { size: 11, x: left, y, width: width - 10, align: 'right' });
  write(`Service period ${day(data.line.periodStart)} – ${day(data.line.periodEnd)}`, { color: MUTED, x: left + 10, y: y + 16 });

  y += 56;
  doc.moveTo(left, y).lineTo(right, y).strokeColor('#dedede').stroke();
  y += 12;
  const totals: Array<[string, string, boolean]> = [
    ['Subtotal', money(net), false],
    [`VAT (${Math.round(data.vatRate * 100)}%)`, money(data.vatEgp), false],
    ['Total paid', money(data.totalEgp), true],
  ];
  for (const [label, value, bold] of totals) {
    write(label, { bold, size: bold ? 12 : 10, x: left + width / 2, y });
    write(value, { bold, size: bold ? 12 : 10, x: left, y, width: width - 10, align: 'right' });
    y += bold ? 22 : 18;
  }

  y += 20;
  write('Payment', { bold: true, color: MUTED, x: left, y });
  write(`Reference ${data.reference} · ${data.method}`, { x: left, y: y + 16 });

  write('Thank you for delivering with Photnoo.', { color: MUTED, x: left, y: doc.page.height - 90, width, align: 'left' });

  doc.end();
  return done;
}
