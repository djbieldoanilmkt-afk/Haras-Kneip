/**
 * Roteiro do assistente de voz.
 *
 * Porte direto de js/components/voiceAssistant.js:14-169 e :411-414. A lógica
 * de perguntas e de interpretação das respostas é a mesma — só a camada de
 * interface mudou. O que já funciona não foi reescrito.
 */

export type VoiceStep = {
  key: string
  label: string
  question: string
  example: string
  required: boolean
  parse: (text: string) => string
}

export function isSkip(text: string): boolean {
  const lower = text.toLowerCase()
  return ['pular', 'não sei', 'nao sei', 'próximo', 'passar'].some((t) => lower.includes(t))
}

export const STEPS: VoiceStep[] = [
  {
    key: 'nome',
    label: 'Nome completo',
    question: 'Qual é o nome completo do animal?',
    example: "Ex: Estrela D'Alva do Kneip",
    required: true,
    parse: (text) => text.trim(),
  },
  {
    key: 'apelido',
    label: 'Apelido',
    question: 'Ele tem algum apelido?',
    example: 'Ex: Estrelinha, ou fale "pular"',
    required: false,
    parse: (text) => (isSkip(text) ? '' : text.trim()),
  },
  {
    key: 'registro_abccmm',
    label: 'Registro ABCCMM',
    question: 'Qual o número do registro na A B C C M M?',
    example: 'Ex: 001234, ou fale "pular"',
    required: false,
    parse: (text) => (isSkip(text) ? '' : text.trim()),
  },
  {
    key: 'sexo',
    label: 'Sexo',
    question: 'O animal é uma égua ou um garanhão?',
    example: 'Fale "égua" ou "garanhão"',
    required: true,
    parse: (text) => {
      const lower = text.toLowerCase()
      if (
        lower.includes('égua') ||
        lower.includes('egua') ||
        lower.includes('fêmea') ||
        lower.includes('femea')
      ) {
        return 'Fêmea'
      }
      if (
        lower.includes('garanhão') ||
        lower.includes('garanhao') ||
        lower.includes('macho') ||
        lower.includes('cavalo')
      ) {
        return 'Macho'
      }
      return text
    },
  },
  {
    key: 'pelagem',
    label: 'Pelagem',
    question: 'Qual é a pelagem dele? Alazã, baia, castanha, tordilha, zaina, pampa ou outra?',
    example: 'Ex: castanha, tordilha...',
    required: true,
    parse: (text) => {
      const lower = text.toLowerCase()
      if (lower.includes('alaz')) return 'Alazã'
      if (lower.includes('baia') || lower.includes('bayo')) return 'Baia'
      if (lower.includes('castanh')) return 'Castanha'
      if (lower.includes('tordilh')) return 'Tordilha'
      if (lower.includes('zain')) return 'Zaina'
      if (lower.includes('pamp')) return 'Pampa'
      if (lower.includes('rosilh')) return 'Rosilha'
      if (lower.includes('pret')) return 'Preta'
      return text.trim()
    },
  },
  {
    key: 'tipo_marcha',
    label: 'Tipo de marcha',
    question: 'Qual é o tipo de marcha? Marcha batida ou marcha picada?',
    example: 'Fale "batida" ou "picada"',
    required: true,
    parse: (text) => {
      const lower = text.toLowerCase()
      if (lower.includes('picad')) return 'Marcha Picada'
      if (lower.includes('batid')) return 'Marcha Batida'
      return 'Marcha Batida'
    },
  },
  {
    key: 'data_nascimento',
    label: 'Data de nascimento',
    question: 'Qual a data de nascimento aproximada dele?',
    example: 'Ex: 2020, ou fale "pular"',
    required: false,
    parse: (text) => {
      if (isSkip(text)) return ''
      const ano = text.match(/\b(19|20)\d{2}\b/)
      return ano ? `${ano[0]}-01-01` : ''
    },
  },
  {
    key: 'peso',
    label: 'Peso (kg)',
    question: 'Qual é o peso dele em quilos?',
    example: 'Ex: 450 quilos, ou fale "pular"',
    required: false,
    parse: (text) => {
      if (isSkip(text)) return ''
      const numero = text.match(/\d+/)
      return numero ? numero[0] : ''
    },
  },
  {
    key: 'altura',
    label: 'Altura (m)',
    question: 'Qual é a altura dele em metros?',
    example: 'Ex: 1 metro e 52, ou fale "pular"',
    required: false,
    parse: (text) => {
      if (isSkip(text)) return ''
      const numero = text.match(/\d+([.,]\d+)?/)
      if (!numero) return ''
      const valor = numero[0].replace(',', '.')
      // Quando o valor vem em centimetros (ex: "152"), converte para metros.
      return Number(valor) > 10 ? (Number(valor) / 100).toFixed(2) : valor
    },
  },
  {
    key: 'baia_piquete',
    label: 'Baia / piquete',
    question: 'Em qual baia ou piquete ele fica?',
    example: 'Ex: Piquete 2, ou fale "pular"',
    required: false,
    parse: (text) => (isSkip(text) ? '' : text.trim()),
  },
  {
    key: 'status_reprodutivo',
    label: 'Status reprodutivo',
    question: 'Qual o status reprodutivo? Prenha, vazia, lactante ou garanhão ativo?',
    example: 'Ex: prenha, vazia, lactante...',
    required: false,
    parse: (text) => {
      const lower = text.toLowerCase()
      if (lower.includes('prenha') || lower.includes('prenho')) return 'Prenha'
      if (lower.includes('vazia') || lower.includes('vazio')) return 'Vazia'
      if (lower.includes('lactante')) return 'Lactante'
      if (lower.includes('cobertura')) return 'Em Cobertura'
      if (lower.includes('potro') || lower.includes('potra')) return 'Potro/Potra'
      return 'Vazia'
    },
  },
  {
    key: 'status_saude',
    label: 'Status de saúde',
    question: 'Como está a saúde dele? Saudável, em tratamento ou observação?',
    example: 'Ex: saudável, ou fale "pular"',
    required: false,
    parse: (text) => (isSkip(text) ? 'Saudável' : text.trim()),
  },
  {
    key: 'premiacao',
    label: 'Premiações',
    question: 'Ele tem alguma premiação ou título?',
    example: 'Ex: Campeão Nacional 2023, ou fale "pular"',
    required: false,
    parse: (text) => (isSkip(text) ? '' : text.trim()),
  },
]

/** Comandos aceitos em qualquer passo. */
export type ComandoGlobal = 'cancelar' | 'voltar' | null

export function comandoGlobal(text: string): ComandoGlobal {
  const lower = text.toLowerCase().trim()
  if (['cancelar', 'fechar', 'sair'].includes(lower)) return 'cancelar'
  if (['voltar', 'passo anterior'].includes(lower)) return 'voltar'
  return null
}
