import { useState } from 'react'
import { useAtendimentos } from '../lib/useInbox'
import { useAvisoMensagem } from '../lib/useAvisoMensagem'
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
  // Som e card do sistema quando chega mensagem. Mora aqui, e não dentro da
  // conversa, porque o aviso precisa valer para os chamados que NÃO estão
  // abertos na tela: justamente os que passariam despercebidos.
  useAvisoMensagem(atendimentos.data, selecionadoId)
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
      {/* A tela é toda painel (lista, conversa, contato) e não tinha h1 nenhum.
          Fica oculto no visual porque um título visível repetiria a barra do
          topo e comeria altura da lista, mas o leitor de tela precisa dele. */}
      <h1 className="sr-only">Atendimentos</h1>
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
      ) : (
        // Sem conversa: no mobile mostra só a lista; o painel da direita é lg+.
        // Admin vê o dashboard de supervisão; atendente vê a marca d'água.
        <div className="hidden lg:flex flex-1 min-w-0 min-h-0">
          {isAdmin ? (
            <Dashboard aoFiltrar={setFiltro} filtro={filtro} />
          ) : (
            <Conversa atendimento={null} usuarioId={usuario?.id ?? null} />
          )}
        </div>
      )}
    </div>
  )
}
