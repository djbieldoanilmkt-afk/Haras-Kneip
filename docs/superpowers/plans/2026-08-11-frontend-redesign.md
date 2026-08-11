# Redesign do Frontend — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o frontend em JS vanilla do Haras Kneip por um app React com identidade visual própria, mantendo paridade total de funcionalidade.

**Architecture:** App React de página única com HashRouter, construído em `src/` enquanto o app legado continua servível em `legacy.html`. A lógica de acesso a dados do `js/store.js` é portada para `src/lib/store.ts` tipado e consumida por hooks. Estilo por tokens Tailwind v4 declarados em CSS, com componentes shadcn/ui.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, React Router (HashRouter), Recharts, lucide-react, Sonner, Supabase JS, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-11-frontend-redesign-design.md`

---

## Notas para quem executa

**O app legado é a fonte de verdade comportamental.** As tarefas de página listam explicitamente os comportamentos a preservar, com referência a arquivo e linha. Antes de escrever uma página, leia o arquivo legado correspondente por inteiro.

**Três defeitos conhecidos, encontrados durante o planejamento:**

1. `js/components/pedigreeTree.js:1` declara `renderPedigreeTree(genealogia, animaisMap)` e retorna uma string HTML, mas `js/pages/profile.js:177` chama `renderPedigreeTree(container, genealogia, animaisMap)` e ignora o retorno. **A árvore genealógica nunca aparece hoje.** A Tarefa 18 a implementa funcionando.
2. `js/components/charts.js:3-11` usa paleta de tema escuro (texto `#b8a892`, borda `#1a1410`) sobre fundo claro. A Tarefa 15 substitui por cores derivadas dos tokens.
3. `js/pages/animalForm.js:167-175` grava fotos como data URL base64 na coluna `foto_url`. Isso infla as linhas da tabela `animais`. **Está fora do escopo deste plano** — o comportamento é portado como está.

**Código morto removido (não portar):** `js/components/timeline.js` inteiro, `initNascimentosChart` em `js/components/charts.js:126`, e de `js/utils/helpers.js` as funções `getStatusIcon`, `debounce`, `generateId`, `formatCurrency`, `capitalize`, `truncate`. Nenhuma é importada em lugar algum.

**Validadores:** `js/utils/validators.js` também é código morto hoje, mas as quatro funções são portadas e **ligadas aos formulários** (Tarefas 7, 19 e 21). Isso conclui algo que já estava escrito, não adiciona funcionalidade nova.

---

## Estrutura de arquivos

```
index.html                    # NOVO: entrada do Vite
legacy.html                   # RENOMEADO de index.html, app antigo, removido na Tarefa 25
src/
  main.tsx                    # bootstrap React
  App.tsx                     # HashRouter + rotas
  index.css                   # Tailwind + tokens do design system
  vite-env.d.ts
  lib/
    supabase.ts               # cliente, lê variáveis de ambiente
    database.types.ts         # tipos gerados do schema
    store.ts                  # porte tipado de js/store.js
    utils.ts                  # cn() do shadcn
    format.ts                 # formatDate, calcularIdade
    status.ts                 # mapas de cor/rótulo de status
    validators.ts             # porte de js/utils/validators.js
  hooks/
    useAsync.ts               # loading/erro/dados para chamadas do store
    useTheme.ts               # tema claro/escuro persistido
  components/
    ui/                       # gerado pelo shadcn CLI
    layout/
      AppShell.tsx            # sidebar + topbar + <Outlet/>
      AppSidebar.tsx
      Topbar.tsx
      Brand.tsx               # monograma HK + nome
      ThemeToggle.tsx
      CommandPalette.tsx      # busca global Ctrl+K
    PageHeader.tsx
    StatCard.tsx
    AnimalCard.tsx
    StatusBadge.tsx
    PedigreeTree.tsx
    charts/
      PelagemChart.tsx
      StatusChart.tsx
      IdadeChart.tsx
      PesagemChart.tsx
    voice/
      voiceWizard.ts          # porte da lógica de js/components/voiceAssistant.js
      VoiceAssistantDialog.tsx
  pages/
    Dashboard.tsx
    Catalogo.tsx
    AnimalForm.tsx
    Perfil.tsx
    Calendario.tsx
    Relatorios.tsx
    Configuracoes.tsx
    PlantelPublico.tsx
  test/
    setup.ts
```

Cada arquivo tem uma responsabilidade. `format.ts`, `status.ts` e `validators.ts` são separados porque mudam por motivos diferentes e são os alvos naturais de teste unitário.

---

## Tarefa 1: Scaffold do projeto

**Files:**
- Rename: `index.html` → `legacy.html`
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

- [ ] **Step 1: Preservar o app legado**

```bash
git mv index.html legacy.html
```

- [ ] **Step 2: Scaffold do Vite numa pasta temporária e subir os arquivos**

```bash
npm create vite@latest .vite-tmp -- --template react-ts
```

- [ ] **Step 3: Mover os arquivos gerados para a raiz e limpar**

```bash
mv .vite-tmp/package.json .vite-tmp/vite.config.ts .vite-tmp/tsconfig.json .vite-tmp/tsconfig.app.json .vite-tmp/tsconfig.node.json .vite-tmp/index.html .
mv .vite-tmp/src/vite-env.d.ts src/
rm -rf .vite-tmp
rm -f src/App.css src/index.css src/assets/react.svg
```

- [ ] **Step 4: Instalar dependências**

```bash
npm install
npm install react-router-dom @supabase/supabase-js recharts lucide-react sonner
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 5: Configurar Vite com alias e Vitest**

Escreva `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 6: Registrar o alias no TypeScript**

Em `tsconfig.app.json`, dentro de `compilerOptions`, acrescente:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 7: Criar o setup de testes**

Escreva `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 8: Adicionar o script de teste**

Em `package.json`, dentro de `"scripts"`, acrescente:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 9: Verificar que o build roda**

Run: `npm run build`
Expected: build conclui e cria `dist/`

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript + Vitest"
```

---

## Tarefa 2: Design system em tokens

**Files:**
- Create: `src/index.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Instalar Tailwind v4 e as fontes**

```bash
npm install -D tailwindcss @tailwindcss/vite tw-animate-css
npm install @fontsource-variable/inter @fontsource/playfair-display
```

- [ ] **Step 2: Registrar o plugin do Tailwind no Vite**

Em `vite.config.ts`, importe e adicione ao array `plugins`:

```ts
import tailwindcss from '@tailwindcss/vite'
// plugins: [react(), tailwindcss()],
```

- [ ] **Step 3: Escrever os tokens**

Escreva `src/index.css`. Os valores vêm da spec, seção "Design system":

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@fontsource-variable/inter";
@import "@fontsource/playfair-display/600.css";
@import "@fontsource/playfair-display/700.css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: #FBFBFC;
  --foreground: #14161A;
  --card: #FFFFFF;
  --card-foreground: #14161A;
  --popover: #FFFFFF;
  --popover-foreground: #14161A;
  --primary: #1E5B3A;
  --primary-foreground: #FFFFFF;
  --secondary: #F1F2F5;
  --secondary-foreground: #14161A;
  --muted: #F1F2F5;
  --muted-foreground: #868C96;
  --accent: #E9F1EC;
  --accent-foreground: #1E5B3A;
  --destructive: #C0332F;
  --destructive-foreground: #FFFFFF;
  --border: #E7E8EC;
  --input: #E7E8EC;
  --ring: #1E5B3A;

  --status-vazia: #6B7280;
  --status-prenha: #B45309;
  --status-lactante: #0F766E;
  --status-cobertura: #1D4ED8;
  --status-potro: #C2410C;

  --radius: 0.5rem;
}

.dark {
  --background: #0F1115;
  --foreground: #E8EAED;
  --card: #16181D;
  --card-foreground: #E8EAED;
  --popover: #16181D;
  --popover-foreground: #E8EAED;
  --primary: #4FA97A;
  --primary-foreground: #0F1115;
  --secondary: #1E222A;
  --secondary-foreground: #E8EAED;
  --muted: #1E222A;
  --muted-foreground: #8B919B;
  --accent: #1B2A22;
  --accent-foreground: #4FA97A;
  --destructive: #E5645F;
  --destructive-foreground: #0F1115;
  --border: #24272E;
  --input: #24272E;
  --ring: #4FA97A;

  --status-vazia: #9CA3AF;
  --status-prenha: #FBBF24;
  --status-lactante: #2DD4BF;
  --status-cobertura: #60A5FA;
  --status-potro: #FB923C;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-status-vazia: var(--status-vazia);
  --color-status-prenha: var(--status-prenha);
  --color-status-lactante: var(--status-lactante);
  --color-status-cobertura: var(--status-cobertura);
  --color-status-potro: var(--status-potro);

  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-brand: "Playfair Display", ui-serif, Georgia, serif;

  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
  --radius-xl: calc(var(--radius) + 8px);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
    font-size: 0.875rem;
    line-height: 1.5;
  }
  h1, h2, h3, h4 {
    @apply tracking-tight font-semibold text-foreground;
  }
}
```

- [ ] **Step 4: Importar o CSS no bootstrap**

Escreva `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erro de CSS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: design system em tokens Tailwind com tema claro e escuro"
```

---

