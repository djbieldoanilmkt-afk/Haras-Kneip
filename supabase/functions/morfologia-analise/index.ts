/*
 * HARASPRO — a leitura das imagens da avaliação morfológica.
 *
 * DUAS PASSADAS, COM OLHARES DIFERENTES
 *
 * A primeira descreve e pontua o que as imagens mostram. A segunda é a de um
 * jurado crítico: o trabalho dela é achar o que uma leitura descritiva deixa
 * passar. Repetir a MESMA pergunta duas vezes ao mesmo modelo, a temperatura
 * zero, devolveria quase a mesma resposta — e pagaríamos duas vezes por uma
 * opinião só. A segunda leitura não vê a primeira, senão ancoraria nela.
 *
 * Quem junta as duas é o BANCO, não este arquivo: `morfologia_reconciliar`
 * decide o que fazer quando elas discordam, e a nota geral sai de lá. Aqui só
 * se lê imagem.
 *
 * TRÊS CHAMADAS POR PASSADA
 *
 * Uma por vista — o animal de lado, a cabeça, os membros. Um jurado olha o
 * perfil e lê pescoço, tronco, dorso e garupa de uma vez; pedir isso região por
 * região reenviaria as mesmas fotos doze vezes.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { lerNotasDoModelo } from '../_compartilhado/analise.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENROUTER_KEY = Deno.env.get('OPENROUTER_KEY')!
const SEGREDO = Deno.env.get('RESUMO_SEGREDO') ?? ''
const MODELO = Deno.env.get('OPENROUTER_MODELO_VISAO') ?? 'google/gemini-2.5-flash'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const BALDE = 'morfologia'

/* Teto de imagens por chamada. O grupo do conjunto pode juntar duas fotos e
   dez quadros do vídeo de 360; acima disso o custo sobe sem a leitura melhorar. */
const IMAGENS_MAX = 12

/* Validade da URL assinada: o suficiente para a chamada acontecer, e nada mais.
   Link de foto de avaliação é material privado. */
const VALIDADE_SEG = 600

type Dados = Record<string, unknown>

/** URLs temporárias para as imagens que vão na chamada. */
async function assinar(caminhos: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (caminhos.length === 0) return mapa

  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BALDE}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: VALIDADE_SEG, paths: caminhos }),
  })
  if (!r.ok) throw new Error(`não consegui assinar as imagens: ${r.status} ${await r.text()}`)

  for (const item of (await r.json()) as { path?: string; signedURL?: string }[]) {
    if (item.path && item.signedURL) {
      mapa.set(item.path, `${SUPABASE_URL}/storage/v1${item.signedURL}`)
    }
  }
  return mapa
}

function instrucoes(pauta: Dados, etapa: string): string {
  const protocolo = (pauta.protocolo ?? {}) as Dados
  const animal = (pauta.animal ?? {}) as Dados
  const criterios = (pauta.criterios ?? []) as Dados[]
  const conhecimento = (pauta.conhecimento ?? []) as Dados[]

  const papel =
    etapa === 'revisao'
      ? [
          'Esta é a SEGUNDA leitura deste animal, e ela é independente: você NÃO viu a primeira.',
          'Seu trabalho é o do jurado crítico. Procure o que uma leitura descritiva deixa',
          'passar — defeito encoberto pelo ângulo, aprumo que só aparece no movimento,',
          'desproporção que o enquadramento favorece.',
          'Mas não seja severo por esporte: região boa recebe nota boa.',
        ].join('\n')
      : [
          'Esta é a primeira leitura. Descreva e pontue o que as imagens mostram,',
          'região por região, sem adivinhar o que está fora do quadro.',
        ].join('\n')

  return [
    'Você avalia a morfologia de um cavalo Mangalarga Marchador a partir de imagens.',
    '',
    papel,
    '',
    protocolo.aviso ? `ATENÇÃO: ${protocolo.aviso}` : '',
    animal.jovem ? `ANIMAL JOVEM (${animal.idade_meses} meses): ${animal.aviso_jovem ?? ''}` : '',
    '',
    'REGRAS',
    '1. Avalie SOMENTE as regiões listadas abaixo, usando a chave EXATA de cada uma.',
    '2. `nota` de 0 a 10, uma casa decimal. `confianca` de 0 a 10: o quanto você confia',
    '   no que conseguiu ver — não o quanto gostou do animal.',
    '3. Se as imagens não mostram a região, diga isso em `pontos_atencao` e baixe a',
    '   confiança. NUNCA preencha o que não deu para ver.',
    '4. NUNCA afirme regra racial ("o padrão da raça exige..."). Descreva o que vê e',
    '   julgue a conformação.',
    '5. Toda nota precisa de evidência: qual imagem e o que nela sustenta a nota.',
    '',
    'REGIÕES A AVALIAR',
    ...criterios.map((c) => `- ${c.chave}: ${c.titulo} — ${c.descricao}`),
    '',
    conhecimento.length > 0
      ? [
          'CONHECIMENTO APLICÁVEL (em ordem de autoridade: o de cima manda no de baixo)',
          ...conhecimento.map(
            (k) => `- [${k.tipo_fonte}] ${k.afirmacao}${k.autor ? ` (${k.autor})` : ''}`,
          ),
        ].join('\n')
      : 'Não há regra cadastrada para estas regiões: julgue apenas conformação visível.',
    '',
    'Responda SÓ com JSON, sem texto em volta:',
    '{"notas":[{"criterio":"","nota":0,"confianca":0,"pontos_fortes":[],' +
      '"pontos_atencao":[],"analise":"","evidencias":[{"imagem":"","observacao":""}]}]}',
  ]
    .filter((l) => l !== '')
    .join('\n')
}

