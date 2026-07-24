import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useVinculos, useUsuarios } from '../../lib/useVinculos'
import { Botao } from '../../components/ui/Botao'
import { Entrada, CampoHora } from '../../components/ui/Campo'
import { Tabela, Th, Tr, Td } from '../../components/ui/Tabela'
import { cn } from '../../lib/utils'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type Horario = { id: string; dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean }
type Plantao = {
  id: string
  nome: string | null
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  ativo: boolean
}

const inputHora =
  'h-8 px-2 text-[13px] rounded-[6px] bg-sf-2 border border-bd-2 text-tx-1 hover:border-bd-3 ' +
  'focus:border-br-1 focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)] transition-colors duration-[120ms]'

export function HorarioFuncionamento() {
  const horarios = useCrud<Horario>('atendimento_horarios', 'dia_semana')
  const plantoes = useCrud<Plantao>('atendimento_plantoes', 'dia_semana')
  const vinculos = useVinculos('atendimento_plantao_usuarios', 'plantao_id', 'usuario_id')
  const usuarios = useUsuarios()
  const [novo, setNovo] = useState({
    nome: '',
    dias: [] as number[],
    hora_inicio: '18:00',
    hora_fim: '21:00',
  })

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

  function alternarDiaNovo(d: number) {
    setNovo((n) => ({
      ...n,
      dias: n.dias.includes(d) ? n.dias.filter((x) => x !== d) : [...n.dias, d],
    }))
  }

  /** Cria um turno por dia marcado, com o mesmo nome e horário. */
  function criarTurnos() {
    for (const d of [...novo.dias].sort((a, b) => a - b)) {
      plantoes.criar.mutate({
        nome: novo.nome || null,
        dia_semana: d,
        hora_inicio: novo.hora_inicio,
        hora_fim: novo.hora_fim,
        ativo: true,
      } as Partial<Plantao>)
    }
    setNovo((n) => ({ ...n, nome: '', dias: [] }))
  }

  const plantonistasDe = (plantaoId: string) =>
    (vinculos.lista.data ?? []).filter((v) => v.plantao_id === plantaoId).map((v) => v.usuario_id)

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <section>
        <h2 className="text-[15px] font-semibold text-tx-1">Horário comercial</h2>
        <p className="text-[13px] text-tx-2 mt-0.5 mb-3">
          Fora desses horários o bot usa o plantão, ou avisa que estamos fechados.
        </p>

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
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-tx-1">Plantões</h2>
        <p className="text-[13px] text-tx-2 mt-0.5 mb-3">
          Turnos fora do comercial. Marque quem atende cada turno. Turno sem ninguém marcado faz o bot só avisar o
          horário e mostrar os contatos de emergência (texto na aba Configurações BOT).
        </p>

        <div className="rounded-[10px] border border-bd-1 bg-sf-1 p-3 mb-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-52">
              <Entrada
                rotulo="Nome do turno"
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                aria-label="Nome do turno"
                placeholder="Plantão noite"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-tx-2">Início</span>
              <input
                type="time"
                aria-label="Início do turno"
                value={novo.hora_inicio}
                onChange={(e) => setNovo({ ...novo, hora_inicio: e.target.value })}
                className={cn(inputHora, 'dado h-9')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-tx-2">Fim</span>
              <input
                type="time"
                aria-label="Fim do turno"
                value={novo.hora_fim}
                onChange={(e) => setNovo({ ...novo, hora_fim: e.target.value })}
                className={cn(inputHora, 'dado h-9')}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] text-tx-2 mr-1">Dias:</span>
            {DIAS.map((nome, d) => {
              const marcado = novo.dias.includes(d)
              return (
                <button
                  key={d}
                  onClick={() => alternarDiaNovo(d)}
                  aria-pressed={marcado}
                  aria-label={`Turno em ${nome}`}
                  className={cn(
                    'h-7 w-11 rounded-[6px] text-[12px] border transition-colors duration-[120ms]',
                    marcado
                      ? 'bg-br-soft text-br-2 border-transparent font-medium'
                      : 'bg-sf-2 text-tx-2 border-bd-2 hover:text-tx-1 hover:border-bd-3'
                  )}
                >
                  {nome.slice(0, 3)}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            <Botao
              variante="primario"
              tamanho="sm"
              onClick={criarTurnos}
              disabled={novo.dias.length === 0}
              icone={<Plus size={15} />}
            >
              {novo.dias.length > 1 ? `Criar ${novo.dias.length} turnos` : 'Criar turno'}
            </Botao>
            <span className="text-[12px] text-tx-3">
              {novo.dias.length === 0
                ? 'Marque os dias que esse turno cobre.'
                : 'Depois de criar, marque quem atende em cada dia.'}
            </span>
          </div>
        </div>

        {(plantoes.lista.data ?? []).length === 0 ? (
          <p className="text-[13px] text-tx-3">Nenhum plantão cadastrado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(plantoes.lista.data ?? []).map((p) => {
              const marcados = plantonistasDe(p.id)
              return (
                <div key={p.id} className="rounded-[10px] border border-bd-1 bg-sf-1 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-[13px] text-tx-1">
                      {p.nome && <span className="font-medium">{p.nome} · </span>}
                      {DIAS[p.dia_semana]}{' '}
                      <span className="dado text-tx-2">
                        {p.hora_inicio?.slice(0, 5)}–{p.hora_fim?.slice(0, 5)}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-[12px] text-tx-2 flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="accent-[color:var(--br-1)]"
                          checked={p.ativo}
                          onChange={(e) =>
                            plantoes.atualizar.mutate({ id: p.id, valores: { ativo: e.target.checked } })
                          }
                        />
                        Ativo
                      </label>
                      <Botao
                        variante="perigo"
                        tamanho="sm"
                        aria-label="Remover turno"
                        onClick={() => {
                          if (confirm('Remover este turno?')) plantoes.remover.mutate(p.id)
                        }}
                      >
                        <Trash2 size={15} />
                      </Botao>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(usuarios.data ?? []).map((u) => {
                      const marcado = marcados.includes(u.id)
                      return (
                        <button
                          key={u.id}
                          onClick={() =>
                            marcado
                              ? vinculos.desvincular.mutate({ plantao_id: p.id, usuario_id: u.id })
                              : vinculos.vincular.mutate({ plantao_id: p.id, usuario_id: u.id })
                          }
                          aria-pressed={marcado}
                          className={cn(
                            'h-7 px-2.5 rounded-[6px] text-[12px] border transition-colors duration-[120ms]',
                            marcado
                              ? 'bg-br-soft text-br-2 border-transparent font-medium'
                              : 'bg-sf-2 text-tx-2 border-bd-2 hover:text-tx-1 hover:border-bd-3'
                          )}
                        >
                          {u.nome}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
