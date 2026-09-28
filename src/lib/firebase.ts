// Centralised Firebase initialisation — import `auth` / `db` from here only.
// These are PUBLIC Web SDK config values. Never place Admin SDK or service-account
// credentials in frontend code or VITE_ variables.
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { initializeFirestore, getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

const env = import.meta.env

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
}

const missing = Object.entries(firebaseConfig)
  .filter(([key, value]) => key !== 'measurementId' && !value)
  .map(([key]) => key)
if (missing.length) {
  throw new Error(`Missing Firebase config: ${missing.join(', ')}. Copy .env.example to .env.local.`)
}

const alreadyInitialised = getApps().length > 0

// Guard against double initialisation (HMR / StrictMode).
export const app = alreadyInitialised ? getApp() : initializeApp(firebaseConfig)

const useEmulators = env.VITE_USE_EMULATORS === 'true'

// App Check complements (never replaces) Authentication + Security Rules.
if (!alreadyInitialised && !useEmulators) {
  if (env.VITE_RECAPTCHA_SITE_KEY) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    })
  } else if (env.PROD) {
    console.warn('App Check is not configured: set VITE_RECAPTCHA_SITE_KEY.')
  }
}

export const auth = getAuth(app)

export const db: Firestore = alreadyInitialised ? getFirestore(app) : initializeFirestore(app, {})

if (useEmulators && !alreadyInitialised) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
