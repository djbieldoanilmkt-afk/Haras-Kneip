import { createClient } from 'npm:@supabase/supabase-js@2'

/**
 * Assistente do haras no WhatsApp.
 *
 * Roda SEM verificação de JWT — a Evolution não emite token do Supabase. A
 * porta é fechada por um segredo no fim da URL, que é o único mecanismo que
 * ela consegue carregar (não assina o corpo do webhook).
 *
 * Duas portas de entrada, de propósito:
 *
 *   ROTEIRO — quem diz só "quero cadastrar um animal" recebe um formulário
 *   numerado e responde na ordem. Saber a ordem elimina a maior fonte de erro
 *   na leitura de um áudio corrido.
 *
 *   SOLTO — quem já sabe o que quer manda tudo de uma vez e só é cobrado pelo
 *   que faltou. Obrigar todo mundo a passar pelo roteiro puniria quem tem
 *   prática.
 *
 * O modelo NUNCA escreve SQL nem escolhe tabela: ele preenche um formulário de
 * um cardápio fixo. Quem grava são as funções `agente_*` do banco, que conferem
 * papel e haras como o RLS conferiria.
 *
 * Tudo num arquivo só porque a API de deploy que uso aceita um único corpo.
 */

const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL')!
const EVOLUTION_KEY = Deno.env.get('EVOLUTION_KEY')!
const WEBHOOK_SEGREDO = Deno.env.get('WEBHOOK_SEGREDO')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENROUTER_KEY = Deno.env.get('OPENROUTER_KEY')!
const MODELO = Deno.env.get('OPENROUTER_MODELO') ?? 'google/gemini-2.5-flash'
const MODELO_AUDIO = Deno.env.get('OPENROUTER_MODELO_AUDIO') ?? 'openai/whisper-large-v3-turbo'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const PIN = /\b(\d{6})\b/

/**
 * Quebra de linha como constante.
 *
 * As mensagens são montadas com array + join. O separador vive aqui porque
 * editar este arquivo por script já transformou o "\n" de dentro de uma string
 * em quebra de linha DE VERDADE duas vezes, e as duas derrubaram o boot com
 * erro de sintaxe. Referenciar uma constante não tem como quebrar assim.
 */
const NL = '\n'

// ============================================================ vocabulário

type Dados = Record<string, unknown>

/** Campos sem os quais não dá para gravar. O resto entra depois, pela tela. */
const OBRIGATORIOS: Record<string, string[]> = {
  cadastrar_animal: ['nome', 'sexo'],
  lancar_sanidade: ['animal_id', 'tipo'],
  lancar_despesa: ['categoria', 'descricao', 'valor'],
  lancar_pesagem: ['animal_id', 'peso'],
  lancar_reproducao: ['animal_id', 'tipo'],
  // Aqui basta UM dos dois; a regra "pelo menos um" é conferida no fluxo.
  definir_pais: ['animal_id'],
}

const PERGUNTA: Record<string, string> = {
  nome: 'o *nome* do animal',
  sexo: 'se é *macho ou fêmea*',
  animal_id: 'de *qual animal* se trata',
  tipo: 'o *tipo*',
  categoria: 'a *categoria* do gasto',
  descricao: 'uma *descrição curta*',
  valor: 'o *valor* em reais',
  peso: 'o *peso* em quilos',
}

