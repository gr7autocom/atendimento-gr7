import { Users, Building2 } from 'lucide-react'
import { useAtendimentos, type AtendimentoLista } from '../lib/useInbox'
import { useUsuarios } from '../lib/useVinculos'
import { useCrud } from '../lib/useCrud'
import { Tabela, Th, Tr, Td } from '../components/ui/Tabela'
import { LinhasCarregando } from '../components/ui/Estados'

type Departamento = { id: string; nome: string; ativo: boolean }

const semCadastro = (a: AtendimentoLista) => !a.contato?.cliente_id

export function Dashboard() {
  const atendimentos = useAtendimentos()
  const usuarios = useUsuarios()
  const departamentos = useCrud<Departamento>('departamentos', 'ordem')

  const lista = (atendimentos.data ?? []).filter((a) => a.status !== 'finalizado')
  const ativos = lista.filter((a) => a.status === 'em_atendimento' && a.responsavel_id)
  const pendentes = lista.filter((a) => a.status === 'na_fila' && !a.responsavel_id && !semCadastro(a))
  const potenciais = lista.filter((a) => !a.responsavel_id && semCadastro(a))

  // Métricas ainda sem origem de dados (dependem de presença/leitura/uazapi): ficam em 0.
  const cards = [
    { rotulo: 'Atendentes online', valor: 0 },
    { rotulo: 'Potenciais', valor: potenciais.length },
    { rotulo: 'Novas mensagens', valor: 0 },
    { rotulo: 'Atendimentos ativos', valor: ativos.length },
    { rotulo: 'Atendimentos pendentes', valor: pendentes.length },
    { rotulo: 'Retornos', valor: 0 },
  ]

  const porDepartamento = (departamentos.lista.data ?? []).map((d) => ({
    nome: d.nome,
    ativos: ativos.filter((a) => a.departamento_id === d.id).length,
    pendentes: pendentes.filter((a) => a.departamento_id === d.id).length,
  }))

  const porAtendente = (usuarios.data ?? [])
    .map((u) => ({ nome: u.nome, ativos: ativos.filter((a) => a.responsavel_id === u.id).length }))
    .filter((u) => u.ativos > 0)
    .sort((a, b) => b.ativos - a.ativos)

  const carregando = atendimentos.isLoading || departamentos.lista.isLoading

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-sf-0">
      <div className="p-5 sm:p-6 max-w-5xl flex flex-col gap-6">
        <div>
          <h1 className="text-[16px] font-semibold text-tx-1">Supervisão</h1>
          <p className="text-[13px] text-tx-2 mt-0.5">Visão geral dos atendimentos da equipe.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {cards.map((c) => (
            <div key={c.rotulo} className="rounded-[10px] border border-bd-1 bg-sf-1 p-3">
              <div className="rotulo text-tx-3">{c.rotulo}</div>
              <div className="dado text-[24px] font-medium text-tx-1 leading-tight mt-1">{c.valor}</div>
            </div>
          ))}
        </div>

        <section>
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-tx-2" />
            <h2 className="text-[14px] font-semibold text-tx-1">Por departamento</h2>
          </div>
          {carregando ? (
            <LinhasCarregando linhas={4} />
          ) : (
            <Tabela
              cabecalho={
                <>
                  <Th>Departamento</Th>
                  <Th className="w-28">Ativos</Th>
                  <Th className="w-28">Pendentes</Th>
                  <Th className="w-28">Retornos</Th>
                </>
              }
            >
              {porDepartamento.map((d) => (
                <Tr key={d.nome}>
                  <Td className="font-medium">{d.nome}</Td>
                  <Td className="dado">{d.ativos}</Td>
                  <Td className="dado">{d.pendentes}</Td>
                  <Td className="dado">0</Td>
                </Tr>
              ))}
            </Tabela>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-tx-2" />
            <h2 className="text-[14px] font-semibold text-tx-1">Por atendente</h2>
          </div>
          {carregando ? (
            <LinhasCarregando linhas={3} />
          ) : porAtendente.length === 0 ? (
            <p className="text-[13px] text-tx-3">Ninguém com atendimento ativo no momento.</p>
          ) : (
            <Tabela
              cabecalho={
                <>
                  <Th>Atendente</Th>
                  <Th className="w-28">Ativos</Th>
                  <Th className="w-28">Novas mensagens</Th>
                  <Th className="w-28">Retornos</Th>
                </>
              }
            >
              {porAtendente.map((u) => (
                <Tr key={u.nome}>
                  <Td className="font-medium">{u.nome}</Td>
                  <Td className="dado">{u.ativos}</Td>
                  <Td className="dado">0</Td>
                  <Td className="dado">0</Td>
                </Tr>
              ))}
            </Tabela>
          )}
        </section>
      </div>
    </div>
  )
}
