/*
 * HARASPRO — o laudo da avaliação morfológica, e a entrega dele.
 *
 * O documento que sai daqui leva a marca do haras e vai parar na mão de quem
 * está decidindo comprar um cavalo. Duas consequências:
 *
 *   O AVISO NÃO É RODAPÉ. Enquanto o protocolo for rascunho, este laudo não
 *   aplica o padrão oficial da ABCCMM — aplica metodologia de observação. Isso
 *   vai numa tarja, na primeira página, antes das notas.
 *
 *   A PROCEDÊNCIA VAI JUNTO. Cada nota guardou de onde veio; o laudo lista
 *   isso. "Com base em quê você disse isso?" tem de ter resposta dentro do
 *   próprio documento.
 *
 * O PDF é desenhado ponto a ponto — não há navegador para quebrar linha. Quem
 * quebra é `quebrarTexto`, e o que ela erra some pela margem.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1'
import { limparParaPdf, nota, quebrarTexto } from '../_compartilhado/texto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL')!
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_KEY')!
const SEGREDO = Deno.env.get('RESUMO_SEGREDO') ?? ''

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const BALDE = 'morfologia'

type Dados = Record<string, unknown>

/* A4 em pontos. */
const LARGURA = 595.28
const ALTURA = 841.89
const MARGEM = 48

const TINTA = rgb(0.13, 0.13, 0.15)
const SUAVE = rgb(0.42, 0.42, 0.46)
const LINHA = rgb(0.85, 0.85, 0.88)
const ALERTA = rgb(0.72, 0.38, 0.05)
const FUNDO_ALERTA = rgb(0.99, 0.96, 0.9)

/**
 * A folha e o lápis.
 *
 * Guarda onde parou a escrita e vira a página sozinha. Sem isto, cada bloco do
 * laudo teria de calcular se ainda cabe — e o primeiro que esquecesse
 * escreveria por cima do rodapé.
 */
class Folha {
  doc: PDFDocument
  pagina: ReturnType<PDFDocument['addPage']>
  y = 0
  paginas = 0
  // deno-lint-ignore no-explicit-any
  constructor(doc: PDFDocument, public normal: any, public forte: any, public rodape: string) {
    this.doc = doc
    this.pagina = this.novaPagina()
  }

  novaPagina() {
    this.pagina = this.doc.addPage([LARGURA, ALTURA])
    this.paginas += 1
    this.y = ALTURA - MARGEM
    this.pagina.drawText(limparParaPdf(`${this.rodape}  ·  página ${this.paginas}`), {
      x: MARGEM,
      y: 26,
      size: 7.5,
      font: this.normal,
      color: SUAVE,
    })
    return this.pagina
  }

  /** Garante espaço; vira a página se não couber. */
  espaco(altura: number) {
    if (this.y - altura < MARGEM + 20) this.novaPagina()
  }

  texto(t: string, opcoes: { tamanho?: number; forte?: boolean; cor?: typeof TINTA; recuo?: number } = {}) {
    const tamanho = opcoes.tamanho ?? 9.5
    const fonte = opcoes.forte ? this.forte : this.normal
    const x = MARGEM + (opcoes.recuo ?? 0)
    const largura = LARGURA - MARGEM * 2 - (opcoes.recuo ?? 0)
    const linhas = quebrarTexto(limparParaPdf(t), largura, (s) =>
      fonte.widthOfTextAtSize(s, tamanho),
    )
    for (const linha of linhas) {
      this.espaco(tamanho + 4)
      if (linha) {
        this.pagina.drawText(linha, {
          x,
          y: this.y - tamanho,
          size: tamanho,
          font: fonte,
          color: opcoes.cor ?? TINTA,
        })
      }
      this.y -= tamanho + 4
    }
  }

  pular(h: number) {
    this.espaco(h)
    this.y -= h
  }

  regua() {
    this.espaco(10)
    this.pagina.drawLine({
      start: { x: MARGEM, y: this.y },
      end: { x: LARGURA - MARGEM, y: this.y },
      thickness: 0.7,
      color: LINHA,
    })
    this.y -= 10
  }
}

