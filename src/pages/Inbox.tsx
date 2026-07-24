import { useState } from 'react'
import { useAtendimentos } from '../lib/useInbox'
import { useUsuarioAtual } from '../lib/auth'
import { ListaChamados } from '../components/inbox/ListaChamados'
import { Conversa } from '../components/inbox/Conversa'
import { PainelContato } from '../components/inbox/PainelContato'
import { SimuladorChamado } from '../components/inbox/SimuladorChamado'

export function Inbox() {
  const atendimentos = useAtendimentos()
  const usuario = useUsuarioAtual()
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)

  const lista = atendimentos.data ?? []
  const selecionado = lista.find((a) => a.id === selecionadoId) ?? null

  return (
    <div className="h-full min-h-0 flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-[#ffffff1a]">
        <h1 className="text-[#ffffff] font-bold">Atendimento</h1>
        <SimuladorChamado />
      </header>

      {atendimentos.isError ? (
        <p className="p-4 text-red-400">Não foi possível carregar os chamados. Recarregue a página.</p>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <ListaChamados
            atendimentos={lista}
            usuarioId={usuario?.id ?? null}
            selecionadoId={selecionadoId}
            onSelecionar={setSelecionadoId}
          />
          <Conversa atendimento={selecionado} usuarioId={usuario?.id ?? null} />
          <PainelContato atendimento={selecionado} />
        </div>
      )}
    </div>
  )
}
