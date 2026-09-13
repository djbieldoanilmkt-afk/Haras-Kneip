import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { PRODUTO } from '@/lib/produto'
import { cn } from '@/lib/utils'

/**
 * As objeções reais de quem compra, não perguntas de enfeite.
 *
 * Cada resposta é honesta sobre a limitação quando existe — dizer "funciona
 * offline" sem funcionar gera cancelamento na primeira semana, que custa mais
 * caro que a venda perdida.
 */
const PERGUNTAS = [
  {
    p: 'Funciona sem internet, no meio do curral?',
    r: 'O sistema precisa de internet para salvar. Onde o sinal falha, o costume é anotar na hora e lançar quando voltar ao escritório ou pegar sinal — e é justamente por isso que estamos construindo o registro por áudio no WhatsApp, que aceita a mensagem assim que o sinal voltar.',
  },
  {
    p: 'Eu já tenho tudo em planilha. Vou perder esse trabalho?',
    r: 'Não. Você pode cadastrar aos poucos, começando pelos animais que mais importam, e a planilha continua servindo enquanto isso. Para quem tem plantel grande, fazemos a migração da planilha junto com você.',
  },
  {
    p: 'Meus dados ficam seguros? Outro haras vê meu plantel?',
    r: 'Cada conta é isolada no banco de dados, com regra de acesso por linha: nem por engano um haras enxerga o plantel de outro. O que fica público é apenas a sua vitrine, e só com os animais que você marcar.',
  },
  {
    p: 'Preciso ser bom de computador?',
    r: 'Se você usa WhatsApp, usa o HarasPro. As telas são pensadas para funcionar no celular, com botão grande e pouca digitação. Cadastro de animal tem um assistente que pergunta e preenche.',
  },
  {
    p: 'O que acontece quando o teste de 15 dias termina?',
    r: 'Seus dados continuam lá e você continua conseguindo consultá-los. O que trava é o registro de coisas novas, até você assinar. Nada é apagado.',
  },
  {
    p: 'Posso cancelar quando quiser?',
    r: 'Pode, sem multa e sem fidelidade. E antes de sair você exporta tudo em JSON e CSV — os dados são seus.',
  },
] as const

function Item({ p, r }: { p: string; r: string }) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="border-b border-black/8">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-semibold">{p}</span>
        <ChevronDown
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform',
            aberto && 'rotate-180',
          )}
        />
      </button>
      {aberto && <p className="pb-4 text-sm leading-relaxed text-[#6B7280]">{r}</p>}
    </div>
  )
}

export function SecaoFAQ() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h2 className="font-heading text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
        Perguntas que todo criador faz
      </h2>
      <p className="mx-auto mt-3 mb-8 max-w-lg text-center text-sm text-[#6B7280]">
        Se a sua não estiver aqui, chame a gente — o {PRODUTO.nome} é feito conversando com quem
        cria.
      </p>

      <div>
        {PERGUNTAS.map((item) => (
          <Item key={item.p} {...item} />
        ))}
      </div>
    </section>
  )
}
