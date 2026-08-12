import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Campo, SelectSimples } from './Campo'

describe('Campo', () => {
  it('mostra o rotulo e o controle', () => {
    render(
      <Campo label="Nome" htmlFor="nome">
        <input id="nome" />
      </Campo>,
    )
    expect(screen.getByLabelText('Nome')).toBeInTheDocument()
  })

  it('mostra o erro no lugar da dica', () => {
    render(
      <Campo label="Nome" erro="Nome é obrigatório" hint="Como consta no registro">
        <input />
      </Campo>,
    )
    expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument()
    expect(screen.queryByText('Como consta no registro')).not.toBeInTheDocument()
  })
})

describe('SelectSimples', () => {
  it('mostra o valor selecionado', () => {
    render(<SelectSimples value="Prenha" onValueChange={() => {}} options={['Vazia', 'Prenha']} />)
    expect(screen.getByText('Prenha')).toBeInTheDocument()
  })

  it('avisa a mudanca de opcao', async () => {
    const aoMudar = vi.fn()
    const user = userEvent.setup()

    render(<SelectSimples value="Vazia" onValueChange={aoMudar} options={['Vazia', 'Prenha']} />)

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Prenha' }))

    expect(aoMudar).toHaveBeenCalledWith('Prenha')
  })
})