function montarPdf(laudo: Dados): Promise<Uint8Array> {
  return (async () => {
    const doc = await PDFDocument.create()
    const normal = await doc.embedFont(StandardFonts.Helvetica)
    const forte = await doc.embedFont(StandardFonts.HelveticaBold)

    const protocolo = (laudo.protocolo ?? {}) as Dados
    const animal = (laudo.animal ?? {}) as Dados
    const regioes = (laudo.regioes ?? []) as Dados[]
    const procedencia = (laudo.procedencia ?? []) as Dados[]

    const f = new Folha(
      doc,
      normal,
      forte,
      `${laudo.haras ?? 'Haras'} · protocolo ${protocolo.versao ?? '?'} (${protocolo.situacao ?? '?'})`,
    )

    // ------------------------------------------------------------- cabeçalho
    f.texto(String(laudo.haras ?? ''), { tamanho: 10, cor: SUAVE })
    f.texto('Avaliação morfológica', { tamanho: 20, forte: true })
    f.pular(4)

    const idade = animal.idade_meses != null ? `${animal.idade_meses} meses` : 'idade não informada'
    f.texto(`${animal.nome ?? 'Sem nome'} · ${animal.sexo ?? '—'} · ${idade}`, {
      tamanho: 12,
      forte: true,
    })
    f.texto(
      `${animal.raca ?? ''}${animal.tipo === 'ANIMAL_EXTERNO' ? ' · animal de fora do plantel' : ''}`,
      { tamanho: 9, cor: SUAVE },
    )
    f.pular(6)
    f.regua()

    // ------------------------------------------------------------ o aviso
    if (laudo.aviso) {
      const texto = limparParaPdf(String(laudo.aviso))
      const linhas = quebrarTexto(texto, LARGURA - MARGEM * 2 - 24, (s) =>
        normal.widthOfTextAtSize(s, 9),
      )
      const alturaCaixa = linhas.length * 13 + 20
      f.espaco(alturaCaixa + 10)
      f.pagina.drawRectangle({
        x: MARGEM,
        y: f.y - alturaCaixa,
        width: LARGURA - MARGEM * 2,
        height: alturaCaixa,
        color: FUNDO_ALERTA,
        borderColor: ALERTA,
        borderWidth: 0.8,
      })
      let yy = f.y - 16
      for (const linha of linhas) {
        f.pagina.drawText(linha, { x: MARGEM + 12, y: yy, size: 9, font: normal, color: ALERTA })
        yy -= 13
      }
      f.y -= alturaCaixa + 12
    }

    // ------------------------------------------------------------ o número
    f.texto('Resultado', { tamanho: 13, forte: true })
    f.pular(2)
    f.texto(
      `Nota geral ${nota(laudo.nota_geral as number)}  ·  confiança ${nota(laudo.confianca as number)}` +
        `  ·  material entregue ${laudo.qualidade_material ?? '—'}%`,
      { tamanho: 11, forte: true },
    )
    if (laudo.potencial) {
      f.pular(2)
      f.texto(String(laudo.potencial), { tamanho: 9, cor: SUAVE })
    }
    f.pular(6)
    f.regua()

    // ------------------------------------------------------------ as regiões
    f.texto('Região por região', { tamanho: 13, forte: true })
    f.pular(4)

    for (const r of regioes) {
      f.espaco(46)
      const marca =
        r.situacao === 'divergente'
          ? '  (as duas leituras discordaram)'
          : r.situacao === 'sem_revisao'
            ? '  (uma leitura só)'
            : ''
      f.texto(
        `${r.titulo ?? r.chave}  —  ${nota(r.nota as number)}` +
          `   confiança ${nota(r.confianca as number)}${marca}`,
        { tamanho: 10.5, forte: true },
      )
      if (r.analise) f.texto(String(r.analise), { tamanho: 9, recuo: 10 })

      /*
        Região cuja prosa o guardrail reteve: no lugar dela vai a explicação.
        Deixar o espaço em branco faria a região parecer mal avaliada, quando o
        que houve foi um parágrafo escrito fora do que este laudo pode afirmar.
      */
      if (r.texto_retido) {
        f.texto(String(r.texto_retido), { tamanho: 8.5, recuo: 10, cor: ALERTA })
      }

      for (const p of (r.pontos_fortes ?? []) as string[]) {
        f.texto(`+ ${p}`, { tamanho: 9, recuo: 10, cor: rgb(0.1, 0.42, 0.22) })
      }
      for (const p of (r.pontos_atencao ?? []) as string[]) {
        f.texto(`! ${p}`, { tamanho: 9, recuo: 10, cor: ALERTA })
      }
      f.pular(8)
    }

    // ------------------------------------------------------- de onde veio
    if (procedencia.length) {
      f.regua()
      f.texto('Com base em quê', { tamanho: 13, forte: true })
      f.texto(
        'As regras abaixo foram as consultadas para pontuar as regiões deste laudo, ' +
          'na ordem de autoridade do protocolo.',
        { tamanho: 8.5, cor: SUAVE },
      )
      f.pular(4)
      for (const p of procedencia) {
        f.texto(`[${p.tipo_fonte}] ${p.afirmacao}${p.autor ? ` — ${p.autor}` : ''}`, {
          tamanho: 8.5,
          recuo: 10,
          cor: SUAVE,
        })
        f.pular(2)
      }
    }

    return await doc.save()
  })()
}

