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

/** Printed in the MRP / Discount columns of a line whose order data carries no
    genuine catalogue rate. The estimate states what it knows and nothing more. */
const NO_DATA = '\u2014'; // em dash

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
  /** Tax billed on this line in ₹. The order's tax is the sum of its lines'
      (OrderPricingService.Calculate), so this is a genuine source for the GST row
      when the payload carries lines but no order-level tax. */
  tax?: number;
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
  /** Single-line "Name, Line1, Line2, City, State, Pincode, Country" delivery address.
      Anonymous order tracking (GET /orders/track/{orderNumber} → OrderTrackingDto)
      returns ONLY this form — it carries no structured shippingAddress object — so the
      Deliver To block reads it when there is nothing better. */
  deliveryAddressSummary?: string;
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
  /** Catalogue rate per qty before discount (MRP).
   *  null when the order line carries no genuine MRP — printed as an em dash. */
  rate: number | null;
  /** null when no genuine discount is known — printed as an em dash. */
  discountPercent: number | null;
  finalRate: number;
  amount: number;
  /** Tax billed on the line (0 when the payload carries none). */
  tax: number;
}

/**
 * An MRP is printed ONLY when it can be read out of, or derived from, data the
 * order line actually carries:
 *   (a) an explicit MRP / compareAtPrice snapshot on the line;
 *   (b) a real rupee line discount  → MRP = charged rate + discount/qty;
 *   (c) a real discount percentage  → MRP = charged rate / (1 − pct/100).
 *
 * There is deliberately no fourth branch. Order items returned by GET /orders/{id}
 * are `{unitPrice, quantity, discount, tax, lineTotal}` and carry no MRP at all, so
 * the old `finalRate * 5` "Sivakasi convention" fallback fired on every single line
 * of every printed estimate: a ₹45 item whose true catalogue price is ₹60 printed
 * as "MRP 225.00 / Discount 80%" — a 275% overstatement on a document headed
 * "For AADHI CRACKERS / Authorized Signatory". A rate that cannot be sourced from
 * the order is now left blank; the customer still sees the rate actually charged
 * in the Final Rate column, and the line still foots to Amount.
 */
const buildInvoiceLines = (items: EstimateOrderItem[]): InvoiceLine[] =>
  (items || []).map((it, i) => {
    const qty = Number(it.quantity) || 1;
    const amount = num(it.lineTotal) || num(it.unitPrice, it.price) * qty;
    const finalRate = num(it.unitPrice, it.price) || (qty > 0 ? amount / qty : 0);

    const declaredMrp = num(it.mrp, it.compareAtPrice);
    const lineDiscount = num(it.discount);
    const explicitPercent = num(it.discountPercent, it.discountPercentage);

    let rate: number | null = null;
    if (declaredMrp > finalRate) {
      rate = declaredMrp;
    } else if (lineDiscount > 0 && qty > 0) {
      rate = finalRate + lineDiscount / qty;
    } else if (explicitPercent > 0 && explicitPercent < 100) {
      rate = finalRate / (1 - explicitPercent / 100);
    }

    let discountPercent: number | null = null;
    if (explicitPercent > 0) {
      discountPercent = explicitPercent;
    } else if (rate !== null && rate > 0) {
      discountPercent = ((rate - finalRate) / rate) * 100;
    }

    return {
      code: it.sku || it.code || `AC-${String(i + 1).padStart(2, '0')}`,
      name: it.productName || it.name || '—',
      qty,
      rate,
      discountPercent: discountPercent === null ? null : Math.max(0, discountPercent),
      finalRate,
      amount,
      tax: num(it.tax)
    };
  });

interface InvoiceTotals {
  subtotal: number;
  discount: number;
  packingCharge: number;
  packingChargePercent?: number;
  tax: number;
  /**
   * The amount actually billed minus the components this payload itemises.
   * 0 (to the paisa) whenever the source order carries its full breakdown — the
   * signed-in My Orders path and the checkout snapshot both foot exactly.
   *
   * Non-zero only when the document was produced from a payload that does NOT
   * itemise every billed component: anonymous order tracking returns the lines
   * and the grand total but no packing charge, no order discount and no order
   * tax. Rather than print "Packing Charge 0.00" — which would be a false
   * statement about a real billed charge — the difference is carried here and
   * printed as one honestly-labelled row.
   */
  residual: number;
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

  // The order's tax IS the sum of its lines' tax (OrderPricingService.Calculate),
  // so summing the lines is a genuine reading of the data, not an estimate.
  const tax = num(order.tax) || lines.reduce((s, l) => s + l.tax, 0);

  // No delivery term: the lorry freight is paid by the customer directly to the
  // transport company on collection and never appears on the store's estimate.
  const computed = Math.max(0, subtotal - discount) + packingCharge + tax;
  const declaredTotal = num(order.grandTotal, order.totalAmount, order.total);
  const overallTotal = declaredTotal > 0 ? declaredTotal : computed;

  // Rounded to the paisa so ordinary floating-point noise never trips the note.
  const residual = Math.round((overallTotal - computed) * 100) / 100;

