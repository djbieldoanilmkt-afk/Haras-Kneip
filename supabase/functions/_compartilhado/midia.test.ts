import { describe, expect, test } from 'vitest'
import { lerSexoEIdade, medirImagem, validarMidia } from './midia'

/* ---------------------------------------------------------------- oficinas */

function png(largura: number, altura: number): Uint8Array {
  const b = [137, 80, 78, 71, 13, 10, 26, 10]
  b.push(0, 0, 0, 13) // tamanho do IHDR
  b.push(0x49, 0x48, 0x44, 0x52) // "IHDR"
  b.push((largura >> 24) & 255, (largura >> 16) & 255, (largura >> 8) & 255, largura & 255)
  b.push((altura >> 24) & 255, (altura >> 16) & 255, (altura >> 8) & 255, altura & 255)
  b.push(8, 2, 0, 0, 0) // profundidade, cor, compressão, filtro, entrelace
  b.push(0, 0, 0, 0) // crc — o leitor não confere, e não precisa
  return new Uint8Array(b)
}

/** Monta um JPEG com os segmentos na ordem dada. */
function jpeg(segmentos: Array<{ marcador: number; dados: number[] }>): Uint8Array {
  const b = [0xff, 0xd8]
  for (const s of segmentos) {
    const tamanho = s.dados.length + 2
    b.push(0xff, s.marcador, (tamanho >> 8) & 255, tamanho & 255, ...s.dados)
  }
  b.push(0xff, 0xd9)
  return new Uint8Array(b)
}

/** Corpo de um segmento SOF: precisão, altura, largura, componentes. */
function sof(largura: number, altura: number): number[] {
  return [8, (altura >> 8) & 255, altura & 255, (largura >> 8) & 255, largura & 255, 3]
}

/* ------------------------------------------------------------------ testes */

describe('medirImagem', () => {
  test('lê a dimensão de um PNG', () => {
    expect(medirImagem(png(1920, 1080))).toEqual({ largura: 1920, altura: 1080 })
  })

  test('lê a dimensão de um JPEG de celular, com os segmentos que ele traz na frente', () => {
    /* APP0 (JFIF) e APP1 (Exif) vêm antes do SOF em qualquer foto de celular. */
    const arquivo = jpeg([
      { marcador: 0xe0, dados: [0x4a, 0x46, 0x49, 0x46, 0] },
      { marcador: 0xe1, dados: new Array(60).fill(0x45) },
      { marcador: 0xdb, dados: new Array(64).fill(3) },
      { marcador: 0xc0, dados: sof(4032, 3024) },
    ])
    expect(medirImagem(arquivo)).toEqual({ largura: 4032, altura: 3024 })
  })

  test('lê JPEG progressivo, que usa outro marcador de quadro', () => {
    const arquivo = jpeg([{ marcador: 0xc2, dados: sof(800, 600) }])
    expect(medirImagem(arquivo)).toEqual({ largura: 800, altura: 600 })
  })

  /*
    A armadilha que derruba leitor ingênuo.

    Um leitor que só procura os bytes FF C0 no arquivo inteiro acha esta
    sequência DENTRO do Exif e lê lixo como se fosse a dimensão. Andar de
    segmento em segmento é o que evita isso — e é a razão de este teste
    existir.
  */
  test('não confunde FFC0 que aparece dentro do Exif com o quadro de verdade', () => {
    const arquivo = jpeg([
      { marcador: 0xe1, dados: [0xff, 0xc0, 0, 11, 8, 0x27, 0x10, 0x27, 0x10, 3, 0] },
      { marcador: 0xc0, dados: sof(1024, 768) },
    ])
    expect(medirImagem(arquivo)).toEqual({ largura: 1024, altura: 768 })
  })

  test('arquivo cortado no meio devolve nulo em vez de travar', () => {
    const inteiro = jpeg([
      { marcador: 0xe1, dados: new Array(200).fill(7) },
      { marcador: 0xc0, dados: sof(640, 480) },
    ])
    expect(medirImagem(inteiro.slice(0, 40))).toBeNull()
  })

  test('segmento com tamanho mentiroso não vira laço infinito', () => {
    /* Tamanho zero faria o ponteiro parar no lugar e girar para sempre. */
    const arquivo = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0, 0xff, 0xc0, 0, 11, 8, 2, 0, 1, 0, 3])
    expect(medirImagem(arquivo)).toBeNull()
  })

  test('o que não é imagem conhecida devolve nulo', () => {
    expect(medirImagem(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]))).toBeNull()
    expect(medirImagem(new Uint8Array(0))).toBeNull()
  })

  test('PNG truncado antes do IHDR devolve nulo', () => {
    expect(medirImagem(png(100, 100).slice(0, 12))).toBeNull()
  })
})

