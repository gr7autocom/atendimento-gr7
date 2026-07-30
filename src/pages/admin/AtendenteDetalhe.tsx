import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Clock } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useVinculos, useUsuarios } from '../../lib/useVinculos'
import { useHorariosAcesso } from '../../lib/useHorariosAcesso'
import { Avatar } from '../../components/ui/Avatar'
import { Selo } from '../../components/ui/Selo'
import { Skeleton } from '../../components/ui/Estados'
import { GradeHorarios } from '../../components/admin/GradeHorarios'
import { Abas, PainelAba, type AbaItem } from '../../components/admin/Abas'
import { cn } from '../../lib/utils'

type Departamento = { id: string; nome: string; ativo?: boolean }
type Aba = 'departamentos' | 'plantao'

const ABAS: AbaItem<Aba>[] = [
  { id: 'departamentos', label: 'Departamentos', icone: Building2 },
  { id: 'plantao', label: 'Plantão', icone: Clock },
]

export function AtendenteDetalhe() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const usuarios = useUsuarios(true)
  const departamentos = useCrud<Departamento>('departamentos', 'ordem')
  const vinculos = useVinculos('atendente_departamentos', 'usuario_id', 'departamento_id')
  const horarios = useHorariosAcesso()
  const [aba, setAba] = useState<Aba>('departamentos')

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
          className="inline-flex items-center gap-1.5 text-corpo text-tx-2 hover:text-tx-1"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <p className="mt-6 text-corpo-lg text-tx-3">Atendente não encontrado.</p>
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
            className="w-8 h-8 shrink-0 rounded-1 flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 transicao"
          >
            <ArrowLeft size={18} />
          </button>
          <Avatar nome={usuario.nome} fotoUrl={usuario.foto_url} tamanho={40} />
          <div className="min-w-0">
            <h1 className="text-titulo font-semibold text-tx-1 truncate">{usuario.nome}</h1>
            <p className="text-apoio text-tx-3 truncate">{usuario.email}</p>
          </div>
        </div>
        <Selo tom={usuario.ativo ? 'ok' : 'neutro'}>{usuario.ativo ? 'Ativo' : 'Inativo'}</Selo>
      </div>

      <Abas abas={ABAS} ativo={aba} aoSelecionar={setAba} idGrupo="atendente" rotulo="Seções do atendente" />

      {aba === 'departamentos' ? (
        <PainelAba
          idGrupo="atendente"
          aba="departamentos"
          topicos={[
            'Marque os departamentos que este atendente atende.',
            'Ele só vê as filas dos departamentos marcados.',
          ]}
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
                    'h-8 px-3 rounded-1 text-corpo border transicao',
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
        </PainelAba>
      ) : (
        <PainelAba
          idGrupo="atendente"
          aba="plantao"
          topicos={[
            'Defina as faixas em que o atendente atende fora do horário comercial.',
            'Sem faixa definida, vale apenas o horário comercial.',
            'Para plantão 24 horas, preencha De 00:00 e Até 00:00.',
          ]}
        >
          <GradeHorarios
            adicionando={horarios.adicionar.isPending}
            faixas={(horarios.lista.data ?? []).filter((f) => f.usuario_id === id)}
            aoAdicionar={(dia) =>
              horarios.adicionar.mutate({ usuario_id: id, dia_semana: dia, hora_inicio: '18:00', hora_fim: '22:00' })
            }
            aoAtualizar={(fid, valores) => horarios.atualizar.mutate({ id: fid, valores })}
            aoRemover={(fid) => horarios.remover.mutate(fid)}
          />
        </PainelAba>
      )}
    </div>
  )
}
