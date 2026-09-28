import type { Entity } from '../../lib/firestore'

export type AssetType = 'stock' | 'fund' | 'uitf' | 'bond' | 'crypto' | 'time_deposit' | 'other'

export interface Investment extends Entity {
  name: string
  symbol?: string
  assetType: AssetType
  /** Optional investment account this holding sits in. */
  accountId?: string
  /** Units held (may be fractional). */
  quantity: number
  /** Average purchase price per unit, in centavos. */
  purchasePrice: number
  /** User-provided current market value of the whole holding, in centavos. */
  currentValue: number
  valuedAt?: Date | null
}

export interface InvestmentTransaction extends Entity {
  investmentId: string
  kind: 'contribution' | 'withdrawal'
  amount: number
  date: Date
  note?: string
}

export const ASSET_TYPES: Array<{ value: AssetType; label: string }> = [
  { value: 'stock', label: 'Stock' },
  { value: 'fund', label: 'Mutual fund / ETF' },
  { value: 'uitf', label: 'UITF' },
  { value: 'bond', label: 'Bond' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'time_deposit', label: 'Time deposit' },
  { value: 'other', label: 'Other' },
]
