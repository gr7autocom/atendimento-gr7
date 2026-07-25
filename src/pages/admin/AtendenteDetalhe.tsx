import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useVinculos, useUsuarios } from '../../lib/useVinculos'
import { useHorariosAcesso } from '../../lib/useHorariosAcesso'
import { Avatar } from '../../components/ui/Avatar'
import { Selo } from '../../components/ui/Selo'
import { Skeleton } from '../../components/ui/Estados'
import { GradeHorarios } from '../../components/admin/GradeHorarios'
import { Bloco } from '../../components/admin/Bloco'
import { cn } from '../../lib/utils'

type Departamento = { id: string; nome: string; ativo?: boolean }

export function AtendenteDetalhe() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const usuarios = useUsuarios(true)
  const departamentos = useCrud<Departamento>('departamentos', 'ordem')
  const vinculos = useVinculos('atendente_departamentos', 'usuario_id', 'departamento_id')
  const horarios = useHorariosAcesso()

  const usuario = (usuarios.data ?? []).find((u) => u.id === id) ?? null
  const deps = departamentos.lista.data ?? []
  const marcados = (vinculos.lista.data ?? []).filter((v) => v.usuario_id === id).map((v) => v.departamento_id)

  if (usuarios.isLoading) {
    return (
      <div className="w-full flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  if (!usuario) {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => navigate('/admin/usuarios')}
          className="inline-flex items-center gap-1.5 text-[13px] text-tx-2 hover:text-tx-1"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <p className="mt-6 text-sm text-tx-3">Atendente não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/admin/usuarios')}
            aria-label="Voltar"
            className="w-8 h-8 shrink-0 rounded-[6px] flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <Avatar nome={usuario.nome} fotoUrl={usuario.foto_url} tamanho={40} />
          <div className="min-w-0">
            <h1 className="text-[16px] font-semibold text-tx-1 truncate">{usuario.nome}</h1>
            <p className="text-[12px] text-tx-3 truncate">{usuario.email}</p>
          </div>
        </div>
        <Selo tom={usuario.ativo ? 'ok' : 'neutro'}>{usuario.ativo ? 'Ativo' : 'Inativo'}</Selo>
      </div>

      <Bloco
        titulo="Departamentos que atende"
        descricao="Marque os departamentos que o atendente atende. É isso que define as filas que ele vê."
      >
        <div className="flex flex-wrap gap-1.5">
          {deps.map((d) => {
            const marcado = marcados.includes(d.id)
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={marcado}
                onClick={() =>
                  marcado
                    ? vinculos.desvincular.mutate({ usuario_id: id, departamento_id: d.id })
                    : vinculos.vincular.mutate({ usuario_id: id, departamento_id: d.id })
                }
                className={cn(
                  'h-8 px-3 rounded-[6px] text-[13px] border transition-colors duration-[120ms]',
                  marcado
                    ? 'bg-br-soft text-br-2 border-transparent font-medium'
                    : 'bg-sf-2 text-tx-2 border-bd-2 hover:text-tx-1 hover:border-bd-3'
                )}
              >
                {d.nome}
              </button>
            )
          })}
        </div>
      </Bloco>

      <Bloco
        titulo="Horário de plantão"
        topicos={[
          'Defina as faixas em que o atendente atende fora do horário comercial.',
          'Sem faixa definida, vale apenas o horário comercial.',
          'Para plantão 24 horas, preencha De 00:00 e Até 00:00.',
        ]}
      >
        <GradeHorarios
          faixas={(horarios.lista.data ?? []).filter((f) => f.usuario_id === id)}
          aoAdicionar={(dia) =>
            horarios.adicionar.mutate({ usuario_id: id, dia_semana: dia, hora_inicio: '18:00', hora_fim: '22:00' })
          }
          aoAtualizar={(fid, valores) => horarios.atualizar.mutate({ id: fid, valores })}
          aoRemover={(fid) => horarios.remover.mutate(fid)}
        />
      </Bloco>
    </div>
  )
}
