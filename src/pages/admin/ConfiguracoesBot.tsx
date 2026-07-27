import { useEffect, useState } from 'react'
import { useBotMensagens, useConfig } from '../../lib/useConfig'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, Entrada, Selecao } from '../../components/ui/Campo'
import { LinhasCarregando } from '../../components/ui/Estados'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { Bloco } from '../../components/admin/Bloco'

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

/** Campos numéricos/texto do comportamento, exibidos numa linha. */
const NUMEROS: { chave: string; label: string; tipo: 'number' | 'text' }[] = [
  { chave: 'janela_reabertura_horas', label: 'Reabrir atendimento após (horas)', tipo: 'number' },
  { chave: 'max_tentativas_menu', label: 'Tentativas no menu', tipo: 'number' },
  { chave: 'tempo_avaliacao_min', label: 'Tempo para avaliar (min)', tipo: 'number' },
  { chave: 'timezone', label: 'Fuso horário', tipo: 'text' },
]

/** Chaves booleanas do comportamento. */
const TOGGLES: { chave: string; label: string }[] = [
  { chave: 'avaliacao_ativa', label: 'Pedir avaliação ao encerrar' },
  { chave: 'enviar_nome_atendente', label: 'Enviar o nome do atendente nas respostas' },
  { chave: 'solicitar_motivo_finalizar', label: 'Solicitar motivo ao finalizar' },
  { chave: 'permitir_cliente_finalizar', label: 'Permitir o cliente finalizar (#sair)' },
]

/** Opções de "Controle de potenciais": destino de um contato sem cadastro. */
const CONTROLE_POTENCIAIS: { valor: string; label: string }[] = [
  { valor: 'nunca', label: 'Nunca aparecer em potenciais (vai direto para a fila)' },
  { valor: 'novos_contatos', label: 'Apenas novos contatos (padrão atual)' },
  { valor: 'sem_atendimento', label: 'Contatos que mandaram mensagem e não criaram atendimento' },
]

/** Valores usados enquanto a chave ainda não foi salva no banco. */
const PADROES: Record<string, string> = {
  nome_bot: '',
  controle_potenciais: 'novos_contatos',
  janela_reabertura_horas: '3',
  max_tentativas_menu: '2',
  tempo_avaliacao_min: '60',
  timezone: 'America/Sao_Paulo',
  avaliacao_ativa: 'true',
  enviar_nome_atendente: 'true',
  solicitar_motivo_finalizar: 'true',
  permitir_cliente_finalizar: 'true',
}

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
  const [flags, setFlags] = useState<Record<string, string>>(PADROES)

  useEffect(() => {
    if (mensagens.data) setTextos(Object.fromEntries(mensagens.data.map((m) => [m.id, m.texto])))
  }, [mensagens.data])

  useEffect(() => {
    if (config.data) setFlags({ ...PADROES, ...config.data })
  }, [config.data])

  const setFlag = (chave: string, valor: string) => setFlags((f) => ({ ...f, [chave]: valor }))

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoAdmin
        titulo="Configurações do bot"
        descricao="Defina como o bot se apresenta ao cliente e o que ele faz antes de passar para um atendente."
      />

      <Bloco
        titulo="Comportamento do bot"
        descricao="Nome que o cliente vê, destino dos contatos sem cadastro e as regras de tempo e finalização."
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada
              rotulo="Nome do bot"
              dica="Aparece para o cliente quando nenhum atendente está ativo."
              placeholder="Ex.: GR7 Atendimento"
              value={flags.nome_bot ?? ''}
              onChange={(e) => setFlag('nome_bot', e.target.value)}
            />
            <Selecao
              rotulo="Controle de potenciais"
              dica="O que fazer quando chega um contato sem cadastro."
              value={flags.controle_potenciais ?? 'novos_contatos'}
              onChange={(e) => setFlag('controle_potenciais', e.target.value)}
            >
              {CONTROLE_POTENCIAIS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </Selecao>
          </div>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {NUMEROS.map((c) => (
              <Entrada
                key={c.chave}
                rotulo={c.label}
                type={c.tipo}
                value={flags[c.chave] ?? ''}
                onChange={(e) => setFlag(c.chave, e.target.value)}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
            {TOGGLES.map((c) => (
              <label key={c.chave} className="flex items-center gap-2.5 text-[13px] text-tx-1">
                <input
                  type="checkbox"
                  className="accent-[color:var(--br-1)]"
                  checked={flags[c.chave] === 'true'}
                  onChange={(e) => setFlag(c.chave, String(e.target.checked))}
                />
                {c.label}
              </label>
            ))}
          </div>

          <div className="pt-1">
            <Botao variante="primario" tamanho="sm" onClick={() => salvarConfig.mutate(flags)}>
              Salvar comportamento
            </Botao>
          </div>
        </div>
      </Bloco>

      {/* Bloco dos textos: refino de layout fica para uma etapa própria. */}
      <section className="rounded-[10px] border border-bd-1 bg-sf-1">
        <div className="px-4 py-3 border-b border-bd-1">
          <h2 className="text-[14px] font-semibold text-tx-1">Mensagens do bot</h2>
          <p className="text-[12px] text-tx-2 mt-0.5">
            Na ordem em que o cliente recebe. Variáveis: <span className="dado">{'{{empresa}}'}</span>{' '}
            <span className="dado">{'{{contato}}'}</span> <span className="dado">{'{{protocolo}}'}</span>{' '}
            <span className="dado">{'{{departamento}}'}</span> <span className="dado">{'{{atendente}}'}</span>{' '}
            <span className="dado">{'{{horario}}'}</span>. O menu de setores é montado sozinho.
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
    </div>
  )
}
