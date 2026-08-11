# Redesign do frontend — Haras Kneip

**Data:** 2026-08-11
**Status:** aprovado para planejamento

## Problema

O frontend atual foi descrito pelo dono do projeto como "horrível" e "datado". Na conversa de brainstorming, o diagnóstico se fechou em dois pontos, e não em navegação ou funcionalidade:

1. **Parece amador / sem identidade** — emoji 🐴 como marca, tipografia sem hierarquia, cara de template genérico.
2. **Datado** — sem modo escuro, sem componentes polidos, sem micro-interações.

O código confirma o diagnóstico:

- Fonte base em `0.8rem` e secundária em `0.7rem` (`css/variables.css`), o que deixa a interface comprimida.
- Estilos inline espalhados pelas páginas, incluindo `onmouseover`/`onmouseout` como manipuladores de hover (`js/pages/dashboard.js:114`).
- Sidebar de 180px, `padding` de `1rem` em tela cheia.
- Sem tema escuro.
- `js/components/sidebar.js` mistura marcação, estilo inline e lógica de teclado no mesmo arquivo.

## Objetivo

Dar ao sistema uma identidade visual própria e um acabamento contemporâneo, **sem alterar funcionalidade, escopo de páginas ou modelo de dados**.

## Decisões tomadas no brainstorming

| Decisão | Escolha | Observação |
|---|---|---|
| Stack | Migrar para Vite + React + Tailwind | Escolha do usuário, ciente de que passa a exigir build |
| Arquitetura JS | Reescrita completa em React | Escolha do usuário, ciente de que é reescrita e não ajuste de CSS |
| Direção visual | "SaaS Claro" (neutros frios, sombras discretas, geometria limpa) | Escolha do usuário |
| Cor de marca | Verde-campo `#1E5B3A` | Recomendação aceita |
| Linguagem | TypeScript | Assumido; shadcn/ui assume TS por padrão |
| Roteamento | HashRouter | Assumido; preserva as URLs atuais e dispensa rewrite no servidor |
| Splash screen | Removida | Assumido; os vídeos passam a ser fundo da página pública do plantel |

O usuário escolheu a direção "SaaS Claro", que na apresentação foi descrita como a que resolve o "datado" mas não o "sem identidade". A resolução acordada foi manter o esqueleto dessa direção e **injetar identidade por cima**: cor de marca própria, monograma `HK` no lugar do emoji, e o nome em serifada como única assinatura tipográfica.

## Stack

| Camada | Hoje | Depois |
|---|---|---|
| Build | nenhum | Vite |
| UI | strings de HTML em módulos ES | React 19 + TypeScript |
| Estilo | 5 arquivos CSS artesanais (1.147 linhas) | Tailwind v4, configuração CSS-first via `@theme` |
| Componentes | manuais | shadcn/ui (código copiado para o repositório) |
| Rotas | `js/router.js` próprio | React Router, modo hash |
| Gráficos | Chart.js via CDN | Recharts |
| Ícones | lucide via CDN | `lucide-react` |
| Fontes | Google Fonts via CDN | `@fontsource` auto-hospedado |
| Toasts | container manual em `index.html` | Sonner |

Versões exatas são fixadas no momento da instalação.

## Design system

Todos os valores viram tokens no bloco `@theme` do Tailwind, com a variante escura ativada por classe `.dark` no elemento raiz.

### Cor de marca

Verde-campo `#1E5B3A` como base, com escala de 50 a 950 gerada a partir dele. No tema escuro o acento sobe para um tom mais claro (`#4FA97A`) para manter contraste sobre fundo grafite.

### Neutros

| Papel | Claro | Escuro |
|---|---|---|
| Superfície | `#FBFBFC` | `#0F1115` |
| Card | `#FFFFFF` | `#16181D` |
| Borda | `#E7E8EC` | `#24272E` |
| Texto | `#14161A` | `#E8EAED` |
| Texto de apoio | `#868C96` | `#8B919B` |

### Cores de status

Os cinco status do domínio são preservados, mas recalibrados para contrastar nos dois temas:

| Status | Claro | Escuro |
|---|---|---|
| Vazia | `#6B7280` | `#9CA3AF` |
| Prenha | `#B45309` | `#FBBF24` |
| Lactante | `#0F766E` | `#2DD4BF` |
| Em cobertura | `#1D4ED8` | `#60A5FA` |
| Potro/Potra | `#C2410C` | `#FB923C` |

**Lactante muda de verde para verde-azulado.** Hoje é `#3d7a2a`, que colidiria com o verde da marca e tornaria ambíguo se um elemento verde significa "marca" ou "lactante".

### Tipografia

- **Inter** para toda a interface.
- **Playfair Display** exclusivamente no nome da marca — mantém a única escolha tipográfica atual que tem personalidade, e o uso restrito a transforma em assinatura.
- Base da interface sobe de `0.8rem` para `0.875rem`. Escala: `0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 1.875 / 2.25rem`.

### Forma e profundidade

- Raios: 6 / 8 / 12 / 16px e `full`.
- Sombras discretas em três níveis, coerentes com a direção escolhida — nada de brilho dourado ou `inset` decorativo como no CSS atual.
- Espaçamento na grade de 4px (padrão do Tailwind), substituindo a escala própria atual.

## App shell

