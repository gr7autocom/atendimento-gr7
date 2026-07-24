import { useEffect, useState } from 'react'
import { useBotMensagens, useConfig } from '../../lib/useConfig'

const ROTULOS: Record<string, string> = {
  bem_vindo: 'Boas-vindas',
  instrucao_menu: 'Instrução do menu',
  opcao_invalida: 'Opção inválida',
  voltar_menu: 'Voltar ao menu',
  entrou_fila: 'Entrou na fila',
  encaminhado_padrao: 'Encaminhado ao departamento padrão',
  plantao: 'Fora do comercial, em plantão',
  fora_horario: 'Fora de horário (com contatos de emergência)',
  encerramento: 'Encerramento',
  solicitar_avaliacao: 'Pedir avaliação',
  agradecimento_avaliacao: 'Agradecer avaliação',
  avaliacao_invalida: 'Avaliação inválida',
}

const CONFIGS: { chave: string; label: string; tipo: 'numero' | 'booleano' | 'texto' }[] = [
  { chave: 'janela_reabertura_horas', label: 'Janela de reabertura (horas)', tipo: 'numero' },
  { chave: 'max_tentativas_menu', label: 'Tentativas no menu antes de encaminhar', tipo: 'numero' },
  { chave: 'tempo_avaliacao_min', label: 'Tempo para avaliar (minutos)', tipo: 'numero' },
  { chave: 'avaliacao_ativa', label: 'Pedir avaliação ao encerrar', tipo: 'booleano' },
  { chave: 'enviar_nome_atendente', label: 'Enviar o nome do atendente nas respostas', tipo: 'booleano' },
  { chave: 'timezone', label: 'Fuso horário', tipo: 'texto' },
]

export function ConfiguracoesBot() {
  const { lista: mensagens, salvar: salvarMensagem } = useBotMensagens()
  const { lista: config, salvar: salvarConfig } = useConfig()
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [flags, setFlags] = useState<Record<string, string>>({})

  useEffect(() => {
    if (mensagens.data) setTextos(Object.fromEntries(mensagens.data.map((m) => [m.id, m.texto])))
  }, [mensagens.data])

  useEffect(() => {
    if (config.data) setFlags(config.data)
  }, [config.data])

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <section>
        <h2 className="text-[#ffffff] font-bold text-lg mb-1">Mensagens do bot</h2>
        <p className="text-[#ffffffb3] text-sm mb-4">
          Variáveis disponíveis: {'{empresa}'}, {'{contato}'}, {'{protocolo}'}, {'{departamento}'},{' '}
          {'{atendente}'}, {'{horario}'}. O menu de departamentos é montado sozinho, não precisa escrever aqui.
        </p>
        {mensagens.isLoading ? (
          <p className="text-[#ffffffb3]">Carregando…</p>
        ) : (
          <div className="flex flex-col gap-4">
            {(mensagens.data ?? []).map((m) => (
              <div key={m.id} className="flex flex-col gap-1">
                <label className="text-sm text-[#ffffffb3]">{ROTULOS[m.chave] ?? m.chave}</label>
                <textarea
                  value={textos[m.id] ?? ''}
                  onChange={(e) => setTextos((t) => ({ ...t, [m.id]: e.target.value }))}
                  className="rounded px-3 py-2 bg-[#ffffff14] text-[#ffffff] min-h-20"
                />
                <div>
                  <button
                    onClick={() => salvarMensagem.mutate({ id: m.id, texto: textos[m.id] ?? '' })}
                    className="rounded bg-[#0078d4] text-[#ffffff] text-sm px-3 py-1.5"
                  >
                    Salvar mensagem
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[#ffffff] font-bold text-lg mb-4">Comportamento</h2>
        <div className="flex flex-col gap-3">
          {CONFIGS.map((c) => (
            <label key={c.chave} className="flex items-center gap-3 text-sm text-[#ffffffb3]">
              {c.tipo === 'booleano' ? (
                <input
                  type="checkbox"
                  checked={flags[c.chave] === 'true'}
                  onChange={(e) => setFlags((f) => ({ ...f, [c.chave]: String(e.target.checked) }))}
                />
              ) : (
                <input
                  type={c.tipo === 'numero' ? 'number' : 'text'}
                  value={flags[c.chave] ?? ''}
                  onChange={(e) => setFlags((f) => ({ ...f, [c.chave]: e.target.value }))}
                  className="rounded px-3 py-1.5 bg-[#ffffff14] text-[#ffffff] w-48"
                />
              )}
              {c.label}
            </label>
          ))}
          <div>
            <button
              onClick={() => salvarConfig.mutate(flags)}
              className="rounded bg-[#0078d4] text-[#ffffff] text-sm px-3 py-1.5"
            >
              Salvar comportamento
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
