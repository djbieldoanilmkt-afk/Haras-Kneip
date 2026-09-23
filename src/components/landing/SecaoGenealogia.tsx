import { PedigreeTree } from '@/components/PedigreeTree'
import { useRevelarAoRolar } from '@/hooks/useRevelarAoRolar'
import type { Genealogia } from '@/lib/database.types'

/**
 * Demonstração da árvore genealógica na landing.
 *
 * É o componente REAL do produto, não um vídeo nem uma captura de tela: os
 * conectores se desenham de verdade quando a seção entra na tela. Mostrar em
 * vez de prometer — e, de quebra, nunca fica desatualizado em relação ao app.
 *
 * A árvore anima na MONTAGEM, então ela só é montada quando revelada; do
 * contrário a animação aconteceria fora da tela e o visitante veria o
 * resultado já parado.
 */

const ANIMAL = 'Estrela D’Alva do Kneip'

const DEMO: Genealogia = {
  id: 'demo',
  animal_id: 'demo',
  pai_id: 'p',
  mae_id: 'm',
  avo_paterno_id: 'ap',
  avo_paterna_id: 'apa',
  avo_materno_id: 'am',
  avo_materna_id: null,
  created_at: '',
  updated_at: null,
}

const ANCESTRAIS = {
  p: { nome: 'Imperador do Vale', foto_url: null },
  m: { nome: 'Brisa Suave', foto_url: null },
  ap: { nome: 'Vencedor JK', foto_url: null },
  apa: { nome: 'Aurora da Serra', foto_url: null },
  am: { nome: 'Trovão Azul', foto_url: null },
}

export function SecaoGenealogia() {
  const { ref, revelado } = useRevelarAoRolar<HTMLDivElement>()

  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-primary text-xs font-bold tracking-widest uppercase">Genealogia</p>
        <h2 className="font-heading mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          O pedigree do seu animal, desenhado
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[#6B7280]">
          Três gerações com foto, linhas de parentesco e navegação entre ancestrais. Não é uma
          imagem desta página — é a tela que você usa todo dia.
        </p>
      </div>

      <div
        ref={ref}
        className="overflow-hidden rounded-2xl border border-black/8 bg-white p-6 shadow-sm"
      >
        {revelado ? (
          <PedigreeTree
            genealogia={DEMO}
            ancestrais={ANCESTRAIS}
            animalNome={ANIMAL}
            semLinks
          />
        ) : (
          // Reserva a altura para a página não pular quando a árvore montar.
          <div className="h-[19rem]" aria-hidden />
        )}
      </div>
    </section>
  )
}