/** Formulário numerado. Saber a ordem torna o áudio corrido legível. */
const ROTEIRO: Record<string, string> = {
  cadastrar_animal: [
    '📋 *Cadastro de animal*',
    '',
    'Me responda numa mensagem ou num áudio só, nesta ordem:',
    '',
    '1️⃣ Nome',
    '2️⃣ Macho ou fêmea',
    '3️⃣ Pelagem',
    '4️⃣ Data de nascimento',
    '5️⃣ Registro ABCCMM (ou "sem registro")',
    '6️⃣ Piquete ou baia',
    '',
    '_Ex.: "Fumaça do Kneip, fêmea, tordilha, 3 de agosto de 2026, sem registro, piquete 2"_',
    '',
    'Só o *nome* e o *sexo* são obrigatórios. E pode mandar a foto depois que eu anexo.',
  ].join('\n'),

  lancar_reproducao: [
    '📋 *Evento reprodutivo*',
    '',
    '1️⃣ Qual égua',
    '2️⃣ O que aconteceu (cobertura, diagnóstico, parto, desmame, cio, aborto)',
    '3️⃣ Quando',
    '4️⃣ Garanhão (se foi cobertura)',
    '5️⃣ Método (monta natural, inseminação, transferência de embrião)',
    '',
    '_Ex.: "Aurora, cobertura, ontem, Imperador do Vale, monta natural"_',
    '',
    'Se for cobertura, eu já calculo o parto previsto.',
  ].join('\n'),

  lancar_sanidade: [
    '📋 *Registro de sanidade*',
    '',
    '1️⃣ Qual animal',
    '2️⃣ O que foi feito (vacinação, vermifugação, exame, ferração...)',
    '3️⃣ Detalhe (qual vacina, qual exame)',
    '4️⃣ Quando',
    '5️⃣ Quando repete',
    '6️⃣ Custo',
    '',
    '_Ex.: "Estrela, vacinação, influenza e tétano, hoje, repete em 6 meses, 180 reais"_',
  ].join('\n'),

  lancar_despesa: [
    '📋 *Lançamento de despesa*',
    '',
    '1️⃣ Categoria (ração, ferrageamento, veterinário, mão de obra...)',
    '2️⃣ O que foi',
    '3️⃣ Valor',
    '4️⃣ Quando',
    '5️⃣ Fornecedor',
    '6️⃣ Dividir entre quais animais (ou "não dividir")',
    '',
    '_Ex.: "Ração, ração do mês, 1200 reais, hoje, Agro Central, divide entre todos"_',
  ].join('\n'),

  lancar_pesagem: [
    '📋 *Pesagem*',
    '',
    '1️⃣ Qual animal',
    '2️⃣ Quantos quilos',
    '3️⃣ Quando',
    '',
    '_Ex.: "Brisa Suave, 420 quilos, hoje"_',
  ].join('\n'),
}

const AJUDA = [
  '🐴 *Assistente do haras*',
  '',
  '*Para registrar*, é só falar:',
  '• _"Vacinei a Estrela contra influenza hoje"_',
  '• _"A Brisa pesou 420 quilos"_',
  '• _"Cobri a Aurora com o Imperador ontem"_',
  '• _"Cadastra uma potra nova"_ (eu mando o formulário)',
  '',
  '*Para perguntar:*',
  '• _"Quais éguas estão prenhas?"_',
  '• _"O que vence nos próximos 30 dias?"_',
  '• _"Quanto gastei com vacina na Aurora?"_',
  '',
  '📸 Mande a *foto* de um animal que eu anexo à ficha dele.',
  '',
  'Antes de gravar eu sempre confirmo. Responda *sim* ou *não*.',
].join('\n')

// ============================================================ Evolution

async function enviar(instancia: string, numero: string, texto: string) {
  await fetch(`${EVOLUTION_URL}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: numero, text: texto }),
  }).catch(() => {
    // Falha ao responder não pode derrubar o webhook: a Evolution reenviaria o
    // mesmo evento e o efeito no banco aconteceria duas vezes.
  })
}

/**
 * Baixa a mídia pela própria Evolution.
 *
 * Pedimos por aqui em vez de confiar no base64 embutido no webhook: a
 * instância pode estar sem `base64` ligado, e nesse caso o payload chega sem a
 * mídia e o áudio sumiria em silêncio.
 */
async function baixarMidia(instancia: string, chave: Dados): Promise<{ base64: string; mime: string } | null> {
  try {
    const r = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instancia}`, {
      method: 'POST',
      headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { key: chave }, convertToMp4: false }),
    })
    const d = (await r.json()) as { base64?: string; mimetype?: string }
    if (!d.base64) return null
    return { base64: d.base64, mime: d.mimetype ?? 'application/octet-stream' }
  } catch {
    return null
  }
}

// ============================================================ OpenRouter

async function transcrever(base64: string, mime: string): Promise<string> {
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const form = new FormData()
  form.append('file', new Blob([bin], { type: mime }), 'audio.ogg')
  form.append('model', MODELO_AUDIO)
  // O modelo acerta muito mais sabendo o idioma de antemão.
  form.append('language', 'pt')

  const r = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
    body: form,
  })
  const d = (await r.json()) as { text?: string }
  return (d.text ?? '').trim()
}