/** Uma chamada de visão para um grupo. Devolve as notas e o que custou. */
async function analisarGrupo(pauta: Dados, etapa: string) {
  const imagens = ((pauta.imagens ?? []) as Dados[]).slice(0, IMAGENS_MAX)
  if (imagens.length === 0) {
    throw new Error(`o grupo ${pauta.grupo} não tem nenhuma imagem`)
  }

  const assinadas = await assinar(imagens.map((i) => String(i.caminho)))

  const conteudo: Dados[] = [
    {
      type: 'text',
      text: imagens
        .map(
          (i, n) =>
            `Imagem ${n + 1}: ${i.rotulo}${i.segundo != null ? ` (quadro aos ${i.segundo}s)` : ''}`,
        )
        .join('\n'),
    },
  ]
  for (const i of imagens) {
    const url = assinadas.get(String(i.caminho))
    if (url) conteudo.push({ type: 'image_url', image_url: { url } })
  }

  const t0 = Date.now()
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELO,
      messages: [
        { role: 'system', content: instrucoes(pauta, etapa) },
        { role: 'user', content: conteudo },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      /* O custo real do provedor, para não gravar estimativa quando dá para
         gravar o número. */
      usage: { include: true },
    }),
  })

  const duracao = Date.now() - t0
  if (!r.ok) throw new Error(`modelo respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`)

  const d = (await r.json()) as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
  }

  const permitidos = ((pauta.criterios ?? []) as Dados[]).map((c) => String(c.chave))
  const leitura = lerNotasDoModelo(d.choices?.[0]?.message?.content ?? '', permitidos)

  return {
    leitura,
    uso: {
      tokens_entrada: d.usage?.prompt_tokens ?? null,
      tokens_saida: d.usage?.completion_tokens ?? null,
      custo: d.usage?.cost ?? null,
      duracao,
    },
  }
}

