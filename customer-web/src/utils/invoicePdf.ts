/* ══════════════════════════════════════════════════════════════════════════════
   ESTIMATE → REAL PDF

   The customer's "Download" used to hand back a .html file. It opened fine in a
   browser, but it is not what anyone means by an invoice: it cannot be attached to
   a WhatsApp message as a document, most phones open it as a web page rather than
   a file, and a transport office asking for the estimate will not accept it. This
   produces an actual A4 .pdf.

   WHY jsPDF AND NOT html2canvas. The obvious route — screenshot the existing HTML
   and paste the image into a PDF — produces a document whose text cannot be
   selected, searched or copied, blurs on zoom, and weighs several megabytes. Every
   figure here is drawn as real text, so the PDF is a few tens of kilobytes and the
   order number can be copied straight out of it.

   WHY IT IS LAZY-LOADED. jsPDF is far larger than this storefront's entire main
   bundle. `import()` keeps it out of the initial download, so a visitor who never
   presses Download never pays for it — the same reasoning behind loading analytics
   after `load`.

   SINGLE SOURCE OF TRUTH. Lines and totals come from buildInvoiceLines /
   buildInvoiceTotals in invoiceTemplate.ts — the very functions the printed HTML
   uses. The PDF cannot drift from the paper document, because neither one computes
   its own money.
   ════════════════════════════════════════════════════════════════════════════ */

import {
  buildInvoiceLines,
  buildInvoiceTotals,
  formatInvoiceDate,
  formatMoney,
  INVOICE_TERMS,
  DEFAULT_INVOICE_BRANDING,
  type EstimateOrder,
  type InvoiceBranding
} from './invoiceTemplate';

/* ── Page geometry (mm, A4 portrait) ─────────────────────────────────────────── */

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 10;
const INNER_W = PAGE_W - MARGIN * 2;

/** Pure black on white: an estimate is a document, not a web page. */
const BLACK: [number, number, number] = [0, 0, 0];

const EM_DASH = '—';

/* ── Small drawing helpers ───────────────────────────────────────────────────── */

type Doc = import('jspdf').jsPDF;

const text = (
  doc: Doc,
  value: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right' } = {}
) => {
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size ?? 8);
  doc.text(value, x, y, { align: opts.align ?? 'left' });
};

/**
 * Draws wrapped text and returns the y coordinate just past it, so callers can
 * stack blocks without guessing how many lines an address took.
 */
const wrapped = (
  doc: Doc,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  opts: { size?: number; bold?: boolean; lineHeight?: number } = {}
): number => {
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size ?? 8);
  const lh = opts.lineHeight ?? (opts.size ?? 8) * 0.42;
  const lines = doc.splitTextToSize(value, maxWidth) as string[];
  lines.forEach((line, i) => doc.text(line, x, y + i * lh));
  return y + lines.length * lh;
};

/* ── Document ────────────────────────────────────────────────────────────────── */

/**
 * Builds the estimate as a PDF and returns it as a Blob.
 *
 * Mirrors the printed HTML section for section: order strip, letterhead, Deliver
 * To / Bank Details, collection details, the ledger, totals, terms and signatory.
 */
