import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/**
 * Rótulo + controle + mensagem de erro.
 *
 * Centraliza o layout de formulário usado nos diálogos do perfil, no cadastro
 * de animal e no calendário, para que os três não divirjam.
 */
export function Campo({
  label,
  htmlFor,
  erro,
  hint,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  erro?: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-muted-foreground text-xs font-medium">
        {label}
      </Label>
      {children}
      {erro ? (
        <p className="text-destructive text-xs">{erro}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}

/** Select de opções simples em texto, com a mesma largura dos inputs. */
export function SelectSimples({
  value,
  onValueChange,
  options,
  placeholder = 'Selecione...',
  id,
}: {
  value: string
  onValueChange: (valor: string) => void
  options: readonly string[]
  placeholder?: string
  id?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(String(v ?? ''))}>
      <SelectTrigger id={id} className="h-9 w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opcao) => (
          <SelectItem key={opcao} value={opcao}>
            {opcao}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Select de animal que guarda o id, e não o nome.
 *
 * O calendário resolve o animal procurando pelo nome escolhido, o que erra
 * quando dois animais se chamam igual — e nome repetido acontece em haras,
 * porque o afixo é o mesmo e o pré-nome se repete entre safras. Nas telas
 * novas o valor do select já é o id.
 */
/**
 * Seletor cujo VALOR e um id e cujo rotulo e um nome.
 *
 * A funcao filha no `SelectValue` e obrigatoria: sem ela o Base UI imprime o
 * proprio valor no gatilho, e como o valor e o id aparecia um UUID na tela.
 *
 * `SelectAnimal` e o mesmo componente com outro nome, mantido porque a maior
 * parte das telas seleciona animal -- mas evento usa o mesmo mecanismo, e
 * chamar de "SelectAnimal" ali seria mentira no codigo.
 */
export function SelectPorId({
  value,
  onValueChange,
  animais,
  placeholder = 'Selecione...',
  id,
}: {
  value: string
  onValueChange: (id: string) => void
  animais: readonly { id: string; nome: string }[]
  placeholder?: string
  id?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(String(v ?? ''))}>
      <SelectTrigger id={id} className="h-9 w-full">
        {/*
          A funcao e obrigatoria aqui. Sem ela o Base UI imprime o proprio
          valor no gatilho — e como o valor deste select e o id, aparecia o
          UUID no lugar do nome do animal. No SelectSimples o problema nao
          existe porque la o valor e o proprio texto da opcao.

          Animal que saiu da lista (excluido enquanto o formulario estava
          aberto) cai no placeholder, que e melhor do que exibir um id solto.
        */}
        <SelectValue placeholder={placeholder}>
          {(selecionado) =>
            animais.find((a) => a.id === selecionado)?.nome ?? placeholder
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {animais.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Mesmo seletor, com o nome que a maior parte das telas usa. */
export const SelectAnimal = SelectPorId
