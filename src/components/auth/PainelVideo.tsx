import { useEffect, useRef, useState } from 'react'

import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/utils'

/**
 * Fundo do painel de autenticação: dois clipes se revezando com fundido.
 *
 * Os dois <video> ficam empilhados e o ativo tem opacidade 1. Quando um
 * termina, o outro assume — as duas transições de opacidade acontecendo juntas
 * produzem o cruzamento, sem biblioteca.
 *
 * O segundo clipe só recebe `src` depois que o primeiro tem dados: são 1,2 MB
 * cada, e baixar os dois numa tela de login seria caro para quem só quer
 * digitar a senha.
 */

const CLIPES = ['haras-drone', 'mangalarga-drone'] as const
const FUNDIDO_MS = 900

export function PainelVideo() {
  const menosMovimento = useReducedMotion()
  const [ativo, setAtivo] = useState(0)
  const [segundoLiberado, setSegundoLiberado] = useState(false)
  const [falhou, setFalhou] = useState(false)

  const primeiro = useRef<HTMLVideoElement>(null)
  const segundo = useRef<HTMLVideoElement>(null)
  const refs = [primeiro, segundo]

  // O evento `loadeddata` pode disparar antes do React anexar o handler —
  // acontece com servidor local rápido. Conferir o readyState na montagem
  // fecha essa corrida.
  useEffect(() => {
    if (primeiro.current && primeiro.current.readyState >= 2) setSegundoLiberado(true)
  }, [])

  // Toca o clipe que acabou de assumir, desde o começo.
  useEffect(() => {
    if (menosMovimento || falhou) return
    const el = refs[ativo].current
    if (!el?.currentSrc) return
    el.currentTime = 0
    void el.play().catch(() => {
      /* autoplay bloqueado: fica o poster, sem erro visível */
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, segundoLiberado, menosMovimento, falhou])

  function aoTerminar(indice: number) {
    // Só passa a vez se o próximo tiver fonte: sem isso o painel apagaria
    // quando o segundo clipe ainda não tivesse sido liberado.
    const proximo = (indice + 1) % CLIPES.length
    if (proximo !== 0 && !segundoLiberado) {
      const el = refs[indice].current
      if (el) void el.play().catch(() => {})
      return
    }
    setAtivo(proximo)
  }

  if (menosMovimento || falhou) {
    // Sem movimento ou sem arquivo: o poster basta, e o gradiente por cima
    // garante a leitura do texto de qualquer forma.
    return (
      <img
        src={`assets/${CLIPES[0]}-poster.webp`}
        alt=""
        onError={() => setFalhou(true)}
        className="absolute inset-0 size-full object-cover"
      />
    )
  }

  return (
    <>
      {CLIPES.map((clipe, i) => (
        <video
          key={clipe}
          ref={refs[i]}
          src={i === 0 || segundoLiberado ? `assets/${clipe}.webm` : undefined}
          poster={`assets/${clipe}-poster.webp`}
          muted
          playsInline
          autoPlay={i === 0}
          preload={i === 0 ? 'auto' : 'none'}
          onLoadedData={() => i === 0 && setSegundoLiberado(true)}
          onEnded={() => aoTerminar(i)}
          onError={() => i === 0 && setFalhou(true)}
          style={{ transitionDuration: `${FUNDIDO_MS}ms` }}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity ease-in-out',
            ativo === i ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
    </>
  )
}
