# Movimento de Sistema e Árvore Genealógica — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar movimento com propósito ao sistema e transformar a árvore genealógica na peça de destaque da demonstração.

**Architecture:** Animação por CSS, sem biblioteca. Três hooks cobrem o que CSS não alcança: detecção de `prefers-reduced-motion`, contagem numérica e revelação ao rolar. A árvore genealógica usa CSS Grid com linhas de altura fixa, o que permite desenhar os conectores por pseudo-elemento sem medir o DOM.

**Tech Stack:** CSS (Tailwind v4 `@theme`), React 19, `IntersectionObserver` e `matchMedia` nativos, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-12-animacoes-e-genealogia-design.md`

---

## Notas para quem executa

**O princípio inegociável é o 1 da spec:** `prefers-reduced-motion: reduce` desliga todo movimento. Há uma regra CSS global que cobre animações e transições declarativas, e o hook `useReducedMotion` cobre o que é dirigido por JavaScript (contador e revelação ao rolar). Os dois caminhos precisam existir — a regra CSS não alcança um `requestAnimationFrame`.

**Nunca anime `width`, `height`, `top` ou `left`.** Só `opacity` e `transform`.

## Estrutura de arquivos

```
src/
  index.css                      MODIFICAR  tokens de movimento, keyframes, guarda global
  hooks/
    useReducedMotion.ts          CRIAR      + teste
    useContadorAnimado.ts        CRIAR      + teste
    useRevelarAoRolar.ts         CRIAR      + teste
  components/
    StatCard.tsx                 MODIFICAR  contagem numérica
    PedigreeTree.tsx             MODIFICAR  conectores, miniaturas, revelação
    layout/AppShell.tsx          MODIFICAR  transição ao trocar de rota
  pages/
    Catalogo.tsx                 MODIFICAR  entrada escalonada dos cards
    PlantelPublico.tsx           MODIFICAR  revelação ao rolar
```

---

## Tarefa 1: Tokens de movimento e guarda global

**Files:** Modificar `src/index.css`

- [ ] **Step 1: Acrescentar o token de easing ao bloco `@theme inline`**

Dentro do `@theme inline` existente, junto das outras declarações:

```css
  --ease-saida: cubic-bezier(0.16, 1, 0.3, 1);
```

- [ ] **Step 2: Acrescentar keyframes e classes utilitárias ao final do arquivo**

```css
@layer utilities {
  @keyframes entrar {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes tracar {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(1);
    }
  }

  /* Entrada padrao. O atraso do escalonamento vem por style inline. */
  .animar-entrada {
    animation: entrar 250ms var(--ease-saida) both;
  }

  /* Revelacao ao rolar: comeca escondido e recebe .revelado pelo observer. */
  .revelar {
    opacity: 0;
    transform: translateY(16px);
    transition:
      opacity 400ms var(--ease-saida),
      transform 400ms var(--ease-saida);
  }

  .revelar.revelado {
    opacity: 1;
    transform: none;
  }

  /* Numeros em contagem nao podem tremer enquanto sobem. */
  .numero-animado {
    font-variant-numeric: tabular-nums;
  }
}

/*
  Principio 1 da spec: quem pediu menos movimento no sistema operacional
  recebe a versao estatica. Esta regra cobre animacao e transicao
  declarativas; o que e dirigido por JavaScript usa useReducedMotion.
*/
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .revelar {
    opacity: 1;
    transform: none;
  }
}
```

- [ ] **Step 3: Verificar que o build passa**

Run: `npm run build`
Expected: build conclui sem erro de CSS

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: tokens de movimento e guarda de prefers-reduced-motion"
```

---

## Tarefa 2: Hook de preferência por menos movimento

**Files:** Criar `src/hooks/useReducedMotion.ts` e `src/hooks/useReducedMotion.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReducedMotion } from './useReducedMotion'

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    })),
  )
}

beforeEach(() => vi.unstubAllGlobals())

describe('useReducedMotion', () => {
  it('devolve false quando o sistema nao pede menos movimento', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('devolve true quando o sistema pede menos movimento', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('consulta a media query correta', () => {
    mockMatchMedia(false)
    renderHook(() => useReducedMotion())
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/hooks/useReducedMotion.test.ts`
Expected: FAIL, "Failed to resolve import ./useReducedMotion"

- [ ] **Step 3: Implementar**

