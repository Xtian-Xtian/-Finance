import { deleteField, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '../../lib/firebase'
import { newBatch } from '../../lib/firestore'
import { auditInBatch } from '../audit/auditService'
import { seedDefaultCategories } from '../categories/categoryService'

export interface Profile {
  ownerId: string
  email: string
  displayName: string
  currency: 'PHP'
  coachUrl?: string
}

function profileRef(uid: string) {
  return doc(db, 'users', uid)
}

/**
 * Called once the user is signed in with a verified email. Creates the profile and default
 * categories atomically on first use. Passwords are never stored — Firebase Auth owns identity.
 */
export async function ensureProfile(user: User): Promise<void> {
  const ref = profileRef(user.uid)
  if ((await getDoc(ref)).exists()) return
  const batch = newBatch()
  batch.set(ref, {
    ownerId: user.uid,
    email: user.email ?? '',
    displayName: (user.displayName || user.email?.split('@')[0] || 'Me').slice(0, 60),
    currency: 'PHP',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  seedDefaultCategories(batch, user.uid)
  auditInBatch(batch, user.uid, { action: 'profile.created', entityType: 'profile', entityId: user.uid })
  await batch.commit()
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(profileRef(uid))
  return snap.exists() ? (snap.data() as Profile) : null
}

export async function updateCoachUrl(uid: string, coachUrl: string | null): Promise<void> {
  await updateDoc(profileRef(uid), { coachUrl: coachUrl ?? deleteField(), updatedAt: serverTimestamp() })
}

export async function updateDisplayName(uid: string, displayName: string): Promise<void> {
  await updateDoc(profileRef(uid), { displayName: displayName.trim(), updatedAt: serverTimestamp() })
}