function instrucoes(plantel: { id: string; nome: string }[], veFinanceiro: boolean): string {
  return [
    'Você é o assistente de um haras de Mangalarga Marchador, no Brasil.',
    'Lê mensagens de voz transcritas e texto informal de quem trabalha no campo.',
    `Hoje é ${new Date().toISOString().slice(0, 10)}.`,
    '',
    'Sua ÚNICA saída é um JSON { "acao", "dados", "observacao" }.',
    '',
    'Ações:',
    '- cadastrar_animal: nome, sexo, pelagem, data_nascimento, tipo_marcha, registro_abccmm, baia_piquete',
    '- lancar_sanidade: animal_id, tipo, descricao, data, proxima_data, custo, veterinario',
    '- lancar_pesagem: animal_id, peso, data, observacoes',
    '- lancar_reproducao: animal_id, tipo, data, garanhao, metodo, data_prevista_parto',
    '- definir_pais: animal_id, pai (NOME do pai), mae (NOME da mãe)',
    veFinanceiro
      ? '- lancar_despesa: categoria, descricao, valor, data, fornecedor, animais (lista de ids)'
      : '- (esta pessoa NÃO tem acesso ao financeiro; nunca use lancar_despesa)',
    '- consultar_custos: animal_id, desde, ate, termo',
    '- consultar_animais: status, local, termo',
    '- consultar_agenda: dias',
    '- confirmar: a pessoa concorda (sim, isso, pode lançar)',
    '- cancelar: desiste ou corrige (não, cancela, deixa pra lá)',
    '- ajuda: pergunta o que você faz',
    '- nao_entendi: não dá para saber o que ela quer',
    '',
    'Regras:',
    '1. Só preencha campo que a pessoa disse. NUNCA invente valor, data ou nome.',
    '2. Datas em AAAA-MM-DD; "hoje"/"ontem" viram data real.',
    '3. Valores em número puro: "mil e duzentos" = 1200.',
    '4. animal_id tem de ser um id EXATO da lista. Se o que ela falou não bater',
    '   com nenhum, deixe vazio e diga isso em observacao.',
    '5. Se ela pedir uma ação sem dar dado nenhum, devolva a ação com dados vazios.',
    '6. Em definir_pais, `pai` e `mae` são NOMES em texto, não ids: o ancestral',
    '   pode ser de outro haras e não estar na lista.',
    '',
    'Animais deste haras:',
    plantel.map((a) => `${a.id} = ${a.nome}`).join('\n') || '(nenhum ainda)',
  ].join('\n')
}

type Leitura = { acao: string; dados: Dados; observacao?: string }

async function entender(
  texto: string,
  plantel: { id: string; nome: string }[],
  veFinanceiro: boolean,
  pendente: { acao: string; dados: Dados } | null,
): Promise<Leitura> {
  const mensagens: Dados[] = [{ role: 'system', content: instrucoes(plantel, veFinanceiro) }]

  if (pendente) {
    mensagens.push({
      role: 'system',
      content: [
        `Há um lançamento em andamento: ${pendente.acao}.`,
        `Já entendido: ${JSON.stringify(pendente.dados)}.`,
        'A mensagem a seguir responde ao que faltava, confirma, ou cancela.',
        'Devolva a MESMA ação com os campos novos, ou confirmar/cancelar.',
      ].join('\n'),
    })
  }

  mensagens.push({ role: 'user', content: texto })

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        messages: mensagens,
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    })
    const d = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    const bruto = d.choices?.[0]?.message?.content ?? ''
    // Alguns modelos embrulham em cerca de código mesmo pedindo json_object.
    const limpo = bruto.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const lido = JSON.parse(limpo) as Leitura
    return { acao: lido.acao ?? 'nao_entendi', dados: lido.dados ?? {}, observacao: lido.observacao }
  } catch {
    return { acao: 'nao_entendi', dados: {} }
  }
}

// ============================================================ formatação

const dinheiro = (v: unknown) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const dia = (v: unknown) => {
  const s = String(v ?? '')
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s
}

function faltando(acao: string, dados: Dados): string[] {
  return (OBRIGATORIOS[acao] ?? []).filter((c) => {
    const v = dados[c]
    return v === undefined || v === null || v === ''
  })
}

function nomeDoAnimal(plantel: { id: string; nome: string }[], id: unknown): string {
  return plantel.find((a) => a.id === id)?.nome ?? 'animal'
}

