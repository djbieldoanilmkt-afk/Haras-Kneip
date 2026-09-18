/*
  Service worker do HarasPro.

  Existe por um motivo só: curral não tem sinal. Sem isto, abrir o app sem
  internet dá tela de dinossauro — e a pessoa que precisa conferir a vacina da
  égua está justamente no lugar onde o sinal falta.

  O QUE ELE NÃO FAZ, DE PROPÓSITO
  ------------------------------------------------------------------------
  Não guarda escrita para enviar depois. Fila de lançamentos que sobe sozinha
  quando o sinal volta erra de um jeito caro: grava duas vezes, grava fora de
  ordem, ou grava algo que a pessoa já corrigiu por outro caminho. E aqui isso
  não é necessário — quem precisa LANÇAR sem sinal usa o WhatsApp, que já
  tem fila própria e entrega quando a rede volta. O app offline serve para
  CONSULTAR.

  AS TRÊS ESTRATÉGIAS
  ------------------------------------------------------------------------
  1. Documento (navegação): rede primeiro, cache como rede de segurança.
     Cache primeiro seria mais rápido, mas um index.html velho aponta para
     pedaços de JavaScript que o deploy novo já apagou — e isso é tela branca,
     que é pior que lentidão.

  2. Arquivos com hash no nome (/assets/*): cache primeiro, sem validade.
     O Vite põe o hash do conteúdo no nome, então o mesmo nome nunca muda de
     conteúdo. Não há o que invalidar.

  3. Leitura da API (/rest/v1/): rede primeiro, cache como rede de segurança.
     É o que faz o plantel aparecer sem sinal, com o último dado visto.
*/

const VERSAO = 'v1'
const CACHE_APP = `haraspro-app-${VERSAO}`
const CACHE_DADOS = `haraspro-dados-${VERSAO}`

/*
  Procurar no cache ignorando o `Vary`.

  O servidor responde os arquivos com `Vary: Origin`. Isso faz o navegador
  exigir que o cabeçalho `Origin` do pedido novo seja igual ao do pedido que
  guardou — e eles nunca são: o worker guarda com um pedido sem `Origin`,
  enquanto o `<script type="module" crossorigin>` que o Vite gera manda
  `Origin`. Resultado: o arquivo estava no cache, e a busca dizia que não.

  Foi o que deixou o app em branco offline mesmo com tudo guardado. Só
  guardamos arquivo próprio e estático, onde variar por origem não quer dizer
  nada, então ignorar é correto e não só conveniente.
*/
const IGNORAR_VARY = { ignoreVary: true }

/*
  Sair da conta apaga os dados guardados.

  O cache da API tem dados do haras da pessoa. Num celular compartilhado —
  comum em fazenda, onde um aparelho fica no escritório — o próximo a entrar
  não pode ver o plantel do anterior. A página avisa quando alguém sai.
*/
self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'limpar-dados') {
    evento.waitUntil(caches.delete(CACHE_DADOS))
    return
  }

  /*
    A página manda a lista do que acabou de carregar.

    Na PRIMEIRA visita o worker chega atrasado: os arquivos de entrada
    (index-*.js, o CSS, o jsx-runtime) já foram pedidos enquanto o navegador
    lia o HTML, antes de existir worker para interceptar. Só os pedaços
    carregados depois caíam no cache — e sem o arquivo de entrada o app abre
    offline como página em branco, com o título certo. Foi exatamente o que
    aconteceu ao derrubar o servidor com a aba aberta.

    Adivinhar os nomes não dá: o Vite põe hash do conteúdo neles. Mas a
    própria página sabe o que carregou, pela Performance API. Ela conta, e
    aqui a lista é guardada.
  */
  if (evento.data?.tipo === 'aquecer' && Array.isArray(evento.data.urls)) {
    evento.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_APP)
        await Promise.all(
          evento.data.urls.map(async (url) => {
            try {
              if (await cache.match(url, IGNORAR_VARY)) return
              await cache.add(new Request(url, { cache: 'no-cache' }))
            } catch {
              // Um arquivo que não entrou não pode derrubar os outros.
            }
          }),
        )
      })(),
    )
  }
})

/*
  Guarda o documento já na instalação.

  Sem isto o app não abre offline na PRIMEIRA visita, e o motivo é sutil: o
  worker só passa a interceptar depois de instalar e assumir a aba, então o
  documento que trouxe a pessoa até aqui nunca passou por ele. Como o resto da
  navegação é por hash (`/#/plantel/...`), o navegador não pede documento
  nenhum de novo — e o cache continua sem a única página que importa.

  Descoberto derrubando o servidor com a aba aberta: tela branca.

  `cache: 'reload'` ignora o cache HTTP do navegador, para não guardar uma
  cópia velha do index.html logo de saída.
*/
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_APP)
      await cache.add(new Request('./', { cache: 'reload' }))
    })(),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys()
      await Promise.all(
        nomes
          .filter((n) => n.startsWith('haraspro-') && n !== CACHE_APP && n !== CACHE_DADOS)
          .map((n) => caches.delete(n)),
      )
      // Assume as abas já abertas. Não há `skipWaiting` no install: trocar os
      // arquivos no meio de uma sessão aberta quebraria o carregamento
      // preguiçoso das telas que ainda não foram visitadas.
      await self.clients.claim()
    })(),
  )
})

/** Guarda no cache sem deixar a falha estourar para quem chamou. */
async function guardar(nomeDoCache, pedido, resposta) {
  try {
    const cache = await caches.open(nomeDoCache)
    await cache.put(pedido, resposta)
  } catch {
    // Cota cheia ou modo anônimo. Não guardar é aceitável; quebrar não é.
  }
}

async function redePrimeiro(pedido, nomeDoCache) {
  try {
    const resposta = await fetch(pedido)
    if (resposta.ok) await guardar(nomeDoCache, pedido, resposta.clone())
    return resposta
  } catch (erro) {
    const guardada = await caches.match(pedido, IGNORAR_VARY)
    if (guardada) return guardada
    throw erro
  }
}

async function cachePrimeiro(pedido, nomeDoCache) {
  const guardada = await caches.match(pedido, IGNORAR_VARY)
  if (guardada) return guardada
  const resposta = await fetch(pedido)
  if (resposta.ok) await guardar(nomeDoCache, pedido, resposta.clone())
  return resposta
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  const url = new URL(pedido.url)

  // Só GET. Gravação nunca passa por aqui: ou vai para a rede, ou falha na
  // cara da pessoa — que é a resposta honesta.
  if (pedido.method !== 'GET') return

  /*
    Autenticação jamais entra em cache.

    A resposta de /auth/v1/ carrega token de sessão. Guardar isso em disco é
    entregar a sessão para quem abrir o navegador depois.
  */
  if (url.pathname.includes('/auth/v1/')) return

  // O documento. Com HashRouter toda rota é o mesmo `/`, então um documento
  // guardado cobre o app inteiro.
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      redePrimeiro(pedido, CACHE_APP).catch(
        async () => (await caches.match('./', IGNORAR_VARY)) ?? (await caches.match('./index.html', IGNORAR_VARY)) ?? Response.error(),
      ),
    )
    return
  }

  // Leitura da API do Supabase: é isso que faz o plantel existir sem sinal.
  if (url.pathname.includes('/rest/v1/')) {
    evento.respondWith(redePrimeiro(pedido, CACHE_DADOS))
    return
  }

  // Arquivos próprios: JavaScript, CSS, fontes, imagens, ícones.
  if (url.origin === self.location.origin) {
    evento.respondWith(cachePrimeiro(pedido, CACHE_APP))
  }
})
