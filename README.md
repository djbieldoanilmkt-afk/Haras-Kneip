# Haras Kneip

Sistema de gestão de plantel Mangalarga Marchador: controle de animais,
genealogia, sanidade, reprodução, calendário e relatórios.

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha com a URL e a chave anon do Supabase
npm run dev
```

## Publicar

**O projeto passou a ter etapa de build.** Não basta mais copiar a pasta para o
servidor.

```bash
npm run build
```

Publique o conteúdo de `dist/`.

As rotas usam hash (`#/catalogo`, `#/animal/:id`), então não é preciso
configurar regra de rewrite no servidor.

## Testes

```bash
npm test
```

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave `anon` (pública por design, protegida por RLS) |

A chave `anon` vai no bundle por natureza — é assim que o Supabase funciona no
navegador. A proteção real dos dados vem do Row Level Security nas tabelas, não
do sigilo da chave.

Nunca coloque a connection string do Postgres (`postgresql://postgres:...`) em
variável `VITE_`: tudo que começa com `VITE_` é embutido no JavaScript enviado
ao navegador.

## Stack

Vite, React, TypeScript, Tailwind CSS v4, shadcn/ui, React Router (hash),
Recharts, Supabase, Vitest.

## Estrutura

```
src/
  lib/          store, tipos do schema, formatação, validadores
  hooks/        useAsync (carregamento) e useTheme (claro/escuro)
  components/   ui/ (shadcn), layout/, charts/, voice/, form/
  pages/        as oito telas do sistema
public/assets/  vídeos de fundo da vitrine pública
docs/           spec e plano do redesign
```
