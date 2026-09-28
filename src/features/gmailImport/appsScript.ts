// Builds the Google Apps Script the user pastes into script.google.com.
// It runs inside THEIR Google account (free), reads only BPI emails, and writes transactions
// through the Firestore REST API signed in as THEIR Finance user — so firestore.rules apply
// exactly as for manual entries.
import { BPI_PARSER_SOURCE } from './bpiParser'
import { BILLEASE_PARSER_SOURCE } from './billeaseParser'
import { COACH_APPS_SCRIPT_SOURCE } from '../coach/coachAppsScript'

export interface ImportScriptConfig {
  apiKey: string
  projectId: string
  uid: string
  refreshToken: string
  defaultAccountId: string
  accountsByLastFour: Record<string, string>
  incomeCategoryId: string
  expenseCategoryId: string
  /** [regex source, categoryId] pairs matched against the description. */
  categoryRules: Array<[string, string]>
  /** [regex source, accountId]: counterparty/subject matches => transfer with that own account. */
  transferRules: Array<[string, string]>
  /** The user's BillEase (loan) account; BillEase emails are skipped when null. */
  billeaseAccountId: string | null
}

export function buildAppsScript(c: ImportScriptConfig): string {
  const config = {
    apiKey: c.apiKey,
    projectId: c.projectId,
    uid: c.uid,
    defaultAccountId: c.defaultAccountId,
    accountsByLastFour: c.accountsByLastFour,
    incomeCategoryId: c.incomeCategoryId,
    expenseCategoryId: c.expenseCategoryId,
    categoryRules: c.categoryRules,
    transferRules: c.transferRules,
    billeaseAccountId: c.billeaseAccountId,
  }

  return `/**
 * Finance — BPI + BillEase Gmail auto-import (generated ${new Date().toISOString().slice(0, 10)})
 *
 * 1. Run  setup    once  (authorise Gmail + starts the 10-minute schedule).
 * 2. Then delete the long SETUP_KEY value below and save.
 * Optional: run  dryRun  to see what would be imported without saving anything.
 *           run  reimport  to re-check the last 30 days after deleting imported transactions.
 *           run  disconnect  to stop importing and forget the key.
 * AI coach:  see the "AI debt coach" section below (optional, needs an Anthropic API key).
 */

// One-time connection key. It is moved into private script storage by setup().
const SETUP_KEY = ${JSON.stringify(c.refreshToken)};

const CONFIG = ${JSON.stringify(config, null, 2)};

const SEARCHES = ['from:bpi', 'from:billease'];
const INITIAL_DAYS = 30;
const RECURRING_DAYS = 3;

function setup() {
  if (!SETUP_KEY) throw new Error('SETUP_KEY is empty. Generate a new script in Finance > Settings.');
  PropertiesService.getUserProperties().setProperty('FINANCE_KEY', SETUP_KEY);
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('importNow').timeBased().everyMinutes(10).create();
  getIdToken_(); // verifies the key works
  importRecent_(INITIAL_DAYS, false);
  Logger.log('Setup complete. Now delete the SETUP_KEY value and save the script.');
}

function importNow() { importRecent_(RECURRING_DAYS, false); }

function dryRun() { importRecent_(INITIAL_DAYS, true); }

/** Re-check the last 30 days (e.g. after deleting imported transactions to re-import them). */
function reimport() {
  PropertiesService.getUserProperties().deleteProperty('PROCESSED');
  importRecent_(INITIAL_DAYS, false);
}

function disconnect() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  PropertiesService.getUserProperties().deleteAllProperties();
  Logger.log('Disconnected. No more imports will run.');
}

${BPI_PARSER_SOURCE}
${BILLEASE_PARSER_SOURCE}
${COACH_APPS_SCRIPT_SOURCE}

function importRecent_(days, dryRun) {
  var props = PropertiesService.getUserProperties();
  var done = JSON.parse(props.getProperty('PROCESSED') || '[]');
  var doneSet = {};
  done.forEach(function (id) { doneSet[id] = true; });

  // Each sender is searched separately and paged, so busy BPI inboxes can't crowd out BillEase.
  var threads = [];
  SEARCHES.forEach(function (q) { threads = threads.concat(searchAll_(q + ' newer_than:' + days + 'd')); });
  var token = dryRun ? null : getIdToken_();
  var labelDone = dryRun ? null : getLabel_('Finance/Imported');
  var imported = 0, skipped = 0;

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      var id = msg.getId();
      if (doneSet[id]) return;
      if (msg.getDate().getTime() < Date.now() - days * 86400000) return;
      var isBillEase = /billease/i.test(msg.getFrom());
      var c = isBillEase ? classifyBillEase_(msg) : classifyBpi_(msg);
      if (!c) {
        // Not cached: a later parser update can still pick it up.
        skipped++;
        if (dryRun && isBillEase) {
          Logger.log('[skipped BillEase] "' + msg.getSubject() + '" on ' + msg.getDate() +
                     (CONFIG.billeaseAccountId ? '' : ' (no BillEase account configured)'));
        }
        return;
      }
      var parsed = c.parsed, accountId = c.accountId, categoryId = c.categoryId;
      if (dryRun) {
        Logger.log('[would import] ' + (parsed.transfer ? 'transfer' : parsed.type) + ' PHP ' + (parsed.amount / 100).toFixed(2) + ' — ' + parsed.description +
                   ' (card/acct ' + (parsed.lastFour || '?') + ') on ' + msg.getDate());
        imported++;
        return;
      }
      var result = saveTransaction_(token, id, parsed, accountId, categoryId, msg);
      if (result === 'ok' || result === 'exists') {
        doneSet[id] = true; done.push(id);
        if (result === 'ok') { imported++; thread.addLabel(labelDone); }
      }
    });
  });

  if (!dryRun) props.setProperty('PROCESSED', JSON.stringify(done.slice(-800)));
  Logger.log((dryRun ? 'Dry run: ' : '') + imported + ' imported, ' + skipped + ' non-transaction emails skipped.');
}

function searchAll_(query) {
  var all = [], page;
  for (var start = 0; start < 500; start += 100) {
    page = GmailApp.search(query, start, 100);
    all = all.concat(page);
    if (page.length < 100) break;
  }
  return all;
}

function classifyBpi_(msg) {
  var parsed = parseBpiEmail(msg.getSubject(), msg.getPlainBody());
  if (!parsed) return null;
  var accountId = (parsed.lastFour && CONFIG.accountsByLastFour[parsed.lastFour]) || CONFIG.defaultAccountId;
  var categoryId = parsed.type === 'income' ? CONFIG.incomeCategoryId : pickCategory_(parsed.description) || CONFIG.expenseCategoryId;
  // Money moving between the user's own accounts is a transfer, not income/expense.
  var otherAccountId = pickTransferAccount_(msg.getSubject() + ' ' + (parsed.counterparty || ''), accountId);
  if (otherAccountId) parsed.transfer = parsed.type === 'income' ? { from: otherAccountId, to: accountId } : { from: accountId, to: otherAccountId };
  return { parsed: parsed, accountId: accountId, categoryId: categoryId };
}

function classifyBillEase_(msg) {
  if (!CONFIG.billeaseAccountId) return null;
  var b = parseBillEaseEmail(msg.getSubject(), msg.getPlainBody());
  if (!b) return null;
  var parsed = { type: 'expense', amount: b.amount, description: b.description, counterparty: b.description, snippet: b.snippet, lastFour: null };
  if (b.kind === 'payment') {
    // Repayment: money moves from a bank/e-wallet into the BillEase account (not an expense).
    var from = (b.method && pickTransferAccount_(b.method, CONFIG.billeaseAccountId)) || CONFIG.defaultAccountId;
    parsed.transfer = { from: from, to: CONFIG.billeaseAccountId };
  }
  return { parsed: parsed, accountId: CONFIG.billeaseAccountId, categoryId: pickCategory_(b.description) || CONFIG.expenseCategoryId };
}

function pickCategory_(description) {
  for (var i = 0; i < CONFIG.categoryRules.length; i++) {
    if (new RegExp(CONFIG.categoryRules[i][0], 'i').test(description)) return CONFIG.categoryRules[i][1];
  }
  return null;
}

function pickTransferAccount_(text, accountId) {
  for (var i = 0; i < CONFIG.transferRules.length; i++) {
    var rule = CONFIG.transferRules[i];
    if (rule[1] !== accountId && new RegExp(rule[0], 'i').test(text)) return rule[1];
  }
  return null;
}

function saveTransaction_(token, messageId, parsed, accountId, categoryId, msg) {
  var base = 'projects/' + CONFIG.projectId + '/databases/(default)/documents/users/' + CONFIG.uid + '/';
  var txId = 'gmail_' + messageId;
  var now = [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }, { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }];
  var body = {
    writes: [
      {
        update: {
          name: base + 'transactions/' + txId,
          fields: txFields_(parsed, accountId, categoryId, msg)
        },
        currentDocument: { exists: false },
        updateTransforms: now
      },
      {
        update: {
          name: base + 'auditLogs/' + Utilities.getUuid().replace(/-/g, ''),
          fields: {
            ownerId: str_(CONFIG.uid), action: str_('transaction.created'), entityType: str_('transaction'),
            entityId: str_(txId), details: str_(('Gmail import: ' + (parsed.transfer ? 'transfer' : parsed.type) + ' PHP ' + (parsed.amount / 100).toFixed(2) + ' — ' + parsed.description).slice(0, 300))
          }
        },
        currentDocument: { exists: false },
        updateTransforms: [now[0]]
      }
    ]
  };
  var res = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + CONFIG.projectId + '/databases/(default)/documents:commit', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(body)
  });
  var code = res.getResponseCode();
  if (code === 200) return 'ok';
  var text = res.getContentText();
  if (code === 409 || /ALREADY_EXISTS/.test(text)) return 'exists';
  Logger.log('Could not import "' + parsed.description + '" (' + code + '): ' + text.slice(0, 300));
  return 'error';
}

function txFields_(parsed, accountId, categoryId, msg) {
  var f = {
    ownerId: str_(CONFIG.uid), amount: { integerValue: String(parsed.amount) }, currency: str_('PHP'),
    description: str_(parsed.description), date: { timestampValue: msg.getDate().toISOString() },
    notes: str_(('Imported from Gmail: ' + msg.getSubject() + '\\n' + parsed.snippet).slice(0, 500)), source: str_('gmail')
  };
  if (parsed.transfer) {
    f.type = str_('transfer'); f.fromAccountId = str_(parsed.transfer.from); f.toAccountId = str_(parsed.transfer.to);
  } else {
    f.type = str_(parsed.type); f.accountId = str_(accountId); f.categoryId = str_(categoryId);
  }
  return f;
}

function getIdToken_() {
  var props = PropertiesService.getUserProperties();
  var key = props.getProperty('FINANCE_KEY');
  if (!key) throw new Error('Not connected. Run setup first.');
  var res = UrlFetchApp.fetch('https://securetoken.googleapis.com/v1/token?key=' + CONFIG.apiKey, {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'refresh_token', refresh_token: key }
  });
  var data = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) {
    throw new Error('Connection key rejected (' + (data.error && data.error.message) + '). Generate a new script in Finance > Settings.');
  }
  if (data.user_id !== CONFIG.uid) throw new Error('Key belongs to a different Finance user.');
  if (data.refresh_token && data.refresh_token !== key) props.setProperty('FINANCE_KEY', data.refresh_token);
  return data.id_token;
}

function getLabel_(name) { return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name); }

function str_(v) { return { stringValue: String(v) }; }
`
}

