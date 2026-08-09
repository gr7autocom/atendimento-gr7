import { useEffect, useState } from 'react'
import { Copy, Check, Headset, MessageSquare, Info } from 'lucide-react'
import {
  useAtualizarContato,
  useContadoresContato,
  useParticipantes,
  useTarefasDoContato,
  nomeEmpresa,
  nomeDoContato,
  ehTitularAnonimizado,
  type AtendimentoLista,
} from '../../lib/useInbox'
import { Avatar } from '../ui/Avatar'
import { Entrada } from '../ui/Campo'
import { Skeleton } from '../ui/Estados'
import { SecaoContato } from './SecaoContato'
import { HistoricoContato } from './HistoricoContato'
import { ParticipantesContato } from './ParticipantesContato'
import { TarefasContato } from './TarefasContato'
import { canalDoChamado } from '../../lib/canal'
import { EliminarTitular } from './EliminarTitular'
import { usePermissao } from '../../lib/permissoes'

/** Card de contador do cabeçalho (Atendimentos, Mensagens). */
function Contador({
  icone: Icone,
  label,
  valor,
  carregando,
}: {
  icone: typeof Headset
  label: string
  valor: number
  carregando: boolean
}) {
  return (
    <div className="rounded-2 border border-bd-1 bg-sf-2 px-3 py-2.5">
      <div className="text-mini text-tx-3">{label}</div>
      <div className="flex items-end justify-between gap-1 mt-1">
        {carregando ? (
          <Skeleton className="h-5 w-9" />
        ) : (
          <span className="dado text-destaque font-semibold text-tx-1 tabular-nums leading-none">{valor}</span>
        )}
        <Icone size={15} className="text-tx-3 mb-0.5 shrink-0" />
      </div>
    </div>
  )
}

