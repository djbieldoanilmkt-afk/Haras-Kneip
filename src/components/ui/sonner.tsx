import { Toaster as Sonner, type ToasterProps } from "sonner"
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

export { Toaster }
