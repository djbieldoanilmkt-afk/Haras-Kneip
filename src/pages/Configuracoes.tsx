import { useEffect, useState } from 'react'
import { Download, Info, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Campo } from '@/components/form/Campo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsync } from '@/hooks/useAsync'
import { store } from '@/lib/store'

export default function Configuracoes() {
  const { data: configuracoes, loading } = useAsync(() => store.getConfiguracoes(), [])
  const [form, setForm] = useState({ haras_nome: '', proprietario: '', localizacao: '' })
  const [salvando, setSalvando] = useState(false)
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    if (!configuracoes) return
    const mapa = Object.fromEntries(configuracoes.map((c) => [c.chave, c.valor]))
    setForm({
      haras_nome: mapa.haras_nome ?? '',
      proprietario: mapa.proprietario ?? '',
      localizacao: mapa.localizacao ?? '',
    })
  }, [configuracoes])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      await Promise.all([
        store.saveConfiguracao('haras_nome', form.haras_nome),
        store.saveConfiguracao('proprietario', form.proprietario),
        store.saveConfiguracao('localizacao', form.localizacao),
      ])
      toast.success('Configurações salvas.')
    } catch (err) {
      toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : 'desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  async function exportarJson() {
    setExportando(true)
    try {
      const conteudo = await store.exportData()
      const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'haras_backup.json'
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Backup exportado.')
    } catch (err) {
      toast.error(`Erro ao exportar: ${err instanceof Error ? err.message : 'desconhecido'}`)
    } finally {
      setExportando(false)
    }
  }

  return (
    <>
      <PageHeader title="Configurações" description="Dados do haras e gestão dos registros" />

      <Card className="mb-4 p-5">
        <h2 className="mb-4 text-sm font-semibold">Informações do Haras</h2>

        {loading ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : (
          <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nome do haras" htmlFor="cfg-nome">
              <Input
                id="cfg-nome"
                value={form.haras_nome}
                onChange={(e) => setForm((f) => ({ ...f, haras_nome: e.target.value }))}
                placeholder="Ex: Haras Kneip"
              />
            </Campo>
            <Campo label="Proprietário" htmlFor="cfg-prop">
              <Input
                id="cfg-prop"
                value={form.proprietario}
                onChange={(e) => setForm((f) => ({ ...f, proprietario: e.target.value }))}
              />
            </Campo>
            <Campo label="Localização" htmlFor="cfg-local" className="sm:col-span-2">
              <Input
                id="cfg-local"
                value={form.localizacao}
                onChange={(e) => setForm((f) => ({ ...f, localizacao: e.target.value }))}
              />
            </Campo>
            <div className="col-span-full flex justify-end">
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar configurações'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Gerenciamento de dados</h2>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={exportarJson}
              disabled={exportando}
            >
              <Download className="size-4" />
              {exportando ? 'Exportando...' : 'Exportar dados (JSON)'}
            </Button>

            {/*
              O botao de importar existia no app legado mas nunca teve handler,
              e store.importData era um stub vazio. Em vez de portar um botao
              morto, a limitacao fica visivel.
            */}
            <div className="border-border text-muted-foreground flex items-start gap-2.5 rounded-md border border-dashed p-3">
              <Upload className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-foreground text-sm font-medium">Importar dados (JSON)</p>
                <p className="mt-0.5 text-xs">
                  Ainda não disponível. Use a exportação para manter um backup.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Info className="size-4" />
            Sobre o sistema
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sistema</dt>
              <dd className="font-medium">Haras Kneip Manager</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Versão</dt>
              <dd className="font-medium">2.0.0</dd>
            </div>
          </dl>
          <p className="text-muted-foreground mt-4 text-sm">
            Gestão de equinos Mangalarga Marchador com controle de plantel, genealogia, sanidade e
            reprodução.
          </p>
        </Card>
      </div>
    </>
  )
}
