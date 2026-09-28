import { describe, expect, it } from 'vitest'
import { compileBillEaseParser } from './billeaseParser'

const parse = compileBillEaseParser()

const PURCHASE = `Billie
Hey Christian,
Your purchase has been successfully completed.

Merchant: KFC GAISANO DAVAO
Amount: PHP 195.00
Payment Method: Credit Line
Reference ID: 202627100087763
To learn more about our repayment options, visit https://billease.ph/faq/
For any further inquiries you have on this credit line transaction, contact us at info@billease.ph`

describe('BillEase email parser', () => {
  it('reads a purchase (real sample)', () => {
    const r = parse('Your BillEase purchase', PURCHASE)
    expect(r).toMatchObject({ kind: 'purchase', amount: 19_500, description: 'KFC GAISANO DAVAO', method: 'Credit Line' })
    expect(r?.snippet).not.toContain('202627100087763')
  })

  it('reads a repayment', () => {
    const r = parse('Payment received', 'Hi Christian, we have received your payment. Amount: PHP 1,250.00 Payment Method: GCash Reference ID: 123456789')
    expect(r).toMatchObject({ kind: 'payment', amount: 125_000, method: 'GCash' })
  })

  it('ignores reminders', () => {
    expect(parse('Payment reminder: due tomorrow', 'Amount: PHP 500.00')).toBeNull()
  })
})
