// BillEase email parser — plain-JS source embedded into the Apps Script (see bpiParser.ts).
// Purchases ("Your purchase has been successfully completed. Merchant: … Amount: PHP …")
// become expenses on the BillEase (loan) account; repayments become transfers into it.
//
// Returns { kind: 'purchase' | 'payment', amount: centavos, description, method, snippet } or null.

export const BILLEASE_PARSER_SOURCE = String.raw`
function parseBillEaseEmail(subject, body) {
  var subj = String(subject || '');
  var text = (subj + ' \n ' + String(body || '')).replace(/\s+/g, ' ');

  if (/(reminder|due (soon|today|tomorrow)|overdue|statement|promo|offer|approved limit|verify|otp)/i.test(subj)) return null;

  var amountMatch = text.match(/Amount\s*:?\s*(?:PHP|Php|₱|\bP)\s?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i)
    || text.match(/(?:PHP|Php|₱)\s?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/);
  if (!amountMatch) return null;
  var parts = amountMatch[1].replace(/,/g, '').split('.');
  var centavos = parseInt(parts[0], 10) * 100 + parseInt(((parts[1] || '') + '00').slice(0, 2), 10);
  if (!(centavos > 0) || centavos > 99999999999999) return null;

  var STOP = '(?=\\s+(?:Merchant|Amount|Payment Method|Reference(?: ID| No\\.?)?|Date|Transaction|To learn|For any|Thank)\\b|$)';
  var merchant = text.match(new RegExp('Merchant\\s*:\\s*(.+?)' + STOP, 'i'));
  var method = text.match(new RegExp('Payment (?:Method|Channel)\\s*:\\s*(.+?)' + STOP, 'i'));
  var snippet = String(body || '').replace(/\s+/g, ' ').replace(/\d{6,}/g, function (m) { return '••••' + m.slice(-4); }).trim().slice(0, 380);

  var isPayment = /(we('ve| have)? received your (re)?payment|(re)?payment (has been |was )?(received|successful|posted|confirmed)|thank you for (your )?(re)?payment)/i.test(text);
  if (merchant && !isPayment) {
    return { kind: 'purchase', amount: centavos, description: merchant[1].trim().slice(0, 120), method: method ? method[1].trim() : null, snippet: snippet };
  }
  if (isPayment) {
    return { kind: 'payment', amount: centavos, description: 'BillEase payment', method: method ? method[1].trim() : null, snippet: snippet };
  }
  return null;
}
`

export interface ParsedBillEaseEmail {
  kind: 'purchase' | 'payment'
  amount: number
  description: string
  method: string | null
  snippet: string
}

export function compileBillEaseParser(): (subject: string, body: string) => ParsedBillEaseEmail | null {
  return new Function(`${BILLEASE_PARSER_SOURCE}; return parseBillEaseEmail;`)()
}