/** O resumo que a pessoa confirma. É a última barreira antes de gravar. */
function resumo(acao: string, d: Dados, plantel: { id: string; nome: string }[]): string {
  const linhas: string[] = []

  if (acao === 'cadastrar_animal') {
    linhas.push('🐴 *Cadastrar animal*', '', `*${d.nome}* — ${d.sexo}`)
    if (d.pelagem) linhas.push(`🎨 ${d.pelagem}`)
    if (d.data_nascimento) linhas.push(`📅 ${dia(d.data_nascimento)}`)
    if (d.registro_abccmm) linhas.push(`📄 ABCCMM ${d.registro_abccmm}`)
    if (d.baia_piquete) linhas.push(`📍 ${d.baia_piquete}`)
  } else if (acao === 'lancar_sanidade') {
    linhas.push('💉 *Sanidade*', '', `${d.tipo} — *${nomeDoAnimal(plantel, d.animal_id)}*`)
    if (d.descricao) linhas.push(`📝 ${d.descricao}`)
    linhas.push(`📅 ${dia(d.data ?? new Date().toISOString())}`)
    if (d.proxima_data) linhas.push(`🔁 Repete em ${dia(d.proxima_data)}`)
    if (d.custo) linhas.push(`💰 ${dinheiro(d.custo)}`)
  } else if (acao === 'lancar_pesagem') {
    linhas.push('⚖️ *Pesagem*', '', `*${nomeDoAnimal(plantel, d.animal_id)}* — ${d.peso} kg`)
    linhas.push(`📅 ${dia(d.data ?? new Date().toISOString())}`)
  } else if (acao === 'lancar_reproducao') {
    linhas.push('💕 *Reprodução*', '', `${d.tipo} — *${nomeDoAnimal(plantel, d.animal_id)}*`)
    if (d.garanhao) linhas.push(`🐎 Garanhão: ${d.garanhao}`)
    if (d.metodo) linhas.push(`🔬 ${d.metodo}`)
    linhas.push(`📅 ${dia(d.data ?? new Date().toISOString())}`)
  } else if (acao === 'lancar_despesa') {
    linhas.push('💰 *Despesa*', '', `${d.categoria} — *${dinheiro(d.valor)}*`)
    linhas.push(`📝 ${d.descricao}`)
    linhas.push(`📅 ${dia(d.data ?? new Date().toISOString())}`)
    if (d.fornecedor) linhas.push(`🏪 ${d.fornecedor}`)
    const animais = (d.animais as string[]) ?? []
    if (animais.length > 0) {
      const cada = Number(d.valor ?? 0) / animais.length
      linhas.push(`🐴 Rateado entre ${animais.length} — ${dinheiro(cada)} cada`)
    }
  }

  if (acao === 'definir_pais') {
    linhas.push('🌳 *Genealogia* — ' + `*${nomeDoAnimal(plantel, d.animal_id)}*`, '')

    /*
      Dizer quem é de fora ANTES de gravar.

      Ancestral que não está no plantel vira um registro externo, criado na
      hora. Quem confirma precisa saber disso — senão descobre depois que o
      sistema "criou um animal" que ele não cadastrou.
    */
    for (const [rotulo, valor] of [['🐎 Pai', d.pai], ['🐴 Mãe', d.mae]] as [string, unknown][]) {
      if (!valor) continue
      const dentro = plantel.some((a) => a.nome.toLowerCase() === String(valor).toLowerCase())
      linhas.push(`${rotulo}: ${valor}${dentro ? '' : ' _(de fora — guardo só para a árvore)_'}`)
    }
  }

  linhas.push('', 'Confirma? Responda *sim* ou *não*.')
  return linhas.join('\n')
}

// ============================================================ execução

/** `seguimento` emenda a próxima pergunta sem a pessoa precisar pedir. */
type Gravacao = { mensagem: string; seguimento?: { acao: string; dados: Dados } }

