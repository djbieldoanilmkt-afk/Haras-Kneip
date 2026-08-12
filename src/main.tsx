import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import { ConfiguracaoAusente } from './ConfiguracaoAusente'

const raiz = createRoot(document.getElementById('root')!)

const faltando = (
  [
    ['VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL],
    ['VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY],
  ] as const
)
  .filter(([, valor]) => !valor)
  .map(([nome]) => nome)

if (faltando.length > 0) {
  // O App importa o cliente Supabase na cadeia de imports, entao carregar so
  // apos a checagem evita o erro em tempo de import e a pagina em branco.
  raiz.render(
    <StrictMode>
      <ConfiguracaoAusente faltando={faltando} />
    </StrictMode>,
  )
} else {
  void import('./App').then(({ default: App }) => {
    raiz.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
