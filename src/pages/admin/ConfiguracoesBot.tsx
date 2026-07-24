import { useEffect, useState } from 'react'
import { useBotMensagens, useConfig } from '../../lib/useConfig'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, Entrada } from '../../components/ui/Campo'
import { LinhasCarregando } from '../../components/ui/Estados'

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

/** Ordem em que o cliente encontra cada mensagem na conversa, não a alfabética. */
const ORDEM_FLUXO = Object.keys(ROTULOS)
const posicaoNoFluxo = (chave: string) => {
  const i = ORDEM_FLUXO.indexOf(chave)
  return i === -1 ? ORDEM_FLUXO.length : i
}

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
    <div className="flex flex-col gap-6 max-w-2xl">
      <section className="rounded-[10px] border border-bd-1 bg-sf-1">
        <div className="px-4 py-3 border-b border-bd-1">
          <h2 className="text-[14px] font-semibold text-tx-1">Mensagens do bot</h2>
          <p className="text-[12px] text-tx-2 mt-0.5">
            Na ordem em que o cliente recebe. Variáveis: <span className="dado">{'{empresa}'}</span>{' '}
            <span className="dado">{'{contato}'}</span> <span className="dado">{'{protocolo}'}</span>{' '}
            <span className="dado">{'{departamento}'}</span> <span className="dado">{'{atendente}'}</span>{' '}
            <span className="dado">{'{horario}'}</span>. O menu de setores é montado sozinho.
          </p>
        </div>

        {mensagens.isLoading ? (
          <LinhasCarregando linhas={4} />
        ) : (
          <div className="p-4 flex flex-col gap-4">
            {[...(mensagens.data ?? [])]
              .sort((a, b) => posicaoNoFluxo(a.chave) - posicaoNoFluxo(b.chave))
              .map((m) => (
                <div key={m.id} className="flex flex-col gap-2">
                  <AreaTexto
                    rotulo={ROTULOS[m.chave] ?? m.chave}
                    value={textos[m.id] ?? ''}
                    onChange={(e) => setTextos((t) => ({ ...t, [m.id]: e.target.value }))}
                  />
                  <div>
                    <Botao
                      variante="neutro"
                      tamanho="sm"
                      onClick={() => salvarMensagem.mutate({ id: m.id, texto: textos[m.id] ?? '' })}
                    >
                      Salvar mensagem
                    </Botao>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className="rounded-[10px] border border-bd-1 bg-sf-1">
        <div className="px-4 py-3 border-b border-bd-1">
          <h2 className="text-[14px] font-semibold text-tx-1">Comportamento</h2>
          <p className="text-[12px] text-tx-2 mt-0.5">Regras que o bot segue durante o atendimento.</p>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {CONFIGS.map((c) =>
            c.tipo === 'booleano' ? (
              <label key={c.chave} className="flex items-center gap-2.5 text-[13px] text-tx-1">
                <input
                  type="checkbox"
                  className="accent-[color:var(--br-1)]"
                  checked={flags[c.chave] === 'true'}
                  onChange={(e) => setFlags((f) => ({ ...f, [c.chave]: String(e.target.checked) }))}
                />
                {c.label}
              </label>
            ) : (
              <div key={c.chave} className="max-w-56">
                <Entrada
                  rotulo={c.label}
                  type={c.tipo === 'numero' ? 'number' : 'text'}
                  value={flags[c.chave] ?? ''}
                  onChange={(e) => setFlags((f) => ({ ...f, [c.chave]: e.target.value }))}
                />
              </div>
            )
          )}
          <div className="pt-1">
            <Botao variante="primario" tamanho="sm" onClick={() => salvarConfig.mutate(flags)}>
              Salvar comportamento
            </Botao>
          </div>
        </div>
      </section>
    </div>
  )
}
