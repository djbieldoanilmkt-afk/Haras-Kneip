import { Toaster as Sonner, toast, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, TriangleAlertIcon, XIcon, Loader2Icon } from "lucide-react"

import { useTheme } from "@/hooks/useTheme"

/*
  A barra de tempo restante e uma animacao CSS, entao ela so fica em sincronia
  com o fechamento se as duas duracoes forem literalmente o mesmo numero. Por
  isso o valor mora aqui e desce para o CSS como variavel, em vez de ser
  digitado duas vezes.
*/
const DURACAO = 4000

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-center"
      offset={20}
      duration={DURACAO}
      icons={{
        success: <CheckIcon className="size-[1.125rem]" strokeWidth={2.5} />,
        info: <InfoIcon className="size-[1.125rem]" strokeWidth={2.5} />,
        warning: <TriangleAlertIcon className="size-[1.125rem]" strokeWidth={2.5} />,
        error: <XIcon className="size-[1.125rem]" strokeWidth={2.5} />,
        loading: <Loader2Icon className="size-[1.125rem] animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--width": "22rem",
          "--duracao-toast": `${DURACAO}ms`,
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

/**
 * Janela do desfazer. Maior que a duração padrão porque aqui o toast não é
 * aviso, é a única chance de voltar atrás — 4 segundos não dão tempo de ler a
 * mensagem e decidir.
 */
const DURACAO_DESFAZER = 10_000

/**
 * Aviso de exclusão com botão de desfazer.
 *
 * Existe como helper, e não solto em cada tela, por causa da barra de tempo:
 * ela é uma animação CSS que lê `--duracao-toast`, então um toast mais longo
 * precisa levar a variável junto. Espalhar isso pelas telas garantiria que
 * alguém esquecesse e a barra terminasse antes do toast sumir.
 */
function toastDesfazer(mensagem: string, aoDesfazer: () => void) {
  toast.success(mensagem, {
    duration: DURACAO_DESFAZER,
    style: { "--duracao-toast": `${DURACAO_DESFAZER}ms` } as React.CSSProperties,
    action: { label: "Desfazer", onClick: aoDesfazer },
  })
}

export { Toaster, toastDesfazer }