## Tarefa 3: shadcn/ui

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/*`

- [ ] **Step 1: Inicializar o shadcn**

```bash
npx shadcn@latest init -d
```

Se o CLI perguntar, responda: estilo `new-york`, cor base `neutral`, variáveis CSS `sim`. O arquivo `src/index.css` já contém os tokens — **não deixe o CLI sobrescrevê-lo**. Se sobrescrever, restaure com `git checkout src/index.css`.

- [ ] **Step 2: Adicionar os componentes usados pelo plano**

```bash
npx shadcn@latest add button card input label select textarea dialog badge table tabs skeleton sonner separator dropdown-menu command sheet tooltip avatar
```

- [ ] **Step 3: Conferir que o alias resolve**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: adiciona componentes base do shadcn/ui"
```

---

## Tarefa 4: Cliente Supabase e variáveis de ambiente

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/database.types.ts`, `.env`, `.env.example`
- Modify: `.gitignore`

**Contexto:** hoje URL e chave estão fixas em `js/supabase.js:3-4`. A chave `anon` é pública por design, mas sai do código-fonte.

- [ ] **Step 1: Ignorar o `.env`**

Acrescente ao final de `.gitignore`:

```
# Variaveis de ambiente
.env
.env.local
```

- [ ] **Step 2: Criar `.env` com os valores atuais**

Escreva `.env`, copiando os valores de `js/supabase.js:3-4`:

```
VITE_SUPABASE_URL=https://nesnxcmdfksakgspvkcg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lc254Y21kZmtzYWtnc3B2a2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzkxMjgsImV4cCI6MjEwMTkxNTEyOH0.M6IVTgWjow4gDCHH5DmJYRwRzSSQm8y29Ah4pyJqV7c
```

- [ ] **Step 3: Criar o `.env.example` versionado**

Escreva `.env.example`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 4: Gerar os tipos do schema**

```bash
npx supabase gen types typescript --project-id nesnxcmdfksakgspvkcg > src/lib/database.types.ts
```

Se o comando falhar por falta de autenticação, escreva `src/lib/database.types.ts` à mão com as oito tabelas, usando os campos observados no app legado:

```ts
export type Animal = {
  id: string
  nome: string
  apelido: string | null
  registro: string | null
  registro_abccmm: string | null
  raca: string
  pelagem: string | null
  tipo_marcha: string | null
  sexo: 'Fêmea' | 'Macho'
  data_nascimento: string | null
  peso: number | null
  altura: number | null
  baia_piquete: string | null
  status_reprodutivo: string | null
  status_saude: string | null
  premiacao: string | null
  foto_url: string | null
  observacoes: string | null
  em_destaque: boolean | null
  ativo: boolean
  created_at: string
}

export type Genealogia = {
  animal_id: string
  pai_id: string | null
  mae_id: string | null
  avo_paterno_id: string | null
  avo_paterna_id: string | null
  avo_materno_id: string | null
  avo_materna_id: string | null
}

export type SaudeRegistro = {
  id: string
  animal_id: string
  tipo: string
  data_registro: string
  descricao: string
  veterinario: string | null
  proxima_data: string | null
}

export type Reproducao = {
  id: string
  animal_id: string
  tipo_evento: string
  data_evento: string
  parceiro_nome: string | null
  previsao_parto: string | null
  observacoes: string | null
}

export type Anotacao = {
  id: string
  animal_id: string
  texto: string
  autor: string | null
  data_registro: string
}

export type Evento = {
  id: string
  titulo: string
  tipo: string
  data_evento: string
  animal_id: string | null
  descricao: string | null
  concluido: boolean
}

export type Pesagem = {
  id: string
  animal_id: string
  data_pesagem: string
  peso: number
}

export type Configuracao = {
  chave: string
  valor: string
}
```

- [ ] **Step 5: Escrever o cliente**

Escreva `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sao obrigatorias. Copie .env.example para .env.',
  )
}

export const supabase = createClient(url, anonKey)
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: cliente Supabase por variaveis de ambiente e tipos do schema"
```

---

## Tarefa 5: Formatação de datas e idade

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

Porte de `js/utils/helpers.js:1-24`. Apenas `formatDate` e `calcularIdade` são usadas no app.

- [ ] **Step 1: Escrever os testes que falham**

Escreva `src/lib/format.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDate, calcularIdade } from './format'

describe('formatDate', () => {
  it('formata data ISO no padrao brasileiro', () => {
    expect(formatDate('2024-03-15')).toBe('15/03/2024')
  })

  it('devolve string vazia quando nao ha data', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('')).toBe('')
  })
})

describe('calcularIdade', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('devolve Desconhecida quando nao ha data de nascimento', () => {
    expect(calcularIdade(null)).toBe('Desconhecida')
  })

  it('devolve so meses quando tem menos de um ano', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T12:00:00Z'))
    expect(calcularIdade('2026-05-11')).toBe('3 meses')
  })

  it('usa singular para um mes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T12:00:00Z'))
    expect(calcularIdade('2026-07-11')).toBe('1 mês')
  })

  it('devolve anos e meses', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T12:00:00Z'))
    expect(calcularIdade('2020-05-11')).toBe('6 anos e 3 meses')
  })

  it('usa singular para um ano', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T12:00:00Z'))
    expect(calcularIdade('2025-08-11')).toBe('1 ano e 0 meses')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/lib/format.test.ts`
Expected: FAIL, "Failed to resolve import ./format"

- [ ] **Step 3: Implementar**

Escreva `src/lib/format.ts`:

```ts
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export function calcularIdade(dataNascimento: string | null | undefined): string {
  if (!dataNascimento) return 'Desconhecida'

  const nasc = new Date(dataNascimento)
  const hoje = new Date()

  let anos = hoje.getFullYear() - nasc.getFullYear()
  let meses = hoje.getMonth() - nasc.getMonth()

  if (meses < 0 || (meses === 0 && hoje.getDate() < nasc.getDate())) {
    anos--
    meses += 12
  }

  if (anos === 0) {
    return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  }
  return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${meses} ${meses === 1 ? 'mês' : 'meses'}`
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- src/lib/format.test.ts`
Expected: PASS, 7 testes

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: porta formatacao de data e calculo de idade com testes"
```

---

## Tarefa 6: Mapa de status

**Files:**
- Create: `src/lib/status.ts`
- Test: `src/lib/status.test.ts`

Substitui `getStatusColor` de `js/utils/helpers.js:26-34`, que devolvia variáveis CSS do tema antigo.

- [ ] **Step 1: Escrever os testes que falham**

Escreva `src/lib/status.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { statusClasses, STATUS_REPRODUTIVO } from './status'

describe('statusClasses', () => {
  it('mapeia status conhecidos sem diferenciar maiusculas', () => {
    expect(statusClasses('Prenha')).toBe('bg-status-prenha/12 text-status-prenha')
    expect(statusClasses('prenha')).toBe('bg-status-prenha/12 text-status-prenha')
  })

  it('mapeia Em Cobertura', () => {
    expect(statusClasses('Em Cobertura')).toBe('bg-status-cobertura/12 text-status-cobertura')
  })

  it('mapeia Potro/Potra', () => {
    expect(statusClasses('Potro/Potra')).toBe('bg-status-potro/12 text-status-potro')
  })

  it('cai no neutro para status desconhecido ou ausente', () => {
    expect(statusClasses('Garanhão Ativo')).toBe('bg-muted text-muted-foreground')
    expect(statusClasses(null)).toBe('bg-muted text-muted-foreground')
  })
})

describe('STATUS_REPRODUTIVO', () => {
  it('contem exatamente as opcoes do formulario legado', () => {
    expect(STATUS_REPRODUTIVO).toEqual([
      'Vazia',
      'Prenha',
      'Lactante',
      'Em Cobertura',
      'Potro/Potra',
      'Garanhão Ativo',
    ])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/lib/status.test.ts`
Expected: FAIL, "Failed to resolve import ./status"

- [ ] **Step 3: Implementar**

Escreva `src/lib/status.ts`:

```ts
export const STATUS_REPRODUTIVO = [
  'Vazia',
  'Prenha',
  'Lactante',
  'Em Cobertura',
  'Potro/Potra',
  'Garanhão Ativo',
] as const

const CLASSES: Record<string, string> = {
  vazia: 'bg-status-vazia/12 text-status-vazia',
  prenha: 'bg-status-prenha/12 text-status-prenha',
  lactante: 'bg-status-lactante/12 text-status-lactante',
  'em cobertura': 'bg-status-cobertura/12 text-status-cobertura',
  'potro/potra': 'bg-status-potro/12 text-status-potro',
}

const NEUTRO = 'bg-muted text-muted-foreground'

export function statusClasses(status: string | null | undefined): string {
  if (!status) return NEUTRO
  return CLASSES[status.toLowerCase()] ?? NEUTRO
}

export const PELAGENS = [
  'Alazã',
  'Baia',
  'Castanha',
  'Pampa',
  'Preta',
  'Rosilha',
  'Tordilha',
  'Tordilha Negra',
  'Zaina',
  'Outra',
] as const

export const TIPOS_MARCHA = ['Marcha Batida', 'Marcha Picada'] as const

export const TIPOS_EVENTO = [
  'Vacinação',
  'Vermifugação',
  'Parto Previsto',
  'Ferração',
  'Veterinário',
  'Cobertura',
  'Outro',
] as const
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- src/lib/status.test.ts`
Expected: PASS, 5 testes

- [ ] **Step 5: Commit**

```bash
git add src/lib/status.ts src/lib/status.test.ts
git commit -m "feat: mapa de status reprodutivo com classes de tema"
```

---

## Tarefa 7: Validadores

**Files:**
- Create: `src/lib/validators.ts`
- Test: `src/lib/validators.test.ts`

Porte de `js/utils/validators.js`. Diferente do legado, estes serão de fato usados (Tarefas 19 e 21).

- [ ] **Step 1: Escrever os testes que falham**

Escreva `src/lib/validators.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateAnimal, validateEvento } from './validators'

describe('validateAnimal', () => {
  it('aceita animal com nome e raca', () => {
    const r = validateAnimal({ nome: 'Aurora da Kneip', raca: 'Mangalarga Marchador' })
    expect(r.isValid).toBe(true)
    expect(r.errors).toEqual({})
  })

  it('rejeita nome ausente', () => {
    const r = validateAnimal({ nome: '', raca: 'Mangalarga Marchador' })
    expect(r.isValid).toBe(false)
    expect(r.errors.nome).toBe('Nome é obrigatório')
  })

  it('rejeita raca ausente', () => {
    const r = validateAnimal({ nome: 'Aurora', raca: '' })
    expect(r.isValid).toBe(false)
    expect(r.errors.raca).toBe('Raça é obrigatória')
  })

  it('acumula os dois erros', () => {
    const r = validateAnimal({ nome: '', raca: '' })
    expect(Object.keys(r.errors)).toHaveLength(2)
  })
})

describe('validateEvento', () => {
  it('aceita evento com titulo e data', () => {
    const r = validateEvento({ titulo: 'Vacinação', data_evento: '2026-08-11' })
    expect(r.isValid).toBe(true)
  })

  it('rejeita titulo ausente', () => {
    const r = validateEvento({ titulo: '', data_evento: '2026-08-11' })
    expect(r.errors.titulo).toBe('Título é obrigatório')
  })

  it('rejeita data ausente', () => {
    const r = validateEvento({ titulo: 'Vacinação', data_evento: '' })
    expect(r.errors.data_evento).toBe('Data é obrigatória')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/lib/validators.test.ts`
Expected: FAIL, "Failed to resolve import ./validators"

- [ ] **Step 3: Implementar**

Escreva `src/lib/validators.ts`:

```ts
export type ValidationResult = {
  isValid: boolean
  errors: Record<string, string>
}

function build(errors: Record<string, string>): ValidationResult {
  return { isValid: Object.keys(errors).length === 0, errors }
}

export function validateAnimal(data: { nome?: string; raca?: string }): ValidationResult {
  const errors: Record<string, string> = {}
  if (!data.nome) errors.nome = 'Nome é obrigatório'
  if (!data.raca) errors.raca = 'Raça é obrigatória'
  return build(errors)
}

export function validateSaude(data: { tipo?: string; data_registro?: string }): ValidationResult {
  const errors: Record<string, string> = {}
  if (!data.tipo) errors.tipo = 'Tipo é obrigatório'
  if (!data.data_registro) errors.data_registro = 'Data é obrigatória'
  return build(errors)
}

export function validateReproducao(data: { tipo?: string; data_evento?: string }): ValidationResult {
  const errors: Record<string, string> = {}
  if (!data.tipo) errors.tipo = 'Tipo é obrigatório'
  if (!data.data_evento) errors.data_evento = 'Data é obrigatória'
  return build(errors)
}

export function validateEvento(data: { titulo?: string; data_evento?: string }): ValidationResult {
  const errors: Record<string, string> = {}
  if (!data.titulo) errors.titulo = 'Título é obrigatório'
  if (!data.data_evento) errors.data_evento = 'Data é obrigatória'
  return build(errors)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- src/lib/validators.test.ts`
Expected: PASS, 7 testes

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators.ts src/lib/validators.test.ts
git commit -m "feat: porta validadores de formulario com testes"
```

---

## Tarefa 8: Store tipado

**Files:**
- Create: `src/lib/store.ts`
- Test: `src/lib/store.test.ts`

Porte de `js/store.js`, com as mesmas consultas. Duas mudanças deliberadas: `getStats` passa a calcular `eventosProximos` com o mesmo intervalo de 7 dias mas propagando erro em vez de engolir, e `importData` (stub vazio em `js/store.js:206`) **não é portado** — o botão de importar é tratado na Tarefa 23.

- [ ] **Step 1: Escrever o teste que falha**

Escreva `src/lib/store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('./supabase', () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }))

import { store } from './store'

function queryStub(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'ilike', 'order', 'gte', 'lte', 'insert', 'update', 'upsert']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

describe('store.getAnimais', () => {
  beforeEach(() => mockFrom.mockReset())

  it('consulta a tabela animais filtrando por ativo', async () => {
    const chain = queryStub({ data: [{ id: '1', nome: 'Aurora' }], error: null })
    mockFrom.mockReturnValue(chain)

    const result = await store.getAnimais()

    expect(mockFrom).toHaveBeenCalledWith('animais')
    expect(chain.eq).toHaveBeenCalledWith('ativo', true)
    expect(result).toEqual([{ id: '1', nome: 'Aurora' }])
  })

  it('propaga erro do Supabase', async () => {
    mockFrom.mockReturnValue(queryStub({ data: null, error: new Error('falha') }))
    await expect(store.getAnimais()).rejects.toThrow('falha')
  })
})

describe('store.deleteAnimal', () => {
  beforeEach(() => mockFrom.mockReset())

  it('faz exclusao logica marcando ativo como false', async () => {
    const chain = queryStub({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await store.deleteAnimal('abc')

    expect(chain.update).toHaveBeenCalledWith({ ativo: false })
    expect(chain.eq).toHaveBeenCalledWith('id', 'abc')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/lib/store.test.ts`
Expected: FAIL, "Failed to resolve import ./store"

- [ ] **Step 3: Implementar**

Escreva `src/lib/store.ts`, portando cada método de `js/store.js` com tipos. Assinaturas obrigatórias (usadas pelas tarefas seguintes):

```ts
import { supabase } from './supabase'
import type {
  Animal, Anotacao, Configuracao, Evento, Genealogia,
  Pesagem, Reproducao, SaudeRegistro,
} from './database.types'

export type AnimalFilters = {
  sexo?: string
  status_reprodutivo?: string
  em_destaque?: boolean
  search?: string
  orderBy?: string
  ascending?: boolean
}

export type Stats = {
  totalAnimais: number
  femeas: number
  machos: number
  prenhas: number
  lactantes: number
  eventosProximos: Evento[]
}

export const store = {
  async getAnimais(filters: AnimalFilters = {}): Promise<Animal[]> {
    let query = supabase.from('animais').select('*').eq('ativo', true)
    if (filters.sexo) query = query.eq('sexo', filters.sexo)
    if (filters.status_reprodutivo) query = query.eq('status_reprodutivo', filters.status_reprodutivo)
    if (filters.em_destaque !== undefined) query = query.eq('em_destaque', filters.em_destaque)
    if (filters.search) query = query.ilike('nome', `%${filters.search}%`)
    query = filters.orderBy
      ? query.order(filters.orderBy, { ascending: filters.ascending ?? true })
      : query.order('nome')

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as Animal[]
  },

  async getAnimal(id: string): Promise<Animal> {
    const { data, error } = await supabase.from('animais').select('*').eq('id', id).single()
    if (error) throw error
    return data as Animal
  },

  async createAnimal(data: Partial<Animal>): Promise<Animal> {
    const { data: result, error } = await supabase.from('animais').insert([data]).select()
    if (error) throw error
    return result![0] as Animal
  },

  async updateAnimal(id: string, data: Partial<Animal>): Promise<Animal> {
    const { data: result, error } = await supabase.from('animais').update(data).eq('id', id).select()
    if (error) throw error
    return result![0] as Animal
  },

  async deleteAnimal(id: string): Promise<void> {
    const { error } = await supabase.from('animais').update({ ativo: false }).eq('id', id)
    if (error) throw error
  },

  async toggleDestaque(id: string, em_destaque: boolean): Promise<Animal> {
    const { data, error } = await supabase.from('animais').update({ em_destaque }).eq('id', id).select()
    if (error) throw error
    return data![0] as Animal
  },

  async toggleAllDestaque(em_destaque: boolean): Promise<Animal[]> {
    const { data, error } = await supabase.from('animais').update({ em_destaque }).eq('ativo', true).select()
    if (error) throw error
    return (data ?? []) as Animal[]
  },

  // Continue portando, uma a uma, com o mesmo corpo de js/store.js:
  //   getGenealogia(animalId): Promise<Genealogia | null>   (js/store.js:53, ignora PGRST116)
  //   saveGenealogia(data): Promise<Genealogia>             (js/store.js:59)
  //   getAllGenealogias(): Promise<Pick<Genealogia,'animal_id'|'pai_id'|'mae_id'>[]>  (js/store.js:200)
  //   getAnimaisMap(): Promise<Record<string, {nome: string; foto_url: string | null}>>  (js/store.js:191)
  //   getSaudeRegistros(animalId): Promise<SaudeRegistro[]>  (js/store.js:65)
  //   createSaudeRegistro(data): Promise<SaudeRegistro>      (js/store.js:71)
  //   getReproducao(animalId): Promise<Reproducao[]>         (js/store.js:77)
  //   createReproducao(data): Promise<Reproducao>            (js/store.js:83)
  //   getAnotacoes(animalId): Promise<Anotacao[]>            (js/store.js:89)
  //   createAnotacao(data): Promise<Anotacao>                (js/store.js:95)
  //   getEventos(month?, year?): Promise<Evento[]>           (js/store.js:101)
  //   createEvento(data): Promise<Evento>                    (js/store.js:114)
  //   updateEvento(id, data): Promise<Evento>                (js/store.js:120)
  //   getPesagens(animalId): Promise<Pesagem[]>              (js/store.js:126)
  //   createPesagem(data): Promise<Pesagem>                  (js/store.js:132)
  //   getStats(): Promise<Stats>                             (js/store.js:138)
  //   getConfiguracoes(): Promise<Configuracao[]>            (js/store.js:158)
  //   saveConfiguracao(chave, valor): Promise<void>          (js/store.js:164)
  //   exportData(): Promise<string>                          (js/store.js:169)
}
```

Cada método segue o mesmo padrão: monta a consulta, `if (error) throw error`, devolve com o tipo. Não altere filtros, ordenação nem nomes de coluna.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- src/lib/store.test.ts`
Expected: PASS, 3 testes

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: porta o store para TypeScript com testes"
```

---

## Tarefa 9: Hook de carregamento assíncrono

**Files:**
- Create: `src/hooks/useAsync.ts`
- Test: `src/hooks/useAsync.test.ts`

Substitui os `skeleton` com altura chutada e os `try/catch` repetidos em cada página do app legado.

- [ ] **Step 1: Escrever os testes que falham**

Escreva `src/hooks/useAsync.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAsync } from './useAsync'

describe('useAsync', () => {
  it('comeca carregando e entrega os dados', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe(42)
    expect(result.current.error).toBeNull()
  })

  it('captura erro sem lancar', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.reject(new Error('falhou')), []))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe('falhou')
    expect(result.current.data).toBeNull()
  })

  it('reexecuta quando reload e chamado', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const { result } = renderHook(() => useAsync(fn, []))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fn).toHaveBeenCalledTimes(1)

    result.current.reload()
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2))
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/hooks/useAsync.test.ts`
Expected: FAIL, "Failed to resolve import ./useAsync"

- [ ] **Step 3: Implementar**

Escreva `src/hooks/useAsync.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: Error | null
  reload: () => void
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fn()
      .then((result) => {
        if (cancelled) return
        setData(result)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setData(null)
        setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, reload }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- src/hooks/useAsync.test.ts`
Expected: PASS, 3 testes

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAsync.ts src/hooks/useAsync.test.ts
git commit -m "feat: hook useAsync com estados de carregamento e erro"
```

---

## Tarefa 10: Tema claro e escuro

**Files:**
- Create: `src/hooks/useTheme.ts`, `src/components/layout/ThemeToggle.tsx`
- Test: `src/hooks/useTheme.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Escreva `src/hooks/useTheme.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('comeca no tema claro quando nao ha preferencia salva', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('le a preferencia salva', () => {
    localStorage.setItem('haras-theme', 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('alterna e persiste', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('haras-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/hooks/useTheme.test.ts`
Expected: FAIL, "Failed to resolve import ./useTheme"

- [ ] **Step 3: Implementar o hook**

Escreva `src/hooks/useTheme.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'haras-theme'

function readStored(): Theme {
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStored)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- src/hooks/useTheme.test.ts`
Expected: PASS, 3 testes

- [ ] **Step 5: Implementar o botão**

Escreva `src/components/layout/ThemeToggle.tsx`:

```tsx
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTheme.ts src/hooks/useTheme.test.ts src/components/layout/ThemeToggle.tsx
git commit -m "feat: tema claro e escuro com preferencia persistida"
```

---

## Tarefa 11: Marca e sidebar

**Files:**
- Create: `src/components/layout/Brand.tsx`, `src/components/layout/AppSidebar.tsx`
- Test: `src/components/layout/AppSidebar.test.tsx`

Substitui `js/components/sidebar.js`. O emoji 🐴 de `sidebar.js:6` sai; entra o monograma.

- [ ] **Step 1: Escrever o teste que falha**

Escreva `src/components/layout/AppSidebar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppSidebar } from './AppSidebar'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppSidebar />
    </MemoryRouter>,
  )
}

describe('AppSidebar', () => {
  it('mostra os cinco itens de navegacao', () => {
    renderAt('/')
    for (const label of ['Painel', 'Plantel', 'Calendário', 'Relatórios', 'Configurações']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('marca o item ativo com aria-current', () => {
    renderAt('/catalogo')
    expect(screen.getByRole('link', { name: /Plantel/ })).toHaveAttribute('aria-current', 'page')
  })

  it('nao usa emoji como marca', () => {
    const { container } = renderAt('/')
    expect(container.textContent).not.toContain('🐴')
    expect(screen.getByText('HK')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/components/layout/AppSidebar.test.tsx`
Expected: FAIL, "Failed to resolve import ./AppSidebar"

- [ ] **Step 3: Implementar a marca**

Escreva `src/components/layout/Brand.tsx`:

```tsx
import { cn } from '@/lib/utils'

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-brand text-sm font-bold text-primary-foreground">
        HK
      </div>
      <div className="font-brand text-sm leading-tight font-semibold">
        Haras
        <br />
        Kneip
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implementar a sidebar**

Escreva `src/components/layout/AppSidebar.tsx`:

```tsx
import { NavLink } from 'react-router-dom'
import { BarChart3, BookOpen, Calendar, LayoutDashboard, Settings } from 'lucide-react'
import { Brand } from './Brand'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/catalogo', label: 'Plantel', icon: BookOpen, end: false },
  { to: '/calendario', label: 'Calendário', icon: Calendar, end: false },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, end: false },
]

export function AppSidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="px-4 py-5">
        <Brand />
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Menu principal">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors',
                'hover:bg-secondary hover:text-foreground',
                isActive && 'bg-accent font-semibold text-accent-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        Mangalarga Marchador
      </div>
    </aside>
  )
}
```

O `NavLink` do React Router já aplica `aria-current="page"` no `<a>` quando a rota está ativa. Não defina o atributo à mão — o teste do Step 1 verifica exatamente esse comportamento nativo.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- src/components/layout/AppSidebar.test.tsx`
Expected: PASS, 3 testes

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/
git commit -m "feat: sidebar com monograma HK no lugar do emoji"
```

---

## Tarefa 12: Topbar e busca global

**Files:**
- Create: `src/components/layout/CommandPalette.tsx`, `src/components/layout/Topbar.tsx`

Substitui a busca de `js/components/header.js:13-17` e o atalho Ctrl+K de `js/app.js:117-131`. O evento `globalSearch` via `CustomEvent` (`header.js:98`) desaparece: a paleta navega direto para o animal.

- [ ] **Step 1: Implementar a paleta**

Escreva `src/components/layout/CommandPalette.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'

export function CommandPalette({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { data: animais } = useAsync(() => store.getAnimais(), [])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar animal pelo nome..." />
      <CommandList>
        <CommandEmpty>Nenhum animal encontrado.</CommandEmpty>
        <CommandGroup heading="Plantel">
          {(animais ?? []).map((a) => (
            <CommandItem
              key={a.id}
              value={a.nome}
              onSelect={() => {
                onOpenChange(false)
                navigate(`/animal/${a.id}`)
              }}
            >
              {a.nome}
              <span className="ml-auto text-xs text-muted-foreground">{a.pelagem}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return { open, setOpen }
}
```

- [ ] **Step 2: Implementar a topbar**

Escreva `src/components/layout/Topbar.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Menu, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from './ThemeToggle'

export function Topbar({ onOpenSearch, onOpenMenu }: {
  onOpenSearch: () => void
  onOpenMenu: () => void
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMenu} aria-label="Abrir menu">
        <Menu className="size-4" />
      </Button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-9 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary md:max-w-xs"
      >
        <Search className="size-4" />
        <span>Buscar animais...</span>
        <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 font-sans text-[10px]">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Button asChild size="sm">
          <Link to="/novo-animal">
            <Plus className="size-4" />
            Novo animal
          </Link>
        </Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/
git commit -m "feat: topbar com busca global por Ctrl+K"
```

---

## Tarefa 13: Shell e rotas

**Files:**
- Create: `src/components/layout/AppShell.tsx`
- Modify: `src/App.tsx`

Substitui `js/router.js`. Mapa de rotas idêntico ao de `js/router.js:12-20`, incluindo `/animal/:id` (`router.js:53`) e `/editar-animal/:id` (`router.js:57`). `/plantel` fica fora do shell, como em `router.js:28`.

- [ ] **Step 1: Implementar o shell**

Escreva `src/components/layout/AppShell.tsx`:

```tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { AppSidebar } from './AppSidebar'
import { Topbar } from './Topbar'
import { CommandPalette, useCommandPalette } from './CommandPalette'

export function AppShell() {
  const { open, setOpen } = useCommandPalette()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <AppSidebar />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSearch={() => setOpen(true)} onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={open} onOpenChange={setOpen} />
    </div>
  )
}
```

- [ ] **Step 2: Implementar as rotas**

Escreva `src/App.tsx`:

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'
import Dashboard from '@/pages/Dashboard'
import Catalogo from '@/pages/Catalogo'
import Perfil from '@/pages/Perfil'
import AnimalForm from '@/pages/AnimalForm'
import Calendario from '@/pages/Calendario'
import Relatorios from '@/pages/Relatorios'
import Configuracoes from '@/pages/Configuracoes'
import PlantelPublico from '@/pages/PlantelPublico'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/plantel" element={<PlantelPublico />} />
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/animal/:id" element={<Perfil />} />
          <Route path="/novo-animal" element={<AnimalForm />} />
          <Route path="/editar-animal/:id" element={<AnimalForm />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<div className="text-muted-foreground">Página não encontrada</div>} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" />
    </HashRouter>
  )
}
```

- [ ] **Step 3: Criar as oito páginas como stubs**

Para cada arquivo em `src/pages/`, crie um stub que será substituído nas tarefas seguintes. Exemplo para `src/pages/Dashboard.tsx`:

```tsx
export default function Dashboard() {
  return <div>Dashboard</div>
}
```

Repita, trocando o nome do componente e o texto, para `Catalogo`, `Perfil`, `AnimalForm`, `Calendario`, `Relatorios`, `Configuracoes` e `PlantelPublico`.

- [ ] **Step 4: Rodar o app e conferir a navegação**

```bash
npm run dev
```

Abra `http://localhost:5173/#/catalogo` e confirme que a sidebar marca "Plantel" como ativo e o conteúdo mostra "Catalogo". Abra `#/plantel` e confirme que a sidebar **não** aparece.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: shell da aplicacao com HashRouter preservando as rotas atuais"
```

---

## Tarefa 14: Componentes de apresentação

**Files:**
- Create: `src/components/PageHeader.tsx`, `src/components/StatCard.tsx`, `src/components/StatusBadge.tsx`, `src/components/AnimalCard.tsx`
- Test: `src/components/AnimalCard.test.tsx`

Substitui `js/components/animalCard.js`, incluindo o bloco de 130 linhas de CSS com `!important` de `animalCard.js:66-193`.

- [ ] **Step 1: Escrever o teste que falha**

Escreva `src/components/AnimalCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnimalCard } from './AnimalCard'
import type { Animal } from '@/lib/database.types'

const base: Animal = {
  id: 'a1', nome: 'Aurora da Kneip', apelido: null, registro: null,
  registro_abccmm: null, raca: 'Mangalarga Marchador', pelagem: 'Tordilha',
  tipo_marcha: 'Marcha Batida', sexo: 'Fêmea', data_nascimento: '2020-05-11',
  peso: null, altura: null, baia_piquete: null, status_reprodutivo: 'Prenha',
  status_saude: null, premiacao: null, foto_url: null, observacoes: null,
  em_destaque: true, ativo: true, created_at: '2024-01-01',
}

function renderCard(animal: Animal, linhagem?: { pai_nome: string | null; mae_nome: string | null }) {
  return render(
    <MemoryRouter>
      <AnimalCard animal={animal} linhagem={linhagem} />
    </MemoryRouter>,
  )
}

describe('AnimalCard', () => {
  it('mostra nome, pelagem e status', () => {
    renderCard(base)
    expect(screen.getByText('Aurora da Kneip')).toBeInTheDocument()
    expect(screen.getByText(/Tordilha/)).toBeInTheDocument()
    expect(screen.getByText('Prenha')).toBeInTheDocument()
  })

  it('liga para o perfil do animal', () => {
    renderCard(base)
    expect(screen.getByRole('link', { name: /Aurora da Kneip/ })).toHaveAttribute('href', '/animal/a1')
  })

  it('usa as iniciais quando nao ha foto', () => {
    renderCard(base)
    expect(screen.getByText('AD')).toBeInTheDocument()
  })

  it('mostra a linhagem quando informada', () => {
    renderCard(base, { pai_nome: 'Vencedor JK', mae_nome: null })
    expect(screen.getByText(/Vencedor JK/)).toBeInTheDocument()
  })

  it('omite a linhagem quando nao ha pai nem mae', () => {
    renderCard(base, { pai_nome: null, mae_nome: null })
    expect(screen.queryByText(/Pai:/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/components/AnimalCard.test.tsx`
Expected: FAIL, "Failed to resolve import ./AnimalCard"

- [ ] **Step 3: Implementar o badge de status**

Escreva `src/components/StatusBadge.tsx`:

```tsx
import { cn } from '@/lib/utils'
import { statusClasses } from '@/lib/status'

export function StatusBadge({ status, className }: { status: string | null; className?: string }) {
  if (!status) return null
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
        statusClasses(status),
        className,
      )}
    >
      {status}
    </span>
  )
}
```

- [ ] **Step 4: Implementar o card**

Escreva `src/components/AnimalCard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import type { Animal } from '@/lib/database.types'
import { calcularIdade } from '@/lib/format'
import { StatusBadge } from './StatusBadge'

export function iniciais(nome: string | null): string {
  if (!nome) return 'HK'
  return nome.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export function AnimalCard({ animal, linhagem, footer }: {
  animal: Animal
  linhagem?: { pai_nome: string | null; mae_nome: string | null }
  footer?: React.ReactNode
}) {
  const temLinhagem = Boolean(linhagem?.pai_nome || linhagem?.mae_nome)

  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/animal/${animal.id}`} className="block">
        <div className="relative h-32 bg-secondary">
          {animal.foto_url ? (
            <img src={animal.foto_url} alt={animal.nome} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center font-brand text-2xl font-bold text-primary">
              {iniciais(animal.nome)}
            </div>
          )}
          <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-card text-xs font-bold shadow-sm">
            {animal.sexo === 'Fêmea' ? '♀' : '♂'}
          </span>
        </div>

        <div className="space-y-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">{animal.nome}</h3>
            <StatusBadge status={animal.status_reprodutivo} />
          </div>

          <p className="text-xs text-muted-foreground">
            {animal.pelagem}
            {animal.tipo_marcha ? ` • ${animal.tipo_marcha}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">{calcularIdade(animal.data_nascimento)}</p>

          {temLinhagem && (
            <div className="mt-2 space-y-0.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
              {linhagem?.pai_nome && <div>Pai: {linhagem.pai_nome}</div>}
              {linhagem?.mae_nome && <div>Mãe: {linhagem.mae_nome}</div>}
            </div>
          )}
        </div>
      </Link>

      {footer}
    </article>
  )
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- src/components/AnimalCard.test.tsx`
Expected: PASS, 5 testes

- [ ] **Step 6: Implementar cabeçalho de página e cartão de métrica**

Escreva `src/components/PageHeader.tsx`:

```tsx
export function PageHeader({ title, description, actions }: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
```

Escreva `src/components/StatCard.tsx`:

```tsx
import { cn } from '@/lib/utils'

export function StatCard({ value, label, highlight }: {
  value: number | string
  label: string
  highlight?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
      {highlight && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
      <div className={cn('text-2xl font-bold tracking-tight', highlight && 'text-primary')}>
        {value}
      </div>
      <div className="mt-1.5 text-[11px] tracking-wider text-muted-foreground uppercase">
        {label}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/
git commit -m "feat: card de animal, cabecalho de pagina e cartao de metrica"
```

---

## Tarefa 15: Gráficos com Recharts

**Files:**
- Create: `src/components/charts/PelagemChart.tsx`, `StatusChart.tsx`, `IdadeChart.tsx`, `PesagemChart.tsx`

Substitui `js/components/charts.js`. As cores de pelagem de `charts.js:21-31` são mantidas — são descritivas da cor real do animal. A paleta de tema escuro de `charts.js:3-11` **não** é portada.

- [ ] **Step 1: Implementar o gráfico de pelagens**

Escreva `src/components/charts/PelagemChart.tsx`:

```tsx
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const PELAGEM_COLORS: Record<string, string> = {
  Castanha: '#8B4513',
  Tordilha: '#A9A9A9',
  Alazã: '#D2691E',
  Baia: '#DAA520',
  Pampa: '#E8D5B7',
  Rosilha: '#CD5C5C',
  Zaina: '#2C1810',
  Preta: '#333333',
  'Tordilha Negra': '#696969',
}

const FALLBACK = 'var(--primary)'

export function PelagemChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sem dados de pelagem.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%" paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={PELAGEM_COLORS[d.name] ?? FALLBACK} stroke="var(--card)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--popover-foreground)',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Implementar o gráfico de status**

Escreva `src/components/charts/StatusChart.tsx`:

```tsx
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  Vazia: 'var(--status-vazia)',
  Prenha: 'var(--status-prenha)',
  Lactante: 'var(--status-lactante)',
  'Em Cobertura': 'var(--status-cobertura)',
  'Potro/Potra': 'var(--status-potro)',
}

const FALLBACK = 'var(--muted-foreground)'

export function StatusChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sem dados de status.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%" paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={STATUS_COLORS[d.name] ?? FALLBACK} stroke="var(--card)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--popover-foreground)',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Implementar o gráfico de idade**

Escreva `src/components/charts/IdadeChart.tsx`:

```tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function IdadeChart({ data }: { data: { faixa: string; quantidade: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="faixa" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: 'var(--secondary)' }}
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--popover-foreground)',
            fontSize: 12,
          }}
        />
        <Bar dataKey="quantidade" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 4: Implementar o gráfico de peso**

Escreva `src/components/charts/PesagemChart.tsx`:

```tsx
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function PesagemChart({ data }: { data: { data: string; peso: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="pesoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="data" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--popover-foreground)',
            fontSize: 12,
          }}
        />
        <Area type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2} fill="url(#pesoFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 6: Commit**

```bash
git add src/components/charts/
git commit -m "feat: graficos em Recharts usando as cores do tema"
```

---

## Tarefa 16: Página Painel

**Files:**
- Modify: `src/pages/Dashboard.tsx`

Porte de `js/pages/dashboard.js`. **Comportamentos a preservar:**
- Quatro métricas: total, prenhas, lactantes, eventos dos próximos 7 dias (`dashboard.js:73-89`)
- Gráficos de pelagem e status agregados a partir da lista de animais (`dashboard.js:153-173`)
- Lista dos 5 eventos próximos com cor por urgência: até 2 dias vermelho, até 5 dias destaque (`dashboard.js:105-112`)
- Lista dos 5 cadastros mais recentes, ordenados por `created_at` decrescente (`dashboard.js:69`)

**O que sai:** os handlers `onmouseover`/`onmouseout` inline de `dashboard.js:114` e `dashboard.js:133`, substituídos por `hover:` do Tailwind. A animação de contador de `dashboard.js:7-18` também sai — números que sobem sozinhos atrasam a leitura do dado.

- [ ] **Step 1: Implementar a página**

Escreva `src/pages/Dashboard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { AlertCircle, ChevronRight, Clock } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { PelagemChart } from '@/components/charts/PelagemChart'
import { StatusChart } from '@/components/charts/StatusChart'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import { formatDate } from '@/lib/format'
import { iniciais } from '@/components/AnimalCard'
import { cn } from '@/lib/utils'

function contar(items: (string | null)[]): { name: string; value: number }[] {
  const acc: Record<string, number> = {}
  for (const item of items) {
    if (!item) continue
    acc[item] = (acc[item] ?? 0) + 1
  }
  return Object.entries(acc).map(([name, value]) => ({ name, value }))
}

function diasAte(data: string): number {
  const alvo = new Date(data)
  const hoje = new Date()
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

export default function Dashboard() {
  const { data: stats, loading: loadingStats } = useAsync(() => store.getStats(), [])
  const { data: animais, loading: loadingAnimais } = useAsync(
    () => store.getAnimais({ orderBy: 'created_at', ascending: false }),
    [],
  )

  const eventos = stats?.eventosProximos ?? []
  const recentes = (animais ?? []).slice(0, 5)

  return (
    <>
      <PageHeader
        title="Painel do Plantel"
        description={`Mangalarga Marchador · ${new Date().toLocaleDateString('pt-BR')}`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loadingStats
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
          : (
            <>
              <StatCard highlight value={stats?.totalAnimais ?? 0} label="Total de animais" />
              <StatCard value={stats?.prenhas ?? 0} label="Matrizes prenhas" />
              <StatCard value={stats?.lactantes ?? 0} label="Matrizes lactantes" />
              <StatCard value={eventos.length} label="Eventos em 7 dias" />
            </>
          )}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Distribuição de pelagens</h2>
          {loadingAnimais
            ? <Skeleton className="h-[280px] rounded-lg" />
            : <PelagemChart data={contar((animais ?? []).map((a) => a.pelagem))} />}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Status reprodutivo</h2>
          {loadingAnimais
            ? <Skeleton className="h-[280px] rounded-lg" />
            : <StatusChart data={contar((animais ?? []).map((a) => a.status_reprodutivo))} />}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="size-4 text-destructive" />
              Eventos próximos
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/calendario">Ver todos</Link>
            </Button>
          </div>

          {loadingStats ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : eventos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento próximo.</p>
          ) : (
            <ul className="divide-y divide-border">
              {eventos.slice(0, 5).map((e) => {
                const dias = diasAte(e.data_evento)
                return (
                  <li key={e.id}>
                    <Link
                      to={e.animal_id ? `/animal/${e.animal_id}` : '/calendario'}
                      className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-secondary"
                    >
                      <div className="min-w-0">
                        <p className={cn(
                          'truncate text-sm font-medium',
                          dias <= 2 && 'text-destructive',
                          dias > 2 && dias <= 5 && 'text-primary',
                        )}>
                          {e.titulo}
                        </p>
                        <p className="text-xs text-muted-foreground">{e.tipo}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium">{formatDate(e.data_evento)}</p>
                        <p className="text-xs text-muted-foreground">Em {dias} dias</p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4" />
            Últimos cadastros
          </h2>

          {loadingAnimais ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : recentes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum animal cadastrado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentes.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/animal/${a.id}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:bg-secondary"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-bold text-primary">
                      {a.foto_url
                        ? <img src={a.foto_url} alt="" className="size-full object-cover" />
                        : iniciais(a.nome)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.nome}</p>
                      <p className="text-xs text-muted-foreground">{a.pelagem}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Conferir no navegador**

```bash
npm run dev
```

Abra `http://localhost:5173/#/` e confirme: quatro métricas com números reais, dois gráficos preenchidos, listas de eventos e cadastros. Alterne o tema e confirme que os gráficos acompanham.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: pagina do painel em React"
```

---

## Tarefa 17: Página Plantel (catálogo)

**Files:**
- Modify: `src/pages/Catalogo.tsx`

Porte de `js/pages/catalog.js`. **Comportamentos a preservar:**
- Barra de compartilhamento com quatro ações: incluir todos, remover todos, copiar link, enviar no WhatsApp (`catalog.js:16-27`)
- URL pública montada como `origin + pathname + '#/plantel'` (`catalog.js:198`)
- Mensagem do WhatsApp exatamente como em `catalog.js:206`
- Filtros combináveis por Fêmea, Macho, Prenha e destaque, com "Todos" limpando a seleção (`catalog.js:137-153` e `catalog.js:212-246`)
- Toggle individual de `em_destaque` por animal, com atualização otimista antes da chamada ao Supabase (`catalog.js:113-134`)
- Contador total de animais exibidos (`catalog.js:42`)
- Linhagem no card, montada cruzando `getAllGenealogias` com os nomes dos animais (`catalog.js:162-170`)

**O que sai:** o alternador grade/lista de `catalog.js:256-273`, que atribuía `grid-1` — classe que não existe em nenhum CSS do projeto, ou seja, o modo lista está quebrado hoje. E o `<select>` de ordenação de `catalog.js:44-47`, que nunca teve handler.

- [ ] **Step 1: Implementar a página**

Escreva `src/pages/Catalogo.tsx` com esta estrutura:

```tsx
import { useMemo, useState } from 'react'
import { Copy, ListChecks, MessageCircle, Star, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { AnimalCard } from '@/components/AnimalCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { Animal } from '@/lib/database.types'

type Filtro = 'Fêmea' | 'Macho' | 'Prenha' | 'destaque'

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'Fêmea', label: 'Éguas' },
  { key: 'Macho', label: 'Garanhões' },
  { key: 'Prenha', label: 'Prenhas' },
  { key: 'destaque', label: 'No link' },
]

const PUBLIC_URL = `${window.location.origin}${window.location.pathname}#/plantel`

export default function Catalogo() {
  const { data, loading, reload } = useAsync(
    () => Promise.all([store.getAnimais(), store.getAllGenealogias()]),
    [],
  )
  const [ativos, setAtivos] = useState<Set<Filtro>>(new Set())
  const [destaqueLocal, setDestaqueLocal] = useState<Record<string, boolean>>({})

  const animais = data?.[0] ?? []
  const genealogias = data?.[1] ?? []

  const linhagemPorAnimal = useMemo(() => {
    const nomes = new Map(animais.map((a) => [a.id, a.nome]))
    const mapa: Record<string, { pai_nome: string | null; mae_nome: string | null }> = {}
    for (const g of genealogias) {
      mapa[g.animal_id] = {
        pai_nome: g.pai_id ? (nomes.get(g.pai_id) ?? null) : null,
        mae_nome: g.mae_id ? (nomes.get(g.mae_id) ?? null) : null,
      }
    }
    return mapa
  }, [animais, genealogias])

  const emDestaque = (a: Animal) => destaqueLocal[a.id] ?? a.em_destaque !== false

  const visiveis = useMemo(() => {
    if (ativos.size === 0) return animais
    return animais.filter((a) =>
      (ativos.has('Fêmea') && a.sexo === 'Fêmea') ||
      (ativos.has('Macho') && a.sexo === 'Macho') ||
      (ativos.has('Prenha') && a.status_reprodutivo === 'Prenha') ||
      (ativos.has('destaque') && emDestaque(a)),
    )
  }, [animais, ativos, destaqueLocal])

  function alternarFiltro(f: Filtro) {
    setAtivos((prev) => {
      const next = new Set(prev)
      next.has(f) ? next.delete(f) : next.add(f)
      return next
    })
  }

  async function alternarDestaque(a: Animal) {
    const novo = !emDestaque(a)
    setDestaqueLocal((prev) => ({ ...prev, [a.id]: novo }))
    try {
      await store.toggleDestaque(a.id, novo)
      toast.success(novo ? 'Animal adicionado ao link.' : 'Animal removido do link.')
    } catch {
      setDestaqueLocal((prev) => ({ ...prev, [a.id]: !novo }))
      toast.error('Não foi possível atualizar o link.')
    }
  }

  async function alternarTodos(valor: boolean) {
    const anterior = destaqueLocal
    setDestaqueLocal(Object.fromEntries(animais.map((a) => [a.id, valor])))
    try {
      await store.toggleAllDestaque(valor)
      toast.success(valor ? 'Todos incluídos no link.' : 'Todos removidos do link.')
    } catch {
      setDestaqueLocal(anterior)
      toast.error('Não foi possível atualizar o link.')
    }
  }

  return (
    <>
      <PageHeader title="Plantel" description={`${visiveis.length} animais`} />

      {/* Barra de compartilhamento — preserva catalog.js:10-29 */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <p className="text-sm font-semibold text-primary">Link de apresentação do plantel</p>
          <p className="text-xs text-muted-foreground">
            Compartilhe os animais selecionados com outros criadores.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => alternarTodos(true)}>
            <ListChecks className="size-4" /> Incluir todos
          </Button>
          <Button variant="outline" size="sm" onClick={() => alternarTodos(false)}>
            <XCircle className="size-4" /> Remover todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(PUBLIC_URL)
              toast.success('Link copiado.')
            }}
          >
            <Copy className="size-4" /> Copiar link
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const msg = encodeURIComponent(
                `Olá! Confira a seleção de equinos Mangalarga Marchador do Haras Kneip:\n${PUBLIC_URL}`,
              )
              window.open(`https://wa.me/?text=${msg}`, '_blank')
            }}
          >
            <MessageCircle className="size-4" /> Enviar no WhatsApp
          </Button>
        </div>
      </Card>

      {/* Filtros — preserva catalog.js:32-39 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant={ativos.size === 0 ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAtivos(new Set())}
          aria-pressed={ativos.size === 0}
        >
          Todos
        </Button>
        {FILTROS.map(({ key, label }) => (
          <Button
            key={key}
            variant={ativos.has(key) ? 'default' : 'outline'}
            size="sm"
            onClick={() => alternarFiltro(key)}
            aria-pressed={ativos.has(key)}
          >
            {key === 'destaque' && <Star className="size-3.5" />}
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
        </div>
      ) : visiveis.length === 0 ? (
        <Card className="p-12 text-center">
          <h2 className="text-base font-semibold">Nenhum cavalo encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tente ajustar os filtros ou cadastrar um novo animal.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visiveis.map((a) => (
            <AnimalCard
              key={a.id}
              animal={a}
              linhagem={linhagemPorAnimal[a.id]}
              footer={
                <div className="flex items-center justify-between border-t border-dashed border-border px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">Exibir no link</span>
                  <Button
                    size="sm"
                    variant={emDestaque(a) ? 'default' : 'outline'}
                    className={cn('h-6 rounded-full px-2.5 text-[11px]')}
                    onClick={() => alternarDestaque(a)}
                  >
                    {emDestaque(a) ? 'Incluído' : 'Incluir'}
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Conferir no navegador**

Abra `#/catalogo`. Confirme: filtros combinam, o contador acompanha, o toggle de link muda o botão na hora e mostra toast, "Copiar link" copia a URL com `#/plantel`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Catalogo.tsx
git commit -m "feat: pagina do plantel com filtros e link de apresentacao"
```

---

## Tarefa 18: Árvore genealógica

**Files:**
- Create: `src/components/PedigreeTree.tsx`
- Test: `src/components/PedigreeTree.test.tsx`

**Este componente está quebrado no app legado** (ver Notas). A implementação aqui é a primeira que funciona. Estrutura visual baseada em `js/components/pedigreeTree.js:34-53`: três colunas — animal, pais, avós.

- [ ] **Step 1: Escrever o teste que falha**

Escreva `src/components/PedigreeTree.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PedigreeTree } from './PedigreeTree'

const nomes = { p1: 'Vencedor JK', m1: 'Estrela do Sul' }

describe('PedigreeTree', () => {
  it('avisa quando nao ha genealogia', () => {
    render(<MemoryRouter><PedigreeTree genealogia={null} nomes={{}} animalNome="Aurora" /></MemoryRouter>)
    expect(screen.getByText(/Sem dados de genealogia/)).toBeInTheDocument()
  })

  it('mostra pai e mae com link para o perfil', () => {
    render(
      <MemoryRouter>
        <PedigreeTree
          genealogia={{ animal_id: 'a1', pai_id: 'p1', mae_id: 'm1',
            avo_paterno_id: null, avo_paterna_id: null,
            avo_materno_id: null, avo_materna_id: null }}
          nomes={nomes}
          animalNome="Aurora"
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /Vencedor JK/ })).toHaveAttribute('href', '/animal/p1')
    expect(screen.getByRole('link', { name: /Estrela do Sul/ })).toHaveAttribute('href', '/animal/m1')
  })

  it('mostra Desconhecido quando o ancestral nao esta preenchido', () => {
    render(
      <MemoryRouter>
        <PedigreeTree
          genealogia={{ animal_id: 'a1', pai_id: 'p1', mae_id: null,
            avo_paterno_id: null, avo_paterna_id: null,
            avo_materno_id: null, avo_materna_id: null }}
          nomes={nomes}
          animalNome="Aurora"
        />
      </MemoryRouter>,
    )
    expect(screen.getAllByText('Desconhecido').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/components/PedigreeTree.test.tsx`
Expected: FAIL, "Failed to resolve import ./PedigreeTree"

- [ ] **Step 3: Implementar**

Escreva `src/components/PedigreeTree.tsx`:

```tsx
import { Link } from 'react-router-dom'
import type { Genealogia } from '@/lib/database.types'

type Nomes = Record<string, string>

function Box({ id, label, nomes }: { id: string | null; label: string; nomes: Nomes }) {
  const nome = id ? (nomes[id] ?? 'Desconhecido') : 'Desconhecido'
  const conteudo = (
    <>
      <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{nome}</div>
    </>
  )

  if (!id || !nomes[id]) {
    return <div className="w-40 rounded-lg border border-border bg-card p-2.5 text-center">{conteudo}</div>
  }

  return (
    <Link
      to={`/animal/${id}`}
      className="w-40 rounded-lg border border-border bg-card p-2.5 text-center transition-colors hover:border-primary hover:bg-accent"
    >
      {conteudo}
    </Link>
  )
}

export function PedigreeTree({ genealogia, nomes, animalNome }: {
  genealogia: Genealogia | null
  nomes: Nomes
  animalNome: string
}) {
  if (!genealogia) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sem dados de genealogia. Use "Editar genealogia" para informar pai e mãe.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-6 overflow-x-auto p-2">
      <div className="flex flex-col justify-center">
        <div className="w-40 rounded-lg border-2 border-primary bg-card p-2.5 text-center">
          <div className="text-[11px] tracking-wide text-muted-foreground uppercase">Animal</div>
          <div className="mt-1 truncate text-sm font-semibold">{animalNome}</div>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <Box id={genealogia.pai_id} label="Pai" nomes={nomes} />
        <Box id={genealogia.mae_id} label="Mãe" nomes={nomes} />
      </div>

      <div className="flex flex-col gap-3">
        <Box id={genealogia.avo_paterno_id} label="Avô paterno" nomes={nomes} />
        <Box id={genealogia.avo_paterna_id} label="Avó paterna" nomes={nomes} />
        <Box id={genealogia.avo_materno_id} label="Avô materno" nomes={nomes} />
        <Box id={genealogia.avo_materna_id} label="Avó materna" nomes={nomes} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- src/components/PedigreeTree.test.tsx`
Expected: PASS, 3 testes

- [ ] **Step 5: Commit**

```bash
git add src/components/PedigreeTree.tsx src/components/PedigreeTree.test.tsx
git commit -m "fix: arvore genealogica funcionando (assinatura quebrada no app legado)"
```

---

## Tarefa 19: Página Perfil

**Files:**
- Modify: `src/pages/Perfil.tsx`

Porte de `js/pages/profile.js`. **Comportamentos a preservar:**
- Cabeçalho com foto ou iniciais, nome, status, pelagem, marcha, idade, ABCCMM, peso, altura, local e saúde (`profile.js:36-75`)
- Cinco abas: Informações, Genealogia, Saúde, Reprodução, Anotações (`profile.js:19-28`)
- Aba Informações com tabela de detalhes e gráfico de peso, mais o diálogo de registrar pesagem (`profile.js:101-157`)
- Aba Genealogia com árvore e diálogo de edição, listando machos como pai e fêmeas como mãe, excluindo o próprio animal (`profile.js:179-211`)
- Aba Saúde com tabela e diálogo de novo registro, tipos exatamente como em `profile.js:255-262`
- Aba Reprodução com tabela e diálogo, tipos exatamente como em `profile.js:328-335`
- Aba Anotações com lista e diálogo, autor padrão "Administrador" (`profile.js:397`)
- Excluir animal com confirmação, redirecionando para `/catalogo` (`profile.js:86-92`)

**O que muda:** `window.switchTab` global e `window.confirm` de `profile.js:87` saem; abas viram estado do React e a confirmação vira `Dialog` do shadcn. Cada diálogo passa a validar com `validateSaude`, `validateReproducao` e `validateEvento` antes de gravar.

- [ ] **Step 1: Implementar a estrutura da página**

Escreva `src/pages/Perfil.tsx`. Use `useParams()` para o `id`, `Tabs` do shadcn para as abas, e um `useAsync` por aba, disparado quando a aba fica ativa. Esqueleto obrigatório:

```tsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'

export default function Perfil() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [aba, setAba] = useState('informacoes')
  const { data: animal, loading, error } = useAsync(() => store.getAnimal(id), [id])

  if (loading) return <Skeleton className="h-96 rounded-lg" />
  if (error || !animal) return <p className="text-muted-foreground">Animal não encontrado.</p>

  return (
    <>
      {/* Cabeçalho: foto/iniciais, nome, StatusBadge, dados, botões Editar e Excluir */}
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="informacoes">Informações</TabsTrigger>
          <TabsTrigger value="genealogia">Genealogia</TabsTrigger>
          <TabsTrigger value="saude">Saúde</TabsTrigger>
          <TabsTrigger value="reproducao">Reprodução</TabsTrigger>
          <TabsTrigger value="anotacoes">Anotações</TabsTrigger>
        </TabsList>

        <TabsContent value="informacoes"><AbaInformacoes animal={animal} /></TabsContent>
        <TabsContent value="genealogia"><AbaGenealogia animalId={id} animalNome={animal.nome} /></TabsContent>
        <TabsContent value="saude"><AbaSaude animalId={id} /></TabsContent>
        <TabsContent value="reproducao"><AbaReproducao animalId={id} /></TabsContent>
        <TabsContent value="anotacoes"><AbaAnotacoes animalId={id} /></TabsContent>
      </Tabs>
    </>
  )
}
```

Implemente cada `Aba*` como componente no mesmo arquivo. Cada uma:
1. Chama `useAsync` com o método correspondente do store.
2. Mostra `Skeleton` enquanto carrega.
3. Mostra mensagem de vazio quando a lista está vazia.
4. Tem um botão que abre um `Dialog` com o formulário.
5. No salvar: valida, chama o store, fecha o diálogo, chama `reload()` do `useAsync`.

`AbaGenealogia` carrega `store.getGenealogia(animalId)` e `store.getAnimaisMap()`, monta `nomes` como `Record<string, string>` a partir do mapa, e passa para `<PedigreeTree>`.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 3: Conferir no navegador**

Abra o perfil de um animal. Percorra as cinco abas. Confirme que a árvore genealógica **aparece** — é o defeito corrigido na Tarefa 18. Registre uma pesagem e confirme que o gráfico atualiza.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Perfil.tsx
git commit -m "feat: pagina de perfil do animal com as cinco abas"
```

