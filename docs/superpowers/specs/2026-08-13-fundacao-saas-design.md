# Fundação SaaS multi-tenant — Plantel (nome provisório)

**Data:** 2026-08-13
**Status:** aguardando aprovação
**Depende de:** redesign React (PR #1) e rodada de movimento/genealogia (concluídos)

## Objetivo

Transformar o sistema interno do Haras Kneip num produto multi-tenant por assinatura, distribuível a outros haras. Cada conta tem seu próprio plantel, sua identidade (nome e logo) e sua vitrine pública — e nenhuma conta enxerga os dados de outra.

## Decisões do dono do projeto

| Decisão | Escolha |
|---|---|
| Raiz do site (`#/`) | Landing de marketing do produto |
| Entrada de novos haras | Cadastro aberto com trial gratuito de 15 dias; expirado, o painel trava até assinar |
| Endereço da vitrine | Slug escolhido no cadastro (`#/plantel/haras-kneip`), único, sugerido a partir do nome |
| Nome do produto | A decidir. Provisório: **Plantel**, centralizado numa constante (`src/lib/produto.ts`) para troca sem caça ao texto |
| Pensão de terceiros | Fora do produto — o Haras Kneip não hospeda animais de terceiros |

## Premissas assumidas (reversíveis)

- Supabase Auth com e-mail/senha, com confirmação de e-mail e recuperação de senha padrão.
- Um papel só na v1: **dono**. Papéis de equipe (tratador, veterinário) ficam para a rodada de "Pessoas".
- Onboarding mínimo: e-mail, senha, nome do haras e slug. Logo se configura depois, em Configurações — pedir upload no cadastro mata conversão.
- **Sem gateway de pagamento na v1.** O trial e o bloqueio são reais; a ativação após pagamento é manual (o operador do produto muda o status da conta). Stripe/Pix automatizado é rodada futura, quando houver fila de assinantes.

## Modelo de dados

### Tabelas novas

**`haras`** — o tenant.

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `nome` | text | exibido no app e na vitrine |
| `slug` | text unique | validado no cadastro; minúsculas, hífens |
| `logo_url` | text null | Storage |
| `status_conta` | text | `'trial'` \| `'ativa'` \| `'bloqueada'` |
| `trial_expira_em` | timestamptz | cadastro + 15 dias |
| `created_at` | timestamptz | |

**`membros`** — quem acessa o quê.

| Coluna | Tipo | Nota |
|---|---|---|
| `haras_id` | uuid fk | |
| `user_id` | uuid fk auth.users | |
| `papel` | text | `'dono'` na v1 |
| | | unique (`haras_id`, `user_id`); na v1, um usuário pertence a um haras |

### Tabelas existentes

Todas as oito (`animais`, `genealogia`, `saude_registros`, `reproducao`, `anotacoes`, `eventos`, `pesagens`, `configuracoes`) ganham `haras_id uuid not null` com FK, preenchido no backfill com o id do Haras Kneip — que passa a ser o **tenant nº 1**, com dados intactos. Em `configuracoes`, a unicidade de `chave` passa a ser por haras.

## Segurança (o coração do produto)

O RLS deixa de ser pendência e vira a fronteira entre clientes.

| Papel | Acesso |
|---|---|
| Autenticado | Lê e escreve apenas linhas cujo `haras_id` pertence ao seu vínculo em `membros` |
| Anônimo | Leitura estritamente limitada à vitrine: `haras` (nome, slug, logo, status), `animais` com `em_destaque = true` de contas não bloqueadas, e `genealogia` desses animais. **Nenhuma escrita.** |

Critério de aceite explícito: o probe de UPDATE anônimo que hoje responde 200 passa a responder **403**.

### Execução das migrações — limitação de acesso

A conta Supabase conectada a esta sessão **não tem acesso** ao projeto `nesnxcmdfksakgspvkcg`, e a chave `anon` não roda DDL. As migrações serão entregues como arquivos SQL numerados em `supabase/migrations/`, e o dono do projeto as executa no SQL Editor do painel do Supabase (ou conecta o MCP ao projeto para eu aplicar). O plano de implementação para nesse ponto e retoma após a confirmação.

## Storage

Dois buckets, com política por tenant no caminho (`{haras_id}/...`):

- `logos` — a logo de cada conta.
- `fotos-animais` — resolve em definitivo a pendência das fotos em base64: o formulário passa a subir o arquivo e gravar só a URL; as fotos existentes do Kneip são migradas por script.

## Fluxos

### Cadastro
E-mail + senha + nome do haras + slug (sugerido do nome, validado único) → confirma e-mail → conta `trial` com 15 dias → entra direto no painel vazio (ou com onboarding leve de "cadastre seu primeiro animal").

### Trial e bloqueio
Banner discreto com dias restantes durante o trial. Expirou: rotas do painel redirecionam para `/assinar` — tela com o pitch e canal de contato para fechar a assinatura. Pagamento confirmado (por fora), o operador muda `status_conta` para `ativa`. A vitrine pública **sai do ar** quando a conta está bloqueada (`indisponível`), como incentivo à assinatura.

### Identidade por conta
Nome e logo configuráveis em Configurações. O monograma do shell usa a logo quando existe e `iniciais(nome)` quando não — o mecanismo já existe. Título da aba, sidebar e vitrine passam a refletir o haras logado (ou o haras do slug, na vitrine).

## Rotas

| Rota | Conteúdo | Acesso |
|---|---|---|
| `#/` | Landing do produto (scroll-trigger reutilizando `useRevelarAoRolar`); logado, redireciona ao painel | público |
| `#/entrar`, `#/criar-conta`, `#/recuperar-senha` | autenticação | público |
| `#/assinar` | bloqueio pós-trial | logado |
| `#/plantel/:slug` | vitrine do haras | público |
| `#/plantel` (legado) | redireciona para `#/plantel/haras-kneip` — preserva os links já compartilhados no WhatsApp | público |
| `#/painel`, `#/catalogo`, `#/animal/:id`, demais | o app atual, protegido por sessão | logado |

Mudança consciente: `#/` deixa de ser o painel (vira landing). O painel muda para `#/painel`.

### Landing — regra de honestidade
A landing anuncia **o que existe**: gestão de plantel, genealogia visual, calendário, relatórios, vitrine pública compartilhável. Semáforo de documentos, custos por animal e KPIs de reprodução entram na página **quando forem entregues** — não se vende funcionalidade que não existe.

## Fora de escopo da v1

Gateway de pagamento automático; múltiplos papéis por conta; um usuário em vários haras; subdomínio próprio por haras; troca de e-mail; exclusão de conta self-service; as funcionalidades das dores 1–5 (rodadas seguintes, já nascendo multi-tenant).

## Critérios de sucesso

1. Dois haras de teste convivem sem vazamento: A não lê nem escreve nada de B (verificado por teste com dois usuários).
2. O probe de escrita anônima responde 403.
3. Vitrine pública funciona deslogado, por slug, e some quando a conta está bloqueada.
4. Conta com trial vencido não acessa o painel; ativação manual restaura o acesso.
5. O Haras Kneip opera como tenant 1 sem perda de dados, com fotos migradas para o Storage.
6. Nome e logo configurados aparecem no shell, na aba e na vitrine.
7. Suíte de testes existente passando, mais cobertura para guarda de rota, trial e slug.
