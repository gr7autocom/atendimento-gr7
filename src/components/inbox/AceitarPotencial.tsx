import { useState } from 'react'
import {
  useClientes,
  useAtualizarContato,
  useAcoesAtendimento,
  nomeEmpresa,
  type AtendimentoLista,
} from '../../lib/useInbox'
import { useCrud } from '../../lib/useCrud'
import { Modal } from '../ui/Modal'
import { Botao } from '../ui/Botao'
import { Entrada, Selecao } from '../ui/Campo'
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
    <Modal titulo="Aceitar chamado" aberto={aberto} onFechar={onFechar}>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-tx-2">
          Este contato ainda não tem empresa vinculada. Escolha a empresa e o setor para assumir o atendimento.
        </p>

        <Entrada
          rotulo="Empresa"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Digite ao menos 2 letras do nome"
          aria-label="Buscar empresa"
        />

        {busca.trim().length >= 2 && (
          <div className="max-h-40 overflow-y-auto rounded-[6px] border border-bd-2 bg-sf-2">
            {clientes.isLoading ? (
              <p className="text-[13px] text-tx-3 p-2.5">Buscando…</p>
            ) : (clientes.data ?? []).length === 0 ? (
              <p className="text-[13px] text-tx-3 p-2.5">
                Nenhuma empresa encontrada. O cadastro novo é feito no painel.
              </p>
            ) : (
              (clientes.data ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setEmpresaId(c.id)}
                  className={cn(
                    'w-full text-left px-2.5 py-2 text-[13px] transition-colors duration-[120ms]',
                    empresaId === c.id ? 'bg-br-soft text-br-2 font-medium' : 'text-tx-1 hover:bg-sf-3'
                  )}
                >
                  {nomeEmpresa(c) ?? 'Sem nome'}
                </button>
              ))
            )}
          </div>
        )}

        {empresaEscolhida && (
          <p className="text-[13px] text-tx-1">
            Empresa escolhida: <span className="font-medium">{nomeEmpresa(empresaEscolhida)}</span>
          </p>
        )}

        <Selecao
          rotulo="Setor"
          value={departamentoId}
          onChange={(e) => setDepartamentoId(e.target.value)}
          aria-label="Setor"
        >
          <option value="">Selecionar</option>
          {(departamentos.lista.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </Selecao>

        {erro && <p className="text-[13px] text-err">{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={aceitar} disabled={!empresaId || !departamentoId}>
            Aceitar e assumir
          </Botao>
        </div>
      </div>
    </Modal>
  )
}
