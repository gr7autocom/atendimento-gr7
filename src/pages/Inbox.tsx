import { useState } from 'react'
import { useAtendimentos } from '../lib/useInbox'
import { useUsuarioAtual } from '../lib/auth'
import { usePermissao } from '../lib/permissoes'
import { ListaChamados } from '../components/inbox/ListaChamados'
import { Conversa } from '../components/inbox/Conversa'
import { PainelContato } from '../components/inbox/PainelContato'
import { Dashboard, type FiltroInbox } from './Dashboard'
import { Erro } from '../components/ui/Estados'

const SEM_FILTRO: FiltroInbox = { departamentoId: null, atendenteId: null }

export function Inbox() {
  const atendimentos = useAtendimentos()
  const usuario = useUsuarioAtual()
  const { isAdmin } = usePermissao()
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroInbox>(SEM_FILTRO)

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
        filtro={filtro}
        aoFiltrar={setFiltro}
      />

      {selecionado ? (
        <>
          <Conversa
            atendimento={selecionado}
            usuarioId={usuario?.id ?? null}
            aoFechar={() => setSelecionadoId(null)}
          />
          <PainelContato atendimento={selecionado} />
        </>
      ) : isAdmin ? (
        // Sem conversa aberta, o admin vê o painel de supervisão na área da direita.
        <Dashboard aoFiltrar={setFiltro} filtro={filtro} />
      ) : (
        // Atendente vê a marca d'água (estado vazio da conversa).
        <Conversa atendimento={null} usuarioId={usuario?.id ?? null} />
      )}
    </div>
  )
}