---

## Tarefa 20: Assistente de voz

**Files:**
- Create: `src/components/voice/voiceWizard.ts`, `src/components/voice/VoiceAssistantDialog.tsx`
- Test: `src/components/voice/voiceWizard.test.ts`

Porte de `js/components/voiceAssistant.js`. **A lógica de perguntas e interpretação é copiada sem alteração** — os 13 passos de `voiceAssistant.js:14-169` e a função `isSkip` de `voiceAssistant.js:411`. Só a camada de interface muda.

- [ ] **Step 1: Escrever os testes que falham**

Escreva `src/components/voice/voiceWizard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { STEPS, isSkip } from './voiceWizard'

function parseDe(key: string, texto: string) {
  return STEPS.find((s) => s.key === key)!.parse(texto)
}

describe('isSkip', () => {
  it('reconhece as formas de pular', () => {
    for (const t of ['pular', 'não sei', 'nao sei', 'próximo', 'passar']) {
      expect(isSkip(t)).toBe(true)
    }
  })
  it('nao confunde texto normal com pular', () => {
    expect(isSkip('Aurora da Kneip')).toBe(false)
  })
})

describe('interpretacao de sexo', () => {
  it('mapeia variacoes para Fêmea', () => {
    for (const t of ['égua', 'egua', 'fêmea', 'femea']) expect(parseDe('sexo', t)).toBe('Fêmea')
  })
  it('mapeia variacoes para Macho', () => {
    for (const t of ['garanhão', 'garanhao', 'macho', 'cavalo']) expect(parseDe('sexo', t)).toBe('Macho')
  })
})

describe('interpretacao de pelagem', () => {
  it('normaliza radicais', () => {
    expect(parseDe('pelagem', 'é castanha')).toBe('Castanha')
    expect(parseDe('pelagem', 'tordilho')).toBe('Tordilha')
    expect(parseDe('pelagem', 'alazão')).toBe('Alazã')
  })
})

describe('interpretacao de altura', () => {
  it('converte centimetros falados para metros', () => {
    expect(parseDe('altura', '152')).toBe('1.52')
  })
  it('aceita metros com virgula', () => {
    expect(parseDe('altura', '1,52')).toBe('1.52')
  })
})

describe('interpretacao de data de nascimento', () => {
  it('extrai o ano e assume primeiro de janeiro', () => {
    expect(parseDe('data_nascimento', 'nasceu em 2020')).toBe('2020-01-01')
  })
  it('devolve vazio quando nao acha ano', () => {
    expect(parseDe('data_nascimento', 'não lembro')).toBe('')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- src/components/voice/voiceWizard.test.ts`
