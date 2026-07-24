import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCrud } from '../../lib/useCrud'
import { useVinculos, useUsuarios } from '../../lib/useVinculos'

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

export function HorarioFuncionamento() {
  const horarios = useCrud<Horario>('atendimento_horarios', 'dia_semana')
  const plantoes = useCrud<Plantao>('atendimento_plantoes', 'dia_semana')
  const vinculos = useVinculos('atendimento_plantao_usuarios', 'plantao_id', 'usuario_id')
  const usuarios = useUsuarios()
  const [novo, setNovo] = useState({ nome: '', dia_semana: '1', hora_inicio: '18:00', hora_fim: '21:00' })

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

  const plantonistasDe = (plantaoId: string) =>
    (vinculos.lista.data ?? []).filter((v) => v.plantao_id === plantaoId).map((v) => v.usuario_id)

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <section>
        <h2 className="text-[#ffffff] font-bold text-lg mb-1">Horário comercial</h2>
        <p className="text-[#ffffffb3] text-sm mb-4">
          Fora desses horários o bot usa o plantão, ou avisa que estamos fechados.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-[#ffffff]">
            <thead className="text-[#ffffffb3] text-left">
              <tr>
                <th className="py-2">Dia</th>
                <th>Abre</th>
                <th>Fecha</th>
                <th>Atende</th>
              </tr>
            </thead>
            <tbody>
              {DIAS.map((nome, d) => {
                const h = porDia(d)
                return (
                  <tr key={d} className="border-t border-[#ffffff14]">
                    <td className="py-2">{nome}</td>
                    <td>
                      <input
                        type="time"
                        aria-label={`Abre ${nome}`}
                        value={h?.hora_inicio?.slice(0, 5) ?? '08:00'}
                        onChange={(e) => salvarDia(d, { hora_inicio: e.target.value })}
                        className="bg-[#ffffff14] text-[#ffffff] rounded px-2 py-1"
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        aria-label={`Fecha ${nome}`}
                        value={h?.hora_fim?.slice(0, 5) ?? '18:00'}
                        onChange={(e) => salvarDia(d, { hora_fim: e.target.value })}
                        className="bg-[#ffffff14] text-[#ffffff] rounded px-2 py-1"
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Atende ${nome}`}
                        checked={h?.ativo ?? false}
                        onChange={(e) => salvarDia(d, { ativo: e.target.checked })}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-[#ffffff] font-bold text-lg mb-1">Plantões</h2>
        <p className="text-[#ffffffb3] text-sm mb-4">
          Turnos fora do comercial. Marque quem atende cada turno. Turno sem ninguém marcado faz o bot só avisar o
          horário e mostrar os contatos de emergência (texto na aba Configurações BOT).
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <input
            placeholder="Nome do turno"
            aria-label="Nome do turno"
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
            className="rounded px-3 py-1.5 bg-[#ffffff14] text-[#ffffff]"
          />
          <select
            aria-label="Dia do turno"
            value={novo.dia_semana}
            onChange={(e) => setNovo({ ...novo, dia_semana: e.target.value })}
            className="rounded px-3 py-1.5 bg-[#ffffff14] text-[#ffffff]"
          >
            {DIAS.map((nome, d) => (
              <option key={d} value={d}>
                {nome}
              </option>
            ))}
          </select>
          <input
            type="time"
            aria-label="Início do turno"
            value={novo.hora_inicio}
            onChange={(e) => setNovo({ ...novo, hora_inicio: e.target.value })}
            className="rounded px-2 py-1.5 bg-[#ffffff14] text-[#ffffff]"
          />
          <input
            type="time"
            aria-label="Fim do turno"
            value={novo.hora_fim}
            onChange={(e) => setNovo({ ...novo, hora_fim: e.target.value })}
            className="rounded px-2 py-1.5 bg-[#ffffff14] text-[#ffffff]"
          />
          <button
            onClick={() =>
              plantoes.criar.mutate({
                nome: novo.nome || null,
                dia_semana: Number(novo.dia_semana),
                hora_inicio: novo.hora_inicio,
                hora_fim: novo.hora_fim,
                ativo: true,
              } as Partial<Plantao>)
            }
            className="flex items-center gap-1 rounded bg-[#0078d4] text-[#ffffff] text-sm px-3 py-1.5"
          >
            <Plus size={16} /> Novo turno
          </button>
        </div>

        {(plantoes.lista.data ?? []).length === 0 ? (
          <p className="text-[#ffffffb3]">Nenhum plantão cadastrado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(plantoes.lista.data ?? []).map((p) => {
              const marcados = plantonistasDe(p.id)
              return (
                <div key={p.id} className="rounded border border-[#ffffff1a] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-[#ffffff]">
                      {p.nome ? `${p.nome} · ` : ''}
                      {DIAS[p.dia_semana]} {p.hora_inicio?.slice(0, 5)} às {p.hora_fim?.slice(0, 5)}
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-[#ffffffb3] flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={p.ativo}
                          onChange={(e) => plantoes.atualizar.mutate({ id: p.id, valores: { ativo: e.target.checked } })}
                        />
                        Ativo
                      </label>
                      <button
                        onClick={() => {
                          if (confirm('Remover este turno?')) plantoes.remover.mutate(p.id)
                        }}
                        aria-label="Remover turno"
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(usuarios.data ?? []).map((u) => {
                      const marcado = marcados.includes(u.id)
                      return (
                        <label key={u.id} className="text-sm text-[#ffffffb3] flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() =>
                              marcado
                                ? vinculos.desvincular.mutate({ plantao_id: p.id, usuario_id: u.id })
                                : vinculos.vincular.mutate({ plantao_id: p.id, usuario_id: u.id })
                            }
                          />
                          {u.nome}
                        </label>
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
