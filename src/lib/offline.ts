/**
 * Registro do service worker e sinal de "sem conexão".
 *
 * O worker em si vive em `public/sw.js`, fora do empacotamento: precisa ser
 * servido da raiz para poder controlar o app inteiro.
 */

/** Avisa o worker para apagar os dados do haras. Chamado ao sair da conta. */
export async function limparDadosOffline() {
  if (!('serviceWorker' in navigator)) return
  const registro = await navigator.serviceWorker.getRegistration()
  registro?.active?.postMessage({ tipo: 'limpar-dados' })
}

export function registrarOffline() {
  if (!('serviceWorker' in navigator)) return

  /*
    Só em produção.

    Em desenvolvimento o Vite serve os módulos sem hash e troca arquivo a cada
    salvamento; um worker guardando isso faria o navegador mostrar código
    velho, e o tempo perdido procurando o "bug" que já estava corrigido é
    pior do que não ter offline na máquina de quem programa.
  */
  if (!import.meta.env.PROD) return

  window.addEventListener('load', async () => {
    try {
      // O caminho é relativo porque o app pode ser servido de subpasta.
      await navigator.serviceWorker.register('./sw.js')
      const pronto = await navigator.serviceWorker.ready
      if (pronto.active) aquecerCache(pronto.active)
    } catch {
      // Sem service worker o app continua funcionando — só não abre sem sinal.
    }
  })
}

/**
 * Conta ao worker tudo que esta página carrega, para ele guardar.
 *
 * Existe porque na primeira visita o worker chega depois: os arquivos de
 * entrada já foram baixados sem passar por ele, e sem eles o app abre offline
 * em branco. Os nomes têm hash do conteúdo, então não dá para listá-los à mão.
 *
 * OBSERVAR, NÃO FOTOGRAFAR
 *
 * A primeira versão tirava uma foto com `getEntriesByType` no `load`. Ficavam
 * de fora justamente os pedaços que o `App` importa — eles chegam DEPOIS do
 * `load`, porque o `App` é carregado sob demanda. Resultado: 17 arquivos fora
 * do cache, e o app abrindo offline em branco de novo.
 *
 * `PerformanceObserver` com `buffered: true` entrega o que já passou e o que
 * ainda vai passar. Não há instante certo para fotografar; então não fotografa.
 */
function aquecerCache(alvo: ServiceWorker) {
  if (typeof PerformanceObserver === 'undefined') return

  const fila = new Set<string>()
  let agendado: ReturnType<typeof setTimeout> | null = null

  const despachar = () => {
    agendado = null
    if (fila.size === 0) return
    alvo.postMessage({ tipo: 'aquecer', urls: [...fila] })
    fila.clear()
  }

  const observador = new PerformanceObserver((lista) => {
    for (const entrada of lista.getEntries()) {
      const url = entrada.name
      if (!url.startsWith(window.location.origin)) continue
      // Dados do haras têm cache próprio, apagado ao sair da conta.
      if (url.includes('/rest/v1/') || url.includes('/auth/v1/')) continue
      fila.add(url)
    }
    // Agrupa: uma tela puxa dezenas de pedaços quase juntos.
    if (agendado === null) agendado = setTimeout(despachar, 1000)
  })

  observador.observe({ type: 'resource', buffered: true })
}

/** Assina o estado da conexão. Devolve a função que cancela a assinatura. */
export function observarConexao(aoMudar: (online: boolean) => void) {
  const avisar = () => aoMudar(navigator.onLine)
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}
