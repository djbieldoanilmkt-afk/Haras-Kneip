import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: Error | null
  reload: () => void
}

/**
 * Executa uma promessa e expõe carregamento, erro e recarga.
 *
 * Substitui os try/catch com skeleton de altura fixa repetidos em cada página
 * do app legado. A promessa é reexecutada quando `deps` muda ou quando
 * `reload()` é chamado; resultados de execuções obsoletas são descartados.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelado = false

    setLoading(true)
    setError(null)

    fn()
      .then((resultado) => {
        if (cancelado) return
        setData(resultado)
      })
      .catch((e: unknown) => {
        if (cancelado) return
        setData(null)
        setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, reload }
}
