export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.password_changed'
  | 'auth.verification_sent'
  | 'auth.import_key_created'
  | 'profile.created'
  | 'profile.updated'
  | 'account.created'
  | 'account.updated'
  | 'account.deleted'
  | 'category.created'
  | 'category.updated'
  | 'category.deleted'
  | 'transaction.created'
  | 'transaction.updated'
  | 'transaction.deleted'
  | 'budget.created'
  | 'budget.updated'
  | 'budget.deleted'
  | 'savings.created'
  | 'savings.updated'
  | 'savings.deleted'
  | 'savings.contribution'
  | 'bill.created'
  | 'bill.updated'
  | 'bill.deleted'
  | 'bill.paid'
  | 'debt.created'
  | 'debt.updated'
  | 'debt.deleted'
  | 'debt.payment'
  | 'investment.created'
  | 'investment.updated'
  | 'investment.deleted'
  | 'investment.transaction'
  | 'goal.created'
  | 'goal.updated'
  | 'goal.deleted'
  | 'coach.requested'
  | 'coach.configured'

/** Never put passwords, tokens or full card numbers in an audit entry. */
export interface AuditEntry {
  action: AuditAction
  entityType: string
  entityId?: string
  details?: string
}

export interface AuditLog extends AuditEntry {
  id: string
  ownerId: string
  createdAt: Date
}