async function gravar(acao: string, user: string, d: Dados): Promise<Gravacao> {
  const hoje = new Date().toISOString().slice(0, 10)

  if (acao === 'definir_pais') {
    const { error } = await supabase.rpc('agente_definir_pais', {
      p_user: user,
      p_animal: d.animal_id,
      p_pai: d.pai ?? null,
      p_mae: d.mae ?? null,
    })
    if (error) throw new Error(error.message)
    return { mensagem: '🌳 Genealogia registrada.' }
  }

  if (acao === 'cadastrar_animal') {
    const { data: novoId, error } = await supabase.rpc('agente_cadastrar_animal', {
      p_user: user,
      p_nome: d.nome,
      p_sexo: d.sexo,
      p_pelagem: d.pelagem ?? null,
      p_data_nascimento: d.data_nascimento ?? null,
      p_tipo_marcha: d.tipo_marcha ?? null,
      p_registro_abccmm: d.registro_abccmm ?? null,
      p_baia_piquete: d.baia_piquete ?? null,
    })
    if (error) throw new Error(error.message)

    /*
      Emenda a genealogia em vez de esperar a pessoa lembrar.

      É o único momento em que ela tem os pais na cabeça. Perguntar depois, numa
      tela, é o que fez nove animais terminarem com dois registros de árvore.
    */
    return {
      mensagem: [
        `✅ *${d.nome}* cadastrado.`,
        '',
        'Quem são os pais? Pode dizer os dois, só um, ou responder *pular*.',
        '',
        '_Se o garanhão for de outro haras, tudo bem — eu guardo só para a árvore._',
        '',
        '📸 E pode mandar a foto que eu anexo à ficha.',
      ].join(NL),
      seguimento: { acao: 'definir_pais', dados: { animal_id: novoId } },
    }
  }

  if (acao === 'lancar_sanidade') {
    const { error } = await supabase.rpc('agente_lancar_sanidade', {
      p_user: user,
      p_animal: d.animal_id,
      p_tipo: d.tipo,
      p_descricao: d.descricao ?? '',
      p_data: d.data ?? hoje,
      p_proxima_data: d.proxima_data ?? null,
      p_custo: d.custo ?? null,
      p_veterinario: d.veterinario ?? null,
    })
    if (error) throw new Error(error.message)
    return { mensagem: '✅ Registro de sanidade lançado.' }
  }

  if (acao === 'lancar_pesagem') {
    const { error } = await supabase.rpc('agente_lancar_pesagem', {
      p_user: user,
      p_animal: d.animal_id,
      p_peso: d.peso,
      p_data: d.data ?? hoje,
      p_observacoes: d.observacoes ?? null,
    })
    if (error) throw new Error(error.message)
    return { mensagem: '✅ Pesagem registrada.' }
  }

  if (acao === 'lancar_reproducao') {
    const { error } = await supabase.rpc('agente_lancar_reproducao', {
      p_user: user,
      p_animal: d.animal_id,
      p_tipo: d.tipo,
      p_data: d.data ?? hoje,
      p_garanhao: d.garanhao ?? null,
      p_metodo: d.metodo ?? null,
      p_data_prevista_parto: d.data_prevista_parto ?? null,
      p_resultado: d.resultado ?? null,
    })
    if (error) throw new Error(error.message)
    return { mensagem: '✅ Evento reprodutivo lançado.' }
  }

  if (acao === 'lancar_despesa') {
    const { error } = await supabase.rpc('agente_lancar_despesa', {
      p_user: user,
      p_data: d.data ?? hoje,
      p_categoria: d.categoria,
      p_descricao: d.descricao,
      p_valor: d.valor,
      p_fornecedor: d.fornecedor ?? null,
      p_animais: (d.animais as string[]) ?? null,
    })
    if (error) throw new Error(error.message)
    return { mensagem: '✅ Despesa lançada. Já aparece no Financeiro.' }
  }

  throw new Error('Ação desconhecida.')
}

async function consultar(acao: string, user: string, d: Dados): Promise<string> {
  if (acao === 'consultar_custos') {
    const { data, error } = await supabase.rpc('agente_consulta_custos', {
      p_user: user,
      p_animal: d.animal_id ?? null,
      p_desde: d.desde ?? null,
      p_ate: d.ate ?? null,
      p_termo: d.termo ?? null,
    })
    if (error) throw new Error(error.message)
    const linhas = (data ?? []) as Dados[]
    if (linhas.length === 0) return 'Não encontrei nenhum gasto com esse filtro.'

    const total = linhas.reduce((s, l) => s + Number(l.valor ?? 0), 0)
    const corpo = linhas
      .slice(0, 15)
      .map((l) => `• ${dia(l.data)} — ${l.descricao} — *${dinheiro(l.valor)}*`)
    if (linhas.length > 15) corpo.push(`_...e mais ${linhas.length - 15} lançamentos._`)

    return [`💰 *Total: ${dinheiro(total)}* em ${linhas.length} lançamentos`, '', ...corpo].join('\n')
  }

  if (acao === 'consultar_animais') {
    const { data, error } = await supabase.rpc('agente_consulta_animais', {
      p_user: user,
      p_status: d.status ?? null,
      p_local: d.local ?? null,
      p_termo: d.termo ?? null,
    })
    if (error) throw new Error(error.message)
    const linhas = (data ?? []) as Dados[]
    if (linhas.length === 0) return 'Nenhum animal com esse filtro.'

    return [
      `🐴 *${linhas.length} ${linhas.length === 1 ? 'animal' : 'animais'}*`,
      '',
      ...linhas.map((a) =>
        `• *${a.nome}* — ${a.sexo}${a.status ? `, ${a.status}` : ''}${a.local ? ` · ${a.local}` : ''}`,
      ),
    ].join('\n')
  }

  const { data, error } = await supabase.rpc('agente_consulta_agenda', {
    p_user: user,
    p_dias: d.dias ?? 30,
  })
  if (error) throw new Error(error.message)
  const linhas = (data ?? []) as Dados[]
  if (linhas.length === 0) return 'Nada marcado para esse período. 👍'

  return [
    `📅 *${linhas.length} ${linhas.length === 1 ? 'compromisso' : 'compromissos'}*`,
    '',
    ...linhas.map((l) => `• ${dia(l.data)} — *${l.animal}* — ${l.tipo}: ${l.detalhe}`),
  ].join('\n')
}

