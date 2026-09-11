import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const saude = vi.hoisted(() => vi.fn())
vi.mock('@/lib/store', () => ({ store: { getSaudeDoAgente: saude } }))

import { AvisoAgente } from './AvisoAgente'

/*
  Esperar os dados CHEGAREM antes de afirmar que nada apareceu.

  `waitFor(() => expect(queryByRole('alert')).toBeNull())` acerta no primeiro
  instante, quando o componente ainda nao recebeu resposta -- e passava mesmo
  com o codigo mostrando a faixa sempre. Sem isto o teste do caso "calado" nao
  prova nada.
*/
async function esperarResposta() {
  await waitFor(() => expect(saude).toHaveBeenCalled())
  await act(async () => {})
}

function mostrar() {
  return render(
    <MemoryRouter>
      <AvisoAgente />
    </MemoryRouter>,
  )
}

const OK = {
  saudavel: true,
  motivo: 'ok' as const,
  detalhe: 'Tudo funcionando.',
  whatsapp_estado: 'open',
  credito_usd: 6.4,
  ultima_mensagem_em: '2026-09-11T09:30:00Z',
  verificado_em: '2026-09-11T10:17:00Z',
}

beforeEach(() => vi.clearAllMocks())

describe('AvisoAgente', () => {
  it('fica calado quando o agente esta de pe', async () => {
    saude.mockResolvedValue(OK)
    mostrar()
    await esperarResposta()
    // Faixa permanente de "tudo certo" vira paisagem, e aí ninguém enxerga a
    // que importa.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('fica calado para quem nunca conectou o agente', async () => {
    saude.mockResolvedValue({ ...OK, saudavel: false, motivo: 'nunca_conectado' })
    mostrar()
    await esperarResposta()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('avisa que o whatsapp caiu e diz o que fazer', async () => {
    saude.mockResolvedValue({
      ...OK,
      saudavel: false,
      motivo: 'whatsapp_desconectado',
      detalhe: 'O WhatsApp do assistente desconectou. Leia o QR code de novo para religar.',
    })
    mostrar()

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain('fora do ar')
    // "Esta quebrado" sem o motivo deixa a pessoa sem acao.
    expect(aviso.textContent).toContain('QR code')
    expect(screen.getByRole('link', { name: 'Resolver' })).toHaveAttribute('href', '/configuracoes')
  })

  it('avisa quando o credito esta acabando', async () => {
    saude.mockResolvedValue({
      ...OK,
      saudavel: false,
      motivo: 'sem_credito',
      credito_usd: 0.1,
      detalhe: 'O crédito da inteligência artificial está acabando.',
    })
    mostrar()
    expect((await screen.findByRole('alert')).textContent).toContain('crédito')
  })

  it('nao quebra a tela quando nao consegue consultar', async () => {
    saude.mockRejectedValue(new Error('sem rede'))
    mostrar()
    await esperarResposta()
    // Falha ao saber o estado do agente nao pode derrubar o app inteiro.
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
