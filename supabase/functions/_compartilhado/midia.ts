/*
  Leitura de mídia sem biblioteca.

  Roda no webhook (Deno) e no teste (Node): só TypeScript puro, nenhuma API de
  plataforma. É por isso que ele mora em `_compartilhado` e não dentro da
  função — para poder ser testado sem subir nada.

  POR QUE LER O CABEÇALHO EM VEZ DE DECODIFICAR

  Precisamos da dimensão para dizer "essa foto está pequena demais, manda de
  novo" antes de gravar. Decodificar a imagem inteira em Deno custaria uma
  dependência grande para responder uma pergunta que está nos primeiros bytes
  do arquivo.
*/

export type Dimensao = { largura: number; altura: number }

/* Marcadores de início de quadro. C4 (Huffman), C8 (reservado) e CC (aritmético)
   caem no meio da faixa e NÃO são quadro — por isso a lista é explícita. */
const QUADRO = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

const ASSINATURA_PNG = [137, 80, 78, 71, 13, 10, 26, 10]

function ehPng(b: Uint8Array): boolean {
  return b.length >= 8 && ASSINATURA_PNG.every((v, i) => b[i] === v)
}

function u32(b: Uint8Array, i: number): number {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
}

function u16(b: Uint8Array, i: number): number {
  return (b[i] << 8) | b[i + 1]
}

/**
 * Dimensão da imagem, ou nulo se não der para saber.
 *
 * Nulo não é erro: HEIC de iPhone, por exemplo, guarda a dimensão numa
 * estrutura de caixas que não vale a pena percorrer aqui. Quem chama trata
 * "não sei" como "aceita sem conferir o tamanho".
 */
export function medirImagem(bytes: Uint8Array): Dimensao | null {
  if (ehPng(bytes)) {
    /* 8 de assinatura + 4 de tamanho + 4 de "IHDR" + 8 de dimensão. */
    if (bytes.length < 24) return null
    return { largura: u32(bytes, 16), altura: u32(bytes, 20) }
  }

  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  /*
    Anda de segmento em segmento, nunca procurando os bytes do quadro soltos
    no arquivo. Um Exif com miniatura embutida contém a sequência do marcador
    de quadro no meio dos dados dele; quem procura solto lê essa miniatura —
    ou lixo — como se fosse a foto.
  */
  let i = 2
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return null

    /* Bytes 0xFF de enchimento entre segmentos são legais e não contam. */
    let marcador = bytes[i + 1]
    while (marcador === 0xff && i + 2 < bytes.length) {
      i++
      marcador = bytes[i + 1]
    }

    /* Marcadores sem corpo: seguem direto. */
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd8)) {
      i += 2
      continue
    }

    /* Fim do arquivo, ou começo dos dados comprimidos: daqui não sai quadro. */
    if (marcador === 0xd9 || marcador === 0xda) return null

    const tamanho = u16(bytes, i + 2)
    /* Todo segmento conta a si mesmo: menos de 2 é tamanho mentiroso, e somar
       zero no ponteiro giraria para sempre. */
    if (tamanho < 2) return null

    if (QUADRO.has(marcador)) {
      if (i + 9 > bytes.length) return null
      return { largura: u16(bytes, i + 7), altura: u16(bytes, i + 5) }
    }

    i += 2 + tamanho
  }

  return null
}

/* ======================================================= aceitação da mídia */

export type Validacao = 'ACEITA' | 'REPETIR_RECOMENDADO' | 'RECUSADA'

export type Veredito = {
  validacao: Validacao
  codigos: string[]
  /** O que dizer ao dono. Vazio quando não há nada a dizer. */
  recado: string
}

/* O balde corta em 100 MB. Conferir aqui é o que transforma "não consegui
   guardar" num recado que diz o que fazer. */
export const BYTES_MAXIMOS = 100 * 1024 * 1024

/* Abaixo disto o modelo de visão não enxerga articulação nem casco: a foto
   não serve para avaliar, por mais bem enquadrada que esteja. */
export const LADO_MINIMO = 640

/* Daqui para cima a foto está boa. Entre um e outro, dá para usar — e vale
   avisar que uma melhor ajudaria. */
export const LADO_BOM = 1024

const RECADOS: Record<string, string> = {
  TIPO_ERRADO_VIDEO: 'Aqui eu preciso de um *vídeo*, não de foto. Pode gravar e mandar?',
  TIPO_ERRADO_FOTO: 'Aqui eu preciso de uma *foto*, não de vídeo.',
  ARQUIVO_VAZIO: 'O arquivo chegou vazio. Pode mandar de novo?',
  ARQUIVO_GRANDE: `Esse arquivo passa de ${BYTES_MAXIMOS / 1024 / 1024} MB. Grave um trecho mais curto, ou mande em qualidade menor.`,
  RESOLUCAO_BAIXA: 'A foto está pequena demais para avaliar. Mande a original, sem reduzir.',
  RESOLUCAO_JUSTA: 'Dá para usar, mas uma foto maior ajudaria bastante.',
  ENQUADRAMENTO_VERTICAL: 'Para o cavalo de lado, vire o celular na horizontal — em pé o quadro corta o animal.',
}

