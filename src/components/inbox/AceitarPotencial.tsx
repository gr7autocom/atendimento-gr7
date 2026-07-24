import { useState } from 'react'
import {
  useClientes,
  useAtualizarContato,
  useAcoesAtendimento,
  nomeEmpresa,
  type AtendimentoLista,
} from '../../lib/useInbox'
import { useCrud } from '../../lib/useCrud'
import { AdminModal } from '../admin/AdminModal'
import { cn } from '../../lib/utils'

type Departamento = { id: string; nome: string; ativo: boolean }

/**
 * Fluxo do contato sem cadastro: o atendente vincula a empresa, escolhe o setor
 * e assume o chamado de uma vez. Usa a RPC de transferência para setor +
 * responsável, evitando o problema do RETURNING com a policy de SELECT.
 */
export function AceitarPotencial({
  atendimento,
  usuarioId,
  aberto,
  onFechar,
}: {
  atendimento: AtendimentoLista
  usuarioId: string | null
  aberto: boolean
  onFechar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [departamentoId, setDepartamentoId] = useState(atendimento.departamento_id ?? '')
  const [erro, setErro] = useState<string | null>(null)

  const clientes = useClientes(busca)
  const departamentos = useCrud<Departamento>('departamentos')
  const atualizarContato = useAtualizarContato()
  const { transferir } = useAcoesAtendimento()

  const empresaEscolhida = (clientes.data ?? []).find((c) => c.id === empresaId)

  async function aceitar() {
    if (!atendimento.contato || !usuarioId) return
    setErro(null)
    try {
      await atualizarContato.mutateAsync({
        id: atendimento.contato.id,
        valores: { cliente_id: empresaId },
      })
      await transferir.mutateAsync({
        id: atendimento.id,
        paraDepartamentoId: departamentoId || null,
        paraUsuarioId: usuarioId,
      })
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível aceitar o chamado.')
    }
  }

  return (
    <AdminModal titulo="Aceitar chamado" aberto={aberto} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[#ffffffb3]">
          Este contato ainda não tem empresa vinculada. Escolha a empresa e o setor para assumir o atendimento.
        </p>

        <label className="flex flex-col gap-1 text-sm text-[#ffffffb3]">
          Empresa
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite ao menos 2 letras do nome"
            aria-label="Buscar empresa"
            className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff]"
          />
        </label>

        {busca.trim().length >= 2 && (
          <div className="max-h-40 overflow-y-auto rounded border border-[#ffffff1a]">
            {clientes.isLoading ? (
              <p className="text-[#ffffffb3] text-sm p-2">Buscando…</p>
            ) : (clientes.data ?? []).length === 0 ? (
              <p className="text-[#ffffffb3] text-sm p-2">
                Nenhuma empresa encontrada. O cadastro novo é feito no painel.
              </p>
            ) : (
              (clientes.data ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setEmpresaId(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm text-[#ffffff]',
                    empresaId === c.id ? 'bg-[#0078d4]' : 'hover:bg-[#ffffff14]'
                  )}
                >
                  {nomeEmpresa(c) ?? 'Sem nome'}
                </button>
              ))
            )}
          </div>
        )}

        {empresaEscolhida && (
          <p className="text-sm text-[#ffffff]">Empresa: {nomeEmpresa(empresaEscolhida)}</p>
        )}

        <label className="flex flex-col gap-1 text-sm text-[#ffffffb3]">
          Setor
          <select
            value={departamentoId}
            onChange={(e) => setDepartamentoId(e.target.value)}
            aria-label="Setor"
            className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff]"
          >
            <option value="">Selecionar</option>
            {(departamentos.lista.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </label>

        {erro && <p className="text-red-400 text-sm">{erro}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onFechar} className="px-3 py-1.5 text-[#ffffffb3]">
            Cancelar
          </button>
          <button
            onClick={aceitar}
            disabled={!empresaId || !departamentoId}
            className="rounded bg-[#0078d4] text-[#ffffff] px-3 py-1.5 disabled:opacity-50"
          >
            Aceitar e assumir
          </button>
        </div>
      </div>
    </AdminModal>
  )
}
