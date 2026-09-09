/* ══════════════════════════════════════════════════════════════════════════════
   SIVAKASI PHYSICAL ESTIMATE — shared printable document
   Faithful port of the admin ERP builder
   (admin-web/src/pages/erp/ErpSalesAndOrdersModule.tsx → buildOrderInvoiceHtml)
   so the storefront's "Download Invoice" prints exactly the same paper the owner
   prints at the counter. Markup, class names and print CSS are kept byte-identical
   to the admin document; only the order-shape mapping is adapted to the
   storefront's normalized order view.

   Everything about the seller that gets printed lives in the two constants below.
   Matching system settings (Store.* / Payment.*, served by
   GET /api/v1/settings/public) override them at runtime via buildInvoiceBranding.
   ════════════════════════════════════════════════════════════════════════════ */

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c =>
      (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<string, string>)[c]
  );

export const INVOICE_COMPANY = {
  name: 'AADHI CRACKERS',
  address: '3/1233/A8, Naranapuram Main Road, Sivakasi - 626 189, Tamil Nadu.',
  mobile: '+91 94428 26566',
  email: 'support@aadhicrackers.com'
};

export const INVOICE_BANK = {
  bankName: 'AXIS BANK LTD',
  accountName: 'AADHI CRACKERS',
  accountNumber: '926020003006172',
  ifscCode: 'UTIB0000089'
};

/** Footer legal lines printed under the ledger. */
export const INVOICE_TERMS = [
  'Fireworks are packed and transported strictly as per The Explosives Act, 1884 and Explosive Rules, 2008 norms; our responsibility ceases once the goods are handed over to the carrier.',
  'Goods once sold are not returnable or exchangeable. Subject to Sivakasi jurisdiction.'
];

/** Sivakasi trade convention: catalogue MRP is ~5x the selling rate (i.e. 80% off).
    Used only as a fallback when the order line carries no real MRP / discount data. */
export const FALLBACK_MRP_MULTIPLIER = 5;

export interface InvoiceBranding {
  company: typeof INVOICE_COMPANY;
  bank: typeof INVOICE_BANK;
}

export const DEFAULT_INVOICE_BRANDING: InvoiceBranding = {
  company: INVOICE_COMPANY,
  bank: INVOICE_BANK
};

/** The slice of StorefrontSettings the estimate letterhead needs (all optional so
    the whole settings object can be handed over as-is). */
