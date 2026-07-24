import { useState } from 'react'
import { useAtendimentos } from '../lib/useInbox'
import { useUsuarioAtual } from '../lib/auth'
import { ListaChamados } from '../components/inbox/ListaChamados'
import { Conversa } from '../components/inbox/Conversa'
import { PainelContato } from '../components/inbox/PainelContato'
import { SimuladorChamado } from '../components/inbox/SimuladorChamado'
import { Erro } from '../components/ui/Estados'

export function Inbox() {
  const atendimentos = useAtendimentos()
  const usuario = useUsuarioAtual()
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)

  const lista = atendimentos.data ?? []
  const selecionado = lista.find((a) => a.id === selecionadoId) ?? null

  return (
    <div className="h-full min-h-0 flex flex-col">
      <header className="h-14 shrink-0 px-4 flex items-center justify-between gap-3 border-b border-bd-1 bg-sf-1">
        <h1 className="text-[15px] font-semibold text-tx-1">Atendimento</h1>
        <SimuladorChamado />
      </header>

      {atendimentos.isError ? (
        <Erro
          mensagem="Não foi possível carregar os chamados."
          onTentar={() => atendimentos.refetch()}
        />
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <ListaChamados
            atendimentos={lista}
            usuarioId={usuario?.id ?? null}
            selecionadoId={selecionadoId}
            onSelecionar={setSelecionadoId}
            carregando={atendimentos.isLoading}
          />
          <Conversa atendimento={selecionado} usuarioId={usuario?.id ?? null} />
          <PainelContato atendimento={selecionado} />
        </div>
      )}
    </div>
  )
}
