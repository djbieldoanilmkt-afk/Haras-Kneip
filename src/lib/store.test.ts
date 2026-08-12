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
  const encadeaveis = ['select', 'eq', 'ilike', 'order', 'gte', 'lte', 'insert', 'update', 'upsert']
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
