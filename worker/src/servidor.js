/*
  HARASPRO — trabalhador de vídeo da avaliação morfológica.

  POR QUE ESTE SERVIÇO EXISTE

  O módulo inteiro roda no Supabase. Uma coisa só não cabe lá: Edge Function é
  Deno puro, sem FFmpeg e sem como instalar. Então o vídeo — e só o vídeo — sai
  para cá. IA, laudo, WhatsApp e banco continuam no Supabase.

  O QUE ELE FAZ

  Pega uma tarefa PROCESSAR_MIDIA, baixa os vídeos daquela avaliação, tira
  quadros, escolhe os que prestam, sobe os escolhidos e registra. Depois fecha
  a tarefa. Nada além disso.

  COMO ELE É ACORDADO

  Por chamada HTTP com segredo. Ele não fica varrendo a fila sozinho: serviço
  acordado o mês inteiro custa dinheiro, e a fila fica vazia quase sempre.
  Quem tem vídeo novo bate na porta.
*/

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';

import { rpc, baixar, subir, conferirAmbiente } from './supabase.js';
import { sondar, extrairQuadros, medirNitidez, segundoDoQuadro } from './video.js';
import { escolherQuadros, quantosQuadros } from './quadros.js';

const PORTA = Number(process.env.PORT) || 8080;
const SEGREDO = process.env.WORKER_SEGREDO ?? '';

/*
  Teto de tarefas por chamada.

  Sem teto, uma fila represada seguraria a requisição por minutos e o Railway
  cortaria no meio — deixando tarefa em 'processando' que só o destravador
  recupera. Melhor devolver rápido e ser chamado de novo.
*/
const TAREFAS_POR_CHAMADA = 5;

/* Uma execução por vez neste processo: dois vídeos em paralelo dobram a
   memória, e memória é o que o plano barato tem de menos. */
let trabalhando = false;

function segredoConfere(recebido) {
  if (!SEGREDO || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(SEGREDO);
  /* `timingSafeEqual` estoura se os tamanhos diferem — comparar o tamanho
     antes vaza só o tamanho, que não é o segredo. */
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Processa um vídeo: baixa, mede, extrai, escolhe, sobe, registra. */
async function processarVideo(video) {
  const pasta = path.join(os.tmpdir(), `morf-${randomUUID()}`);
  const arquivo = path.join(pasta, 'entrada');
  const quadrosDir = path.join(pasta, 'quadros');

  try {
    await mkdir(pasta, { recursive: true });
    await writeFile(arquivo, await baixar(video.caminho));

    const info = await sondar(arquivo);
    await rpc('morfologia_midia_medidas', {
      p_midia: video.midia_id,
      p_duracao: info.duracao,
      p_largura: info.largura,
      p_altura: info.altura,
    });

    const arquivos = await extrairQuadros(arquivo, quadrosDir);
    if (arquivos.length === 0) {
      throw new Error(`nenhum quadro saiu de ${video.papel}`);
    }

    const { nitidez, medido } = await medirNitidez(quadrosDir, arquivos.length);

    const candidatos = arquivos.map((caminho, i) => ({
      segundo: segundoDoQuadro(i),
      nitidez: nitidez[i],
      arquivo: caminho,
    }));

    const escolhidos = escolherQuadros(candidatos, quantosQuadros(video.papel));

    /* Apaga o que sobrou de uma tentativa anterior ANTES de registrar os
       novos: se a regra de escolha mudou, os quadros velhos não podem ficar
       misturados com os novos na mesma análise. */
    await rpc('morfologia_frames_limpar', { p_midia: video.midia_id });

    for (const q of escolhidos) {
      const destino = `${video.prefixo_quadros}${q.segundo.toFixed(2)}.jpg`;
      await subir(destino, await readFile(q.arquivo));
      await rpc('morfologia_frame_registrar', {
        p_midia: video.midia_id,
        p_segundo: q.segundo,
        p_caminho: destino,
        p_nitidez: medido ? q.nitidez : null,
        p_selecionado: true,
      });
    }

    return {
      midia_id: video.midia_id,
      papel: video.papel,
      duracao: info.duracao,
      candidatos: arquivos.length,
      quadros: escolhidos.length,
      nitidez_medida: medido,
    };
  } finally {
    await rm(pasta, { recursive: true, force: true }).catch(() => {});
  }
}

async function processarTarefa(tarefa) {
  const feitos = [];
  for (const video of tarefa.videos) {
    feitos.push(await processarVideo(video));
  }
  return feitos;
}

/** Consome a fila até esvaziar ou bater o teto. */
async function trabalhar() {
  const relatorio = [];

  /* Recupera tarefa de trabalhador que morreu no meio antes de pegar as
     novas — senão ela nunca mais sairia de 'processando'. */
  const destravadas = await rpc('morfologia_destravar_tarefas', {});

  for (let i = 0; i < TAREFAS_POR_CHAMADA; i++) {
    const tarefa = await rpc('morfologia_tarefa_pegar', { p_tipo: 'PROCESSAR_MIDIA' });
    if (!tarefa?.tarefa_id) break;

    try {
      const feitos = await processarTarefa(tarefa);
      await rpc('morfologia_tarefa_concluir', { p_id: tarefa.tarefa_id, p_ok: true });
      relatorio.push({ tarefa_id: tarefa.tarefa_id, ok: true, videos: feitos });
    } catch (e) {
      /*
        A tarefa volta como falhada com o motivo. `tentativas` já foi contada
        ao pegar, então três falhas param sozinhas — vídeo corrompido não fica
        girando na fila para sempre.
      */
      await rpc('morfologia_tarefa_concluir', {
        p_id: tarefa.tarefa_id,
        p_ok: false,
        p_erro: String(e?.message ?? e),
      });
      relatorio.push({
        tarefa_id: tarefa.tarefa_id,
        ok: false,
        tentativa: tarefa.tentativa,
        erro: String(e?.message ?? e),
      });
      console.error(`tarefa ${tarefa.tarefa_id} falhou:`, e);
    }
  }

  return { destravadas, tarefas: relatorio };
}

function responder(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
  });
  res.end(texto);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');

  if (req.method === 'GET' && (url.pathname === '/saude' || url.pathname === '/')) {
    /* Diz o que falta, nunca o valor do que existe. */
    return responder(res, 200, { ok: true, faltando: conferirAmbiente(), trabalhando });
  }

  if (req.method === 'POST' && url.pathname === '/trabalhar') {
    if (!segredoConfere(req.headers['x-segredo'])) {
      return responder(res, 401, { erro: 'segredo inválido' });
    }
    if (trabalhando) {
      /* 202: a chamada não foi rejeitada, o trabalho já está acontecendo. */
      return responder(res, 202, { ok: true, observacao: 'já estou trabalhando' });
    }

    trabalhando = true;
    try {
      return responder(res, 200, { ok: true, ...(await trabalhar()) });
    } catch (e) {
      console.error('falha geral:', e);
      return responder(res, 500, { erro: String(e?.message ?? e) });
    } finally {
      trabalhando = false;
    }
  }

  return responder(res, 404, { erro: 'não existe' });
});

const faltando = conferirAmbiente();
if (faltando.length) {
  /* Sobe assim mesmo: `/saude` precisa responder para o Railway não ficar
     reiniciando em laço, e a mensagem no log diz exatamente o que configurar. */
  console.error('faltam variáveis de ambiente:', faltando.join(', '));
}

servidor.listen(PORTA, () => console.log(`trabalhador de vídeo ouvindo na ${PORTA}`));
