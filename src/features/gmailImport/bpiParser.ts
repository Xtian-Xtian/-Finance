// BPI email parser. Kept as plain-JS SOURCE TEXT because it is embedded verbatim into the
// Google Apps Script that runs inside the user's Gmail account. Unit tests evaluate the same
// source (bpiParser.test.ts), so what we test is exactly what runs in Apps Script.
//
// Returns { type: 'income' | 'expense', amount: centavos, lastFour, description } or null
// for emails that are not money movements (card blocks, OTPs, advisories…).

export const BPI_PARSER_SOURCE = String.raw`
function parseBpiEmail(subject, body) {
  var subj = String(subject || '');
  var text = (subj + ' \n ' + String(body || '')).replace(/\s+/g, ' ');

  // Notifications that never represent a money movement.
  var NOT_A_TRANSACTION = /(block|unblock|disabled|ready for use|relink|deactivat|activat|one[- ]time pin|\bOTP\b|enrol|password|log-?in|sign-?in|statement is ready|advisory|promo|reminder|update your|verify)/i;
  if (NOT_A_TRANSACTION.test(subj)) return null;

  var amountMatch = text.match(/(?:PHP|Php|php|₱|\bP)\s?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/);
  if (!amountMatch) return null;
  var parts = amountMatch[1].replace(/,/g, '').split('.');
  var centavos = parseInt(parts[0], 10) * 100 + parseInt(((parts[1] || '') + '00').slice(0, 2), 10);
  if (!(centavos > 0) || centavos > 99999999999999) return null;

  var INCOMING = /(incoming|received|receive|credited|credit to your|deposit|cash[- ]in|refund|reversal|salary|payroll)/i;
  var OUTGOING = /(purchase|payment|paid|debited|debit from your|withdraw|outgoing|sent|transfer to|bills|charged|spent|transaction)/i;
  var incoming = INCOMING.test(subj);
  var outgoing = OUTGOING.test(subj);
  if (!incoming && !outgoing) {
    incoming = /(credited|received|deposited)/i.test(text);
    outgoing = !incoming && /(debited|purchase|payment|withdraw|charged)/i.test(text);
  }
  if (!incoming && !outgoing) return null;

  var lastFourMatch = text.match(/(?:ending(?: in)?|account no\.?|card no\.?|X{3,}|\*{2,})\s?:?\s?(\d{4})\b/i);

  var counterparty = text.match(/\b(?:at|to|from|merchant\s*:?|sender\s*:?|recipient\s*:?)\s+([A-Za-z0-9][A-Za-z0-9 .&'*\-]{2,40}?)(?=\s(?:on|with|using|amounting|for|via|ref|reference|has|was|in the amount)\b|[.,;:](?:\s|$)|$)/i);
  var bad = /^(your|the|you|bpi|account|card|php|p\d)|email|dear|\*|http/i;
  var party = counterparty && !bad.test(counterparty[1]) ? counterparty[1].trim() : null;
  var description = party || subj.trim();

  // Short, masked excerpt of the email for the transaction's notes (long digit runs -> last 4).
  var snippet = String(body || '').replace(/\s+/g, ' ').replace(/\d{6,}/g, function (m) { return '••••' + m.slice(-4); }).trim().slice(0, 380);

  return {
    type: incoming ? 'income' : 'expense',
    amount: centavos,
    lastFour: lastFourMatch ? lastFourMatch[1] : null,
    counterparty: party,
    snippet: snippet,
    description: description.slice(0, 120) || (incoming ? 'BPI incoming' : 'BPI payment')
  };
}
`

export interface ParsedBpiEmail {
  type: 'income' | 'expense'
  amount: number
  lastFour: string | null
  counterparty: string | null
  snippet: string
  description: string
}

/** Compile the embedded source for use in tests / previews. */
export function compileBpiParser(): (subject: string, body: string) => ParsedBpiEmail | null {
  return new Function(`${BPI_PARSER_SOURCE}; return parseBpiEmail;`)()
}
