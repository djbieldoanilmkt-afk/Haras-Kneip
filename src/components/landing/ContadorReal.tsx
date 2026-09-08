import { useRevelarAoRolar } from '@/hooks/useRevelarAoRolar'
import { useContadorAnimado } from '@/hooks/useContadorAnimado'
import { useAsync } from '@/hooks/useAsync'
import { supabase } from '@/lib/supabase'
import { PRODUTO } from '@/lib/produto'

type Estatisticas = { animais: number; haras: number }

function Numero({ valor, rotulo, ativo }: { valor: number; rotulo: string; ativo: boolean }) {
  // Só conta depois de revelado: contar fora da tela desperdiça o efeito.
  const exibido = useContadorAnimado(ativo ? valor : 0, 1200)

  return (
    <div>
      <div className="numero-animado font-heading text-primary text-4xl font-extrabold tracking-tight sm:text-5xl">
        {exibido.toLocaleString('pt-BR')}
      </div>
      <div className="text-muted-foreground mt-1 text-xs tracking-wider uppercase">{rotulo}</div>
    </div>
  )
}

/**
 * Prova social com número REAL, lido do banco pela função
 * `estatisticas_publicas()`. Ela é security definer e devolve só contagens —
 * o RLS continua impedindo o anônimo de ler qualquer linha.
 *
 * Some quando a consulta falha ou o número ainda é pequeno demais: "1 haras
 * cadastrado" trabalha contra a venda.
 */
export function ContadorReal() {
  const { ref, revelado } = useRevelarAoRolar<HTMLDivElement>()
  const { data, error } = useAsync(async () => {
    const { data, error } = await supabase.rpc('estatisticas_publicas')
    if (error) throw error
    return data as Estatisticas
  }, [])

  if (error || !data || data.animais < 5) return null

  return (
    <section ref={ref} className="border-y border-black/8 bg-white py-12">
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-8 px-4 text-center">
        <Numero valor={data.animais} rotulo="Animais cadastrados" ativo={revelado} />
        <Numero valor={data.haras} rotulo={`Haras usando o ${PRODUTO.nome}`} ativo={revelado} />
      </div>
    </section>
  )
}