export function PainelContato({
  atendimento,
  variante = 'lateral',
}: {
  atendimento: AtendimentoLista | null
  /** 'lateral' = coluna no desktop (some no mobile); 'cheia' = ocupa tudo (overlay no mobile). */
  variante?: 'lateral' | 'cheia'
}) {
  const atualizar = useAtualizarContato()
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [copiado, setCopiado] = useState(false)
  const contadores = useContadoresContato(atendimento?.contato?.id ?? null)
  const participantes = useParticipantes(atendimento?.id ?? null)
  const tarefas = useTarefasDoContato(atendimento?.contato?.id ?? null)
  const { isAdmin } = usePermissao()
  const anonimizado = ehTitularAnonimizado(atendimento?.contato?.telefone)

  useEffect(() => {
    setNome(atendimento?.contato?.nome ?? '')
    setCargo(atendimento?.contato?.cargo ?? '')
  }, [atendimento?.contato?.id, atendimento?.contato?.nome, atendimento?.contato?.cargo])

  if (!atendimento) return null

  const contato = atendimento.contato
  const canal = canalDoChamado(atendimento?.canal)
  const cls =
    variante === 'cheia'
      ? 'w-full h-full overflow-y-auto bg-sf-1'
      : 'hidden lg:block lg:w-[320px] shrink-0 bg-sf-1 lg:border-l border-bd-1 overflow-y-auto'

  function copiarProtocolo() {
    navigator.clipboard?.writeText(String(atendimento!.protocolo))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <aside className={cls}>
      <div className="p-4 flex flex-col items-center text-center border-b border-bd-1">
        <Avatar nome={nomeDoContato(atendimento)} tamanho={72} canal={canal} />
        <button
          type="button"
          onClick={copiarProtocolo}
          className="mt-3 inline-flex items-center gap-1.5 text-tx-3 hover:text-tx-2 transicao"
          title="Copiar protocolo"
        >
          <span className="rotulo">Protocolo</span>
          {copiado ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
        </button>
        <div className="dado text-metrica font-semibold text-tx-1 tabular-nums leading-tight">
          {atendimento.protocolo}
        </div>
      </div>

      <div className="px-5 py-4 grid grid-cols-2 gap-2.5 border-b border-bd-1">
        <Contador icone={Headset} label="Atendimentos" valor={contadores.data?.atendimentos ?? 0} carregando={contadores.isLoading} />
        <Contador icone={MessageSquare} label="Mensagens" valor={contadores.data?.mensagens ?? 0} carregando={contadores.isLoading} />
      </div>

      <SecaoContato titulo="Informações" inicialAberta>
        <div className="flex flex-col gap-4">
          {/*
            No WhatsApp o número É a identidade: o provedor garante de qual aparelho
            veio a mensagem. No site a pessoa digita nome e telefone e ninguém
            confere nada. É a mesma tela com dois graus de confiança, e sem este
            aviso o atendente trata os dois igual na hora de passar uma senha.

            Um aviso por seção, e não um por campo: a mesma ressalva repetida em
            nome, telefone e CNPJ vira ruído e ninguém lê.

            Sem cor de alerta, de propósito. Vermelho ou âmbar diria "cliente
            suspeito", e o normal é ser quem diz ser. A ressalva é sobre o que o
            sistema garante, não sobre a pessoa.
          */}
          {canal === 'web' && (
            <p className="flex gap-1.5 text-apoio text-tx-2">
              <Info size={13} className="shrink-0 mt-0.5 text-tx-3" aria-hidden="true" />
              <span>
                Os dados vieram do formulário do site e não foram verificados. Confirme quem é antes
                de passar senha ou dado da empresa.
              </span>
            </p>
          )}

          <div>
            <div className="rotulo mb-1.5">Nome</div>
            <Entrada
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onBlur={() => {
                if (contato && nome !== (contato.nome ?? '')) {
                  atualizar.mutate({ id: contato.id, valores: { nome: nome || null } })
                }
              }}
              placeholder={anonimizado ? 'Removido a pedido do titular' : contato?.nome_whatsapp ?? 'Nome do contato'}
              aria-label="Nome do contato"
              /*
                Travado depois da eliminação, e isto é conformidade e não
                enfeite: o campo grava direto em `contatos.nome`, então digitar
                aqui reintroduziria o dado pessoal que o titular pediu para
                apagar, sem passar por nenhuma checagem.
              */
              disabled={anonimizado}
              // Só no WhatsApp: ali a dica traz o nome do perfil da conta, que é
              // informação nova. No site ela repetiria o aviso do topo da seção,
              // que já cobre nome, telefone e CNPJ.
              dica={canal === 'web' ? undefined : `WhatsApp informou: ${contato?.nome_whatsapp || 'sem nome'}`}
            />
          </div>

          <div>
            <div className="rotulo mb-1">Empresa</div>
            {contato?.cliente_id ? (
              <div className="text-corpo text-tx-1">{nomeEmpresa(contato.cliente) ?? 'Cadastro vinculado'}</div>
            ) : (
              <div className="text-corpo text-tx-2">Sem cadastro. Use Aceitar para vincular a empresa e assumir.</div>
            )}
          </div>

          <div>
            <div className="rotulo mb-1.5">Cargo</div>
            <Entrada
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              onBlur={() => {
                if (contato && cargo.trim() !== (contato.cargo ?? '')) {
                  atualizar.mutate({ id: contato.id, valores: { cargo: cargo.trim() || null } })
                }
              }}
              placeholder="Ex.: Financeiro"
              aria-label="Cargo do contato"
              disabled={anonimizado}
            />
          </div>

          <div>
            <div className="rotulo mb-1">Telefone</div>
            {/*
              O valor cru de um titular anonimizado é `anonimizado:<uuid>`, que
              é chave de banco e não telefone. Mostrá-lo aqui não vaza dado
              pessoal, mas faz o painel parecer quebrado.
            */}
            <div className={anonimizado ? 'text-corpo text-tx-3' : 'dado text-corpo text-tx-1'}>
              {anonimizado ? 'Removido a pedido do titular' : contato?.telefone}
            </div>
          </div>
        </div>
      </SecaoContato>

      <SecaoContato titulo="Tarefas" contagem={tarefas.data?.length ?? 0}>
        <TarefasContato atendimento={atendimento} />
      </SecaoContato>

      <SecaoContato
        titulo="Participantes"
        contagem={(atendimento.responsavel_id ? 1 : 0) + (participantes.lista.data?.length ?? 0)}
      >
        <ParticipantesContato atendimento={atendimento} />
      </SecaoContato>

      {/* Anteriores: o chamado aberto agora não conta, por isso o -1. */}
      <SecaoContato titulo="Histórico" contagem={Math.max((contadores.data?.atendimentos ?? 1) - 1, 0)}>
        <HistoricoContato contatoId={contato?.id ?? null} atendimentoAtualId={atendimento.id} />
      </SecaoContato>

      {/*
        Ação de LGPD no rodapé, só para admin, e depois de tudo: é rara,
        irreversível e não tem nada a ver com atender. Perto de Assumir ou
        Transferir ela seria clique de rotina em algo que não volta.
      */}
      {isAdmin && <EliminarTitular contato={contato} />}
    </aside>
  )
}
