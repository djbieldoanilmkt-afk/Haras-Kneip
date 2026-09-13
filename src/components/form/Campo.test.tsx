import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Campo, SelectAnimal, SelectSimples } from './Campo'

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

describe('SelectAnimal', () => {
  const ANIMAIS = [
    { id: 'aa96d0ea-1933-4724-8e8d-6e91557ed32d', nome: 'Brisa Suave' },
    { id: 'bb11c0ff-0000-4724-8e8d-6e91557ed999', nome: 'Trovão Azul' },
  ]

  it('mostra o NOME do animal no gatilho, e nao o id', () => {
    render(
      <SelectAnimal value={ANIMAIS[0].id} onValueChange={() => {}} animais={ANIMAIS} />,
    )

    expect(screen.getByText('Brisa Suave')).toBeInTheDocument()
    expect(screen.queryByText(ANIMAIS[0].id)).not.toBeInTheDocument()
  })

  it('devolve o id, e nao o nome, quando a opcao muda', async () => {
    const aoMudar = vi.fn()
    const user = userEvent.setup()

    render(<SelectAnimal value={ANIMAIS[0].id} onValueChange={aoMudar} animais={ANIMAIS} />)

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Trovão Azul' }))

    // O id e o que vai para o banco; dois animais podem ter o mesmo nome.
    expect(aoMudar).toHaveBeenCalledWith(ANIMAIS[1].id)
  })

  it('cai no placeholder quando o animal selecionado nao esta mais na lista', () => {
    render(
      <SelectAnimal
        value="id-de-animal-excluido"
        onValueChange={() => {}}
        animais={ANIMAIS}
        placeholder="Selecione a matriz..."
      />,
    )

    expect(screen.getByText('Selecione a matriz...')).toBeInTheDocument()
    expect(screen.queryByText('id-de-animal-excluido')).not.toBeInTheDocument()
  })
})