describe('validarMidia', () => {
  const foto = { papel: 'LATERAL_ESQ', mime: 'image/jpeg', bytes: 2_000_000 }
  const video = { papel: 'VIDEO_360', mime: 'video/mp4', bytes: 8_000_000 }

  test('foto boa e na horizontal passa sem ressalva', () => {
    const v = validarMidia({ ...foto, dimensao: { largura: 3000, altura: 2000 } })
    expect(v.validacao).toBe('ACEITA')
    expect(v.codigos).toEqual([])
  })

  test('vídeo dentro do limite passa — a duração quem mede é o trabalhador', () => {
    expect(validarMidia({ ...video, dimensao: null }).validacao).toBe('ACEITA')
  })

  /*
    O erro mais comum de quem está com o celular na mão: o roteiro pede vídeo e
    a pessoa manda foto. Gravar isso como se fosse o vídeo deixaria a avaliação
    esperando para sempre por algo que já "chegou".
  */
  test('foto onde o roteiro pede vídeo é recusada, e o recado diz o que falta', () => {
    const v = validarMidia({ papel: 'VIDEO_360', mime: 'image/jpeg', bytes: 900_000,
                             dimensao: { largura: 3000, altura: 2000 } })
    expect(v.validacao).toBe('RECUSADA')
    expect(v.codigos).toContain('TIPO_ERRADO')
    expect(v.recado.toLowerCase()).toContain('vídeo')
  })

  test('vídeo onde o roteiro pede foto é recusado', () => {
    const v = validarMidia({ papel: 'CABECA_PERFIL', mime: 'video/mp4', bytes: 5_000_000,
                             dimensao: null })
    expect(v.validacao).toBe('RECUSADA')
    expect(v.codigos).toContain('TIPO_ERRADO')
    expect(v.recado.toLowerCase()).toContain('foto')
  })

  test('arquivo vazio é recusado', () => {
    const v = validarMidia({ ...foto, bytes: 0, dimensao: null })
    expect(v.validacao).toBe('RECUSADA')
    expect(v.codigos).toContain('ARQUIVO_VAZIO')
  })

  /*
    O balde corta em 100 MB. Sem esta conferência, o arquivo subiria, o
    storage devolveria erro e o dono receberia "não consegui guardar" sem
    saber o motivo.
  */
  test('arquivo acima do limite do balde é recusado antes de tentar subir', () => {
    const v = validarMidia({ ...video, bytes: 120 * 1024 * 1024, dimensao: null })
    expect(v.validacao).toBe('RECUSADA')
    expect(v.codigos).toContain('ARQUIVO_GRANDE')
    expect(v.recado).toMatch(/\d+\s*MB/i)
  })

  test('foto pequena demais é recusada', () => {
    const v = validarMidia({ ...foto, dimensao: { largura: 640, altura: 480 } })
    expect(v.validacao).toBe('RECUSADA')
    expect(v.codigos).toContain('RESOLUCAO_BAIXA')
  })

  test('foto no limite do aceitável passa, mas pedindo outra melhor', () => {
    const v = validarMidia({ ...foto, dimensao: { largura: 1000, altura: 800 } })
    expect(v.validacao).toBe('REPETIR_RECOMENDADO')
    expect(v.codigos).toContain('RESOLUCAO_JUSTA')
  })

  /*
    Cavalo de lado não cabe em foto em pé. Isso não é recusa — a foto serve —
    mas avisar na hora vale mais do que descobrir no laudo que o quadro cortou
    a garupa.
  */
  test('foto lateral em pé recebe o aviso de enquadramento', () => {
    const v = validarMidia({ ...foto, dimensao: { largura: 1200, altura: 1600 } })
    expect(v.validacao).toBe('REPETIR_RECOMENDADO')
    expect(v.codigos).toContain('ENQUADRAMENTO_VERTICAL')
  })

  test('foto de cabeça em pé não recebe aviso de enquadramento', () => {
    const v = validarMidia({ papel: 'CABECA_FRENTE', mime: 'image/jpeg', bytes: 2_000_000,
                             dimensao: { largura: 1200, altura: 1600 } })
    expect(v.codigos).not.toContain('ENQUADRAMENTO_VERTICAL')
    expect(v.validacao).toBe('ACEITA')
  })

  test('problemas se somam, e a recusa manda no veredito', () => {
    const v = validarMidia({ ...foto, dimensao: { largura: 300, altura: 500 } })
    expect(v.validacao).toBe('RECUSADA')
    expect(v.codigos).toEqual(expect.arrayContaining(['RESOLUCAO_BAIXA', 'ENQUADRAMENTO_VERTICAL']))
  })

  /*
    HEIC de iPhone: o leitor de cabeçalho devolve nulo. Recusar por isso seria
    barrar metade dos celulares por uma limitação nossa.
  */
  test('dimensão desconhecida não vira recusa', () => {
    const v = validarMidia({ papel: 'FRENTE', mime: 'image/heic', bytes: 3_000_000,
                             dimensao: null })
    expect(v.validacao).toBe('ACEITA')
    expect(v.codigos).toEqual([])
  })

  /*
    A Evolution às vezes entrega o arquivo sem dizer o que é. Recusar por
    "tipo errado" quando o cabeçalho prova que é imagem seria recusar por
    falha de quem mandou o metadado, não de quem mandou a foto.
  */
  test('sem o tipo declarado, o cabeçalho decide', () => {
    const v = validarMidia({ papel: 'FRENTE', mime: 'application/octet-stream',
                             bytes: 2_000_000, dimensao: { largura: 2000, altura: 3000 } })
    expect(v.validacao).toBe('ACEITA')

    const w = validarMidia({ papel: 'VIDEO_LATERAL', mime: 'application/octet-stream',
                             bytes: 9_000_000, dimensao: null })
    expect(w.validacao).toBe('ACEITA')
  })

  test('o recado de uma mídia aceita sem ressalva é vazio', () => {
    expect(validarMidia({ ...foto, dimensao: { largura: 3000, altura: 2000 } }).recado).toBe('')
  })
})

