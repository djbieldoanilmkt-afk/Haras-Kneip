import { describe, it, expect, vi, afterEach } from 'vitest'
import { contaPodeUsar, diasRestantesTrial } from './conta'

afterEach(() => vi.useRealTimers())

function em(data: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(data))
}

describe('diasRestantesTrial', () => {
  it('conta os dias ate a expiracao', () => {
    em('2026-08-13T12:00:00Z')
    expect(diasRestantesTrial({ trial_expira_em: '2026-08-28T12:00:00Z' })).toBe(15)
  })

  it('devolve zero quando vencido, nunca negativo', () => {
    em('2026-08-13T12:00:00Z')
    expect(diasRestantesTrial({ trial_expira_em: '2026-08-01T12:00:00Z' })).toBe(0)
  })
})

describe('contaPodeUsar', () => {
  it('ativa sempre pode', () => {
    em('2026-08-13T12:00:00Z')
    expect(contaPodeUsar({ status_conta: 'ativa', trial_expira_em: '2020-01-01' })).toBe(true)
  })

  it('bloqueada nunca pode', () => {
    expect(contaPodeUsar({ status_conta: 'bloqueada', trial_expira_em: '2099-01-01' })).toBe(false)
  })

  it('trial vigente pode; trial vencido nao', () => {
    em('2026-08-13T12:00:00Z')
    expect(contaPodeUsar({ status_conta: 'trial', trial_expira_em: '2026-08-20' })).toBe(true)
    expect(contaPodeUsar({ status_conta: 'trial', trial_expira_em: '2026-08-10' })).toBe(false)
  })
})
