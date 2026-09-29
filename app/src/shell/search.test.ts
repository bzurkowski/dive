import { deepStrictEqual as eq } from 'node:assert/strict'
import type { Term } from '../types.ts'
import { gaps, searchTerms } from './search.ts'

eq(gaps('retryable error', 'rtry'), 1, 'letters in order, one skipped')
eq(gaps('retry', 'yr'), -1, 'letters out of order')
eq(gaps('aab', 'ab'), 0, 'the tightest start wins')

const refund = { term: 'Refund', meaning: 'Money back to the customer.', code: 'Refund' }
const retry = { term: 'Retryable error', meaning: 'A gateway error.', code: 'GatewayError.retryable' }
const attempt = { term: 'Attempt', meaning: 'One try to send a refund.', code: 'refund.attempts' }
const job = { term: 'Job', meaning: 'Work queued for later.' }
const terms: Term[] = [refund, retry, attempt, job]
const names = (q: string) => searchTerms(terms, q).map((t) => t.term)

eq(searchTerms(terms, '  '), terms, 'blank query keeps everything in order')
eq(names('rtry'), ['Retryable error'], 'fuzzy on the term')
eq(names('ref'), ['Refund', 'Attempt'], 'term hits before code hits')
eq(names('gateway'), ['Retryable error'], 'code hit')
eq(names('queued'), ['Job'], 'meaning is a substring match')
eq(names('qud'), [], 'meaning is not fuzzy')
eq(names('re'), ['Refund', 'Retryable error', 'Attempt'], 'ties keep glossary order')
eq(names('RE'), names('re'), 'case does not matter')
