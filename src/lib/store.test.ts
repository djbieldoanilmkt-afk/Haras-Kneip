import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { store } from './store'

type Resultado = { data: unknown; error: unknown }

/**
 * Imita o query builder do supabase-js: todo método encadeável devolve o
 * próprio objeto, e o objeto é "thenable" para poder ser aguardado.
 */
function queryStub(result: Resultado) {
  const chain: Record<string, unknown> = {}
  const encadeaveis = [
    'select',
    'eq',
    'ilike',
    'order',
    'gte',
    'lte',
    'not',
    'is',
    'insert',
    'update',
    'upsert',
  ]
  for (const metodo of encadeaveis) {
    chain[metodo] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve: (v: Resultado) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

beforeEach(() => mockFrom.mockReset())

describe('getAnimais', () => {
  it('consulta a tabela animais filtrando por ativo e ordenando por nome', async () => {
    const chain = queryStub({ data: [{ id: '1', nome: 'Aurora' }], error: null })
    mockFrom.mockReturnValue(chain)

    const result = await store.getAnimais()

    expect(mockFrom).toHaveBeenCalledWith('animais')
    expect(chain.eq).toHaveBeenCalledWith('ativo', true)
    expect(chain.order).toHaveBeenCalledWith('nome')
    expect(result).toEqual([{ id: '1', nome: 'Aurora' }])
  })

  it('aplica filtro de destaque quando informado', async () => {
    const chain = queryStub({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await store.getAnimais({ em_destaque: true })

    expect(chain.eq).toHaveBeenCalledWith('em_destaque', true)
  })

  it('aplica busca por nome com ilike', async () => {
    const chain = queryStub({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await store.getAnimais({ search: 'aurora' })

    expect(chain.ilike).toHaveBeenCalledWith('nome', '%aurora%')
  })

  it('usa orderBy customizado quando informado', async () => {
    const chain = queryStub({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await store.getAnimais({ orderBy: 'created_at', ascending: false })

    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('propaga erro do Supabase', async () => {
    mockFrom.mockReturnValue(queryStub({ data: null, error: new Error('falha') }))
    await expect(store.getAnimais()).rejects.toThrow('falha')
  })

  it('devolve lista vazia quando data vem nula sem erro', async () => {
    mockFrom.mockReturnValue(queryStub({ data: null, error: null }))
    await expect(store.getAnimais()).resolves.toEqual([])
  })
})

describe('deleteAnimal', () => {
  it('faz exclusao logica marcando ativo como false', async () => {
    const chain = queryStub({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await store.deleteAnimal('abc')

    expect(chain.update).toHaveBeenCalledWith({ ativo: false })
    expect(chain.eq).toHaveBeenCalledWith('id', 'abc')
  })
})

describe('getGenealogia', () => {
  it('devolve null quando o registro nao existe (PGRST116)', async () => {
    const chain = queryStub({ data: null, error: { code: 'PGRST116' } })
    mockFrom.mockReturnValue(chain)

    await expect(store.getGenealogia('a1')).resolves.toBeNull()
  })

  it('propaga outros erros', async () => {
    const chain = queryStub({ data: null, error: { code: '42P01', message: 'sem tabela' } })
    mockFrom.mockReturnValue(chain)

    await expect(store.getGenealogia('a1')).rejects.toBeDefined()
  })
})

describe('createAnotacao', () => {
  it('grava nas colunas reais titulo e conteudo', async () => {
    const chain = queryStub({ data: [{ id: 'n1' }], error: null })
    mockFrom.mockReturnValue(chain)

    await store.createAnotacao({
      animal_id: 'a1',
      titulo: 'Ferrageamento',
      conteudo: 'Casco dianteiro direito',
      data_registro: '2026-08-12',
    })

    expect(mockFrom).toHaveBeenCalledWith('anotacoes')
    const enviado = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0][0]
    expect(enviado).toHaveProperty('titulo')
    expect(enviado).toHaveProperty('conteudo')
    expect(enviado).not.toHaveProperty('texto')
    expect(enviado).not.toHaveProperty('autor')
  })
})

describe('createReproducao', () => {
  it('grava nas colunas reais tipo, garanhao e data_prevista_parto', async () => {
    const chain = queryStub({ data: [{ id: 'r1' }], error: null })
    mockFrom.mockReturnValue(chain)

    await store.createReproducao({
      animal_id: 'a1',
      tipo: 'Parto',
      garanhao: 'Vencedor JK',
      data_evento: '2026-08-12',
      data_prevista_parto: null,
    })

    const enviado = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0][0]
    expect(enviado).toHaveProperty('tipo')
    expect(enviado).toHaveProperty('garanhao')
    expect(enviado).not.toHaveProperty('tipo_evento')
    expect(enviado).not.toHaveProperty('parceiro_nome')
    expect(enviado).not.toHaveProperty('previsao_parto')
  })
})

describe('getAnimaisMap', () => {
  it('devolve um mapa de id para nome e foto', async () => {
    mockFrom.mockReturnValue(
      queryStub({
        data: [
          { id: 'a1', nome: 'Aurora', foto_url: null },
          { id: 'a2', nome: 'Vencedor', foto_url: 'x.jpg' },
        ],
        error: null,
      }),
    )

    const mapa = await store.getAnimaisMap()

    expect(mapa).toEqual({
      a1: { nome: 'Aurora', foto_url: null },
      a2: { nome: 'Vencedor', foto_url: 'x.jpg' },
    })
  })
})

/** Primeiro dia do mês corrente deslocado, no calendário local. */
function mesRelativo(deslocamento: number): string {
  const agora = new Date()
  const d = new Date(agora.getFullYear(), agora.getMonth() + deslocamento, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

describe('getPendenciasSanitarias', () => {
  it('achata o nome do animal embutido e ordena pela data de retorno', async () => {
    const chain = queryStub({
      data: [
        {
          id: 's1',
          animal_id: 'a1',
          tipo: 'Vacina',
          descricao: 'Influenza',
          proxima_data: '2026-09-20',
          animais: { nome: 'Aurora' },
        },
      ],
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const result = await store.getPendenciasSanitarias()

    expect(mockFrom).toHaveBeenCalledWith('saude_registros')
    expect(chain.not).toHaveBeenCalledWith('proxima_data', 'is', null)
    expect(chain.order).toHaveBeenCalledWith('proxima_data', { ascending: true })
    expect(result).toEqual([
      {
        id: 's1',
        animal_id: 'a1',
        animal: 'Aurora',
        tipo: 'Vacina',
        descricao: 'Influenza',
        proxima_data: '2026-09-20',
      },
    ])
  })

  it('nao quebra quando o vinculo com o animal vem nulo', async () => {
    mockFrom.mockReturnValue(
      queryStub({
        data: [
          {
            id: 's1',
            animal_id: 'a1',
            tipo: 'Exame',
            descricao: 'AIE',
            proxima_data: '2026-09-20',
            animais: null,
          },
        ],
        error: null,
      }),
    )

    const [pendencia] = await store.getPendenciasSanitarias()

    expect(pendencia.animal).toBe('Animal removido')
  })
})

describe('getPartosPrevistos', () => {
  it('descarta previsoes cuja cria ja foi cadastrada', async () => {
    const chain = queryStub({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await store.getPartosPrevistos()

    expect(mockFrom).toHaveBeenCalledWith('reproducao')
    expect(chain.is).toHaveBeenCalledWith('cria_id', null)
  })

  it('nomeia a constraint no embed, senao o PostgREST recusa por ambiguidade', async () => {
    const chain = queryStub({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await store.getPartosPrevistos()

    // reproducao tem duas chaves para animais (animal_id e cria_id).
    expect(chain.select).toHaveBeenCalledWith(
      expect.stringContaining('animais!reproducao_animal_id_fkey(nome)'),
    )
  })
})

describe('getResumoCustos', () => {
  it('soma por mes e por animal, e ordena os animais do maior gasto para o menor', async () => {
    mockFrom.mockReturnValue(
      queryStub({
        data: [
          { custo: 100, data_registro: mesRelativo(0), animal_id: 'a1', animais: { nome: 'Aurora' } },
          { custo: 50, data_registro: mesRelativo(0), animal_id: 'a1', animais: { nome: 'Aurora' } },
          { custo: 300, data_registro: mesRelativo(0), animal_id: 'a2', animais: { nome: 'Vencedor' } },
          { custo: 80, data_registro: mesRelativo(-1), animal_id: 'a1', animais: { nome: 'Aurora' } },
        ],
        error: null,
      }),
    )

    const resumo = await store.getResumoCustos()

    expect(resumo.mesAtual).toBe(450)
    expect(resumo.mesAnterior).toBe(80)
    expect(resumo.porAnimal).toEqual([
      { animal_id: 'a2', animal: 'Vencedor', total: 300 },
      { animal_id: 'a1', animal: 'Aurora', total: 230 },
    ])
  })

  it('semeia a janela inteira, para que mes sem gasto apareca como zero', async () => {
    mockFrom.mockReturnValue(queryStub({ data: [], error: null }))

    const resumo = await store.getResumoCustos(6)

    expect(resumo.porMes).toHaveLength(6)
    expect(resumo.porMes.every((m) => m.total === 0)).toBe(true)
    // Ordem cronológica: o último balde é o mês corrente.
    expect(resumo.porMes.at(-1)?.mes).toBe(mesRelativo(0).slice(0, 7))
  })

  it('ignora lancamento fora da janela em vez de somar no mes errado', async () => {
    mockFrom.mockReturnValue(
      queryStub({
        data: [
          { custo: 999, data_registro: mesRelativo(-24), animal_id: 'a1', animais: { nome: 'Antigo' } },
        ],
        error: null,
      }),
    )

    const resumo = await store.getResumoCustos(6)

    expect(resumo.porMes.reduce((s, m) => s + m.total, 0)).toBe(0)
  })
})
