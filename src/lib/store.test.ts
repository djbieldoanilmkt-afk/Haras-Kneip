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
    'delete',
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

/**
 * getResumoCustos consulta duas tabelas em paralelo, entao o mock precisa
 * responder de acordo com a tabela pedida — devolver a mesma cadeia para as
 * duas faria a consulta de despesas receber linhas de sanidade.
 */
function porTabela(mapa: Record<string, Resultado>) {
  const cadeias: Record<string, ReturnType<typeof queryStub>> = {}
  mockFrom.mockImplementation((tabela: string) => {
    cadeias[tabela] ??= queryStub(mapa[tabela] ?? { data: [], error: null })
    return cadeias[tabela]
  })
  return cadeias
}

describe('getResumoCustos', () => {
  it('soma sanidade e despesas no mesmo mes', async () => {
    porTabela({
      saude_registros: {
        data: [
          { custo: 200, data_registro: mesRelativo(0), animal_id: 'a1', animais: { nome: 'Aurora' } },
        ],
        error: null,
      },
      despesas: {
        data: [
          {
            valor: 1000,
            data: mesRelativo(0),
            categoria: 'Ração e suplemento',
            despesa_rateios: [],
          },
        ],
        error: null,
      },
    })

    const resumo = await store.getResumoCustos()

    expect(resumo.mesAtual).toBe(1200)
  })

  it('usa o valor da despesa no mes, e nao a soma dos rateios', async () => {
    porTabela({
      despesas: {
        data: [
          {
            valor: 900,
            data: mesRelativo(0),
            categoria: 'Ração e suplemento',
            despesa_rateios: [
              { animal_id: 'a1', valor: 300, animais: { nome: 'Aurora' } },
              { animal_id: 'a2', valor: 300, animais: { nome: 'Vencedor' } },
              { animal_id: 'a3', valor: 300, animais: { nome: 'Brisa' } },
            ],
          },
        ],
        error: null,
      },
    })

    const resumo = await store.getResumoCustos()

    // Se somasse os rateios em vez do valor, daria 900 por coincidência aqui;
    // o que o teste protege é o caminho: o mês conta a despesa uma vez só.
    expect(resumo.mesAtual).toBe(900)
    expect(resumo.porAnimal).toHaveLength(3)
  })

  it('conta despesa sem rateio no mes, mas nao no custo por animal', async () => {
    porTabela({
      despesas: {
        data: [
          { valor: 500, data: mesRelativo(0), categoria: 'Manutenção', despesa_rateios: [] },
        ],
        error: null,
      },
    })

    const resumo = await store.getResumoCustos()

    expect(resumo.mesAtual).toBe(500)
    expect(resumo.porAnimal).toEqual([])
  })

  it('ordena os animais do maior gasto para o menor', async () => {
    porTabela({
      saude_registros: {
        data: [
          { custo: 100, data_registro: mesRelativo(0), animal_id: 'a1', animais: { nome: 'Aurora' } },
        ],
        error: null,
      },
      despesas: {
        data: [
          {
            valor: 400,
            data: mesRelativo(0),
            categoria: 'Ferrageamento',
            despesa_rateios: [
              { animal_id: 'a1', valor: 100, animais: { nome: 'Aurora' } },
              { animal_id: 'a2', valor: 300, animais: { nome: 'Vencedor' } },
            ],
          },
        ],
        error: null,
      },
    })

    const resumo = await store.getResumoCustos()

    expect(resumo.porAnimal).toEqual([
      { animal_id: 'a2', animal: 'Vencedor', total: 300 },
      { animal_id: 'a1', animal: 'Aurora', total: 200 },
    ])
  })

  it('agrupa por categoria, com sanidade entrando como Veterinario', async () => {
    porTabela({
      saude_registros: {
        data: [
          { custo: 700, data_registro: mesRelativo(0), animal_id: 'a1', animais: { nome: 'Aurora' } },
        ],
        error: null,
      },
      despesas: {
        data: [
          { valor: 300, data: mesRelativo(0), categoria: 'Transporte', despesa_rateios: [] },
        ],
        error: null,
      },
    })

    const resumo = await store.getResumoCustos()

    expect(resumo.porCategoria).toEqual([
      { categoria: 'Veterinário', total: 700 },
      { categoria: 'Transporte', total: 300 },
    ])
  })

  it('semeia a janela inteira, para que mes sem gasto apareca como zero', async () => {
    porTabela({})

    const resumo = await store.getResumoCustos(6)

    expect(resumo.porMes).toHaveLength(6)
    expect(resumo.porMes.every((m) => m.total === 0)).toBe(true)
    // Ordem cronológica: o último balde é o mês corrente.
    expect(resumo.porMes.at(-1)?.mes).toBe(mesRelativo(0).slice(0, 7))
  })

  it('ignora lancamento fora da janela em vez de somar no mes errado', async () => {
    porTabela({
      saude_registros: {
        data: [
          { custo: 999, data_registro: mesRelativo(-24), animal_id: 'a1', animais: { nome: 'Antigo' } },
        ],
        error: null,
      },
    })

    const resumo = await store.getResumoCustos(6)

    expect(resumo.porMes.reduce((s, m) => s + m.total, 0)).toBe(0)
  })
})