/** Processa uma tarefa de análise inteira: os três grupos. */
async function analisar(tarefa: Dados, etapa: string) {
  const aval = String(tarefa.avaliacao_id)

  /*
    O que já tem nota nesta etapa não é refeito.

    Uma tarefa que falhou no terceiro grupo volta para a fila; sem isto, a
    repetição pagaria de novo pelos dois grupos que deram certo.
  */
  const { data: jaFeitas } = await supabase
    .from('morfologia_notas')
    .select('criterio')
    .eq('avaliacao_id', aval)
    .eq('etapa', etapa)
  const feitos = new Set(((jaFeitas ?? []) as Dados[]).map((n) => String(n.criterio)))

  const { data: grupos, error: erroGrupos } = await supabase.rpc('morfologia_grupos_de_analise')
  if (erroGrupos) throw new Error(`não consegui ler os grupos: ${erroGrupos.message}`)

  const relatorio: Dados[] = []
  const problemas: string[] = []

  for (const g of (grupos ?? []) as Dados[]) {
    const criterios = (g.criterios ?? []) as string[]
    if (criterios.every((c) => feitos.has(c))) {
      relatorio.push({ grupo: g.grupo, pulado: 'já tinha nota' })
      continue
    }

    const { data: pauta, error } = await supabase.rpc('morfologia_pauta', {
      p_aval: aval,
      p_grupo: g.grupo,
    })
    if (error) throw new Error(`pauta do grupo ${g.grupo}: ${error.message}`)

    try {
      const { leitura, uso } = await analisarGrupo(pauta as Dados, etapa)
      const conhecimento = ((pauta as Dados).conhecimento ?? []) as Dados[]

      for (const n of leitura.notas) {
        /*
          Cada nota guarda só a procedência que valia para AQUELA região.

          Gravar a base do grupo inteiro faria a nota de aparência geral citar
          regras sobre aprumo — e a pergunta "com base em quê você disse isso?"
          teria como resposta uma lista onde a maior parte não tem nada a ver.
        */
        const fontes = conhecimento
          .filter((k) => ((k.criterios ?? []) as string[]).includes(n.criterio))
          .map((k) => String(k.conhecimento_id))

        const { error: erroNota } = await supabase.rpc('morfologia_registrar_nota', {
          p_avaliacao: aval,
          p_criterio: n.criterio,
          p_etapa: etapa,
          p_nota: n.nota,
          p_confianca: n.confianca,
          p_pontos_fortes: n.pontos_fortes,
          p_pontos_atencao: n.pontos_atencao,
          p_analise: n.analise,
          p_evidencias: n.evidencias,
          p_conhecimento_ids: fontes,
        })
        if (erroNota) problemas.push(`${n.criterio}: ${erroNota.message}`)
      }

      await supabase.rpc('morfologia_registrar_uso', {
        p_avaliacao: aval,
        p_etapa: `analise_${etapa}_${g.grupo}`,
        p_modelo: MODELO,
        p_tokens_entrada: uso.tokens_entrada,
        p_tokens_saida: uso.tokens_saida,
        p_custo_usd: uso.custo,
        p_duracao_ms: uso.duracao,
      })

      /*
        Região que o modelo não devolveu fica sem nota, e isso precisa aparecer.
        Silêncio aqui viraria uma nota geral tirada de menos regiões do que o
        laudo diz.
      */
      const faltando = criterios.filter(
        (c) => !leitura.notas.some((n) => n.criterio === c) && !feitos.has(c),
      )
      if (faltando.length) problemas.push(`sem nota: ${faltando.join(', ')}`)
      problemas.push(...leitura.ignorados)

      relatorio.push({ grupo: g.grupo, notas: leitura.notas.length, faltando, custo: uso.custo })
    } catch (e) {
      problemas.push(`grupo ${g.grupo}: ${String((e as Error)?.message ?? e)}`)
      relatorio.push({ grupo: g.grupo, erro: String((e as Error)?.message ?? e) })
    }
  }

  /*
    Nenhuma região pode terminar sem nota.

    Sem esta conferência, um modelo que devolvesse uma resposta vazia — ou que
    se recusasse a avaliar — fecharia a etapa com sucesso, e o laudo sairia
    tirando a nota geral de menos regiões do que diz avaliar. Falhar aqui manda
    a tarefa de volta à fila, e as três tentativas acabam com o motivo escrito.
  */
  const { data: agora } = await supabase
    .from('morfologia_notas')
    .select('criterio')
    .eq('avaliacao_id', aval)
    .eq('etapa', etapa)
  const comNota = new Set(((agora ?? []) as Dados[]).map((n) => String(n.criterio)))

  const esperados = ((grupos ?? []) as Dados[]).flatMap((g) => (g.criterios ?? []) as string[])
  const semNota = esperados.filter((c) => !comNota.has(c))

  return { relatorio, problemas, semNota }
}

function responder(status: number, corpo: Dados) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  if (req.headers.get('x-segredo') !== SEGREDO || !SEGREDO) {
    return responder(401, { erro: 'segredo inválido' })
  }

  const feito: Dados[] = []

  /* Uma tarefa por chamada. Análise é lenta; segurar a requisição por três
     avaliações faria a Edge Function ser cortada no meio. */
  for (const tipo of ['ANALISE_PRIMARIA', 'ANALISE_REVISAO']) {
    const { data: tarefa } = await supabase.rpc('morfologia_tarefa_pegar', { p_tipo: tipo })
    const t = (tarefa ?? {}) as Dados
    if (!t.tarefa_id) continue

    const etapa = tipo === 'ANALISE_PRIMARIA' ? 'primaria' : 'revisao'
    try {
      const { relatorio, problemas, semNota } = await analisar(t, etapa)

      /*
        Reprova se um grupo estourou OU se sobrou região sem nota. A tarefa
        volta para a fila e completa o que faltou, sem refazer o que deu certo.
        Concluir com uma região em branco entregaria um laudo incompleto como
        se fosse inteiro.
      */
      const grave = relatorio.some((g) => g.erro) || semNota.length > 0
      const motivo = [
        ...problemas,
        ...(semNota.length ? [`ficaram sem nota: ${semNota.join(', ')}`] : []),
      ].join(' | ')

      await supabase.rpc('morfologia_tarefa_concluir', {
        p_id: t.tarefa_id,
        p_ok: !grave,
        p_erro: grave ? motivo : null,
      })

      feito.push({ tipo, tarefa_id: t.tarefa_id, ok: !grave, relatorio, problemas, semNota })
    } catch (e) {
      const erro = String((e as Error)?.message ?? e)
      await supabase.rpc('morfologia_tarefa_concluir', {
        p_id: t.tarefa_id,
        p_ok: false,
        p_erro: erro,
      })
      console.error(`tarefa ${t.tarefa_id} falhou:`, e)
      feito.push({ tipo, tarefa_id: t.tarefa_id, ok: false, erro })
    }
    break
  }

  return responder(200, { ok: true, feito })
})
