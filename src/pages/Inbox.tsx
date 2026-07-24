import { useState } from 'react'
import { useAtendimentos } from '../lib/useInbox'
import { useUsuarioAtual } from '../lib/auth'
import { ListaChamados } from '../components/inbox/ListaChamados'
import { Conversa } from '../components/inbox/Conversa'
import { PainelContato } from '../components/inbox/PainelContato'
import { Erro } from '../components/ui/Estados'

export function Inbox() {
  const atendimentos = useAtendimentos()
  const usuario = useUsuarioAtual()
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)

  const lista = atendimentos.data ?? []
  const selecionado = lista.find((a) => a.id === selecionadoId) ?? null

  if (atendimentos.isError) {
    return (
      <div className="h-full flex items-center justify-center">
        <Erro mensagem="Não foi possível carregar os chamados." onTentar={() => atendimentos.refetch()} />
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row">
      <ListaChamados
        atendimentos={lista}
        usuarioId={usuario?.id ?? null}
        selecionadoId={selecionadoId}
        onSelecionar={setSelecionadoId}
        carregando={atendimentos.isLoading}
        aoAtualizar={() => atendimentos.refetch()}
        atualizando={atendimentos.isFetching}
      />
      <Conversa atendimento={selecionado} usuarioId={usuario?.id ?? null} />
      <PainelContato atendimento={selecionado} />
    </div>
  )
}