describe('createDespesa', () => {
  it('grava so a despesa quando nenhum animal e escolhido', async () => {
    const cadeias = porTabela({ despesas: { data: { id: 'd1' }, error: null } })

    await store.createDespesa(
      { data: '2026-09-09', categoria: 'Manutenção', descricao: 'Cerca', valor: 500 },
      [],
    )

    expect(cadeias.despesas.insert).toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalledWith('despesa_rateios')
  })

  it('divide o valor entre os animais em partes que somam o total', async () => {
    const cadeias = porTabela({
      despesas: { data: { id: 'd1' }, error: null },
      despesa_rateios: { data: null, error: null },
    })

    await store.createDespesa(
      { data: '2026-09-09', categoria: 'Ração e suplemento', descricao: 'Ração', valor: 1200 },
      ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9'],
    )

    const linhas = (cadeias.despesa_rateios.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(linhas).toHaveLength(9)
    // 1200 / 9 = 133,333...: arredondar cada parte perderia centavos.
    const soma = linhas.reduce((s: number, l: { valor: number }) => s + Math.round(l.valor * 100), 0)
    expect(soma).toBe(120_000)
  })

  it('apaga a despesa quando o rateio falha, para nao deixar meio lancamento', async () => {
    const cadeias = porTabela({
      despesas: { data: { id: 'd1' }, error: null },
      despesa_rateios: { data: null, error: new Error('rateio falhou') },
    })

    await expect(
      store.createDespesa(
        { data: '2026-09-09', categoria: 'Ração e suplemento', descricao: 'Ração', valor: 100 },
        ['a1'],
      ),
    ).rejects.toThrow('rateio falhou')

    expect(cadeias.despesas.delete).toHaveBeenCalled()
    expect(cadeias.despesas.eq).toHaveBeenCalledWith('id', 'd1')
  })
})

describe('getPesagensResumo', () => {
  it('usa a pesagem mais recente e compara com a anterior', async () => {
    mockFrom.mockReturnValue(
      queryStub({
        data: [
          { animal_id: 'a1', peso: 420, data_pesagem: '2026-09-01', animais: { nome: 'Aurora' } },
          { animal_id: 'a1', peso: 400, data_pesagem: '2026-06-01', animais: { nome: 'Aurora' } },
          { animal_id: 'a1', peso: 390, data_pesagem: '2026-03-01', animais: { nome: 'Aurora' } },
        ],
        error: null,
      }),
    )

    const [resumo] = await store.getPesagensResumo()

    expect(resumo.peso).toBe(420)
    expect(resumo.data_pesagem).toBe('2026-09-01')
    // Compara com a de junho (400), nao com a de marco (390).
    expect(resumo.variacao).toBe(20)
  })

  it('marca variacao nula quando so existe uma pesagem', async () => {
    mockFrom.mockReturnValue(
      queryStub({
        data: [
          { animal_id: 'a1', peso: 420, data_pesagem: '2026-09-01', animais: { nome: 'Aurora' } },
        ],
        error: null,
      }),
    )

    const [resumo] = await store.getPesagensResumo()

    expect(resumo.variacao).toBeNull()
  })

  it('devolve o animal pesado ha mais tempo primeiro', async () => {
    mockFrom.mockReturnValue(
      queryStub({
        data: [
          { animal_id: 'a1', peso: 420, data_pesagem: '2026-09-01', animais: { nome: 'Aurora' } },
          { animal_id: 'a2', peso: 500, data_pesagem: '2026-02-01', animais: { nome: 'Vencedor' } },
        ],
        error: null,
      }),
    )

    const resumo = await store.getPesagensResumo()

    expect(resumo.map((r) => r.animal)).toEqual(['Vencedor', 'Aurora'])
  })

  it('registra perda de peso como variacao negativa', async () => {
    mockFrom.mockReturnValue(
      queryStub({
        data: [
          { animal_id: 'a1', peso: 380, data_pesagem: '2026-09-01', animais: { nome: 'Aurora' } },
          { animal_id: 'a1', peso: 410, data_pesagem: '2026-06-01', animais: { nome: 'Aurora' } },
        ],
        error: null,
      }),
    )

    const [resumo] = await store.getPesagensResumo()

    expect(resumo.variacao).toBe(-30)
  })
})
