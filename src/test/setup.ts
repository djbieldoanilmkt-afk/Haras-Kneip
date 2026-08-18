import '@testing-library/jest-dom/vitest'

/*
  O jsdom nao implementa matchMedia nem IntersectionObserver. Sao lacunas do
  ambiente de teste, nao do codigo: no navegador as duas APIs sempre existem.
  Preencher aqui evita espalhar guardas defensivas pela producao.

  Testes que precisam controlar o comportamento dessas APIs sobrescrevem os
  globais com vi.stubGlobal, o que continua funcionando.
*/

if (!window.matchMedia) {
  window.matchMedia = ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: readonly number[] = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  } as unknown as typeof window.IntersectionObserver
}
