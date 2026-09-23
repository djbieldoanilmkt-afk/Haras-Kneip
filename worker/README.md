# Trabalhador de vídeo — avaliação morfológica

Extrai quadros dos vídeos de uma avaliação morfológica e grava os que prestam.

## Por que este serviço existe fora do Supabase

O módulo inteiro roda no Supabase. Uma coisa só não cabe lá: **Edge Function é
Deno puro, sem FFmpeg e sem como instalar**. Extrair quadro de vídeo é a única
etapa que precisa de FFmpeg — então é a única que sai. IA, laudo, WhatsApp e
banco continuam no Supabase.

Não é preferência de arquitetura. É a restrição que sobrou depois de conferir
que não há alternativa em Deno.

## O que ele faz

1. Pega uma tarefa `PROCESSAR_MIDIA` da fila (`morfologia_tarefas`).
2. Para cada vídeo **aceito e não substituído** daquela avaliação:
   - baixa do balde privado `morfologia`;
   - lê duração e dimensão com `ffprobe` e grava na mídia;
   - extrai quadros a 3 por segundo, no máximo 180 segundos de vídeo;
   - mede a nitidez de cada quadro (`edgedetect` + `signalstats`);
   - escolhe os melhores **cobrindo o vídeo inteiro** (ver `src/quadros.js`);
   - sobe os escolhidos e registra em `morfologia_frames`.
3. Fecha a tarefa.

Foto não passa por aqui — ela já é o quadro.

## Escolha dos quadros

Fatia o tempo em N trechos e pega o mais nítido de cada trecho. Pegar
simplesmente "os N mais nítidos" devolve N imagens do mesmo instante — no vídeo
de 360 graus, isso significa N fotos do mesmo ângulo e nenhuma do outro lado.

Quadro com nitidez abaixo de 20% da melhor do próprio vídeo é descartado: é
borrão, não "um pouco tremido". A comparação é com o próprio vídeo porque luz
de galpão e luz de sol dão escalas diferentes.

| Papel               | Quadros |
| ------------------- | ------- |
| `VIDEO_360`         | 10      |
| `VIDEO_LATERAL`     | 8       |
| `VIDEO_FRENTE_TRAS` | 6       |
| outros              | 6       |

## Contrato com o banco

O trabalhador **não monta SQL**. Ele chama funções nomeadas, definidas em
`supabase/migrations/045_morfologia_fila_de_video.sql`:

| Função                        | Para quê                                  |
| ----------------------------- | ----------------------------------------- |
| `morfologia_destravar_tarefas`| devolve à fila o que ficou preso          |
| `morfologia_tarefa_pegar`     | pega uma tarefa e os vídeos dela          |
| `morfologia_midia_medidas`    | grava duração e dimensão                  |
| `morfologia_frames_limpar`    | apaga quadros antes de reprocessar        |
| `morfologia_frame_registrar`  | grava um quadro escolhido                 |
| `morfologia_tarefa_concluir`  | fecha a tarefa                            |

O que ele pode fazer no banco está escrito em SQL revisável, não em JavaScript.

## Endpoints

- `GET /saude` — diz se está de pé e **quais** variáveis faltam (nunca o valor).
- `POST /trabalhar` — exige `x-segredo`. Consome até 5 tarefas e responde com o
  que fez. Responde `202` se já estiver trabalhando.

## Como ele é acordado

Ele **dorme quando não tem trabalho** (`sleepApplication` no Railway) — parado
não consome nada. Quem bate na porta é `public.morfologia_acordar_trabalhador()`
(migração 046), chamada pelo pg_cron de 5 em 5 minutos.

Essa função **confere a fila antes** de chamar. Acordar o serviço a cada 5
minutos para ele responder "nada a fazer" o manteria acordado o mês inteiro —
que é exatamente o custo que dormir evita.

## Variáveis de ambiente

| Nome                        | Para quê                                     |
| --------------------------- | -------------------------------------------- |
| `SUPABASE_URL`              | projeto                                      |
| `SUPABASE_SERVICE_ROLE_KEY` | balde privado e as funções acima             |
| `WORKER_SEGREDO`            | cabeçalho `x-segredo` de `/trabalhar`        |
| `PORT`                      | o Railway define                             |

Nenhuma delas entra em log ou em mensagem de erro.

## Rodar e testar

```bash
npm test          # a lógica de escolha de quadros, sem rede e sem FFmpeg
npm start         # precisa das variáveis acima
```

Sem dependências de npm: só Node 22, FFmpeg e quatro arquivos.

## Deploy

```bash
RAILWAY_TOKEN=<token do projeto> railway up --service morfologia-frames
```