// ============================================================ foto

async function anexarFoto(
  instancia: string,
  chave: Dados,
  user: string,
  harasId: string,
  animalId: string,
  nome: string,
): Promise<string> {
  const midia = await baixarMidia(instancia, chave)
  if (!midia) return 'Não consegui baixar a foto. Pode mandar de novo?'

  const bin = Uint8Array.from(atob(midia.base64), (c) => c.charCodeAt(0))
  const ext = midia.mime.includes('png') ? 'png' : 'jpg'
  const caminho = `${harasId}/${animalId}-${Date.now()}.${ext}`

  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/fotos-animais/${caminho}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': midia.mime,
      'x-upsert': 'true',
    },
    body: bin,
  })
  if (!r.ok) return 'Não consegui guardar a foto. Tente de novo em instantes.'

  const url = `${SUPABASE_URL}/storage/v1/object/public/fotos-animais/${caminho}`
  const { error } = await supabase.rpc('agente_definir_foto', {
    p_user: user,
    p_animal: animalId,
    p_url: url,
  })
  if (error) return `Não consegui anexar: ${error.message}`

  return `📸 Foto anexada à ficha de *${nome}*.`
}

// ============================================================ boas-vindas

const RECUSA = [
  '❌ Esse código não confere ou já expirou.',
  '',
  'Peça um novo no sistema, em *Configurações → Equipe*, e me mande aqui deste mesmo celular.',
].join('\n')

async function boasVindas(userId: string, harasId: string): Promise<string> {
  const [{ data: haras }, { data: membro }] = await Promise.all([
    supabase.from('haras').select('nome').eq('id', harasId).maybeSingle(),
    supabase.from('membros').select('papel').eq('user_id', userId).maybeSingle(),
  ])

  const nomeHaras = haras?.nome ?? 'seu haras'
  const veFinanceiro = membro?.papel === 'dono' || membro?.papel === 'gerente'

  const lancar = [
    '• _"Vacinei a Estrela contra influenza hoje"_',
    '• _"A Brisa pesou 420 quilos"_',
    '• _"Cobri a Aurora com o Imperador ontem"_',
  ]
  if (veFinanceiro) lancar.unshift('• _"Gastei 1.200 de ração, divide entre os nove"_')

  const perguntar = [
    '• _"Quais éguas estão prenhas?"_',
    '• _"O que vence nos próximos 30 dias?"_',
  ]
  if (veFinanceiro) perguntar.push('• _"Quanto já gastei com vacina na Aurora?"_')

  return [
    `✅ Número confirmado. Bem-vindo ao *HarasPro*, ${nomeHaras}!`,
    '',
    'Sou o assistente do haras. Pode falar comigo por *áudio ou texto*, do jeito que for mais fácil — inclusive com a mão suja, no meio do curral.',
    '',
    '*📝 Para eu registrar:*',
    ...lancar,
    '',
    '*🔎 Para eu consultar:*',
    ...perguntar,
    '',
    '📸 Mande a *foto* de um animal que eu anexo à ficha dele.',
    '',
    '⚠️ *Antes de gravar eu confirmo com você.* Se faltar algum dado, eu pergunto — nunca invento.',
    '',
    'Manda um _"oi"_ quando quiser começar.',
  ].join('\n')
}