describe('lerSexoEIdade', () => {
  test('lê os dois de uma vez, do jeito que a pessoa responde', () => {
    expect(lerSexoEIdade('macho, 4 anos')).toEqual({ sexo: 'Macho', idadeMeses: 48 })
  })

  test('entende como o haras fala, não só "macho" e "fêmea"', () => {
    expect(lerSexoEIdade('é uma égua de 6 anos').sexo).toBe('Fêmea')
    expect(lerSexoEIdade('garanhão').sexo).toBe('Macho')
    expect(lerSexoEIdade('potra').sexo).toBe('Fêmea')
    expect(lerSexoEIdade('potro de 2 anos').sexo).toBe('Macho')
    expect(lerSexoEIdade('castrado').sexo).toBe('Macho')
  })

  test('sem acento também vale — ninguém acentua no WhatsApp', () => {
    expect(lerSexoEIdade('femea, 3 anos')).toEqual({ sexo: 'Fêmea', idadeMeses: 36 })
    expect(lerSexoEIdade('egua').sexo).toBe('Fêmea')
    expect(lerSexoEIdade('garanhao').sexo).toBe('Macho')
  })

  test('mês não vira ano', () => {
    expect(lerSexoEIdade('fêmea, 8 meses').idadeMeses).toBe(8)
    expect(lerSexoEIdade('potro de 10 meses').idadeMeses).toBe(10)
  })

  test('soma anos e meses quando vêm juntos', () => {
    expect(lerSexoEIdade('potra de 2 anos e 3 meses').idadeMeses).toBe(27)
  })

  test('número solto é idade em anos', () => {
    expect(lerSexoEIdade('macho de 4').idadeMeses).toBe(48)
  })

  /*
    A armadilha do número solto: "nasceu em 2022" não é um cavalo de 2022 anos.
    Cavalo não passa de 40 — acima disso, o número é outra coisa.
  */
  test('ano de nascimento não é confundido com idade', () => {
    expect(lerSexoEIdade('macho, nasceu em 2022').idadeMeses).toBeNull()
  })

  test('"e meio" não vira meses', () => {
    expect(lerSexoEIdade('4 anos e meio').idadeMeses).toBe(48)
  })

  test('o que falta volta como nulo, não como chute', () => {
    expect(lerSexoEIdade('não sei')).toEqual({ sexo: null, idadeMeses: null })
    expect(lerSexoEIdade('')).toEqual({ sexo: null, idadeMeses: null })
    expect(lerSexoEIdade('5 anos').sexo).toBeNull()
    expect(lerSexoEIdade('macho').idadeMeses).toBeNull()
  })
})