Expected: FAIL, "Failed to resolve import ./voiceWizard"

- [ ] **Step 3: Portar a lógica**

Escreva `src/components/voice/voiceWizard.ts`. Copie `isSkip` de `voiceAssistant.js:411-414` e o array de 13 passos de `voiceAssistant.js:14-169`, adicionando tipos:

```ts
export type VoiceStep = {
  key: string
  label: string
  question: string
  example: string
  required: boolean
  parse: (text: string) => string
}

export function isSkip(text: string): boolean {
  const lower = text.toLowerCase()
  return ['pular', 'não sei', 'nao sei', 'próximo', 'passar'].some((t) => lower.includes(t))
}

export const STEPS: VoiceStep[] = [ /* os 13 passos, corpo idêntico ao legado */ ]
```

Atenção em `altura` (`voiceAssistant.js:118-127`): o legado compara `val > 10` com `val` sendo string. Mantenha o comportamento, mas escreva `Number(val) > 10` — é a mesma semântica em JavaScript e passa no TypeScript.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- src/components/voice/voiceWizard.test.ts`
Expected: PASS, 9 testes

- [ ] **Step 5: Implementar o diálogo**

Escreva `src/components/voice/VoiceAssistantDialog.tsx`. Um `Dialog` do shadcn que:
- Recebe `open`, `onOpenChange` e `onComplete(data: Record<string, string>)`
- Mantém `stepIndex`, `isListening`, `isSpeaking` e `data` em estado do React
- Usa `window.SpeechRecognition ?? window.webkitSpeechRecognition` com `lang = 'pt-BR'`, `continuous = false`, `interimResults = false` (`voiceAssistant.js:177-180`)
- Usa `window.speechSynthesis` com `SpeechSynthesisUtterance`, `lang = 'pt-BR'` (`voiceAssistant.js:206-209`)
- Reconhece os comandos globais "cancelar"/"fechar"/"sair" e "voltar"/"passo anterior" (`voiceAssistant.js:274-284`)
- Mostra "Passo N de 13: <rótulo>", a pergunta, o status, e três botões: falar, pular, cancelar
- Ao terminar os 13 passos, fala a mensagem de `voiceAssistant.js:307` e chama `onComplete(data)` com `raca: 'Mangalarga Marchador'` incluído (`voiceAssistant.js:247`)
- Se o navegador não suportar reconhecimento de voz, mostra um aviso no próprio diálogo em vez do `alert()` de `voiceAssistant.js:174`

Declare os tipos do navegador em `src/vite-env.d.ts`:

```ts
interface Window {
  SpeechRecognition?: typeof SpeechRecognition
  webkitSpeechRecognition?: typeof SpeechRecognition
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/voice/ src/vite-env.d.ts
git commit -m "feat: porta o assistente de voz preservando a logica de interpretacao"
```

---

## Tarefa 21: Página de formulário do animal

**Files:**
- Modify: `src/pages/AnimalForm.tsx`

Porte de `js/pages/animalForm.js`. Serve tanto `/novo-animal` quanto `/editar-animal/:id`.

**Comportamentos a preservar:**
- Cinco seções: Identificação, Características, Dados físicos, Localização e status, Foto (`animalForm.js:38-134`)
- Lista de pelagens de `animalForm.js:20` — use `PELAGENS` de `@/lib/status`
- `raca` fixo em `'Mangalarga Marchador'` no envio (`animalForm.js:208`)
- `status_saude` com valor inicial `'Saudável'` (`animalForm.js:109`)
- Foto lida com `FileReader.readAsDataURL` e gravada em `foto_url` (`animalForm.js:167-175`) — mantido como está, ver Notas
- Ao salvar, redireciona para `/animal/:id` do animal criado ou editado (`animalForm.js:226` e `animalForm.js:229`)
- Botão do assistente de voz que preenche os campos (`animalForm.js:178-197`)

**O que muda:** `alert()` de `animalForm.js:233` vira `toast.error`. A validação passa por `validateAnimal` antes de chamar o store.

- [ ] **Step 1: Implementar a página**

Escreva `src/pages/AnimalForm.tsx` com um único objeto de estado para o formulário:

```tsx
const [form, setForm] = useState<Partial<Animal>>({
  nome: '', apelido: '', registro: '', registro_abccmm: '',
  raca: 'Mangalarga Marchador', pelagem: 'Alazã', tipo_marcha: 'Marcha Batida',
  sexo: 'Fêmea', data_nascimento: null, peso: null, altura: null,
  baia_piquete: '', status_reprodutivo: 'Vazia', status_saude: 'Saudável',
  premiacao: '', foto_url: '', observacoes: '',
})
```

Quando `id` existe, carregue com `useAsync(() => store.getAnimal(id), [id])` e popule o estado num `useEffect`.

No submit:

```tsx
const { isValid, errors } = validateAnimal({ nome: form.nome, raca: form.raca })
if (!isValid) {
  setErros(errors)
  toast.error('Confira os campos obrigatórios.')
  return
}
try {
  const salvo = id ? await store.updateAnimal(id, form) : await store.createAnimal(form)
  toast.success(id ? 'Animal atualizado.' : 'Animal cadastrado.')
  navigate(`/animal/${salvo.id}`)
} catch (e) {
  toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}`)
}
```

O botão de voz abre o `VoiceAssistantDialog` e, no `onComplete`, faz `setForm((f) => ({ ...f, ...dadosDeVoz }))`.

- [ ] **Step 2: Conferir no navegador**

Cadastre um animal novo com nome vazio e confirme que o erro aparece sem chamar o Supabase. Depois cadastre um válido e confirme o redirecionamento para o perfil. Edite e confirme que os campos vêm preenchidos.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AnimalForm.tsx
git commit -m "feat: formulario de animal com validacao ligada"
```

---

## Tarefa 22: Página Calendário

**Files:**
- Modify: `src/pages/Calendario.tsx`

Porte de `js/pages/calendar.js`. **Comportamentos a preservar:**
- Grade mensal com dias vazios antes do primeiro dia da semana (`calendar.js:42-44`)
- Dia de hoje destacado (`calendar.js:51`)
- Pontos coloridos por tipo de evento, cores de `calendar.js:9-17` — substituídas pelos tokens: Vacinação `--status-lactante`, Vermifugação `--status-cobertura`, Parto Previsto `--status-prenha`, Ferração `--status-potro`, Veterinário `--destructive`, Cobertura `--primary`, Outro `--muted-foreground`
- Navegação mês anterior, próximo mês e hoje (`calendar.js:130-143`)
- Painel lateral que mostra os eventos do dia clicado (`calendar.js:75-90`)
- Legenda dos sete tipos (`calendar.js:112-119`)
- Diálogo de novo evento com título, tipo, data, animal opcional e descrição (`calendar.js:153-179`)

**O que muda:** `alert('Erro ao salvar evento.')` de `calendar.js:203` vira `toast.error`. O salvar passa por `validateEvento`.

- [ ] **Step 1: Implementar a página**

Escreva `src/pages/Calendario.tsx`. Estado: `mesAtual: Date` e `diaSelecionado: string | null`. Carregue com:

```tsx
const { data: eventos, loading, reload } = useAsync(
  () => store.getEventos(mesAtual.getMonth() + 1, mesAtual.getFullYear()),
  [mesAtual.getFullYear(), mesAtual.getMonth()],
)
```

A grade usa `grid grid-cols-7 gap-1`. Cada dia é um `<button>` com `aria-label` no formato `"11 de agosto, 2 eventos"`.

- [ ] **Step 2: Conferir no navegador**

Abra `#/calendario`. Navegue entre meses e confirme que os eventos recarregam. Clique num dia com evento e confirme o painel lateral. Crie um evento sem título e confirme que a validação bloqueia.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Calendario.tsx
git commit -m "feat: pagina de calendario com eventos por mes"
```

---

## Tarefa 23: Páginas de Relatórios e Configurações

**Files:**
- Modify: `src/pages/Relatorios.tsx`, `src/pages/Configuracoes.tsx`

**Relatórios** — porte de `js/pages/reports.js`. Preservar:
- Quatro métricas: total, fêmeas, machos, idade média com uma casa decimal (`reports.js:77-94`)
- Três gráficos: pelagens, status e distribuição por idade
- Faixas de idade exatamente `0-1`, `1-3`, `3-5`, `5-10`, `10+` (`reports.js:47`), com a mesma lógica de classificação de `reports.js:64-68`
- Exportação CSV com as doze colunas de `reports.js:105`, aspas duplas escapadas, arquivo `haras_animais.csv` (`reports.js:103-119`)

**Configurações** — porte de `js/pages/settings.js`. Preservar:
- Formulário com nome do haras, proprietário e localização, lidos e gravados por chave em `configuracoes` (`settings.js:69-71` e `settings.js:80-82`)
- Exportação JSON como `haras_backup.json` (`settings.js:90-106`)
- Cartão "Sobre o sistema"

**Mudança deliberada:** o botão "Importar Dados (JSON)" de `settings.js:38-43` **não tem handler nenhum hoje** e `store.importData` é um stub vazio (`js/store.js:206`). Clicar não faz nada. Em vez de portar um botão morto, substitua por um aviso desabilitado com o texto "Importação de dados ainda não disponível". Isso torna visível uma limitação que hoje está escondida.

Os `alert()` de `settings.js:83`, `settings.js:86` e `settings.js:104` viram `toast`.

- [ ] **Step 1: Implementar Relatórios**

Escreva `src/pages/Relatorios.tsx`, usando `StatCard`, `PelagemChart`, `StatusChart` e `IdadeChart`. Função de exportação:

```tsx
function exportarCsv(animais: Animal[]) {
  const cols = ['id', 'nome', 'registro', 'raca', 'pelagem', 'sexo',
    'data_nascimento', 'peso', 'altura', 'baia_piquete',
    'status_reprodutivo', 'status_saude'] as const

  const linhas = animais.map((a) =>
    cols.map((c) => `"${String(a[c] ?? '').replace(/"/g, '""')}"`).join(','),
  )
  const csv = [cols.join(','), ...linhas].join('\n')

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'haras_animais.csv'
  link.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Implementar Configurações**

Escreva `src/pages/Configuracoes.tsx` conforme descrito acima.

- [ ] **Step 3: Conferir no navegador**

Abra `#/relatorios`, exporte o CSV e abra o arquivo — confirme cabeçalho e linhas. Abra `#/configuracoes`, salve uma alteração e recarregue a página para confirmar a persistência.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Relatorios.tsx src/pages/Configuracoes.tsx
git commit -m "feat: paginas de relatorios e configuracoes"
```

---

## Tarefa 24: Página pública do plantel

**Files:**
- Modify: `src/pages/PlantelPublico.tsx`

Porte de `js/pages/plantelPublico.js`. Esta é a página que estranhos veem — é a vitrine do haras.

**Comportamentos a preservar:**
- Roda fora do shell, sem sidebar (`router.js:28`)
- Lista apenas animais com `em_destaque: true` (`plantelPublico.js:93`)
- Herói com vídeo de fundo em rotação entre os três arquivos de `assets/`, avançando no evento `ended` e voltando ao primeiro em `error` (`plantelPublico.js:56-76`)
- Grade responsiva com `minmax(280px, 1fr)` (`plantelPublico.js:120`)
- Clique no card abre um modal com foto, dados, genealogia, premiações e observações (`plantelPublico.js:191-236`)
- Mensagem de vazio quando nenhum animal está marcado (`plantelPublico.js:111-115`)
- Rodapé com o ano corrente (`plantelPublico.js:47`)

**O que muda:** conforme a spec, a splash screen sai do app e os vídeos ficam aqui. O emoji 🐴 de `plantelPublico.js:21` é substituído pelo monograma. A página adota os tokens do tema, mas **fica travada no tema claro** — é uma vitrine pública, e fotos de animais pedem fundo claro.

- [ ] **Step 1: Implementar a página**

Escreva `src/pages/PlantelPublico.tsx`. Para a rotação de vídeo:

```tsx
const PLAYLIST = ['assets/plantel-bg.mp4', 'assets/plantel-bg-2.mp4', 'assets/plantel-bg-3.mp4']

const [videoIndex, setVideoIndex] = useState(0)
// <video> com key={videoIndex} src={PLAYLIST[videoIndex]} autoPlay muted playsInline
//   onEnded={() => setVideoIndex((i) => (i + 1) % PLAYLIST.length)}
//   onError={() => setVideoIndex(0)}
```

Os vídeos precisam ser servidos pelo Vite. Mova a pasta para `public/`:

```bash
git mv assets public/assets
```

Assim os caminhos `assets/plantel-bg.mp4` continuam válidos em produção.

O modal usa `Dialog` do shadcn em vez do overlay manual de `plantelPublico.js:36-43`.

- [ ] **Step 2: Conferir no navegador**

Abra `#/plantel`. Confirme: sem sidebar, vídeo rodando no herói, só os animais marcados aparecem, o clique abre o modal com genealogia.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: pagina publica do plantel com heroi em video"
```

---

## Tarefa 25: Smoke tests de renderização por página

**Files:**
- Create: `src/test/renderPage.tsx`, `src/pages/pages.smoke.test.tsx`

Requisito da spec, seção "Testes". Cada página precisa renderizar sem estourar, com o store inteiro mockado. Isso protege o corte da Tarefa 26: se alguma página quebrar, a suíte acusa antes de o app legado ser removido.

- [ ] **Step 1: Criar o utilitário de renderização**

Escreva `src/test/renderPage.tsx`:

```tsx
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

export function renderPage(element: ReactElement, { path = '/', route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  )
}
```

- [ ] **Step 2: Escrever os testes que falham**

Escreva `src/pages/pages.smoke.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderPage } from '@/test/renderPage'

vi.mock('@/lib/store', () => ({
  store: {
    getAnimais: vi.fn().mockResolvedValue([]),
    getAnimal: vi.fn().mockResolvedValue({
      id: 'a1', nome: 'Aurora da Kneip', apelido: null, registro: null,
      registro_abccmm: null, raca: 'Mangalarga Marchador', pelagem: 'Tordilha',
      tipo_marcha: 'Marcha Batida', sexo: 'Fêmea', data_nascimento: '2020-05-11',
      peso: null, altura: null, baia_piquete: null, status_reprodutivo: 'Prenha',
      status_saude: null, premiacao: null, foto_url: null, observacoes: null,
      em_destaque: true, ativo: true, created_at: '2024-01-01',
    }),
    getAllGenealogias: vi.fn().mockResolvedValue([]),
    getGenealogia: vi.fn().mockResolvedValue(null),
    getAnimaisMap: vi.fn().mockResolvedValue({}),
    getSaudeRegistros: vi.fn().mockResolvedValue([]),
    getReproducao: vi.fn().mockResolvedValue([]),
    getAnotacoes: vi.fn().mockResolvedValue([]),
    getPesagens: vi.fn().mockResolvedValue([]),
    getEventos: vi.fn().mockResolvedValue([]),
    getConfiguracoes: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({
      totalAnimais: 0, femeas: 0, machos: 0, prenhas: 0, lactantes: 0, eventosProximos: [],
    }),
  },
}))

import Dashboard from './Dashboard'
import Catalogo from './Catalogo'
import Perfil from './Perfil'
import AnimalForm from './AnimalForm'
import Calendario from './Calendario'
import Relatorios from './Relatorios'
import Configuracoes from './Configuracoes'
import PlantelPublico from './PlantelPublico'

beforeEach(() => vi.clearAllMocks())

describe('smoke de renderizacao', () => {
  it('Painel', async () => {
    renderPage(<Dashboard />)
    await waitFor(() => expect(screen.getByText('Painel do Plantel')).toBeInTheDocument())
  })

  it('Plantel', async () => {
    renderPage(<Catalogo />)
    await waitFor(() => expect(screen.getByText('Plantel')).toBeInTheDocument())
  })

  it('Perfil', async () => {
    renderPage(<Perfil />, { path: '/animal/:id', route: '/animal/a1' })
    await waitFor(() => expect(screen.getByText('Aurora da Kneip')).toBeInTheDocument())
  })

  it('Novo animal', async () => {
    renderPage(<AnimalForm />, { path: '/novo-animal', route: '/novo-animal' })
    await waitFor(() => expect(screen.getByLabelText(/Nome/i)).toBeInTheDocument())
  })

  it('Calendario', async () => {
    renderPage(<Calendario />)
    await waitFor(() => expect(screen.getByText('Dom')).toBeInTheDocument())
  })

  it('Relatorios', async () => {
    renderPage(<Relatorios />)
    await waitFor(() => expect(screen.getByText(/Exportar CSV/i)).toBeInTheDocument())
  })

  it('Configuracoes', async () => {
    renderPage(<Configuracoes />)
    await waitFor(() => expect(screen.getByText(/Informações do Haras/i)).toBeInTheDocument())
  })

  it('Plantel publico', async () => {
    renderPage(<PlantelPublico />, { path: '/plantel', route: '/plantel' })
    await waitFor(() => expect(screen.getByText(/HARAS KNEIP|Haras Kneip/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 3: Rodar e corrigir**

Run: `npm test -- src/pages/pages.smoke.test.tsx`
Expected: PASS, 8 testes

Se algum falhar, o problema está na página, não no teste. Ajuste a página. Se o texto esperado não bater com o que a página realmente renderiza, ajuste o teste para o texto real — mas **não** enfraqueça o teste para apenas `expect(true)`.

- [ ] **Step 4: Commit**

```bash
git add src/test/renderPage.tsx src/pages/pages.smoke.test.tsx
git commit -m "test: smoke de renderizacao das oito paginas"
```

---

## Tarefa 26: Corte para o app novo

**Files:**
- Delete: `legacy.html`, `css/`, `js/`
- Create: `README.md`
- Modify: `index.html`

**Ponto sem volta.** Só execute esta tarefa depois que as Tarefas 16 a 25 estiverem concluídas e verdes.

- [ ] **Step 1: Confirmar que todas as páginas funcionam**

Rode `npm test` primeiro — os smoke tests da Tarefa 25 precisam estar verdes. Depois percorra manualmente as nove rotas no app novo: `#/`, `#/catalogo`, `#/animal/<id>`, `#/novo-animal`, `#/editar-animal/<id>`, `#/calendario`, `#/relatorios`, `#/configuracoes`, `#/plantel`. **Não prossiga se qualquer uma estiver quebrada.**

- [ ] **Step 2: Ajustar o `index.html`**

Escreva `index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Haras Kneip - Sistema de gestão de plantel Mangalarga Marchador. Controle de genealogia, reprodução, marcha e relatórios."
    />
    <meta name="theme-color" content="#1E5B3A" />
    <title>Haras Kneip | Mangalarga Marchador</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Remover o app legado**

```bash
git rm -r legacy.html css js
```

- [ ] **Step 4: Documentar o novo fluxo de publicação**

Escreva `README.md`:

````markdown
# Haras Kneip

Sistema de gestão de plantel Mangalarga Marchador.

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha com a URL e a chave anon do Supabase
npm run dev
```

## Publicar

O projeto agora tem etapa de build. Não basta copiar a pasta.

```bash
npm run build
```

Publique o conteúdo de `dist/`.

## Testes

```bash
npm test
```

## Stack

Vite, React, TypeScript, Tailwind CSS v4, shadcn/ui, React Router (hash),
Recharts, Supabase.
````

- [ ] **Step 5: Verificar o build**

Run: `npm run build`
Expected: build conclui, `dist/` criado

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove o app legado e documenta o build"
```

---

## Tarefa 27: Verificação final

- [ ] **Step 1: Rodar toda a suíte**

Run: `npm test`
Expected: PASS em todos os arquivos de teste. Anote o total.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 3: Verificar o build de produção**

Run: `npm run build`
Expected: sem erros

- [ ] **Step 4: Conferência visual nos dois temas**

Rode `npm run preview` e percorra as nove rotas no tema claro e no escuro. Em cada uma confirme:
1. Nenhum texto ilegível por contraste.
2. Nenhum emoji usado como marca.
3. Gráficos com cores coerentes com o tema ativo.
4. Nada estourando horizontalmente em viewport de 375px.

- [ ] **Step 5: Confirmar RLS no Supabase**

Requisito da spec, seção "Credenciais". Confirme no painel do Supabase que Row Level Security está ativo nas oito tabelas: `animais`, `genealogia`, `saude_registros`, `reproducao`, `anotacoes`, `eventos`, `pesagens`, `configuracoes`. **Se alguma estiver sem RLS, relate ao dono do projeto** — não altere o schema, está fora do escopo.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "chore: verificacao final do redesign"
```

---

## Critérios de aceite

Espelham a seção "Critérios de sucesso" da spec:

1. As oito páginas funcionam com paridade em relação ao app legado.
2. Tema claro e escuro completos, com preferência persistida.
3. Nenhum estilo inline para hover, cor ou espaçamento.
4. Texto de interface com base de `0.875rem` e hierarquia explícita.
5. Marca por monograma e serifada; nenhum emoji como elemento de marca.
6. `npm test` e `npx tsc --noEmit` passando, conferência visual feita nas nove rotas, nos dois temas.
