import { Plus, X } from 'lucide-react'
import { CampoHora } from '../ui/Campo'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type FaixaBase = { id: string; dia_semana: number; hora_inicio: string; hora_fim: string }

/**
 * Grade de horários em 7 colunas (um dia por coluna), no layout do Zintech.
 * Usada na tela de departamento e na de atendente. Campos De/Até largos, em HH:MM.
 */
export function GradeHorarios({
  faixas,
  aoAdicionar,
  aoAtualizar,
  aoRemover,
  adicionando = false,
}: {
  faixas: FaixaBase[]
  aoAdicionar: (dia: number) => void
  /** Trava o "+ horário" enquanto a faixa está sendo criada: clique duplo
   *  criava duas faixas iguais no mesmo dia. */
  adicionando?: boolean
  aoAtualizar: (id: string, valores: { hora_inicio?: string; hora_fim?: string }) => void
  aoRemover: (id: string) => void
}) {
  const faixasDe = (dia: number) =>
    faixas.filter((f) => f.dia_semana === dia).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {DIAS.map((nomeDia, dia) => {
        const fs = faixasDe(dia)
        return (
          <div key={dia} className="rounded-2 border border-bd-1 bg-sf-0 p-2 flex flex-col gap-2">
            <div className="text-mini font-semibold uppercase tracking-wide text-tx-2 text-center">{nomeDia}</div>
            <button
              type="button"
              onClick={() => aoAdicionar(dia)}
              disabled={adicionando}
              className="inline-flex items-center justify-center gap-1 h-8 rounded-1 border border-bd-2 text-apoio text-br-2 hover:bg-br-soft transicao disabled:opacity-45 disabled:pointer-events-none"
            >
              <Plus size={14} /> horário
            </button>
            {fs.map((fx) => (
              <div key={fx.id} className="relative rounded-1 bg-sf-2 border border-bd-1 p-2 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => aoRemover(fx.id)}
                  aria-label={`Remover faixa de ${nomeDia}`}
                  // 24x24 é o mínimo da WCAG 2.2 para alvo de toque; em 20 era
                  // fácil errar o clique e apagar a faixa errada no celular.
                  className="absolute top-1 right-1 w-6 h-6 rounded-micro flex items-center justify-center text-tx-3 hover:text-err hover:bg-err-soft transicao"
                >
                  <X size={13} />
                </button>
                <label className="flex flex-col gap-0.5">
                  <span className="text-mini text-tx-3">De</span>
                  <CampoHora
                    rotuloAcessivel={`Início ${nomeDia}`}
                    valor={fx.hora_inicio.slice(0, 5)}
                    aoSalvar={(v) => aoAtualizar(fx.id, { hora_inicio: v })}
                    className="w-full"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-mini text-tx-3">Até</span>
                  <CampoHora
                    rotuloAcessivel={`Fim ${nomeDia}`}
                    valor={fx.hora_fim.slice(0, 5)}
                    aoSalvar={(v) => aoAtualizar(fx.id, { hora_fim: v })}
                    className="w-full"
                  />
                </label>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