- **Sidebar de 240px** (contra 180px), recolhível para trilha de ícones, com estado persistido. No mobile vira drawer.
- **Topbar** com breadcrumb, busca global por `⌘K` (Command palette), toggle de tema e menu do usuário.
- **Conteúdo** com largura máxima e respiro adequado.

## Componentes

Mapa direto do que existe hoje:

| Atual | Novo | Nota |
|---|---|---|
| `components/animalCard.js` | `AnimalCard` | sobre o Card do shadcn |
| `components/modal.js` | `Dialog` | shadcn |
| `components/sidebar.js` | `AppSidebar` | shadcn Sidebar |
| `components/header.js` | `PageHeader` | |
| `components/charts.js` | `Chart` | Recharts |
| `components/timeline.js` | `Timeline` | |
| `components/pedigreeTree.js` | `PedigreeTree` | componente próprio |
| `components/voiceAssistant.js` | `VoiceAssistant` | **lógica portada como está** |

O assistente de voz tem 414 linhas de lógica de reconhecimento de fala em cima da Web Speech API. Essa lógica é portada sem reescrita — apenas a casca visual muda. Reescrever o que funciona não serve ao objetivo deste trabalho.

Estados de carregamento passam a usar o `Skeleton` do shadcn, substituindo os `<div class="skeleton">` com altura fixa chutada.

## Páginas

As oito páginas permanecem, sem adição nem remoção:

`dashboard`, `catalogo`, `animalForm`, `profile`, `calendar`, `reports`, `settings`, `plantelPublico`.

Os vídeos em `assets/` (`splash-bg.mp4`, `plantel-bg*.mp4`) passam a ser fundo do herói da página pública do plantel.

## Camada de dados

O `js/store.js` vira `src/lib/store.ts`, tipado, com a mesma lógica de consulta. Sobre ele, hooks: `useAnimais`, `useAnimal`, `useStats`, `useEventos`, `useGenealogia`, `useSaudeRegistros`, `useReproducao`, `useAnotacoes`, `usePesagens`, `useConfiguracoes`.

**Sem TanStack Query.** Para oito telas com leitura simples, ele adiciona conceito sem retorno proporcional.

As oito tabelas do Supabase permanecem intocadas: `animais`, `genealogia`, `saude_registros`, `reproducao`, `anotacoes`, `eventos`, `pesagens`, `configuracoes`. Os tipos TypeScript são gerados a partir do schema e versionados em `src/lib/database.types.ts`.

### Credenciais

Hoje a URL e a chave `anon` do Supabase estão fixas em `js/supabase.js` e versionadas. A chave `anon` é pública por design — não é um vazamento —, mas passa a variável de ambiente do Vite (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), com `.env` no `.gitignore` e um `.env.example` versionado.

Como a chave é exposta no bundle por natureza, **é preciso confirmar que RLS está ativo nas oito tabelas** antes do corte. Isso é verificação, não alteração de schema.

## Estratégia de migração

O app novo é construído em `src/` com o app antigo intacto ao lado, permitindo comparação lado a lado e mantendo o sistema utilizável durante todo o trabalho.

Fases:

1. Scaffold: Vite, TypeScript, Tailwind v4, shadcn/ui, tokens, fontes auto-hospedadas.
2. App shell: sidebar, topbar, tema claro/escuro, rotas.
3. Camada de dados: `store.ts` tipado, hooks, variáveis de ambiente.
4. Componentes base.
5. Páginas, nesta ordem: dashboard, catálogo, perfil, formulário, calendário, relatórios, configurações, plantel público.
6. Corte: `index.html` passa a apontar para o bundle; `css/` e `js/` são removidos.
7. Verificação final.

## Testes

- **Vitest + Testing Library.**
- Cobertura nas funções do `store.ts` e nos utilitários (`formatDate`, validadores) — a lógica que tem regra de verdade.
- Smoke test de renderização por página, garantindo que nenhuma quebra no corte.
- Conferência visual manual de cada página rodando o app, nos dois temas.

## Fora de escopo

- Alterações no schema do Supabase.
- Novas funcionalidades ou páginas.
- Reorganização da navegação ou da informação.
- Reescrita da lógica do assistente de voz.
- `store.importData` continua um stub, como está hoje. É uma lacuna pré-existente, não introduzida por este trabalho.

## Riscos e consequências

| Risco | Consequência | Mitigação |
|---|---|---|
| Publicação passa a exigir build | Não é mais possível subir a pasta como está hoje | Documentar `npm run build` → `dist/` no README |
| Chart.js → Recharts | Gráficos mudam de aparência | Conferência visual nas telas de dashboard e relatórios |
| Porte do assistente de voz | Pode expor bugs latentes na integração com a Web Speech API | Portar a lógica sem alteração; testar em navegador real |
| Reescrita de 22 arquivos JS | Regressão funcional silenciosa | Corte só depois de todas as páginas prontas; app antigo disponível para comparação |
| shadcn/ui traz Radix | Bundle maior que o atual | Aceitável: hoje o CDN carrega Chart.js e lucide inteiros a cada visita |

## Critérios de sucesso

1. As oito páginas funcionam com paridade de funcionalidade em relação ao app atual.
2. Tema claro e escuro completos, com preferência persistida.
3. Nenhum estilo inline remanescente para hover, cor ou espaçamento.
4. Texto de interface com base de `0.875rem` e hierarquia tipográfica explícita.
5. Marca presente por monograma e serifada; nenhum emoji como elemento de marca.
6. Testes passando e conferência visual feita nas oito páginas, nos dois temas.
