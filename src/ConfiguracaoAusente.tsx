/**
 * Tela exibida quando as variáveis de ambiente do Supabase não chegaram ao
 * build. Sem isto o app lançaria no import e o resultado seria uma página em
 * branco, que não diz nada a quem está publicando o site.
 */
export function ConfiguracaoAusente({ faltando }: { faltando: string[] }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#FBFBFC] p-6 text-[#14161A]">
      <div className="w-full max-w-lg rounded-xl border border-black/8 bg-white p-8 shadow-sm">
        <div className="font-brand mb-5 flex size-10 items-center justify-center rounded-lg bg-[#1E5B3A] text-sm font-bold text-white">
          HK
        </div>

        <h1 className="text-lg font-semibold">Configuração incompleta</h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          O sistema não conseguiu se conectar ao banco de dados porque estas variáveis de ambiente
          não foram definidas no momento do build:
        </p>

        <ul className="my-4 space-y-1.5">
          {faltando.map((nome) => (
            <li
              key={nome}
              className="rounded-md border border-black/8 bg-[#F7F8F9] px-3 py-2 font-mono text-xs"
            >
              {nome}
            </li>
          ))}
        </ul>

        <div className="space-y-3 text-sm text-[#6B7280]">
          <p>
            <strong className="text-[#14161A]">Publicando na Vercel ou Netlify:</strong> defina as
            duas no painel do projeto, em Environment Variables, e refaça o deploy. Variáveis
            adicionadas depois do build não entram sozinhas — o deploy precisa rodar de novo.
          </p>
          <p>
            <strong className="text-[#14161A]">Rodando local:</strong> copie o arquivo{' '}
            <code className="rounded bg-[#F7F8F9] px-1 py-0.5 text-xs">.env.example</code> para{' '}
            <code className="rounded bg-[#F7F8F9] px-1 py-0.5 text-xs">.env</code>, preencha os
            valores e reinicie o servidor.
          </p>
        </div>

        <p className="mt-5 border-t border-black/8 pt-4 text-xs text-[#868C96]">
          Os valores estão no painel do Supabase, em Project Settings → API. Use a chave{' '}
          <strong>anon</strong>, nunca a <strong>service_role</strong> nem a connection string do
          Postgres — tudo que começa com <code>VITE_</code> é embutido no JavaScript enviado ao
          navegador.
        </p>
      </div>
    </div>
  )
}