```ts
import { useSyncExternalStore } from 'react'

const CONSULTA = '(prefers-reduced-motion: reduce)'

/**
 * Verdadeiro quando o sistema operacional pede menos movimento.
 *
 * A regra CSS em index.css cobre animacao declarativa. Este hook cobre o que
 * e dirigido por JavaScript — contador e revelacao ao rolar —, que a regra
 * CSS nao alcanca.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (aoMudar) => {
      const mq = matchMedia(CONSULTA)
      mq.addEventListener('change', aoMudar)
      return () => mq.removeEventListener('change', aoMudar)
    },
    () => matchMedia(CONSULTA).matches,
    () => false,
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/hooks/useReducedMotion.test.ts`
Expected: PASS, 3 testes

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useReducedMotion.ts src/hooks/useReducedMotion.test.ts
git commit -m "feat: hook de deteccao de prefers-reduced-motion"
```

---

## Tarefa 3: Hook de contagem numérica

**Files:** Criar `src/hooks/useContadorAnimado.ts` e `src/hooks/useContadorAnimado.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContadorAnimado } from './useContadorAnimado'

const mockReduced = vi.fn(() => false)
vi.mock('./useReducedMotion', () => ({ useReducedMotion: () => mockReduced() }))

beforeEach(() => {
  mockReduced.mockReturnValue(false)
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('useContadorAnimado', () => {
  it('comeca em zero', () => {
    const { result } = renderHook(() => useContadorAnimado(50))
    expect(result.current).toBe(0)
  })

  it('chega ao valor final ao term do tempo', () => {
    const { result } = renderHook(() => useContadorAnimado(50, 800))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(50)
  })

  it('nunca ultrapassa o valor final', () => {
    const { result } = renderHook(() => useContadorAnimado(7, 800))
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current).toBeLessThanOrEqual(7)
  })

  it('vai direto ao valor final quando o sistema pede menos movimento', () => {
    mockReduced.mockReturnValue(true)
    const { result } = renderHook(() => useContadorAnimado(50, 800))
    expect(result.current).toBe(50)
  })

  it('devolve o valor final quando ele e zero', () => {
    const { result } = renderHook(() => useContadorAnimado(0, 800))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/hooks/useContadorAnimado.test.ts`
Expected: FAIL, "Failed to resolve import ./useContadorAnimado"

- [ ] **Step 3: Implementar**

```ts
import { useEffect, useState } from 'react'

import { useReducedMotion } from './useReducedMotion'

/** Desaceleracao cubica: rapido no inicio, suave no fim. */
function desacelerar(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Conta de zero ate `valor` em `duracao` milissegundos.
 *
 * Devolve o valor final imediatamente quando o sistema pede menos movimento.
 */
export function useContadorAnimado(valor: number, duracao = 800): number {
  const menosMovimento = useReducedMotion()
  const [atual, setAtual] = useState(menosMovimento ? valor : 0)

  useEffect(() => {
    if (menosMovimento) {
      setAtual(valor)
      return
    }

    let quadro = 0
    let inicio: number | null = null

    const passo = (agora: number) => {
      inicio ??= agora
      const progresso = Math.min((agora - inicio) / duracao, 1)
      setAtual(Math.round(desacelerar(progresso) * valor))
      if (progresso < 1) quadro = requestAnimationFrame(passo)
    }

    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [valor, duracao, menosMovimento])

  return atual
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/hooks/useContadorAnimado.test.ts`
Expected: PASS, 5 testes

Se os testes com `vi.useFakeTimers()` não avançarem o `requestAnimationFrame`, acrescente `vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })` no `beforeEach`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useContadorAnimado.ts src/hooks/useContadorAnimado.test.ts
git commit -m "feat: hook de contagem numerica com respeito a reduced-motion"
```

---

## Tarefa 4: Hook de revelação ao rolar

**Files:** Criar `src/hooks/useRevelarAoRolar.ts` e `src/hooks/useRevelarAoRolar.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRevelarAoRolar } from './useRevelarAoRolar'

const mockReduced = vi.fn(() => false)
vi.mock('./useReducedMotion', () => ({ useReducedMotion: () => mockReduced() }))

let observados: Element[] = []
let disparar: (entradas: { isIntersecting: boolean; target: Element }[]) => void

beforeEach(() => {
  mockReduced.mockReturnValue(false)
  observados = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (e: unknown[]) => void) {
        disparar = cb as never
      }
      observe(el: Element) {
        observados.push(el)
      }
      unobserve() {}
      disconnect() {}
    },
  )
})

describe('useRevelarAoRolar', () => {
  it('devolve uma ref e comeca escondido', () => {
    const { result } = renderHook(() => useRevelarAoRolar())
    expect(result.current.revelado).toBe(false)
    expect(result.current.ref).toBeDefined()
  })

  it('ja comeca revelado quando o sistema pede menos movimento', () => {
    mockReduced.mockReturnValue(true)
    const { result } = renderHook(() => useRevelarAoRolar())
    expect(result.current.revelado).toBe(true)
  })

  it('nao observa nada quando o sistema pede menos movimento', () => {
    mockReduced.mockReturnValue(true)
    const { result } = renderHook(() => useRevelarAoRolar())
    const el = document.createElement('div')
    // @ts-expect-error atribuicao direta para o teste
    result.current.ref.current = el
    expect(observados).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/hooks/useRevelarAoRolar.test.ts`
Expected: FAIL, "Failed to resolve import ./useRevelarAoRolar"

- [ ] **Step 3: Implementar**

```ts
import { useEffect, useRef, useState } from 'react'

import { useReducedMotion } from './useReducedMotion'

/**
 * Revela um elemento quando ele entra na tela.
 *
 * Revela uma unica vez: sair da tela nao desfaz. Sem o `once`, o conteudo
 * pisca ao rolar para cima e para baixo, o que cansa em lista longa.
 */
export function useRevelarAoRolar<T extends HTMLElement = HTMLDivElement>() {
  const menosMovimento = useReducedMotion()
  const ref = useRef<T>(null)
  const [revelado, setRevelado] = useState(menosMovimento)

  useEffect(() => {
    if (menosMovimento) {
      setRevelado(true)
      return
    }

    const elemento = ref.current
    if (!elemento) return

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            setRevelado(true)
            observador.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )

    observador.observe(elemento)
    return () => observador.disconnect()
  }, [menosMovimento])

  return { ref, revelado }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/hooks/useRevelarAoRolar.test.ts`
Expected: PASS, 3 testes

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRevelarAoRolar.ts src/hooks/useRevelarAoRolar.test.ts
git commit -m "feat: hook de revelacao ao rolar com IntersectionObserver"
```

---

## Tarefa 5: Contagem nas métricas do painel

**Files:** Modificar `src/components/StatCard.tsx`

- [ ] **Step 1: Reescrever o componente**

O `value` hoje aceita `number | string`. A contagem só se aplica a número; texto (como a idade média, `"7.2"`) aparece direto.

```tsx
import { useContadorAnimado } from '@/hooks/useContadorAnimado'
import { cn } from '@/lib/utils'

function Valor({ value }: { value: number | string }) {
  const contado = useContadorAnimado(typeof value === 'number' ? value : 0)
  return <>{typeof value === 'number' ? contado : value}</>
}

export function StatCard({
  value,
  label,
  highlight,
}: {
  value: number | string
  label: string
  highlight?: boolean
}) {
  return (
    <div className="border-border bg-card relative overflow-hidden rounded-lg border p-4 shadow-sm">
      {highlight && <span className="bg-primary absolute inset-y-0 left-0 w-0.5" />}
      <div
        className={cn(
          'numero-animado text-2xl font-bold tracking-tight',
          highlight && 'text-primary',
        )}
      >
        <Valor value={value} />
      </div>
      <div className="text-muted-foreground mt-1.5 text-[11px] tracking-wider uppercase">
        {label}
      </div>
    </div>
  )
}
```

O `Valor` é um componente separado porque hooks não podem ser chamados condicionalmente. Extraindo, o hook roda sempre e a condição fica no que ele renderiza.

- [ ] **Step 2: Verificar tipos e testes**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/pages`
Expected: sem erros de tipo; os smoke tests continuam passando

- [ ] **Step 3: Conferir no navegador**

Abra `#/` e confirme que os quatro números sobem de zero e param no valor certo, sem tremer.

- [ ] **Step 4: Commit**

```bash
git add src/components/StatCard.tsx
git commit -m "feat: contagem numerica nas metricas do painel"
```

---

## Tarefa 6: Transição de rota e entrada escalonada

**Files:** Modificar `src/components/layout/AppShell.tsx` e `src/pages/Catalogo.tsx`

- [ ] **Step 1: Animar a troca de rota no shell**

Em `AppShell.tsx`, importe `useLocation` do `react-router-dom` e use a chave da rota para remontar o contêiner do conteúdo, o que reinicia a animação CSS:

```tsx
import { Outlet, useLocation } from 'react-router-dom'
```

Substitua o `<main>` existente por:

```tsx
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/*
            A key faz o React remontar este div a cada rota, o que reinicia a
            animacao CSS. Sem ela a animacao so rodaria na primeira carga.
          */}
          <div key={useLocation().pathname} className="animar-entrada mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
```

Chamar `useLocation()` dentro do JSX viola as regras de hooks quando aparece em ramo condicional. Extraia para o topo do componente:

```tsx
export function AppShell() {
  const { pathname } = useLocation()
  const { open, setOpen } = useCommandPalette()
  const [menuOpen, setMenuOpen] = useState(false)
  // ...
```

e use `key={pathname}`.

- [ ] **Step 2: Escalonar a entrada dos cards do plantel**

Em `Catalogo.tsx`, no `map` que renderiza os `AnimalCard`, envolva cada card num elemento com a classe e o atraso:

```tsx
          {visiveis.map((a, i) => (
            <div
              key={a.id}
              className="animar-entrada"
              // Teto de 12: com 30ms por card e 50 animais, o ultimo apareceria
              // 1,5s depois do primeiro.
              style={{ animationDelay: `${Math.min(i, 11) * 30}ms` }}
            >
              <AnimalCard
                animal={a}
                linhagem={linhagemPorAnimal[a.id]}
                footer={/* ... mantenha o footer existente ... */}
              />
            </div>
          ))}
```

A `key` vai para o `div` externo. Como ela é o `id` do animal, alternar destaque mantém o mesmo nó do DOM e a animação **não** reinicia.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run`
Expected: sem erros; 98 testes passando

- [ ] **Step 4: Conferir no navegador**

Abra `#/catalogo`. Os cards entram em cascata. Clique em "Incluído" num card: **nenhum card pode re-animar.** Se re-animarem, a `key` está no lugar errado.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AppShell.tsx src/pages/Catalogo.tsx
git commit -m "feat: transicao de rota e entrada escalonada dos cards"
```

---

## Tarefa 7: Árvore genealógica com conectores

**Files:** Modificar `src/components/PedigreeTree.tsx`; modificar `src/index.css`

Esta é a peça de destaque. A árvore passa a ter conectores, miniatura de foto e revelação nível a nível.

**Geometria sem medição.** A árvore usa CSS Grid com **três colunas e quatro linhas de altura fixa**:

| | Coluna 1 | Coluna 2 | Coluna 3 |
|---|---|---|---|
| Linha 1 | | Pai (linhas 1-2) | Avô paterno |
| Linha 2 | Animal (linhas 1-4) | | Avó paterna |
| Linha 3 | | Mãe (linhas 3-4) | Avô materno |
| Linha 4 | | | Avó materna |

Com altura de linha fixa em `--linha`, o centro vertical de cada célula é conhecido, e os conectores viram pseudo-elementos posicionados por `calc()`. Nada é medido em JavaScript, então redimensionar a janela, mudar o zoom ou carregar a fonte depois não quebra o alinhamento.

- [ ] **Step 1: Acrescentar o CSS dos conectores ao final de `src/index.css`**

```css
@layer components {
  .pedigree {
    --linha: 3.5rem;
    --vao: 0.5rem;
    --ramo: 1.5rem;

    display: grid;
    grid-template-columns: repeat(3, minmax(9rem, 11rem));
    grid-auto-rows: var(--linha);
    column-gap: var(--ramo);
    row-gap: var(--vao);
  }

  .pedigree-no {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--card);
    overflow: hidden;
  }

  /* Ramo horizontal entrando pela esquerda de pais e avos. */
  .pedigree-no[data-ramo]::before {
    content: '';
    position: absolute;
    left: calc(var(--ramo) * -1);
    top: 50%;
    width: var(--ramo);
    height: 1px;
    background: var(--border);
    transform: scaleX(0);
    transform-origin: right;
    animation: tracar 600ms var(--ease-saida) forwards;
    animation-delay: inherit;
  }

  /*
    Chave vertical ligando o par de filhos. Fica na celula do pai/mae e vai do
    centro da primeira linha ao centro da segunda: como as linhas tem altura
    fixa, os dois recuos valem metade da altura da linha.
  */
  .pedigree-chave::after {
    content: '';
    position: absolute;
    right: calc(var(--ramo) * -1);
    top: calc(var(--linha) / 2);
    bottom: calc(var(--linha) / 2);
    width: 1px;
    background: var(--border);
    transform: scaleY(0);
    transform-origin: center;
    animation: tracar-vertical 600ms var(--ease-saida) forwards;
    /* Mesmo atraso do no que a contem, para o ramo e a chave saírem juntos. */
    animation-delay: inherit;
  }

  @keyframes tracar-vertical {
    from {
      transform: scaleY(0);
    }
    to {
      transform: scaleY(1);
    }
  }
}
```

- [ ] **Step 2: Reescrever o componente**

```tsx
import { Link } from 'react-router-dom'

import type { Genealogia } from '@/lib/database.types'
import { iniciais } from './AnimalCard'
import { cn } from '@/lib/utils'

type Ancestral = { nome: string; foto_url: string | null }
type Ancestrais = Record<string, Ancestral>

function Conteudo({ ancestral, rotulo }: { ancestral: Ancestral | null; rotulo: string }) {
  return (
    <>
      <div className="bg-secondary text-primary font-brand flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md text-[11px] font-bold">
        {ancestral?.foto_url ? (
          <img src={ancestral.foto_url} alt="" className="size-full object-cover" />
        ) : (
          iniciais(ancestral?.nome ?? null)
        )}
      </div>
      <div className="min-w-0">
        <div className="text-muted-foreground text-[10px] tracking-wide uppercase">{rotulo}</div>
        <div className="truncate text-xs font-medium">{ancestral?.nome ?? 'Desconhecido'}</div>
      </div>
    </>
  )
}

function No({
  id,
  rotulo,
  ancestrais,
  className,
  atraso,
  chave,
}: {
  id: string | null
  rotulo: string
  ancestrais: Ancestrais
  className?: string
  atraso: number
  chave?: boolean
}) {
  const ancestral = id ? (ancestrais[id] ?? null) : null
  const estilo = { animationDelay: `${atraso}ms` }

  const classes = cn(
    'pedigree-no animar-entrada',
    chave && 'pedigree-chave',
    !ancestral && 'border-dashed text-muted-foreground',
    className,
  )

  if (!ancestral || !id) {
    return (
      <div className={classes} data-ramo style={estilo}>
        <Conteudo ancestral={null} rotulo={rotulo} />
      </div>
    )
  }

  return (
    <Link
      to={`/animal/${id}`}
      className={cn(classes, 'hover:border-primary hover:bg-accent transition-colors')}
      data-ramo
      style={estilo}
    >
      <Conteudo ancestral={ancestral} rotulo={rotulo} />
    </Link>
  )
}

/**
 * Arvore genealogica em tres geracoes.
 *
 * Esta e a primeira versao que funciona. O componente legado
 * (js/components/pedigreeTree.js) devolvia uma string HTML enquanto
 * js/pages/profile.js:177 chamava passando um container, entao a arvore
 * nunca chegou a aparecer na tela.
 */
export function PedigreeTree({
  genealogia,
  ancestrais,
  animalNome,
  animalFoto,
}: {
  genealogia: Genealogia | null
  ancestrais: Ancestrais
  animalNome: string
  animalFoto?: string | null
}) {
  if (!genealogia) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Sem dados de genealogia. Use "Editar genealogia" para informar pai e mãe.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto p-2">
      <div className="pedigree">
        <div
          className="pedigree-no pedigree-chave animar-entrada border-primary col-start-1 row-span-4 self-center border-2"
          style={{ animationDelay: '0ms' }}
        >
          <Conteudo ancestral={{ nome: animalNome, foto_url: animalFoto ?? null }} rotulo="Animal" />
        </div>

        <No
          id={genealogia.pai_id}
          rotulo="Pai"
          ancestrais={ancestrais}
          className="col-start-2 row-span-2 row-start-1 self-center"
          atraso={120}
          chave
        />
        <No
          id={genealogia.mae_id}
          rotulo="Mãe"
          ancestrais={ancestrais}
          className="col-start-2 row-span-2 row-start-3 self-center"
          atraso={120}
          chave
        />

        <No
          id={genealogia.avo_paterno_id}
          rotulo="Avô paterno"
          ancestrais={ancestrais}
          className="col-start-3 row-start-1"
          atraso={240}
        />
        <No
          id={genealogia.avo_paterna_id}
          rotulo="Avó paterna"
          ancestrais={ancestrais}
          className="col-start-3 row-start-2"
          atraso={240}
        />
        <No
          id={genealogia.avo_materno_id}
          rotulo="Avô materno"
          ancestrais={ancestrais}
          className="col-start-3 row-start-3"
          atraso={240}
        />
        <No
          id={genealogia.avo_materna_id}
          rotulo="Avó materna"
          ancestrais={ancestrais}
          className="col-start-3 row-start-4"
          atraso={240}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Atualizar o teste existente para a nova interface**

O componente deixa de receber `nomes: Record<string, string>` e passa a receber `ancestrais: Record<string, {nome, foto_url}>`. Em `src/components/PedigreeTree.test.tsx`, troque a constante e a prop:

```tsx
const ANCESTRAIS = {
  p1: { nome: 'Vencedor JK', foto_url: null },
  m1: { nome: 'Estrela do Sul', foto_url: null },
  ap1: { nome: 'Rei do Vale', foto_url: null },
}

function renderArvore(g: Genealogia | null) {
  return render(
    <MemoryRouter>
      <PedigreeTree genealogia={g} ancestrais={ANCESTRAIS} animalNome="Aurora da Kneip" />
    </MemoryRouter>,
  )
}
```

O teste "nao cria link para ancestral desconhecido" espera exatamente 1 link. Continua correto: o nó do animal não é link.

- [ ] **Step 4: Atualizar o chamador em `src/pages/Perfil.tsx`**

Na `AbaGenealogia`, a variável `nomes` deixa de existir. Passe o mapa direto, que já tem o formato certo:

```tsx
      {loading ? (
        <Skeleton className="h-56 rounded-lg" />
      ) : (
        <PedigreeTree
          genealogia={genealogia}
          ancestrais={mapa}
          animalNome={animal.nome}
          animalFoto={animal.foto_url}
        />
      )}
```

O `nomeDe` usado no diálogo de edição ainda precisa dos nomes. Troque a implementação:

```tsx
  const nomeDe = (id: string | null) => (id && mapa[id]?.nome) || DESCONHECIDO
```

e remova a linha que construía `nomes`.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run`
Expected: sem erros; todos os testes passando

- [ ] **Step 6: Conferir no navegador**

Abra o perfil de um animal com pai e mãe cadastrados e vá à aba Genealogia. Confirme:
1. As linhas conectoras aparecem ligando animal → pais → avós
2. As caixas entram em três ondas: animal, pais, avós
3. Em 375px de largura a árvore rola horizontalmente sem quebrar o layout

- [ ] **Step 7: Commit**

```bash
git add src/components/PedigreeTree.tsx src/components/PedigreeTree.test.tsx src/pages/Perfil.tsx src/index.css
git commit -m "feat: arvore genealogica com conectores, miniaturas e revelacao"
```

---

## Tarefa 8: Revelação ao rolar na vitrine pública

**Files:** Modificar `src/pages/PlantelPublico.tsx`

- [ ] **Step 1: Extrair o card para um componente com revelação**

Dentro de `PlantelPublico.tsx`, acima do componente da página, crie:

```tsx
function CardRevelavel({ children, atraso }: { children: React.ReactNode; atraso: number }) {
  const { ref, revelado } = useRevelarAoRolar<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={cn('revelar', revelado && 'revelado')}
      style={{ transitionDelay: `${atraso}ms` }}
    >
      {children}
    </div>
  )
}
```

Importe `useRevelarAoRolar` de `@/hooks/useRevelarAoRolar` e `cn` de `@/lib/utils`.

- [ ] **Step 2: Envolver cada card da grade**

No `map` dos animais, envolva o `<button>` existente:

```tsx
            {animais.map((a, i) => {
              const linhagem = linhagens[a.id]
              return (
                <CardRevelavel key={a.id} atraso={(i % 3) * 80}>
                  <button
                    type="button"
                    onClick={() => setSelecionado(a)}
                    className="w-full overflow-hidden rounded-xl border border-black/8 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    {/* ... conteudo existente do card, sem alteracao ... */}
                  </button>
                </CardRevelavel>
              )
            })}
```

O atraso usa `i % 3` para escalonar por posição na linha da grade, não pela posição absoluta: o quarto card começa uma linha nova e deve entrar junto com o primeiro dela, não 240ms depois.

A `key` migra para o `CardRevelavel` e o `<button>` ganha `w-full`, já que agora está dentro de um contêiner.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/pages`
Expected: sem erros; smoke tests passando

O jsdom não implementa `IntersectionObserver`. Se o smoke test da vitrine falhar, adicione ao `src/test/setup.ts`:

```ts
class IntersectionObserverFake {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverFake)
```

com `import { vi } from 'vitest'` no topo do arquivo.

- [ ] **Step 4: Conferir no navegador**

Abra `#/plantel` e role a página. Os cards aparecem conforme entram na tela e não somem ao rolar de volta.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PlantelPublico.tsx src/test/setup.ts
git commit -m "feat: revelacao ao rolar na vitrine publica"
```

---

## Tarefa 9: Entrada do conteúdo carregado e animação dos gráficos

Cobre as duas últimas linhas da tabela A da spec.

**Files:** Modificar `src/pages/Dashboard.tsx`, `src/pages/Relatorios.tsx`, `src/components/charts/*.tsx`

- [ ] **Step 1: Conferir se o Recharts está animando**

Abra `#/` e observe os dois gráficos ao carregar. O Recharts anima por padrão (`isAnimationActive` é `true`). Se as fatias já aparecerem inteiras, acrescente explicitamente aos componentes `<Pie>`, `<Bar>` e `<Area>`:

```tsx
          isAnimationActive
          animationDuration={600}
          animationEasing="ease-out"
```

Se já estiverem animando, não mexa — o padrão da biblioteca é adequado.

- [ ] **Step 2: Fazer o conteúdo carregado entrar com opacidade**

Nos blocos que trocam `Skeleton` por conteúdo, acrescente `animar-entrada` ao contêiner do conteúdo. Em `Dashboard.tsx`, nos dois cartões de gráfico:

```tsx
          {carregandoAnimais ? (
            <Skeleton className="h-[280px] rounded-lg" />
          ) : (
            <div className="animar-entrada">
              <PelagemChart data={contar((animais ?? []).map((a) => a.pelagem))} />
            </div>
          )}
```

Repita para o `StatusChart` do painel e para os três gráficos de `Relatorios.tsx`.

Não é preciso fazer o mesmo nas métricas: elas já têm a contagem numérica, que cumpre o papel de sinalizar chegada de dado.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run`
Expected: sem erros; todos os testes passando

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Relatorios.tsx src/components/charts
git commit -m "feat: entrada do conteudo carregado e animacao dos graficos"
```

---

## Tarefa 10: Verificação final

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: todos os testes passando. Anote o total.

- [ ] **Step 2: Tipos e build**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: sem erros

- [ ] **Step 3: Verificar o desligamento por preferência do sistema**

Este é o critério mais fácil de quebrar sem perceber, porque nada na tela indica que ele falhou.

No Chrome: DevTools → menu de três pontos → More tools → Rendering → **Emulate CSS media feature prefers-reduced-motion: reduce**.

Com a emulação ligada, percorra `#/`, `#/catalogo`, o perfil de um animal na aba Genealogia e `#/plantel`. Confirme:
1. Nenhum movimento em nenhuma delas
2. As métricas do painel mostram o valor final de imediato, sem contar
3. Os cards da vitrine aparecem já visíveis, sem depender de rolagem
4. A árvore genealógica aparece completa, com os conectores desenhados

- [ ] **Step 4: Verificar que a grade não re-anima**

Em `#/catalogo`, clique em "Incluído" em três cards diferentes. Nenhum card pode re-animar.

- [ ] **Step 5: Conferir em 375px**

Reduza a janela para 375px e percorra as mesmas telas. Sem estouro horizontal, e a árvore genealógica rolando dentro do próprio contêiner.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "chore: verificacao final de movimento e genealogia"
```

---

## Critérios de aceite

Espelham a seção "Critérios de sucesso" da spec:

1. Com `prefers-reduced-motion: reduce`, nenhuma animação roda e todo conteúdo aparece no estado final.
2. Alternar o destaque de um animal no plantel não re-anima a grade.
3. A árvore genealógica mostra conectores e miniaturas, e continua legível em 375px.
4. Nenhuma animação de `width`, `height`, `top` ou `left`.
5. Os testes existentes continuam passando, mais cobertura nova para os três hooks.
