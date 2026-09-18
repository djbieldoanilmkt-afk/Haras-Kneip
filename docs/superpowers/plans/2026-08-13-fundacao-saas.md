# Fundação SaaS — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Multi-tenant com trial de 15 dias: landing, cadastro, tenancy por `haras_id`, RLS como fronteira entre contas, branding por conta e vitrine por slug — com o Haras Kneip migrado como tenant 1.

**Spec:** `docs/superpowers/specs/2026-08-13-fundacao-saas-design.md`

**Arquitetura de execução:** as migrações SQL são a espinha; o app é construído em torno delas. O executor desta sessão **não tem acesso ao banco** — as migrações são entregues como arquivos em `supabase/migrations/` e o dono do projeto as roda no SQL Editor. O plano tem um **CHECKPOINT** nesse ponto.

## Decisões técnicas centrais

1. **Trigger preenche `haras_id`.** Um trigger `before insert` em cada tabela seta `haras_id = meu_haras_id()` quando nulo. O store quase não muda: RLS filtra as leituras, o trigger carimba as escritas.
2. **`criar_haras(nome, slug)` é função `security definer`.** Insere haras + vínculo atomicamente. Inserts diretos em `haras`/`membros` são revogados — impede um usuário de se vincular ao haras alheio.
3. **Trial imposto no banco, não só na tela.** As políticas de escrita exigem conta `ativa` ou trial vigente. Expirou: leitura continua (humano), escrita trava — mesmo para quem contornar a interface.
4. **`status_conta` protegido por grant de coluna.** `grant update (nome, logo_url)` — o dono edita a identidade, mas não ativa a própria conta driblando o trial.
5. **Onboarding em dois passos:** cadastro cria só o usuário; a tela "Criar seu haras" chama `criar_haras`. Permite vincular o usuário do Gabriel ao Kneip (tenant pré-existente) com um insert manual, sem caso especial no código.

## Tarefas

### T1 — Constante do produto e utilitário de slug (TDD)
`src/lib/produto.ts` (nome provisório "Plantel", centralizado) e `src/lib/slug.ts` (`gerarSlug(nome)`, `validarSlug`) com testes: acentos, espaços, maiúsculas, hífens duplicados, tamanho mínimo.

### T2 — Migrações SQL
Três arquivos completos em `supabase/migrations/`:
- `001_tenancy.sql` — tabelas `haras` e `membros`; Kneip inserido como tenant 1 (`ativa`, slug `haras-kneip`, uuid fixo); `haras_id` + backfill + `not null` nas 8 tabelas; unicidade de `configuracoes.chave` passa a ser por haras.
- `002_rls.sql` — funções `meu_haras_id()`, `definir_haras_id()` (trigger), `criar_haras()`; drop dinâmico de todas as políticas antigas; RLS ligado em tudo; políticas por tenant (leitura/escrita autenticada), políticas anônimas restritas à vitrine (haras não bloqueado, animais em destaque, genealogia desses animais); revokes e grants de coluna.
- `003_storage.sql` — buckets `logos` e `fotos-animais` (públicos para leitura), escrita restrita à pasta `{haras_id}/` do autor.

**CHECKPOINT:** dono roda os 3 arquivos no SQL Editor, na ordem, e confirma. Depois de criar seu login pelo app, roda um insert de vínculo (fornecido) ligando seu `user_id` ao Kneip.

### T3 — Sessão e telas de autenticação
`useSession` (onAuthStateChange); páginas `Entrar`, `CriarConta` (e-mail+senha; aviso de confirmação de e-mail), `RecuperarSenha`. Funcionam antes das migrações — o Auth é nativo do projeto.

### T4 — Tenant: hook e onboarding
`useHarasAtual` (membro → haras, status, dias de trial); `CriarHaras` (nome + slug com sugestão e checagem de unicidade, chama `criar_haras`); tela `Assinar` (bloqueio pós-trial, canal de contato); banner de trial no shell.

### T5 — Rotas e guardas
`/` landing (logado → `/painel`); painel move para `/painel`; `RequireAuth` (sem sessão → `/entrar`; sem haras → `/criar-haras`; bloqueado/trial vencido → `/assinar`); vitrine `#/plantel/:slug`; `#/plantel` legado redireciona para `haras-kneip`. Smoke tests atualizados.

### T6 — Branding por conta
`Brand`/Topbar/título da aba dinâmicos (logo ou `iniciais(nome)`); Configurações ganha seção Identidade (nome, upload de logo para o Storage; slug exibido, não editável na v1).

### T7 — Vitrine por slug
`store.getHarasPorSlug` + consultas da vitrine filtradas por `haras_id`; herói usa nome/logo do haras; conta bloqueada → página "indisponível".

### T8 — Foto do animal via Storage
`AnimalForm` sobe o arquivo para `fotos-animais/{haras_id}/` e grava a URL pública. Fotos base64 existentes continuam exibindo (data URL funciona em `<img>`); re-salvar a foto na edição migra o animal. Migração em lote fica fora da v1 — são 9 animais.

### T9 — Landing
Herói (vídeo de fundo já existente), seções de funcionalidades **reais** (plantel, genealogia visual, calendário, relatórios, vitrine), trial de 15 dias como CTA, scroll-reveal com `useRevelarAoRolar`. Tema claro fixo, mesmo racional da vitrine.

### T10 — Verificação final
Suíte completa; `tsc`; build; probe de escrita anônima → **403**; dois tenants de teste sem vazamento (criar segundo haras e conferir isolamento); trial vencido bloqueia escrita; fluxo completo cadastro → criar haras → cadastrar animal → vitrine.

## Riscos assumidos

- `configuracoes.upsert` precisa passar a usar `onConflict: 'haras_id,chave'` — sem isso o salvar configurações quebra silenciosamente após a migração.
- A vitrine logada de outro haras: políticas anônimas também se aplicam a `authenticated` (políticas somam por OR) para a vitrine funcionar logado.
- Enquanto as migrações não rodarem, o app em produção continua no comportamento atual; o corte de rotas (T5) só entra depois do CHECKPOINT.