function pedeVideo(papel: string): boolean {
  return papel.startsWith('VIDEO')
}

/**
 * Se a mídia serve para o papel que o roteiro está pedindo.
 *
 * O que NÃO se decide aqui: se a foto está tremida, escura ou se o cavalo
 * está no quadro. Isso é olho, não cabeçalho — fica para a etapa de visão.
 * Aqui só entra o que o arquivo responde sozinho, e que evita subir lixo.
 */
export function validarMidia(entrada: {
  papel: string
  mime: string
  bytes: number
  dimensao: Dimensao | null
}): Veredito {
  const { papel, mime, bytes, dimensao } = entrada
  const codigos: string[] = []
  const recados: string[] = []

  function anotar(codigo: string, recado = RECADOS[codigo]) {
    codigos.push(codigo)
    if (recado) recados.push(recado)
  }

  /*
    O tipo declarado manda; quando ele não diz nada, o cabeçalho decide.

    A Evolution às vezes entrega `application/octet-stream`. Recusar por "tipo
    errado" nesse caso seria punir quem mandou a foto certa por causa de um
    metadado que quem mandou não controla.
  */
  const ehVideo = mime.startsWith('video/')
  const ehImagem = mime.startsWith('image/') || (!ehVideo && dimensao !== null)

  if (pedeVideo(papel) && ehImagem) anotar('TIPO_ERRADO', RECADOS.TIPO_ERRADO_VIDEO)
  if (!pedeVideo(papel) && ehVideo) anotar('TIPO_ERRADO', RECADOS.TIPO_ERRADO_FOTO)

  if (bytes <= 0) anotar('ARQUIVO_VAZIO')
  else if (bytes > BYTES_MAXIMOS) anotar('ARQUIVO_GRANDE')

  /* Dimensão nula é "não sei", não "ruim": HEIC de iPhone cai aqui. */
  if (dimensao && !pedeVideo(papel)) {
    const menorLado = Math.min(dimensao.largura, dimensao.altura)
    if (menorLado < LADO_MINIMO) anotar('RESOLUCAO_BAIXA')
    else if (menorLado < LADO_BOM) anotar('RESOLUCAO_JUSTA')

    /* Só para o cavalo de lado: de frente e a cabeça cabem em pé. */
    if (papel.startsWith('LATERAL') && dimensao.altura > dimensao.largura) {
      anotar('ENQUADRAMENTO_VERTICAL')
    }
  }

  const grave = new Set(['TIPO_ERRADO', 'ARQUIVO_VAZIO', 'ARQUIVO_GRANDE', 'RESOLUCAO_BAIXA'])
  const validacao: Validacao = codigos.some((c) => grave.has(c))
    ? 'RECUSADA'
    : codigos.length > 0
      ? 'REPETIR_RECOMENDADO'
      : 'ACEITA'

  return { validacao, codigos, recado: recados.join(' ') }
}

/* =============================================== sexo e idade ditos em texto */

/*
  Cavalo não passa dos 40 anos.

  Isso é o que separa "de 4" (quatro anos) de "nasceu em 2022" (um ano, não
  dois mil e vinte e dois). Sem esse teto, a resposta mais natural do mundo
  viraria uma idade absurda gravada na avaliação.
*/
export const IDADE_MAXIMA_ANOS = 40

const MACHO = /\b(macho|garanhao|potro|castrado)\b/
const FEMEA = /\b(femea|egua|potra|potranca|matriz)\b/

/** Minúsculas e sem acento. No WhatsApp ninguém acentua. */
export function semAcento(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Lê o que o dono respondeu sobre um cavalo de fora.
 *
 * Não usa modelo de linguagem de propósito: é uma pergunta fechada com duas
 * respostas possíveis, e uma chamada de IA aqui custaria dinheiro para acertar
 * o que uma expressão regular acerta — e erraria de formas mais difíceis de
 * prever.
 *
 * O que não achou volta nulo. Chutar sexo ou idade aqui contaminaria o laudo:
 * é a idade que decide se as regras de animal jovem valem.
 */
export function lerSexoEIdade(texto: string): { sexo: string | null; idadeMeses: number | null } {
  const t = semAcento(texto ?? '')

  const sexo = FEMEA.test(t) ? 'Fêmea' : MACHO.test(t) ? 'Macho' : null

  let idadeMeses: number | null = null
  const anos = t.match(/(\d+)\s*ano/)
  const meses = t.match(/(\d+)\s*mes/)
  if (anos) idadeMeses = Number(anos[1]) * 12
  if (meses) idadeMeses = (idadeMeses ?? 0) + Number(meses[1])

  /* Número sem unidade: "de 4". Em haras isso é sempre ano — mas só até onde
     cavalo chega. */
  if (idadeMeses === null) {
    const solto = t.match(/\b(\d+)\b/)
    const n = solto ? Number(solto[1]) : 0
    if (n >= 1 && n <= IDADE_MAXIMA_ANOS) idadeMeses = n * 12
  }

  return { sexo, idadeMeses }
}
