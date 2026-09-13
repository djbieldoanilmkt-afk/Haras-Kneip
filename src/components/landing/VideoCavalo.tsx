import { useEffect, useRef } from 'react'

import { useRevelarAoRolar } from '@/hooks/useRevelarAoRolar'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

/**
 * Cavalo em vídeo recortado na página, sem caixa.
 *
 * O truque é `mix-blend-mode: multiply`: como o fundo do vídeo foi achatado
 * para branco puro (255), multiply devolve exatamente a cor da página —
 * `(255 × pagina) / 255 = pagina` —, e só o animal e a sombra de contato
 * sobrevivem. Por isso a seção que hospeda precisa ter fundo CLARO: sobre
 * fundo escuro o multiply comeria o cavalo junto.
 *
 * Preferimos multiply a vídeo com canal alfa porque crina e cauda são fios
 * finos: qualquer recorte por chroma key os serrilha, enquanto o multiply não
 * recorta nada — apenas escurece.
 */
export function VideoCavalo({
  nome,
  className,
  loop = true,
  alt,
}: {
  nome: 'heroi' | 'transicao' | 'fechamento'
  className?: string
  loop?: boolean
  alt: string
}) {
  const { ref, revelado } = useRevelarAoRolar<HTMLDivElement>()
  const menosMovimento = useReducedMotion()
  const video = useRef<HTMLVideoElement>(null)

  // Só baixa o vídeo quando a seção entra na tela: um visitante que nunca
  // rola até aqui não paga o download.
  useEffect(() => {
    const el = video.current
    if (!el || !revelado || menosMovimento) return
    el.src = `assets/${nome}.webm`
    el.load()
    void el.play().catch(() => {
      // Autoplay bloqueado: o poster continua no lugar, sem erro visível.
    })
  }, [revelado, menosMovimento, nome])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <video
        ref={video}
        poster={`assets/${nome}-poster.webp`}
        muted
        playsInline
        loop={loop}
        preload="none"
        aria-label={alt}
        className="h-full w-full object-contain mix-blend-multiply"
      />
    </div>
  )
}
