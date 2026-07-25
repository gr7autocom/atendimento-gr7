import { useCrud } from '../../lib/useCrud'
import { CampoHora } from '../../components/ui/Campo'
import { Tabela, Th, Tr, Td } from '../../components/ui/Tabela'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { cn } from '../../lib/utils'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type Horario = { id: string; dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean }

export function HorarioFuncionamento() {
  const horarios = useCrud<Horario>('atendimento_horarios', 'dia_semana')

  const porDia = (d: number) => (horarios.lista.data ?? []).find((h) => h.dia_semana === d)

  function salvarDia(d: number, campos: Partial<Horario>) {
    const existente = porDia(d)
    if (existente) {
      horarios.atualizar.mutate({ id: existente.id, valores: campos })
    } else {
      horarios.criar.mutate({
        dia_semana: d,
        hora_inicio: '08:00',
        hora_fim: '18:00',
        ativo: true,
        ...campos,
      } as Partial<Horario>)
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <CabecalhoAdmin
        titulo="Horário comercial"
        descricao="Dentro desse horário qualquer atendente ativo acessa. Fora dele, só quem tem horário de plantão definido no card do atendente."
      />

      <Tabela
        cabecalho={
          <>
            <Th>Dia</Th>
            <Th>Abre</Th>
            <Th>Fecha</Th>
            <Th className="w-20">Atende</Th>
          </>
        }
      >
        {DIAS.map((nome, d) => {
          const h = porDia(d)
          return (
            <Tr key={d}>
              <Td className={cn('font-medium', !h?.ativo && 'text-tx-3')}>{nome}</Td>
              <Td>
                <CampoHora
                  rotuloAcessivel={`Abre ${nome}`}
                  valor={h?.hora_inicio?.slice(0, 5) ?? '08:00'}
                  aoSalvar={(v) => salvarDia(d, { hora_inicio: v })}
                />
              </Td>
              <Td>
                <CampoHora
                  rotuloAcessivel={`Fecha ${nome}`}
                  valor={h?.hora_fim?.slice(0, 5) ?? '18:00'}
                  aoSalvar={(v) => salvarDia(d, { hora_fim: v })}
                />
              </Td>
              <Td>
                <input
                  type="checkbox"
                  className="accent-[color:var(--br-1)]"
                  aria-label={`Atende ${nome}`}
                  checked={h?.ativo ?? false}
                  onChange={(e) => salvarDia(d, { ativo: e.target.checked })}
                />
              </Td>
            </Tr>
          )
        })}
      </Tabela>
    </div>
  )
}
