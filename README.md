# Finance — Personal Finance Tracker

React + TypeScript + Tailwind CSS on Firebase (Auth, Cloud Firestore, App Check, Security Rules).
All amounts are Philippine Peso stored as **integer centavos** (₱1,250.50 → `125050`).

## Quick start

```bash
npm install
cp .env.example .env.local     # already filled in for project faience-af728
npm run dev                    # http://localhost:5173
```

In the Firebase console for `faience-af728`, enable:

1. **Authentication → Email/Password** (and optionally Password policy + Email enumeration protection).
2. **Cloud Firestore** (production mode), then deploy rules: `npm run deploy:rules`.
3. **App Check → reCAPTCHA v3**, put the site key in `VITE_RECAPTCHA_SITE_KEY`, then enforce App Check for Firestore once traffic looks healthy.

### Local development with emulators (recommended)

Requires **Java 11+** on PATH.

```bash
npm run emulators              # auth :9099, firestore :8080, UI :4000
# in .env.local set VITE_USE_EMULATORS=true, then
npm run dev
```

The Auth emulator prints email-verification links in the emulator UI/log.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm test` | Unit tests for money math, balances, budgets, bills, debts, net worth, validation |
| `npm run test:rules` | Firestore Security Rules tests against the emulator (needs Java) |
| `npm run deploy:rules` | Deploy `firestore.rules` + indexes |
| `npm run deploy` | Build and deploy hosting (with security headers) + Firestore |

## File structure

Feature-first: everything for one domain lives in one folder, and each file has a single job.

```
app/
├─ firestore.rules            # Security boundary: ownership, validation, ledger integrity
├─ firestore.indexes.json
├─ firebase.json              # Hosting (CSP + security headers), emulator ports
├─ tests/rules/               # Security Rules tests (emulator)
└─ src/
   ├─ app/                    # App shell: router (App.tsx), route guards
   ├─ lib/                    # Framework-free helpers shared by all features
   │  ├─ firebase.ts          #   the ONLY Firebase initialisation (auth, db, App Check)
   │  ├─ firestore.ts         #   user-scoped paths, create/update payloads, error mapping
   │  ├─ money.ts             #   centavo parsing/formatting (no floats)
   │  ├─ dates.ts, validation.ts, csv.ts, cn.ts, useAsyncAction.ts
   ├─ data/                   # Live Firestore subscriptions + derived balances/net worth
   ├─ components/
   │  ├─ ui/                  #   Button, Card, Field, Modal, Badge, StatCard…
   │  ├─ layout/              #   AppLayout, Sidebar, navigation config
   │  └─ charts/              #   shared chart theme + tooltip
   └─ features/
      └─ <feature>/           # accounts, transactions, budgets, savings, bills, debts,
         ├─ types.ts          #   investments, goals, reports, networth, dashboard,
         ├─ <feature>Calc.ts  #   categories, audit, auth, settings
         ├─ <feature>Service.ts
         ├─ <Feature>Page.tsx
         └─ <Feature>Form.tsx
```

Per-feature file roles:

| File | Contains | Depends on |
| --- | --- | --- |
| `types.ts` | Data model + option lists | nothing |
| `*Calc.ts` | Pure financial calculations, unit-tested | `types`, `lib` |
| `*Validation.ts` | Application-layer input validation | `types`, `lib/validation` |
| `*Service.ts` | Firestore writes (atomic batch + audit entry) | `lib/firestore`, `audit` |
| `*Page.tsx` / forms | UI only; reads from `useFinance()`, writes via the service | everything above |

To add a feature, follow the order below (security first):
**types → firestore.rules match + validator → rules tests → service → calc + unit tests → page → nav entry in `components/layout/navigation.ts` → route in `app/App.tsx`.**

## Data model

Everything lives under `users/{uid}/…`:
`accounts, transactions, categories, budgets, savingsGoals, savingsContributions, bills, debts, debtPayments, investments, investmentTransactions, financialGoals, netWorthSnapshots, auditLogs`.

- **Balances are derived** (opening balance + transactions), so they can never drift.
- **Transfers** are one document (`fromAccountId`, `toAccountId`), so they are atomic by construction and never count as income/expense.
- **Budgets** use id `YYYY-MM_categoryId` → exactly one per category per month.
- **Savings / debt running totals** can only change in the same batch as a new ledger entry of equal amount (enforced by rules).
- **Net worth** = assets − liabilities. History uses monthly snapshots; months without a snapshot are estimated from account balances only and labelled as such.

## Security model

| Layer | What it does |
| --- | --- |
| Firebase Auth | Identity, passwords, email verification, reset. No custom auth, no passwords in Firestore. |
| Security Rules | `request.auth.uid == userId` **and** `email_verified`; field allow-lists (no mass assignment); int-centavo money bounds; immutable `ownerId`/`createdAt`; server-time timestamps; referenced accounts/categories must exist under the same user (no IDOR); append-only audit logs and ledgers. |
| App Check | reCAPTCHA v3 attestation, a complement to Auth and Rules (not a replacement). |
| Application | Same validation in services before writing; ownership checked against the user's own data. |
| Frontend | Form validation, generic auth errors (no account enumeration), client-side login throttle, CSV formula-injection escaping, React escaping (no `dangerouslySetInnerHTML`). |
| Hosting | CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS, strict referrer and permissions policies. |

Card data: only nickname, issuer, **last four digits**, limit and statement/due days. Rules reject CVV, PIN and full card numbers.

### Known limitations / pre-production checklist

- **Failed-login auditing** is client-reported: failed attempts on a device are logged at the next successful sign-in. For authoritative logging, add Identity Platform blocking functions or Cloud Functions.
- **Rate limiting** relies on Firebase Auth's built-in protection plus a client throttle. Enable App Check enforcement and consider Identity Platform for stronger controls.
- Before launch, run the security review list: IDOR, broken authorization, XSS, injection, CSRF (N/A for token-based Firestore calls), brute force, sensitive-data exposure, rules coverage, mass assignment, ownership manipulation.
- Investment values and debt payoff figures are user-provided or estimated, and the UI labels them as such, not as guarantees.
