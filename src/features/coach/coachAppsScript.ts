// Apps Script source for the AI debt coach web app (embedded in the generated import script).
// Runs in the user's own Google account. The Anthropic API key lives in Script Properties
// (never in the website). Every request must carry the user's Firebase ID token, which is
// verified with Identity Toolkit before Claude is called. Raw HTTP is used because Apps Script
// cannot install the Anthropic SDK.

export const COACH_SYSTEM_PROMPT = [
  'You are a practical personal-finance coach for a user in the Philippines. All amounts are Philippine pesos (PHP).',
  'You receive a JSON summary of the user\'s own recorded finances. Base every number on that data; when something is missing',
  '(for example unknown interest rates or untracked spending), say what you assumed. Show simple arithmetic where you estimate.',
  'Goal: help the user become debt-free as fast as is realistic without skipping essentials or bills.',
  'Compare paying the highest-interest debt first (avalanche) with the smallest balance first (snowball) and recommend one for this user.',
  'Suggest concrete, specific actions tied to their actual spending categories and bills, each with an estimated monthly peso impact.',
  'Warn about risks such as overdue bills, maxed credit lines, or an empty emergency fund.',
  'These are estimates and suggestions, not guarantees or licensed financial advice. Be kind, direct and brief.',
].join(' ')

export const COACH_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'debtFreeEstimate', 'payoffOrder', 'actions', 'warnings'],
  properties: {
    summary: { type: 'string', description: '2-4 sentence overview of the situation and the plan.' },
    debtFreeEstimate: {
      type: 'object',
      additionalProperties: false,
      required: ['months', 'targetMonth', 'basis'],
      properties: {
        months: { type: 'integer', description: 'Estimated months until debt-free following the plan; 0 if unknown.' },
        targetMonth: { type: 'string', description: 'Estimated month, e.g. "March 2027", or "Unknown".' },
        basis: { type: 'string', description: 'The monthly payment and assumptions behind the estimate.' },
      },
    },
    payoffOrder: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'reason'],
        properties: { name: { type: 'string' }, reason: { type: 'string' } },
      },
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail', 'monthlyImpactPhp'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          monthlyImpactPhp: { type: 'number', description: 'Estimated pesos per month freed up or saved.' },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
}

export const COACH_APPS_SCRIPT_SOURCE = `
// ---------------- AI debt coach (web app) ----------------
// Setup: Project Settings (gear) → Script properties → add ANTHROPIC_API_KEY.
// Then Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
// "Anyone" only lets requests reach the script; each one is verified against your Finance login.

const COACH_DAILY_LIMIT = 15;
const COACH_MODEL = 'claude-opus-5';
const COACH_SYSTEM = ${JSON.stringify(COACH_SYSTEM_PROMPT)};
const COACH_SCHEMA = ${JSON.stringify(COACH_OUTPUT_SCHEMA)};

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents;
    if (!body || body.length > 60000) return coachJson_({ error: 'bad_request' });
    var req = JSON.parse(body);
    if (!verifyFinanceUser_(req.idToken)) return coachJson_({ error: 'unauthorized' });

    var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!key) return coachJson_({ error: 'no_key' });
    if (!takeCoachQuota_()) return coachJson_({ error: 'limit' });

    var question = String(req.question || '').slice(0, 500);
    var extra = typeof req.extraMonthlyPhp === 'number' && req.extraMonthlyPhp > 0 ? req.extraMonthlyPhp : null;
    var prompt = 'My financial summary (JSON):\\n' + JSON.stringify(req.summary) +
      (extra ? '\\n\\nI can put an extra PHP ' + extra + ' per month toward debt.' : '') +
      '\\n\\n' + (question || 'When can I realistically become debt-free, and what should I do first?');
    return coachJson_(askClaude_(key, prompt));
  } catch (err) {
    Logger.log('Coach error: ' + err);
    return coachJson_({ error: 'api' });
  }
}

function askClaude_(key, prompt) {
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Server-side refusal fallback: a declined request is retried on Anthropic's recommended model.
      'anthropic-beta': 'server-side-fallback-2026-07-01'
    },
    payload: JSON.stringify({
      model: COACH_MODEL,
      max_tokens: 8000,
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: COACH_SCHEMA } },
      system: COACH_SYSTEM,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  var code = res.getResponseCode();
  var data = JSON.parse(res.getContentText());
  if (code !== 200) {
    Logger.log('Anthropic API ' + code + ': ' + res.getContentText().slice(0, 300));
    return { error: code === 400 ? 'bad_request' : 'api' };
  }
  if (data.stop_reason === 'refusal') return { error: 'refusal' };
  var text = (data.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
  try {
    return { ok: true, advice: JSON.parse(text) };
  } catch (e) {
    Logger.log('Unparseable coach output (stop_reason ' + data.stop_reason + ')');
    return { error: 'api' };
  }
}

/** The caller must be THIS script's Finance user with a verified email. */
function verifyFinanceUser_(idToken) {
  if (!idToken || typeof idToken !== 'string') return false;
  var res = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + CONFIG.apiKey, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ idToken: idToken })
  });
  if (res.getResponseCode() !== 200) return false;
  var users = JSON.parse(res.getContentText()).users || [];
  return users.length === 1 && users[0].localId === CONFIG.uid && users[0].emailVerified === true;
}

function takeCoachQuota_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var props = PropertiesService.getScriptProperties();
    var day = 'COACH_' + Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
    var used = Number(props.getProperty(day) || 0);
    if (used >= COACH_DAILY_LIMIT) return false;
    props.setProperty(day, String(used + 1));
    return true;
  } finally {
    lock.releaseLock();
  }
}

function coachJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`
