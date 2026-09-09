import { describe, it, expect } from 'vitest'

import { SEM_LOCAL, agruparPorLocal, completudeDoCadastro, lacunasDeCadastro } from './plantel'
import type { Animal } from './database.types'

function animal(parcial: Partial<Animal>): Animal {
  return {
    id: 'a1',
    nome: 'Aurora',
    apelido: null,
    registro: null,
    registro_abccmm: null,
    raca: 'Mangalarga Marchador',
    pelagem: 'Tordilha',
    tipo_marcha: 'Marcha Batida',
    sexo: 'Fêmea',
    data_nascimento: '2020-05-11',
    peso: null,
    altura: null,
    baia_piquete: null,
    status_reprodutivo: 'Vazia',
    status_saude: null,
    premiacao: null,
    foto_url: null,
    observacoes: null,
    em_destaque: false,
    ativo: true,
    created_at: '2024-01-01',
    updated_at: null,
    ...parcial,
  } as Animal
}

describe('agruparPorLocal', () => {
  it('agrupa por baia ou piquete em ordem alfabetica', () => {
    const lotes = agruparPorLocal([
      animal({ id: '1', baia_piquete: 'Piquete 2' }),
      animal({ id: '2', baia_piquete: 'Baia 1' }),
      animal({ id: '3', baia_piquete: 'Piquete 2' }),
    ])

    expect(lotes.map((l) => l.local)).toEqual(['Baia 1', 'Piquete 2'])
    expect(lotes[1].animais).toHaveLength(2)
  })

  it('joga o balde sem local para o fim, mesmo sendo o maior', () => {
    const lotes = agruparPorLocal([
      animal({ id: '1', baia_piquete: null }),
      animal({ id: '2', baia_piquete: null }),
      animal({ id: '3', baia_piquete: null }),
      animal({ id: '4', baia_piquete: 'Piquete 1' }),
    ])

    expect(lotes.at(-1)?.local).toBe(SEM_LOCAL)
    expect(lotes.at(-1)?.animais).toHaveLength(3)
  })

  it('trata local so com espacos como ausente, e nao como um lugar chamado " "', () => {
    const lotes = agruparPorLocal([animal({ id: '1', baia_piquete: '   ' })])
    expect(lotes[0].local).toBe(SEM_LOCAL)
  })

  it('ordena respeitando acento do portugues', () => {
    const lotes = agruparPorLocal([
      animal({ id: '1', baia_piquete: 'Área B' }),
      animal({ id: '2', baia_piquete: 'Aroeira' }),
    ])

    // Em ordem por código de caractere, "Área" cairia depois de "Aroeira".
    expect(lotes.map((l) => l.local)).toEqual(['Área B', 'Aroeira'])
  })
})

describe('lacunasDeCadastro', () => {
  it('conta quantos animais faltam em cada campo, do mais furado para o menos', () => {
    const lacunas = lacunasDeCadastro([
      animal({ id: '1', foto_url: null, registro_abccmm: 'A1', baia_piquete: 'P1' }),
      animal({ id: '2', foto_url: null, registro_abccmm: null, baia_piquete: 'P1' }),
    ])

    expect(lacunas[0]).toEqual({ campo: 'foto_url', rotulo: 'Sem foto', faltando: 2 })
    expect(lacunas.find((l) => l.campo === 'registro_abccmm')?.faltando).toBe(1)
  })

  it('omite campo sem nenhuma falta, em vez de listar zero', () => {
    const lacunas = lacunasDeCadastro([
      animal({ id: '1', foto_url: 'x.jpg', registro_abccmm: 'A1', baia_piquete: 'P1' }),
    ])

    expect(lacunas.some((l) => l.campo === 'foto_url')).toBe(false)
  })
})

describe('completudeDoCadastro', () => {
  it('devolve 100 para plantel completo', () => {
    const cheio = animal({
      id: '1',
      foto_url: 'x.jpg',
      registro_abccmm: 'A1',
      baia_piquete: 'P1',
      pelagem: 'Tordilha',
      data_nascimento: '2020-01-01',
    })
    expect(completudeDoCadastro([cheio])).toBe(100)
  })

  it('devolve 100 para plantel vazio, e nao 0', () => {
    // Conta recem-criada nao tem nada por preencher; "0% completo" seria uma
    // reprimenda sem sentido.
    expect(completudeDoCadastro([])).toBe(100)
  })

  it('mede a fracao de campos preenchidos, nao a de animais completos', () => {
    // 5 campos cobrados; este animal tem 3 preenchidos (pelagem, nascimento,
    // piquete) e 2 vazios (foto, ABCCMM) => 60%.
    const parcial = animal({ id: '1', baia_piquete: 'P1' })
    expect(completudeDoCadastro([parcial])).toBe(60)
  })
})
