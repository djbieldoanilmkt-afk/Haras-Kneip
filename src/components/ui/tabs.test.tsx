import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

function montar(orientacao: 'horizontal' | 'vertical' = 'horizontal') {
  const { container } = render(
    <Tabs defaultValue="a" orientation={orientacao}>
      <TabsList>
        <TabsTrigger value="a">Informações</TabsTrigger>
        <TabsTrigger value="b">Genealogia</TabsTrigger>
        <TabsTrigger value="c">Saúde</TabsTrigger>
      </TabsList>
      <TabsContent value="a">conteúdo</TabsContent>
    </Tabs>,
  )
  return {
    raiz: container.querySelector('[data-slot="tabs"]') as HTMLElement,
    lista: container.querySelector('[data-slot="tabs-list"]') as HTMLElement,
    gatilho: container.querySelector('[data-slot="tabs-trigger"]') as HTMLElement,
  }
}

/**
 * Variantes `data-*` que a classe usa e que NENHUM atributo do documento pode
 * satisfazer.
 *
 * É a forma silenciosa de errar em Tailwind: a classe existe, o CSS é gerado,
 * e simplesmente nunca casa. Nada quebra — o estilo só não acontece.
 */
function variantesOrfas(elemento: HTMLElement, classe: string): string[] {
  const orfas: string[] = []
  // `data-foo:` e `group-data-foo/x:` cobram o ATRIBUTO `data-foo`.
  for (const [, nome] of classe.matchAll(/(?:^|\s|:)(?:group-)?data-([a-z-]+)[:/]/g)) {
    const atributo = `data-${nome}`
    if (!elemento.closest(`[${atributo}]`)) orfas.push(atributo)
  }
  return [...new Set(orfas)]
}

describe('Tabs', () => {
  /*
    O que quebrou a página do animal.

    O Base UI escreve `data-orientation="horizontal"`. As classes do shadcn
    cobravam `data-horizontal`, que não existe — então `flex-col` e `h-8` nunca
    aplicavam. Sem `flex-col` a raiz vira uma LINHA, e a barra de abas, como
    item de flex, estica até a altura do conteúdo inteiro. Era uma barra de
    32px ocupando meia tela.
  */
  test('nenhuma variante de dados cobra atributo que o Base UI não escreve', () => {
    const { raiz, lista, gatilho } = montar()
    expect(variantesOrfas(raiz, raiz.className)).toEqual([])
    expect(variantesOrfas(lista, lista.className)).toEqual([])
    expect(variantesOrfas(gatilho, gatilho.className)).toEqual([])
  })

  test('o Base UI marca a orientação onde as classes procuram', () => {
    const { raiz } = montar()
    expect(raiz.getAttribute('data-orientation')).toBe('horizontal')
    expect(montar('vertical').raiz.getAttribute('data-orientation')).toBe('vertical')
  })

  /*
    A altura da barra não pode depender do conteúdo das abas: é ela que deve
    mandar na própria altura.
  */
  test('a barra horizontal tem altura própria', () => {
    const { lista } = montar()
    expect(lista.className).toMatch(/data-\[orientation=horizontal\][^:]*:h-\d/)
  })

  test('em pé, a barra empilha e solta a altura', () => {
    const { lista } = montar('vertical')
    expect(lista.className).toMatch(/data-\[orientation=vertical\][^:]*:flex-col/)
  })

  /*
    Cinco abas em tela de celular não cabem. Espremer corta o rótulo; quebrar
    linha devolve o problema de altura que esta correção resolveu.
  */
  test('a barra rola de lado em vez de espremer as abas', () => {
    const { lista, gatilho } = montar()
    expect(lista.className).toMatch(/overflow-x-auto/)
    expect(gatilho.className).toMatch(/shrink-0/)
  })
})