export interface InvoiceBrandingSource {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

/** Overlays the live storefront settings (when present) on the hard-coded letterhead. */
export const buildInvoiceBranding = (settings?: InvoiceBrandingSource | null): InvoiceBranding => {
  const pick = (value: string | undefined, fallback: string) => (value || '').trim() || fallback;
  const s = settings || {};
  return {
    company: {
      name: pick(s.storeName, INVOICE_COMPANY.name),
      address: pick(s.storeAddress, INVOICE_COMPANY.address),
      mobile: pick(s.storePhone, INVOICE_COMPANY.mobile),
      email: pick(s.storeEmail, INVOICE_COMPANY.email)
    },
    bank: {
      bankName: pick(s.bankName, INVOICE_BANK.bankName),
      accountName: pick(s.accountName, INVOICE_BANK.accountName),
      accountNumber: pick(s.accountNumber, INVOICE_BANK.accountNumber),
      ifscCode: pick(s.ifscCode, INVOICE_BANK.ifscCode)
    }
  };
};

/* ── Order shape ──────────────────────────────────────────────────────────────
   Deliberately permissive: the storefront normalizes orders slightly differently
   per screen (and the API has grown aliases), so every field is optional and the
   builder reads each value through its known aliases.
   ─────────────────────────────────────────────────────────────────────────── */

export interface EstimateOrderItem {
  productName?: string;
  name?: string;
  sku?: string;
  code?: string;
  quantity?: number;
  unitPrice?: number;
  price?: number;
  /** Catalogue rate before discount, when the API carries one. */
  mrp?: number;
  compareAtPrice?: number;
  /** Line-level discount in ₹ (whole line, not per unit). */
  discount?: number;
  discountPercent?: number;
  discountPercentage?: number;
  lineTotal?: number;
}

export interface EstimateAddress {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  pincode?: string;
}

export interface EstimateOrder {
  orderNumber?: string;
  /** Any of these is accepted as the estimate date. */
  placedAt?: string;
  placedAtUtc?: string;
  date?: string;
  customerName?: string;
  customerPhone?: string;
  shippingAddress?: EstimateAddress | null;
  items?: EstimateOrderItem[];
  itemsSubtotal?: number;
  subtotal?: number;
  discount?: number;
  packingCharges?: number;
  packingCharge?: number;
  packingChargePercent?: number;
  tax?: number;
  grandTotal?: number;
  totalAmount?: number;
  total?: number;
}

const num = (...values: unknown[]): number => {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return 0;
};

const formatMoney = (n?: number): string =>
  (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** dd-MM-yyyy, the format printed on the paper estimate. */
const formatInvoiceDate = (dateStr?: string): string => {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

interface InvoiceLine {
  code: string;
  name: string;
  qty: number;
  /** Rate per qty before discount (MRP). */
  rate: number;
  discountPercent: number;
  finalRate: number;
  amount: number;
}

const buildInvoiceLines = (items: EstimateOrderItem[]): InvoiceLine[] =>
  (items || []).map((it, i) => {
    const qty = Number(it.quantity) || 1;
    const amount = num(it.lineTotal) || num(it.unitPrice, it.price) * qty;
    const finalRate = num(it.unitPrice, it.price) || (qty > 0 ? amount / qty : 0);
    const lineDiscount = num(it.discount);

    // Prefer real data: an explicit MRP, else the per-unit discount the order carries,
    // else the shop's standard 80%-off catalogue convention.
    let rate = num(it.mrp, it.compareAtPrice);
    if (!(rate > finalRate)) {
      rate = lineDiscount > 0 ? finalRate + lineDiscount / qty : finalRate * FALLBACK_MRP_MULTIPLIER;
    }

    const explicitPercent = num(it.discountPercent, it.discountPercentage);
    const discountPercent =
      explicitPercent > 0 ? explicitPercent : rate > 0 ? ((rate - finalRate) / rate) * 100 : 0;

    return {
      code: it.sku || it.code || `AC-${String(i + 1).padStart(2, '0')}`,
      name: it.productName || it.name || '—',
      qty,
      rate,
      discountPercent: Math.max(0, discountPercent),
      finalRate,
      amount
    };
  });

interface InvoiceTotals {
  subtotal: number;
  discount: number;
  packingCharge: number;
  packingChargePercent?: number;
  tax: number;
  overallTotal: number;
  totalItems: number;
  totalQty: number;
}

const buildInvoiceTotals = (order: EstimateOrder, lines: InvoiceLine[]): InvoiceTotals => {
  const lineSum = lines.reduce((s, l) => s + l.amount, 0);
  const declaredSubtotal = num(order.itemsSubtotal, order.subtotal);
  const subtotal = declaredSubtotal > 0 ? declaredSubtotal : lineSum;
  const discount = num(order.discount);

  const percent = num(order.packingChargePercent);
  const packingChargePercent = percent > 0 ? percent : undefined;
  const declaredPacking = num(order.packingCharges, order.packingCharge);
  const packingCharge =
    declaredPacking > 0
      ? declaredPacking
      : packingChargePercent
      ? (subtotal * packingChargePercent) / 100
      : 0;

  const tax = num(order.tax);

  // No delivery term: the lorry freight is paid by the customer directly to the
  // transport company on collection and never appears on the store's estimate.
  const computed = Math.max(0, subtotal - discount) + packingCharge + tax;
  const declaredTotal = num(order.grandTotal, order.totalAmount, order.total);
  const overallTotal = declaredTotal > 0 ? declaredTotal : computed;

  return {
    subtotal,
    discount,
    packingCharge,
    packingChargePercent,
    tax,
    overallTotal,
    totalItems: lines.length,
    totalQty: lines.reduce((s, l) => s + l.qty, 0)
  };
};

/** The owner's A4 paper estimate, print-optimised (pure black on white, bordered ledger).
    Identical document to the one the admin ERP prints for the same order. */
export const buildEstimateHtml = (
  order: EstimateOrder,
  branding: InvoiceBranding = DEFAULT_INVOICE_BRANDING
): string => {
  const { company, bank } = branding;
  const lines = buildInvoiceLines(order.items || []);
  const totals = buildInvoiceTotals(order, lines);

  const orderNum = order.orderNumber || '—';
  const orderDate = formatInvoiceDate(order.placedAtUtc || order.placedAt || order.date);

  const addr = order.shippingAddress;
  const deliverToLines = [
    addr?.addressLine1,
    addr?.addressLine2,
    [addr?.city, addr?.state].filter(Boolean).join(', '),
    addr?.postalCode || addr?.pincode ? `Pincode: ${addr?.postalCode || addr?.pincode}` : ''
  ]
    .filter(Boolean)
    .map(l => `<div>${escapeHtml(l)}</div>`)
    .join('');

  const customerName = order.customerName || addr?.fullName || 'Valued Customer';
  const phone = order.customerPhone || addr?.phone || '';

  const rows =
    lines.length === 0
      ? '<tr><td colspan="8" style="text-align:center;padding:22px 10px;font-weight:bold;">No items recorded for this order.</td></tr>'
      : lines
          .map(
            (l, i) => `
          <tr>
            <td class="c-sno">${i + 1}</td>
            <td class="c-code">${escapeHtml(l.code)}</td>
            <td class="c-name">${escapeHtml(l.name)}</td>
            <td class="c-qty">${escapeHtml(l.qty)}</td>
            <td class="c-rate">${escapeHtml(formatMoney(l.rate))}</td>
            <td class="c-disc">${escapeHtml(l.discountPercent.toFixed(l.discountPercent % 1 === 0 ? 0 : 2))}%</td>
            <td class="c-final">${escapeHtml(formatMoney(l.finalRate))}</td>
            <td class="c-amt">${escapeHtml(formatMoney(l.amount))}</td>
          </tr>`
          )
          .join('');

  const sumRow = (label: string, value: string, cls = '') =>
    `<tr${cls ? ` class="${cls}"` : ''}><td class="sum-k">${escapeHtml(label)}</td><td class="sum-v">${escapeHtml(
      value
    )}</td></tr>`;

  const totalRows = [
    sumRow('Subtotal', formatMoney(totals.subtotal)),
    sumRow('Discount', totals.discount > 0 ? `- ${formatMoney(totals.discount)}` : formatMoney(0)),
    sumRow(
      totals.packingChargePercent
        ? `Packing Charge ( ${totals.packingChargePercent}% )`
        : 'Packing Charge',
      formatMoney(totals.packingCharge)
    ),
    totals.tax > 0 ? sumRow('GST', formatMoney(totals.tax)) : '',
    sumRow('Overall Total', formatMoney(totals.overallTotal), 'grand')
  ].join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Estimate_${escapeHtml(orderNum)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.35; padding: 10px; }
  .sheet { width: 100%; max-width: 190mm; margin: 0 auto; border: 1.5px solid #000; }
  .head { display: flex; border-bottom: 1.5px solid #000; }
  .head > div { padding: 5px 8px; }
  .head-left { width: 33.33%; font-weight: bold; }
  .head-mid { width: 33.34%; text-align: center; font-weight: bold; font-size: 14px; letter-spacing: 2px;
              border-left: 1.5px solid #000; border-right: 1.5px solid #000; }
  .head-right { width: 33.33%; text-align: right; font-weight: bold; }
  .company { text-align: center; padding: 7px 10px 8px; border-bottom: 1.5px solid #000; }
  .company-name { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
  .company-addr { margin-top: 2px; }
  .company-contact { margin-top: 3px; font-weight: bold; }
  .company-contact span { margin: 0 12px; }
  .boxes { display: flex; border-bottom: 1.5px solid #000; }
  .box { padding: 6px 8px; line-height: 1.5; }
  .box-left { width: 58%; border-right: 1.5px solid #000; }
  .box-right { width: 42%; }
  .box-title { font-weight: bold; text-decoration: underline; margin-bottom: 3px; }
  .box-name { font-weight: bold; }
  table.bank { width: 100%; border-collapse: collapse; }
  table.bank td { padding: 1px 0; vertical-align: top; font-size: 10.5px; }
  table.bank td.k { font-weight: bold; width: 76px; white-space: nowrap; }
  table.bank td.c { width: 10px; text-align: center; font-weight: bold; }
  table.bank td.v { font-weight: bold; letter-spacing: 0.2px; }
  table.ledger { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.ledger thead { display: table-header-group; }
  table.ledger th { border-bottom: 1.5px solid #000; border-right: 1px solid #000; padding: 5px 3px;
                    font-weight: bold; text-align: center; }
  table.ledger td { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 3.5px 5px; }
  table.ledger th:last-child, table.ledger td:last-child { border-right: none; }
  table.ledger tr { page-break-inside: avoid; }
  .c-sno { width: 32px; text-align: center; }
  .c-code { width: 68px; text-align: center; }
  .c-name { text-align: left; }
  .c-qty { width: 36px; text-align: center; font-weight: bold; }
  .c-rate { width: 84px; text-align: right; }
  .c-disc { width: 68px; text-align: right; }
  .c-final { width: 72px; text-align: right; }
  .c-amt { width: 80px; text-align: right; font-weight: bold; }
  .totals { display: flex; border-bottom: 1.5px solid #000; page-break-inside: avoid; }
  .totals-left { width: 52%; border-right: 1.5px solid #000; padding: 7px 9px; font-weight: bold; line-height: 1.9; }
  .totals-right { width: 48%; }
  table.sum { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.sum td { padding: 3.5px 9px; border-bottom: 1px solid #000; }
  table.sum tr:last-child td { border-bottom: none; }
  td.sum-k { text-align: right; }
  td.sum-v { width: 98px; text-align: right; font-weight: bold; border-left: 1px solid #000; }
  table.sum tr.grand td { font-weight: bold; font-size: 12.5px; border-top: 1.5px solid #000; }
  .foot { display: flex; padding: 8px 9px; font-size: 9.5px; line-height: 1.5; page-break-inside: avoid; }
  .foot-terms { width: 63%; padding-right: 12px; }
  .foot-terms .t { font-weight: bold; text-decoration: underline; margin-bottom: 2px; }
  .foot-sign { width: 37%; text-align: right; display: flex; flex-direction: column; justify-content: space-between; }
  .sign-for { font-weight: bold; }
  .sign-space { height: 48px; }
  .sign-line { border-top: 1px solid #000; padding-top: 3px; font-weight: bold; }
  @media print { body { padding: 0; } .sheet { max-width: 100%; } }
</style>
</head>
<body>
  <div class="sheet">
    <!-- 1. Order No | ESTIMATE | Date -->
    <div class="head">
      <div class="head-left">Order No : ${escapeHtml(orderNum)}</div>
      <div class="head-mid">ESTIMATE</div>
      <div class="head-right">Date : ${escapeHtml(orderDate)}</div>
    </div>

    <!-- 2. Company letterhead -->
    <div class="company">
      <div class="company-name">${escapeHtml(company.name)}</div>
      <div class="company-addr">${escapeHtml(company.address)}</div>
      <div class="company-contact">
        <span>Mobile : ${escapeHtml(company.mobile)}</span>
        <span>E-mail : ${escapeHtml(company.email)}</span>
      </div>
    </div>

    <!-- 3. Deliver To | Bank Details -->
    <div class="boxes">
      <div class="box box-left">
        <div class="box-title">Deliver To</div>
        <div class="box-name">${escapeHtml(customerName)}</div>
        ${deliverToLines || '<div>Sivakasi, Tamil Nadu</div>'}
        ${phone ? `<div>Phone : ${escapeHtml(phone)}</div>` : ''}
      </div>
      <div class="box box-right">
        <div class="box-title">Bank Details</div>
        <table class="bank">
          <tr><td class="k">Bank</td><td class="c">:</td><td class="v">${escapeHtml(bank.bankName)}</td></tr>
          <tr><td class="k">A/c Name</td><td class="c">:</td><td class="v">${escapeHtml(bank.accountName)}</td></tr>
          <tr><td class="k">A/c No</td><td class="c">:</td><td class="v">${escapeHtml(bank.accountNumber)}</td></tr>
          <tr><td class="k">IFSC</td><td class="c">:</td><td class="v">${escapeHtml(bank.ifscCode)}</td></tr>
        </table>
      </div>
    </div>

    <!-- 4. Ledger -->
    <table class="ledger">
      <thead>
        <tr>
          <th class="c-sno">S.No</th>
          <th class="c-code">Code</th>
          <th class="c-name">Product Name</th>
          <th class="c-qty">Qty</th>
          <th class="c-rate">Rate/Qty (MRP)</th>
          <th class="c-disc">Discount %</th>
          <th class="c-final">Final Rate</th>
          <th class="c-amt">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <!-- 5. Totals -->
    <div class="totals">
      <div class="totals-left">
        <div>Total Items : ${escapeHtml(totals.totalItems)}</div>
        <div>Total Qty : ${escapeHtml(totals.totalQty)}</div>
      </div>
      <div class="totals-right">
        <table class="sum">
          ${totalRows}
        </table>
      </div>
    </div>

    <!-- 6. Terms + signatory -->
    <div class="foot">
      <div class="foot-terms">
        <div class="t">Terms &amp; Conditions</div>
        ${INVOICE_TERMS.map(t => `<div>${escapeHtml(t)}</div>`).join('')}
      </div>
      <div class="foot-sign">
        <div class="sign-for">For ${escapeHtml(company.name)}</div>
        <div class="sign-space"></div>
        <div class="sign-line">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
};
