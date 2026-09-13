import { Link } from 'react-router-dom'
import { ExternalLink, Link2, MessageCircle, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useRevelarAoRolar } from '@/hooks/useRevelarAoRolar'
import { cn } from '@/lib/utils'

/**
 * A vitrine pública é o recurso mais viral do produto: cada link mandado num
 * grupo de criadores é distribuição gratuita. Ela merecia mais que uma linha
 * numa lista de funcionalidades.
 *
 * O exemplo aponta para uma vitrine real, não para uma imagem — quem clica vê
 * o produto funcionando de verdade.
 */

const PASSOS = [
  { icone: Star, texto: 'Marque no plantel quais animais quer mostrar' },
  { icone: Link2, texto: 'O sistema monta um endereço só seu' },
  { icone: MessageCircle, texto: 'Mande no grupo de criadores e acompanhe' },
] as const

export function SecaoVitrine() {
  const { ref, revelado } = useRevelarAoRolar<HTMLDivElement>()

  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="text-primary text-xs font-bold tracking-widest uppercase">
            Vitrine pública
          </p>
          <h2 className="font-heading mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Um link para vender, pronto para o WhatsApp
          </h2>
          <p className="mt-3 text-sm text-[#6B7280]">
            Seus animais selecionados numa página com foto, pelagem, idade, registro e genealogia.
            Quem recebe não precisa instalar nada nem criar conta — abre e vê.
          </p>

          <ol className="mt-6 space-y-3">
            {PASSOS.map(({ icone: Icone, texto }, i) => (
              <li key={texto} className="flex items-start gap-3">
                <span className="bg-accent text-accent-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  {i + 1}
                </span>
                <span className="flex items-center gap-2 pt-1 text-sm text-[#374151]">
                  <Icone className="text-primary size-4 shrink-0" />
                  {texto}
                </span>
              </li>
            ))}
          </ol>

          <Button
            className="mt-7"
            variant="outline"
            nativeButton={false}
            render={<Link to="/plantel/haras-kneip" />}
          >
            <ExternalLink className="size-4" />
            Ver uma vitrine de verdade
          </Button>
        </div>

        {/* Celular mostrando como o link chega no WhatsApp. */}
        <div ref={ref} className={cn('revelar flex justify-center', revelado && 'revelado')}>
          <div className="w-[290px] rounded-[2rem] border-[10px] border-[#14161A] bg-[#14161A] shadow-2xl">
            <div className="rounded-[1.4rem] bg-[#EFE7DE] p-3">
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-sm bg-[#D9FDD3] p-2 shadow-sm">
                {/* Prévia do link, o mesmo cartão que o Open Graph gera. */}
                <div className="overflow-hidden rounded-lg bg-white">
                  <img
                    src="marca/og-haraspro.jpg"
                    alt="Prévia do link do plantel"
                    className="aspect-[1200/630] w-full object-cover"
                    loading="lazy"
                  />
                  <div className="p-2">
                    <p className="text-[11px] font-semibold text-[#111B21]">
                      Haras Kneip — Plantel
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-[#111B21]/60">
                      Seleção Mangalarga Marchador. Veja os animais disponíveis.
                    </p>
                  </div>
                </div>
                <p className="mt-1.5 text-[12px] text-[#111B21]">
                  Dá uma olhada no plantel 👇
                </p>
                <p className="text-[11px] break-all text-[#1E5B3A]">
                  haraspro.com.br/#/plantel/haras-kneip
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
