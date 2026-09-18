import { describe, expect, test } from 'vitest'
import { quebrarTexto, dinheiro, limparParaPdf, nota } from './texto'

/** Medidor de mentira: cada caractere vale 1. Deixa a asserção legível. */
const largura = (s: string) => s.length

describe('quebrarTexto', () => {
  test('quebra nos espaços, respeitando a largura', () => {
    expect(quebrarTexto('um dois tres quatro cinco', 12, largura)).toEqual([
      'um dois tres',
      'quatro cinco',
    ])
  })

  test('linha que cabe exata não gera linha vazia', () => {
    expect(quebrarTexto('abcde', 5, largura)).toEqual(['abcde'])
  })

  /*
    A palavra que não cabe.

    Nome de haras, URL, termo técnico emendado: sem partir, a palavra sai pela
    margem do PDF e some. Partir é feio; vazar é pior — some do documento.
  */
  test('palavra maior que a linha é partida em vez de vazar', () => {
    const linhas = quebrarTexto('supercalifragilistico', 8, largura)
    expect(linhas.every((l) => l.length <= 8)).toBe(true)
    expect(linhas.join('')).toBe('supercalifragilistico')
  })

  test('palavra gigante depois de texto normal também é partida', () => {
    const linhas = quebrarTexto('veja isto: aaaaaaaaaaaaaaaaaaaa', 10, largura)
    expect(linhas.every((l) => l.length <= 10)).toBe(true)
  })

  test('parágrafo do texto vira parágrafo no PDF', () => {
    expect(quebrarTexto('primeiro\n\nsegundo', 20, largura)).toEqual([
      'primeiro',
      '',
      'segundo',
    ])
  })

  test('espaço a mais não vira linha em branco', () => {
    expect(quebrarTexto('um    dois', 20, largura)).toEqual(['um dois'])
  })

  test('texto vazio ou ausente não gera linha nenhuma', () => {
    expect(quebrarTexto('', 20, largura)).toEqual([])
    expect(quebrarTexto('   ', 20, largura)).toEqual([])
    expect(quebrarTexto(null as unknown as string, 20, largura)).toEqual([])
  })

  test('largura absurda não trava', () => {
    expect(quebrarTexto('abc', 0, largura)).toEqual(['a', 'b', 'c'])
  })
})

describe('formatação para o laudo', () => {
  test('nota sai com uma casa e vírgula, como se escreve em português', () => {
    expect(nota(7.5)).toBe('7,5')
    expect(nota(8)).toBe('8,0')
    expect(nota(null)).toBe('—')
  })

  test('dinheiro sai em real', () => {
    expect(dinheiro(1234.5)).toBe('R$ 1.234,50')
    expect(dinheiro(0)).toBe('R$ 0,00')
  })
})

describe('limparParaPdf', () => {
  test('acento do português passa intacto', () => {
    expect(limparParaPdf('garupa, inclinação e ançã — José')).toContain('inclinação')
    expect(limparParaPdf('ç ã õ é ê í ó ú à')).toBe('ç ã õ é ê í ó ú à')
  })

  /*
    O modelo escreve com tipografia bonita: aspas curvas, travessão, reticências
    de um caractere. Nada disso existe na codificação que a fonte padrão do PDF
    usa, e a biblioteca não ignora — ela ESTOURA. Um laudo inteiro perdido por
    uma aspa.
  */
  test('tipografia que a fonte do PDF não tem vira equivalente que ela tem', () => {
    expect(limparParaPdf('\u201Cgarupa\u201D e \u2018aprumo\u2019')).toBe('"garupa" e \'aprumo\'')
    expect(limparParaPdf('boa \u2014 mas atenção')).toBe('boa - mas atenção')
    expect(limparParaPdf('etc\u2026')).toBe('etc...')
  })

  test('emoji some em vez de derrubar o documento', () => {
    expect(limparParaPdf('nota 8 ✅ boa 🐴')).toBe('nota 8  boa ')
  })

  test('vazio e nulo não quebram', () => {
    expect(limparParaPdf('')).toBe('')
    expect(limparParaPdf(null as unknown as string)).toBe('')
  })
})