export const buildEstimatePdfBlob = async (
  order: EstimateOrder,
  branding: InvoiceBranding = DEFAULT_INVOICE_BRANDING
): Promise<Blob> => {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  const autoTable = autoTableModule.default;

  const { company, bank } = branding;
  const lines = buildInvoiceLines(order.items || []);
  const totals = buildInvoiceTotals(order, lines);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setTextColor(...BLACK);
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.4);

  const orderNum = order.orderNumber || EM_DASH;
  const orderDate = formatInvoiceDate(order.placedAtUtc || order.placedAt || order.date);

  let y = MARGIN;

  /* ── 1. Order No | ESTIMATE | Date ───────────────────────────────────────── */
  const stripH = 7;
  doc.rect(MARGIN, y, INNER_W, stripH);
  doc.line(MARGIN + INNER_W / 3, y, MARGIN + INNER_W / 3, y + stripH);
  doc.line(MARGIN + (INNER_W * 2) / 3, y, MARGIN + (INNER_W * 2) / 3, y + stripH);

  text(doc, `Order No : ${orderNum}`, MARGIN + 2.5, y + 4.6, { bold: true });
  text(doc, 'ESTIMATE', PAGE_W / 2, y + 4.9, { bold: true, size: 11, align: 'center' });
  text(doc, `Date : ${orderDate}`, PAGE_W - MARGIN - 2.5, y + 4.6, { bold: true, align: 'right' });
  y += stripH;

  /* ── 2. Letterhead ───────────────────────────────────────────────────────── */
  const headTop = y;
  text(doc, company.name, PAGE_W / 2, y + 6.5, { bold: true, size: 15, align: 'center' });

  // Each line is centred individually, so the address is split FIRST and drawn once.
  // (Measuring it with wrapped() would draw it as a side effect and leave a second,
  // left-aligned copy in the file — invisible under a white patch, but still there
  // for anyone who selects or copies the text.)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let ay = y + 11;
  (doc.splitTextToSize(company.address, INNER_W - 12) as string[]).forEach(l => {
    doc.text(l, PAGE_W / 2, ay, { align: 'center' });
    ay += 3.6;
  });
  text(doc, `Mobile : ${company.mobile}`, PAGE_W / 2 - 34, ay + 0.6, { bold: true, align: 'center' });
  text(doc, `E-mail : ${company.email}`, PAGE_W / 2 + 34, ay + 0.6, { bold: true, align: 'center' });
  y = ay + 3.4;
  doc.rect(MARGIN, headTop, INNER_W, y - headTop);

  /* ── 3. Deliver To | Bank Details ────────────────────────────────────────── */
  const addr = order.shippingAddress;
  const hasStructured = Boolean(
    addr && (addr.addressLine1 || addr.city || addr.postalCode || addr.pincode)
  );
  const summaryParts = String(order.deliveryAddressSummary || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  const deliverLines = (
    hasStructured
      ? [
          addr?.addressLine1,
          addr?.addressLine2,
          [addr?.city, addr?.state].filter(Boolean).join(', '),
          addr?.postalCode || addr?.pincode
            ? `Pincode: ${addr?.postalCode || addr?.pincode}`
            : ''
        ]
      : [summaryParts.slice(order.customerName ? 0 : 1).join(', ')]
  ).filter(Boolean) as string[];

  // Never invent a recipient — an unknown one is left off the paper.
  const customerName =
    order.customerName ||
    addr?.fullName ||
    (!hasStructured ? summaryParts[0] : '') ||
    'Valued Customer';
  const phone = order.customerPhone || addr?.phone || '';

  const boxTop = y;
  const splitX = MARGIN + INNER_W * 0.58;

  let ly = y + 4.5;
  text(doc, 'Deliver To', MARGIN + 2.5, ly, { bold: true, size: 8 });
  doc.line(MARGIN + 2.5, ly + 0.7, MARGIN + 2.5 + doc.getTextWidth('Deliver To'), ly + 0.7);
  ly += 4.6;
  text(doc, customerName, MARGIN + 2.5, ly, { bold: true });
  ly += 3.8;
  deliverLines.forEach(l => {
    ly = wrapped(doc, l, MARGIN + 2.5, ly, splitX - MARGIN - 6, { size: 8, lineHeight: 3.8 });
  });
  if (phone) {
    text(doc, `Phone : ${phone}`, MARGIN + 2.5, ly);
    ly += 3.8;
  }

  let ry = y + 4.5;
  text(doc, 'Bank Details', splitX + 2.5, ry, { bold: true, size: 8 });
  doc.line(splitX + 2.5, ry + 0.7, splitX + 2.5 + doc.getTextWidth('Bank Details'), ry + 0.7);
  ry += 4.6;
  ([
    ['Bank', bank.bankName],
    ['A/c Name', bank.accountName],
    ['A/c No', bank.accountNumber],
    ['IFSC', bank.ifscCode]
  ] as const).forEach(([k, v]) => {
    text(doc, `${k} :`, splitX + 2.5, ry, { bold: true, size: 7.5 });
    ry = wrapped(doc, String(v), splitX + 21, ry, PAGE_W - MARGIN - splitX - 24, {
      size: 7.5,
      bold: true,
      lineHeight: 3.4
    });
    ry += 0.2;
  });

  y = Math.max(ly, ry) + 1.5;
  doc.rect(MARGIN, boxTop, INNER_W, y - boxTop);
  doc.line(splitX, boxTop, splitX, y);

  /* ── 3b. Collection details (only once a carrier holds the parcel) ───────── */
  const carrier = (order.carrierName || '').trim();
  const lrNumber = (order.trackingNumber || '').trim();
  const carrierPhone = (order.carrierPhone || '').trim();
  const carrierAddress = (order.carrierAddress || '').trim();

  const collectItems = ([
    ['Transport', carrier],
    ['LR / Waybill', lrNumber],
    ['Office Phone', carrierPhone]
  ] as const).filter(([, v]) => Boolean(v));

  if (collectItems.length > 0 || carrierAddress) {
    const cTop = y;
    let cy = y + 4.5;
    text(doc, 'Collection Details', MARGIN + 2.5, cy, { bold: true, size: 8 });
    doc.line(
      MARGIN + 2.5,
      cy + 0.7,
      MARGIN + 2.5 + doc.getTextWidth('Collection Details'),
      cy + 0.7
    );
    cy += 4.4;

    if (collectItems.length > 0) {
      cy = wrapped(
        doc,
        collectItems.map(([k, v]) => `${k} : ${v}`).join('     '),
        MARGIN + 2.5,
        cy,
        INNER_W - 5,
        { size: 7.5, lineHeight: 3.6 }
      );
    }
    if (carrierAddress) {
      cy = wrapped(doc, `Transport Office : ${carrierAddress}`, MARGIN + 2.5, cy, INNER_W - 5, {
        size: 7.5,
        lineHeight: 3.6
      });
    }
    // The note describes only what this block actually printed.
    const note = [
      lrNumber ? 'Quote the LR / waybill number at the transport office to collect this parcel.' : '',
      'Freight is payable by the customer directly to the transport company on collection.'
    ]
      .filter(Boolean)
      .join(' ');
    cy = wrapped(doc, note, MARGIN + 2.5, cy + 0.6, INNER_W - 5, { size: 6.8, lineHeight: 3 });

    y = cy + 1.5;
    doc.rect(MARGIN, cTop, INNER_W, y - cTop);
  }

  /* ── 4. Ledger ───────────────────────────────────────────────────────────── */
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: MARGIN },
    theme: 'grid',
    tableLineColor: BLACK,
    tableLineWidth: 0.4,
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 1.2, right: 1.4, bottom: 1.2, left: 1.4 },
      textColor: BLACK,
      lineColor: BLACK,
      lineWidth: 0.1,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: false as unknown as undefined,
      textColor: BLACK,
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: { top: 0, right: 0.1, bottom: 0.4, left: 0 }
    },
    head: [
      ['S.No', 'Code', 'Product Name', 'Qty', 'Rate/Qty (MRP)', 'Discount %', 'Final Rate', 'Amount']
    ],
    body:
      lines.length === 0
        ? [[{ content: 'No items recorded for this order.', colSpan: 8, styles: { halign: 'center', fontStyle: 'bold', cellPadding: 6 } }]]
        : lines.map((l, i) => [
            String(i + 1),
            l.code,
            l.name,
            String(l.qty),
            l.rate === null ? EM_DASH : formatMoney(l.rate),
            l.discountPercent === null ? EM_DASH : `${l.discountPercent}%`,
            formatMoney(l.finalRate),
            formatMoney(l.amount)
          ]),
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 17, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 23, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 19, halign: 'right' },
      7: { cellWidth: 21, halign: 'right', fontStyle: 'bold' }
    }
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  /* ── 5. Totals ───────────────────────────────────────────────────────────── */
  const sumRows: Array<[string, string, boolean]> = [
    ['Subtotal', formatMoney(totals.subtotal), false]
  ];
  if (totals.discount > 0) sumRows.push(['Discount', formatMoney(totals.discount), false]);
  if (totals.packingCharge > 0) {
    sumRows.push([
      totals.packingChargePercent
        ? `Packing Charge ( ${totals.packingChargePercent}% )`
        : 'Packing Charge',
      formatMoney(totals.packingCharge),
      false
    ]);
  }
  if (totals.tax > 0) sumRows.push(['GST', formatMoney(totals.tax), false]);
  // Stated rather than hidden: if the server's grand total does not equal the parts,
  // the paper says so instead of quietly printing a figure that does not foot.
  if (totals.residual !== 0) {
    sumRows.push([totals.residual > 0 ? 'Other Charges' : 'Rounding', formatMoney(totals.residual), false]);
  }
  sumRows.push(['Overall Total', formatMoney(totals.overallTotal), true]);

  const rowH = 5.2;
  const sumH = rowH * sumRows.length;
  const leftH = 16;
  const blockH = Math.max(sumH, leftH);

  // Keep the totals whole: a grand total stranded alone on page two looks like a
  // different document.
  if (y + blockH + 30 > PAGE_H - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }

  const tTop = y;
  const tSplit = MARGIN + INNER_W * 0.52;
  text(doc, `Total Items : ${totals.totalItems}`, MARGIN + 3, y + 6, { bold: true, size: 8.5 });
  text(doc, `Total Qty : ${totals.totalQty}`, MARGIN + 3, y + 11.5, { bold: true, size: 8.5 });

  let sy = y;
  const valX = PAGE_W - MARGIN;
  const valColX = valX - 26;
  sumRows.forEach(([label, value, grand], i) => {
    if (grand) {
      doc.setLineWidth(0.4);
      doc.line(tSplit, sy, valX, sy);
      doc.setLineWidth(0.4);
    } else if (i > 0) {
      doc.setLineWidth(0.1);
      doc.line(tSplit, sy, valX, sy);
      doc.setLineWidth(0.4);
    }
    text(doc, label, valColX - 2, sy + rowH * 0.7, {
      bold: grand,
      size: grand ? 9.5 : 8,
      align: 'right'
    });
    text(doc, value, valX - 2, sy + rowH * 0.7, {
      bold: true,
      size: grand ? 9.5 : 8,
      align: 'right'
    });
    sy += rowH;
  });

  y = tTop + blockH;
  doc.rect(MARGIN, tTop, INNER_W, blockH);
  doc.line(tSplit, tTop, tSplit, y);
  doc.line(valColX, tTop, valColX, y);

  /* ── 6. Terms + signatory ────────────────────────────────────────────────── */
  const fTop = y;
  let fy = y + 4.4;
  text(doc, 'Terms & Conditions', MARGIN + 2.5, fy, { bold: true, size: 7.5 });
  doc.line(
    MARGIN + 2.5,
    fy + 0.7,
    MARGIN + 2.5 + doc.getTextWidth('Terms & Conditions'),
    fy + 0.7
  );
  fy += 3.8;
  INVOICE_TERMS.forEach(t => {
    fy = wrapped(doc, t, MARGIN + 2.5, fy, INNER_W * 0.62, { size: 6.8, lineHeight: 2.9 });
    fy += 0.6;
  });

  const signX = PAGE_W - MARGIN - 3;
  text(doc, `For ${company.name}`, signX, y + 5, { bold: true, size: 7.5, align: 'right' });
  const signLineY = Math.max(fy + 6, y + 24);
  doc.setLineWidth(0.1);
  doc.line(signX - 42, signLineY, signX, signLineY);
  doc.setLineWidth(0.4);
  text(doc, 'Authorized Signatory', signX, signLineY + 3.4, {
    bold: true,
    size: 7.5,
    align: 'right'
  });

  y = Math.max(fy, signLineY + 5) + 1.5;
  doc.rect(MARGIN, fTop, INNER_W, y - fTop);

  // Named so a phone's Downloads list and a WhatsApp attachment both read sensibly.
  doc.setProperties({
    title: `Estimate ${orderNum}`,
    subject: `Estimate for order ${orderNum}`,
    author: company.name,
    creator: company.name
  });

  return doc.output('blob');
};
