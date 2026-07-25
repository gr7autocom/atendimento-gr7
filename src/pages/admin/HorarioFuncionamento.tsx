import { useCrud } from '../../lib/useCrud'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { Bloco } from '../../components/admin/Bloco'
import { GradeHorarios } from '../../components/admin/GradeHorarios'

type Horario = { id: string; dia_semana: number; hora_inicio: string; hora_fim: string; ativo?: boolean }

export function HorarioFuncionamento() {
  const horarios = useCrud<Horario>('atendimento_horarios', 'dia_semana')
  const faixas = (horarios.lista.data ?? []).filter((h) => h.ativo !== false)

  return (
    <div className="w-full">
      <CabecalhoAdmin
        titulo="Horário comercial"
        descricao="Fora deste horário, só quem está de plantão acessa o Atendimento."
      />

      <Bloco
        titulo="Horário de atendimento"
        topicos={[
          'Defina as faixas em que a equipe atende em cada dia.',
          'Dia sem faixa fica fechado. O bot avisa que está fora de horário.',
          'Para atender 24 horas, preencha De 00:00 e Até 00:00.',
        ]}
      >
        <GradeHorarios
          faixas={faixas}
          aoAdicionar={(dia) =>
            horarios.criar.mutate({ dia_semana: dia, hora_inicio: '08:00', hora_fim: '18:00', ativo: true })
          }
          aoAtualizar={(id, valores) => horarios.atualizar.mutate({ id, valores })}
          aoRemover={(id) => horarios.remover.mutate(id)}
        />
      </Bloco>
    </div>
  )
}