async function gerar(tarefa: Dados) {
  const aval = String(tarefa.avaliacao_id)
  const { data: laudo, error } = await supabase.rpc('morfologia_laudo', { p_aval: aval })
  if (error) throw new Error(`não consegui montar o laudo: ${error.message}`)

  const pdf = await montarPdf(laudo as Dados)
  const animal = ((laudo as Dados).animal ?? {}) as Dados
  const nomeArquivo = `avaliacao-${String(animal.nome ?? 'animal')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()}.pdf`
  const caminho = `${tarefa.haras_id}/${aval}/${nomeArquivo}`

  /*
    Cópia para um buffer próprio antes de enviar.

    O que `pdf-lib` devolve é um `Uint8Array` sobre um buffer genérico, e o
    `fetch` do Deno só aceita uma visão sobre `ArrayBuffer` concreto. Em tempo
    de execução os dois funcionam; a cópia é o que faz a conferência de tipos
    passar sem um `as` escondendo a diferença.
  */
  const corpo = new Blob([new Uint8Array(pdf)], { type: 'application/pdf' })

  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BALDE}/${caminho}`, {
    method: 'POST',
    headers: {
      /* `apikey` junto do `Authorization`: o Storage recusa a chave de serviço
         no formato novo se ela vier só como portador. */
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: corpo,
  })
  if (!r.ok) throw new Error(`não consegui guardar o laudo: ${r.status} ${await r.text()}`)

  await supabase.rpc('morfologia_registrar_relatorio', {
    p_avaliacao: aval,
    p_caminho: caminho,
    p_arquivo: nomeArquivo,
    p_bytes: pdf.length,
  })

  return { caminho, bytes: pdf.length, paginas: undefined }
}

async function entregar(tarefa: Dados) {
  const aval = String(tarefa.avaliacao_id)
  const { data: laudo, error } = await supabase.rpc('morfologia_laudo', { p_aval: aval })
  if (error) throw new Error(`não consegui ler o laudo: ${error.message}`)

  const l = laudo as Dados
  const arquivo = (l.arquivo ?? {}) as Dados
  if (!arquivo.caminho) throw new Error('não há arquivo de laudo para entregar')

  const { data: destino, error: erroDestino } = await supabase.rpc('morfologia_destino_do_laudo', {
    p_aval: aval,
  })
  if (erroDestino) throw new Error(`não sei para quem mandar: ${erroDestino.message}`)
  const d = (destino ?? {}) as Dados
  if (!d.telefone || !d.instancia) throw new Error('avaliação sem telefone ou instância')

  /* URL assinada com validade longa: o dono pode abrir o laudo dias depois, do
     próprio WhatsApp. */
  const assinada = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BALDE}/${arquivo.caminho}`,
    {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 30 }),
    },
  )
  if (!assinada.ok) throw new Error(`não consegui assinar o laudo: ${assinada.status}`)
  const { signedURL } = (await assinada.json()) as { signedURL: string }
  const url = `${SUPABASE_URL}/storage/v1${signedURL}`

  const animal = (l.animal ?? {}) as Dados
  const legenda = [
    `📋 *Avaliação de ${animal.nome ?? 'seu animal'}*`,
    '',
    `Nota geral *${nota(l.nota_geral as number)}* · confiança ${nota(l.confianca as number)}`,
    l.potencial ? `\n${l.potencial}` : '',
    l.aviso ? `\n_${l.aviso}_` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const envio = await fetch(`${EVOLUTION_URL}/message/sendMedia/${d.instancia}`, {
    method: 'POST',
    headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: d.telefone,
      mediatype: 'document',
      mimetype: 'application/pdf',
      media: url,
      fileName: arquivo.arquivo,
      caption: legenda,
    }),
  })
  if (!envio.ok) throw new Error(`a Evolution recusou: ${envio.status} ${await envio.text()}`)

  await supabase.rpc('morfologia_encerrar', { p_aval: aval })
  return { enviado_para: d.telefone, arquivo: arquivo.arquivo }
}

function responder(status: number, corpo: Dados) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  if (!SEGREDO || req.headers.get('x-segredo') !== SEGREDO) {
    return responder(401, { erro: 'segredo inválido' })
  }

  const feito: Dados[] = []

  for (const tipo of ['GERAR_RELATORIO', 'ENVIAR_WHATSAPP']) {
    const { data: tarefa } = await supabase.rpc('morfologia_tarefa_pegar', { p_tipo: tipo })
    const t = (tarefa ?? {}) as Dados
    if (!t.tarefa_id) continue

    try {
      const r = tipo === 'GERAR_RELATORIO' ? await gerar(t) : await entregar(t)
      await supabase.rpc('morfologia_tarefa_concluir', { p_id: t.tarefa_id, p_ok: true })
      feito.push({ tipo, tarefa_id: t.tarefa_id, ok: true, ...r })
    } catch (e) {
      const erro = String((e as Error)?.message ?? e)
      await supabase.rpc('morfologia_tarefa_concluir', {
        p_id: t.tarefa_id,
        p_ok: false,
        p_erro: erro,
      })
      console.error(`${tipo} ${t.tarefa_id} falhou:`, e)
      feito.push({ tipo, tarefa_id: t.tarefa_id, ok: false, erro })
    }
  }

  return responder(200, { ok: true, feito })
})