  return {
    subtotal,
    discount,
    packingCharge,
    packingChargePercent,
    tax,
    residual,
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
  const hasStructuredAddress = Boolean(
    addr && (addr.addressLine1 || addr.city || addr.postalCode || addr.pincode)
  );

  // Order tracking hands back only "Name, Line1, Line2, City, State, Pincode, Country"
  // (Address.ToSingleLine). Split on the commas it joined with: the first segment is
  // the recipient's name, the rest is the address.
  const summaryParts = String(order.deliveryAddressSummary || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  const deliverToLines = (
    hasStructuredAddress
      ? [
          addr?.addressLine1,
          addr?.addressLine2,
          [addr?.city, addr?.state].filter(Boolean).join(', '),
          addr?.postalCode || addr?.pincode ? `Pincode: ${addr?.postalCode || addr?.pincode}` : ''
        ]
      : [summaryParts.slice(order.customerName ? 0 : 1).join(', ')]
  )
    .filter(Boolean)
    .map(l => `<div>${escapeHtml(l)}</div>`)
    .join('');

  // Never invent a recipient or an address: an unknown one is left off the paper
  // rather than filled in with the store's own city.
  const customerName =
    order.customerName || addr?.fullName || (!hasStructuredAddress ? summaryParts[0] : '') || 'Valued Customer';
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
            <td class="c-rate">${l.rate === null ? NO_DATA : escapeHtml(formatMoney(l.rate))}</td>
            <td class="c-disc">${
              l.discountPercent === null
                ? NO_DATA
                : `${escapeHtml(l.discountPercent.toFixed(l.discountPercent % 1 === 0 ? 0 : 2))}%`
            }</td>
            <td class="c-final">${escapeHtml(formatMoney(l.finalRate))}</td>
            <td class="c-amt">${escapeHtml(formatMoney(l.amount))}</td>
          </tr>`
          )
          .join('');

  // All 8 columns are kept for every line so the ledger stays aligned; a line with
  // no catalogue MRP shows an em dash in the MRP and Discount % columns, and this
  // note explains it rather than leaving the reader to guess.
  const missingMrpNote = lines.some(l => l.rate === null)
    ? `<div class="mrp-note">${NO_DATA} under Rate/Qty (MRP) / Discount % : no catalogue MRP is recorded against that item; the rate charged is shown under Final Rate.</div>`
    : '';

  const sumRow = (label: string, value: string, cls = '') =>
    `<tr${cls ? ` class="${cls}"` : ''}><td class="sum-k">${escapeHtml(label)}</td><td class="sum-v">${escapeHtml(
      value
    )}</td></tr>`;

  /* The ledger must foot. When the source itemises every billed component it does,
     and the summary prints exactly as it always has. When it does not (anonymous
     order tracking carries the lines and the amount billed but no packing charge,
     order discount or order tax), the zero rows would each be a false statement
     about a real charge — so only the components this payload genuinely knows are
     listed, and the remainder is stated as one labelled row and explained below. */
  const itemisedFully = totals.residual === 0;

  const totalRows = (
    itemisedFully
      ? [
          sumRow('Subtotal', formatMoney(totals.subtotal)),
          sumRow(
            'Discount',
            totals.discount > 0 ? `- ${formatMoney(totals.discount)}` : formatMoney(0)
          ),
          sumRow(
            totals.packingChargePercent
              ? `Packing Charge ( ${totals.packingChargePercent}% )`
              : 'Packing Charge',
            formatMoney(totals.packingCharge)
          ),
          totals.tax > 0 ? sumRow('GST', formatMoney(totals.tax)) : ''
        ]
      : [
          sumRow('Subtotal', formatMoney(totals.subtotal)),
          totals.discount > 0 ? sumRow('Discount', `- ${formatMoney(totals.discount)}`) : '',
          totals.packingCharge > 0
            ? sumRow(
                totals.packingChargePercent
                  ? `Packing Charge ( ${totals.packingChargePercent}% )`
                  : 'Packing Charge',
                formatMoney(totals.packingCharge)
              )
            : '',
          totals.tax > 0 ? sumRow('GST', formatMoney(totals.tax)) : '',
          sumRow(
            'Charges & Adjustments',
            `${totals.residual < 0 ? '- ' : ''}${formatMoney(Math.abs(totals.residual))}`
          )
        ]
  )
    .concat(sumRow('Overall Total', formatMoney(totals.overallTotal), 'grand'))
    .join('');

  const residualNote = itemisedFully
    ? ''
    : `<div class="mrp-note">Charges &amp; Adjustments is the balance of the amount billed on this order after the items above &mdash; the packing charge, any tax and any discount. This copy was produced from order tracking, which does not itemise them separately; the amount billed is stated as Overall Total.</div>`;

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
  .mrp-note { padding: 4px 9px; border-bottom: 1.5px solid #000; font-size: 9.5px; line-height: 1.4; }
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
        ${deliverToLines}
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

    ${missingMrpNote}
    ${residualNote}

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