/** Keyword → category-name rules; only rules whose category exists are used. */
export const DEFAULT_CATEGORY_KEYWORDS: Array<[string, string]> = [
  ['grab(?!food)|angkas|joyride|move ?it|lrt|mrt|beep|shell|petron|caltex|seaoil|autosweep|easytrip', 'Transportation'],
  ['jollibee|mcdo|mcdonald|kfc|chowking|starbucks|grabfood|foodpanda|mang inasal|greenwich|coffee|restaurant', 'Food'],
  ['sm supermarket|savemore|puregold|robinsons supermarket|landers|s&r|waltermart|7-eleven|alfamart|ministop', 'Groceries'],
  ['netflix|spotify|youtube|disney|github|apple\\.com|icloud|google|microsoft|openai|anthropic|canva|adobe', 'Subscriptions'],
  ['meralco|maynilad|manila water|pldt|globe|smart|converge|sky ?cable|dito', 'Bills & Utilities'],
  ['shopee|lazada|zalora|amazon|uniqlo|h&m', 'Shopping'],
  ['mercury drug|watsons|southstar|hospital|clinic|pharma', 'Health'],
]

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Aliases that identify money moving to/from the user's OWN accounts in BPI emails. */
export function buildTransferRules(
  accounts: Array<{ id: string; name: string; type: string; institution?: string; lastFour?: string }>,
  defaultAccountId: string,
): Array<[string, string]> {
  const base = accounts.find((a) => a.id === defaultAccountId)
  const generic = new Set(['bpi', 'bank', 'savings', 'account', 'wallet', 'cash', base?.name.toLowerCase(), base?.institution?.toLowerCase()])
  const rules: Array<[string, string]> = []
  for (const a of accounts) {
    if (a.id === defaultAccountId || a.type === 'cash') continue
    const terms: string[] = []
    const name = a.name.trim().toLowerCase()
    if (name && !generic.has(name)) terms.push(escapeRegex(name))
    if (a.institution && !generic.has(a.institution.toLowerCase())) terms.push(escapeRegex(a.institution.toLowerCase()))
    const hay = `${name} ${a.institution ?? ''}`.toLowerCase()
    if (/gcash/.test(hay)) terms.push('gcash', 'g-?xchange')
    if (/maya|paymaya/.test(hay)) terms.push('maya', 'paymaya')
    if (/grabpay/.test(hay)) terms.push('grabpay')
    if (/shopeepay/.test(hay)) terms.push('shopeepay')
    if (a.type === 'credit_card') terms.push('\\bcc\\b', 'credit ?card', 'rewards card')
    if (a.lastFour) terms.push(`x{2,}${a.lastFour}\\b`, `ending(?: in)? ${a.lastFour}\\b`)
    if (terms.length) rules.push([terms.join('|'), a.id])
  }
  // Credit-card rules first so "BPI CC" wins over looser matches.
  return rules.sort((x, y) => Number(accounts.find((a) => a.id === y[1])?.type === 'credit_card') - Number(accounts.find((a) => a.id === x[1])?.type === 'credit_card'))
}
