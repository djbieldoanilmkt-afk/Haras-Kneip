/*
  A parte que só existe por causa do FFmpeg.

  Duas passagens, de propósito:

    1) tira os quadros em arquivo
    2) mede a nitidez DOS ARQUIVOS que a primeira gerou

  Fazer as duas coisas numa passagem só é possível e é mais rápido, mas a
  correspondência entre "medição número 7" e "arquivo número 7" passaria a
  depender de o FFmpeg entregar as duas saídas na mesma ordem. Medir o arquivo
  já gravado elimina a dúvida: o índice É o arquivo.
*/

import { spawn } from 'node:child_process';
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

/*
  Três quadros por segundo.

  A marcha do Mangalarga tem quatro tempos; a passada inteira dura menos de um
  segundo. Um quadro por segundo perderia fases do movimento. Acima de três,
  as imagens ficam quase idênticas e só engordam a conta.
*/
export const QUADROS_POR_SEGUNDO = 3;

/*
  Teto de duração analisada.

  Vídeo de haras às vezes vem com cinco minutos de conversa antes do cavalo
  andar. Cortar em três minutos limita memória, disco e tempo sem estragar
  nenhum caso real de 360 graus ou passagem lateral.
*/
export const SEGUNDOS_MAXIMOS = 180;

function executar(programa, args, { capturarSaida = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(programa, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let saida = '';
    let erro = '';
    p.stdout.on('data', (d) => {
      if (capturarSaida) saida += d.toString();
    });
    /* O FFmpeg fala muito em stderr. Guardo só o fim: se der errado, a última
       mensagem é a que explica; o resto é banner. */
    p.stderr.on('data', (d) => {
      erro = (erro + d.toString()).slice(-4000);
    });
    p.on('error', reject);
    p.on('close', (codigo) => {
      if (codigo === 0) resolve(saida);
      else reject(new Error(`${programa} saiu com ${codigo}: ${erro.trim() || 'sem mensagem'}`));
    });
  });
}

/** Duração e dimensão do vídeo, sem decodificar o conteúdo. */
export async function sondar(arquivo) {
  const bruto = await executar(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0',
     '-show_entries', 'stream=width,height',
     '-show_entries', 'format=duration',
     '-of', 'json', arquivo],
    { capturarSaida: true },
  );

  const j = JSON.parse(bruto);
  const fluxo = j.streams?.[0] ?? {};
  const duracao = Number(j.format?.duration);

  return {
    largura: Number.isFinite(fluxo.width) ? fluxo.width : null,
    altura: Number.isFinite(fluxo.height) ? fluxo.height : null,
    /* Sem duração não é erro: alguns .mov de celular não trazem no cabeçalho.
       O resto do processo não depende dela. */
    duracao: Number.isFinite(duracao) && duracao > 0 ? Number(duracao.toFixed(2)) : null,
  };
}

/**
 * Grava os quadros em disco e devolve os caminhos, em ordem de tempo.
 *
 * Reduz para 1280 de largura no máximo: o modelo de visão não enxerga mais
 * detalhe que isso, e vídeo 4K de celular geraria arquivos enormes à toa.
 */
export async function extrairQuadros(arquivo, destino) {
  await mkdir(destino, { recursive: true });

  await executar('ffmpeg', [
    '-nostdin', '-v', 'error', '-y',
    '-t', String(SEGUNDOS_MAXIMOS),
    '-i', arquivo,
    '-an',
    '-vf', `fps=${QUADROS_POR_SEGUNDO},scale='min(1280,iw)':-2`,
    '-q:v', '3',
    path.join(destino, '%05d.jpg'),
  ]);

  const nomes = (await readdir(destino)).filter((n) => n.endsWith('.jpg')).sort();
  return nomes.map((n) => path.join(destino, n));
}

/**
 * Nitidez de cada quadro, na mesma ordem dos arquivos.
 *
 * `edgedetect` transforma a imagem num mapa de bordas; `signalstats` devolve o
 * brilho médio desse mapa. Imagem nítida tem borda forte e média alta; imagem
 * tremida vira cinza escuro. É uma medida relativa — só vale comparada com os
 * outros quadros DO MESMO vídeo, que é exatamente como ela é usada.
 */
export async function medirNitidez(destino, quantidade) {
  const bruto = await executar('ffmpeg', [
    '-nostdin', '-v', 'error',
    '-f', 'image2', '-i', path.join(destino, '%05d.jpg'),
    /* Mede em miniatura: a ordem de grandeza da borda se mantém e o custo cai
       muito. */
    '-vf', "scale=320:-2,edgedetect=low=0.1:high=0.4,signalstats,metadata=print:file=-",
    '-f', 'null', '-',
  ], { capturarSaida: true });

  const valores = [];
  for (const linha of bruto.split('\n')) {
    const m = linha.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
    if (m) valores.push(Number(m[1]));
  }

  /*
    Se a medição não vier (build de FFmpeg sem o filtro, saída mudada de
    formato), o processo NÃO para: devolve nitidez zero para todos. Com todos
    iguais, a escolha por fatia ainda cobre o vídeo inteiro — perde-se a
    preferência pelo quadro mais limpo, não a extração.
  */
  if (valores.length !== quantidade) {
    return { nitidez: new Array(quantidade).fill(0), medido: false };
  }
  return { nitidez: valores, medido: true };
}

/** Instante de um quadro. O filtro `fps` gera taxa constante: índice / taxa. */
export function segundoDoQuadro(indice) {
  return Number((indice / QUADROS_POR_SEGUNDO).toFixed(2));
}