// ============================================================ handler

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (url.searchParams.get('s') !== WEBHOOK_SEGREDO) {
    return new Response('não autorizado', { status: 401 })
  }

  const corpo = await req.json().catch(() => null)
  if (!corpo) return new Response('ok')

  const evento = String(corpo.event ?? '').toLowerCase()
  const instancia = String(corpo.instance ?? '')
  const dados = (corpo.data ?? {}) as Dados

  if (evento === 'connection.update') {
    const estado = String(dados.state ?? '')
    if (estado === 'open' || estado === 'close') {
      const { data: harasId } = await supabase.rpc('haras_por_instancia', { p_instancia: instancia })
      if (harasId) {
        const jid = String(dados.wuid ?? '')
        await supabase.rpc('registrar_conexao_whatsapp', {
          p_haras: harasId,
          p_numero: estado === 'open' && jid ? jid.split('@')[0] : null,
        })
      }
    }
    return new Response('ok')
  }

  if (evento !== 'messages.upsert') return new Response('ok')

  const chave = (dados.key ?? {}) as Dados
  const remetente = String(chave.remoteJid ?? '')

  // Eco viraria laço; grupo não identifica pessoa.
  if (chave.fromMe === true) return new Response('ok')
  if (remetente.endsWith('@g.us')) return new Response('ok')

  const numero = remetente.split('@')[0]
  const msg = (dados.message ?? {}) as Dados
  const estendida = msg.extendedTextMessage as Dados | undefined
  const imagem = msg.imageMessage as Dados | undefined
  const audio = msg.audioMessage as Dados | undefined
  let texto = String(msg.conversation ?? estendida?.text ?? imagem?.caption ?? '').trim()

  const { data: membros } = await supabase.rpc('membro_por_telefone', { p_numero: numero })
  const membro = (Array.isArray(membros) ? membros[0] : null) as Dados | null

  // ------------------------------------------------------ confirmação do número
  const candidato = texto.match(PIN)?.[1]
  if (!membro && candidato) {
    const { data: verificado } = await supabase.rpc('verificar_telefone_por_pin', {
      p_numero: numero,
      p_pin: candidato,
    })
    const ok = (Array.isArray(verificado) ? verificado[0] : null) as Dados | null
    await enviar(instancia, numero, ok ? await boasVindas(String(ok.user_id), String(ok.haras_id)) : RECUSA)
    return new Response('ok')
  }

  /*
    Número desconhecido e sem código: silêncio.

    Responder a qualquer um transformaria o número num alvo de spam e
    acumularia sinais de automação — o que faz o WhatsApp banir um número
    não-oficial. Quem foi convidado sabe que precisa mandar o PIN.
  */
  if (!membro) return new Response('ok')

  const user = String(membro.user_id)
  const harasId = String(membro.haras_id)
  const veFinanceiro = membro.papel === 'dono' || membro.papel === 'gerente'

  const { data: plantelBruto } = await supabase.rpc('agente_plantel', { p_user: user })
  const plantel = ((plantelBruto ?? []) as Dados[]).map((a) => ({
    id: String(a.id),
    nome: String(a.nome),
  }))

  const { data: pendenteBruto } = await supabase
    .from('intencoes')
    .select('*')
    .eq('telefone', numero)
    .gt('expira_em', new Date().toISOString())
    .maybeSingle()
  const pendente = pendenteBruto as Dados | null

  const limpar = () => supabase.from('intencoes').delete().eq('telefone', numero)

  // ------------------------------------------------------------------- foto
  if (imagem) {
    /*
      De qual animal é a foto, em ordem de certeza: o que a legenda diz, o que
      está sendo cadastrado agora, ou o último cadastrado nos últimos minutos.
      Sem nenhum dos três, pergunta — anexar no animal errado é pior que
      perguntar.
    */
    let alvo = plantel.find((a) => texto && a.nome.toLowerCase().includes(texto.toLowerCase()))

    if (!alvo && pendente?.dados) {
      const id = (pendente.dados as Dados).animal_id
      if (id) alvo = plantel.find((a) => a.id === id)
    }
    if (!alvo) {
      const { data: ultimo } = await supabase.rpc('agente_ultimo_animal', { p_user: user, p_minutos: 10 })
      const u = (Array.isArray(ultimo) ? ultimo[0] : null) as Dados | null
      if (u) alvo = { id: String(u.id), nome: String(u.nome) }
    }

    const resposta = alvo
      ? await anexarFoto(instancia, chave, user, harasId, alvo.id, alvo.nome)
      : '📸 Recebi a foto! De qual animal é? Responda com o nome dele.'

    await enviar(instancia, numero, resposta)
    return new Response('ok')
  }

  // ------------------------------------------------------------------ áudio
  if (audio && !texto) {
    const midia = await baixarMidia(instancia, chave)
    if (!midia) {
      await enviar(instancia, numero, 'Não consegui ouvir esse áudio. Pode mandar de novo?')
      return new Response('ok')
    }
    texto = await transcrever(midia.base64, midia.mime)
    if (!texto) {
      await enviar(instancia, numero, 'Não consegui entender o áudio. Pode repetir?')
      return new Response('ok')
    }
  }

  if (!texto) return new Response('ok')

  // ---------------------------------------------------------------- cérebro
  const leitura = await entender(
    texto,
    plantel,
    veFinanceiro,
    pendente ? { acao: String(pendente.acao), dados: pendente.dados as Dados } : null,
  )

  if (leitura.acao === 'ajuda') {
    await enviar(instancia, numero, AJUDA)
    return new Response('ok')
  }

  if (leitura.acao === 'cancelar') {
    await limpar()
    await enviar(instancia, numero, 'Beleza, cancelei. Não gravei nada. 👍')
    return new Response('ok')
  }

  if (leitura.acao === 'confirmar') {
    if (!pendente || pendente.estado !== 'aguardando_confirmacao') {
      await enviar(instancia, numero, 'Não tenho nada esperando confirmação. Pode me dizer o que você quer registrar?')
      return new Response('ok')
    }
    try {
      const feito = await gravar(String(pendente.acao), user, pendente.dados as Dados)
      await limpar()

      // Emenda a próxima pergunta já com o contexto pronto, para a resposta
      // curta ("pai Imperador, mãe Estrela") saber a que animal se refere.
      if (feito.seguimento) {
        await supabase.from('intencoes').insert({
          haras_id: harasId,
          user_id: user,
          telefone: numero,
          acao: feito.seguimento.acao,
          dados: feito.seguimento.dados,
          faltando: [],
          estado: 'coletando',
          expira_em: new Date(Date.now() + 30 * 60_000).toISOString(),
        })
      }

      await enviar(instancia, numero, feito.mensagem)
    } catch (e) {
      await limpar()
      await enviar(instancia, numero, `❌ Não consegui gravar: ${e instanceof Error ? e.message : 'erro'}`)
    }
    return new Response('ok')
  }

  if (leitura.acao.startsWith('consultar_')) {
    try {
      await enviar(instancia, numero, await consultar(leitura.acao, user, leitura.dados))
    } catch (e) {
      await enviar(instancia, numero, `❌ Não consegui consultar: ${e instanceof Error ? e.message : 'erro'}`)
    }
    return new Response('ok')
  }

  if (!OBRIGATORIOS[leitura.acao]) {
    const extra = leitura.observacao ? `\n\n_${leitura.observacao}_` : ''
    await enviar(instancia, numero, `Não entendi o que você quer registrar.${extra}\n\nManda *ajuda* que eu explico.`)
    return new Response('ok')
  }

  // Junta o que já sabia com o que acabou de chegar.
  const mesma = pendente && pendente.acao === leitura.acao
  const dadosAtuais: Dados = { ...(mesma ? (pendente.dados as Dados) : {}), ...leitura.dados }

  /*
    Pediu a ação sem dar nada: manda o roteiro numerado.

    É o caminho de quem não sabe o que o sistema precisa. Quem já mandou algum
    dado pula direto para a cobrança do que faltou.
  */
  const vazio = Object.values(dadosAtuais).every((v) => v === undefined || v === null || v === '')
  if (vazio && ROTEIRO[leitura.acao]) {
    await supabase.from('intencoes').upsert(
      {
        haras_id: harasId,
        user_id: user,
        telefone: numero,
        acao: leitura.acao,
        dados: {},
        faltando: OBRIGATORIOS[leitura.acao],
        estado: 'coletando',
        expira_em: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      { onConflict: 'telefone' },
    )
    await enviar(instancia, numero, ROTEIRO[leitura.acao])
    return new Response('ok')
  }

  /*
    Genealogia é o único caso em que nenhum campo é obrigatório sozinho, mas
    algum precisa vir: confirmar sem pai nem mãe gravaria uma linha vazia.
  */
  if (leitura.acao === 'definir_pais' && !dadosAtuais.pai && !dadosAtuais.mae) {
    await supabase.from('intencoes').upsert(
      {
        haras_id: harasId,
        user_id: user,
        telefone: numero,
        acao: 'definir_pais',
        dados: dadosAtuais,
        faltando: ['pai'],
        estado: 'coletando',
        expira_em: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      { onConflict: 'telefone' },
    )
    await enviar(
      instancia,
      numero,
      'Me diga o *nome do pai*, o *da mãe*, ou os dois. Se não souber agora, responda *pular*.',
    )
    return new Response('ok')
  }

  const faltam = faltando(leitura.acao, dadosAtuais)

  await supabase.from('intencoes').upsert(
    {
      haras_id: harasId,
      user_id: user,
      telefone: numero,
      acao: leitura.acao,
      dados: dadosAtuais,
      faltando: faltam,
      estado: faltam.length === 0 ? 'aguardando_confirmacao' : 'coletando',
      expira_em: new Date(Date.now() + 30 * 60_000).toISOString(),
    },
    { onConflict: 'telefone' },
  )

  if (faltam.length > 0) {
    const lista = faltam.map((c) => PERGUNTA[c] ?? c)
    const texto2 =
      lista.length === 1 ? lista[0] : lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1]
    const extra = leitura.observacao ? `\n\n_${leitura.observacao}_` : ''
    await enviar(instancia, numero, `Quase lá! Só faltou me dizer ${texto2}.${extra}`)
    return new Response('ok')
  }

  await enviar(instancia, numero, resumo(leitura.acao, dadosAtuais, plantel))
  return new Response('ok')
})
