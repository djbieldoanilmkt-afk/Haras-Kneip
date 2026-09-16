/*
  Qual quadro do vídeo vale a pena analisar.

  Um vídeo de trinta segundos a três quadros por segundo dá noventa imagens.
  Mandar noventa para o modelo custa caro e não melhora nada: em meio segundo
  o cavalo não mudou. O que importa é cobrir o percurso inteiro — e, dentro de
  cada trecho, pegar a imagem mais nítida.

  POR QUE POR TRECHO, E NÃO AS MAIS NÍTIDAS DO VÍDEO

  Escolher simplesmente as dez mais nítidas costuma devolver dez imagens do
  mesmo instante — o momento em que o cavalo parou. No vídeo de 360 graus isso
  é o pior resultado possível: dez fotos do mesmo ângulo e nenhuma do outro
  lado. Fatiar o tempo e pegar a melhor de cada fatia garante os ângulos.
*/

/** Quantos quadros cada tipo de vídeo rende. */
export const QUADROS_POR_PAPEL = {
  /* Volta completa: cada fatia é um ângulo diferente, então pede mais. */
  VIDEO_360: 10,
  /* Aprumo de frente e de trás: dois trechos úteis, o resto é caminhada. */
  VIDEO_FRENTE_TRAS: 6,
  /* Marcha: a sequência importa tanto quanto a nitidez. */
  VIDEO_LATERAL: 8,
};

export const QUADROS_PADRAO = 6;

export function quantosQuadros(papel) {
  return QUADROS_POR_PAPEL[papel] ?? QUADROS_PADRAO;
}

/*
  Abaixo disto a imagem não é "um pouco tremida": é borrão.

  Fração da melhor nitidez do próprio vídeo, não um número absoluto — luz de
  galpão e luz de sol dão escalas diferentes, e comparar com o próprio vídeo é
  a única referência honesta.
*/
export const PISO_DE_NITIDEZ = 0.2;

/**
 * Escolhe os quadros que vão para a análise.
 *
 * @param {Array<{segundo: number, nitidez: number}>} candidatos
 * @param {number} quantidade
 * @returns {Array<{segundo: number, nitidez: number, selecionado: boolean, motivo_descarte: string|null}>}
 *          Só os escolhidos. Quem não passou não volta: o vídeo continua
 *          guardado, e linha de quadro sem arquivo não serve para nada.
 */
export function escolherQuadros(candidatos, quantidade) {
  if (!Array.isArray(candidatos) || candidatos.length === 0) return [];
  if (!(quantidade > 0)) return [];

  const ordenados = [...candidatos].sort((a, b) => a.segundo - b.segundo);
  const inicio = ordenados[0].segundo;
  const fim = ordenados[ordenados.length - 1].segundo;
  const melhor = Math.max(...ordenados.map((c) => c.nitidez ?? 0));
  const piso = melhor * PISO_DE_NITIDEZ;

  /* Menos candidatos que fatias: não há o que fatiar, leva todos os que
     prestam. */
  if (ordenados.length <= quantidade) {
    return ordenados
      .filter((c) => (c.nitidez ?? 0) >= piso)
      .map((c) => ({ ...c, selecionado: true, motivo_descarte: null }));
  }

  /* Vídeo de duração zero (um quadro só, ou tudo no mesmo instante): fatiar
     por tempo divide por zero. Cai para nitidez pura. */
  const duracao = fim - inicio;
  if (!(duracao > 0)) {
    return [...ordenados]
      .sort((a, b) => (b.nitidez ?? 0) - (a.nitidez ?? 0))
      .slice(0, quantidade)
      .sort((a, b) => a.segundo - b.segundo)
      .map((c) => ({ ...c, selecionado: true, motivo_descarte: null }));
  }

  const largura = duracao / quantidade;
  const escolhidos = [];

  for (let i = 0; i < quantidade; i++) {
    const de = inicio + i * largura;
    /* A última fatia fecha no fim inclusive, senão o último quadro do vídeo
       fica de fora por um décimo de segundo. */
    const ate = i === quantidade - 1 ? fim : de + largura;
    const ultima = i === quantidade - 1;

    let campeao = null;
    for (const c of ordenados) {
      const dentro = ultima
        ? c.segundo >= de && c.segundo <= ate
        : c.segundo >= de && c.segundo < ate;
      if (!dentro) continue;
      if (campeao === null || (c.nitidez ?? 0) > (campeao.nitidez ?? 0)) campeao = c;
    }

    /* Fatia vazia acontece quando o vídeo tem buraco de tempo. Pular é certo:
       inventar quadro de outra fatia repetiria ângulo. */
    if (campeao === null) continue;
    if ((campeao.nitidez ?? 0) < piso) continue;
    escolhidos.push({ ...campeao, selecionado: true, motivo_descarte: null });
  }

  return escolhidos;
}
