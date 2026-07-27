import { useEffect, useState } from 'react'
import { useBotMensagens, useConfig } from '../../lib/useConfig'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, Entrada, Selecao } from '../../components/ui/Campo'
import { LinhasCarregando } from '../../components/ui/Estados'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { Bloco } from '../../components/admin/Bloco'

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

/** Variáveis que o bot troca pelo dado real ao enviar. */
const VARIAVEIS: { chave: string; desc: string }[] = [
  { chave: 'empresa', desc: 'nome da empresa' },
  { chave: 'contato', desc: 'nome do cliente' },
  { chave: 'protocolo', desc: 'número do protocolo' },
  { chave: 'departamento', desc: 'setor escolhido' },
  { chave: 'atendente', desc: 'nome do atendente' },
  { chave: 'horario', desc: 'horário de atendimento' },
]

/** Mensagens do bot agrupadas por sessão, na ordem em que o cliente as encontra. */
const SESSOES: { titulo: string; itens: { chave: string; label: string; dica?: string }[] }[] = [
  {
    titulo: 'Gerais',
    itens: [
      { chave: 'bem_vindo', label: 'Mensagem de boas-vindas', dica: 'Primeiro contato do cliente.' },
      { chave: 'instrucao_menu', label: 'Escolha de departamento', dica: 'Pede o número do setor.' },
      { chave: 'voltar_menu', label: 'Voltar ao menu', dica: 'Como voltar ao menu principal.' },
      { chave: 'opcao_invalida', label: 'Opção inválida', dica: 'Quando o cliente digita algo fora do menu.' },
    ],
  },
  {
    titulo: 'Atendimento',
    itens: [
      { chave: 'entrou_fila', label: 'Abertura de protocolo', dica: 'Quando o protocolo é aberto.' },
      {
        chave: 'encaminhado_padrao',
        label: 'Encaminhado ao departamento padrão',
        dica: 'Enviada quando o cliente não escolhe o setor e cai no padrão.',
      },
      { chave: 'encerramento', label: 'Atendimento finalizado', dica: 'Ao finalizar o atendimento.' },
      { chave: 'fora_horario', label: 'Fora do horário comercial', dica: 'Fora do horário, sem plantão.' },
      { chave: 'plantao', label: 'Fora do horário comercial (plantão)', dica: 'Fora do comercial, com plantão ativo.' },
      { chave: 'solicitar_avaliacao', label: 'Solicitação de avaliação', dica: 'Pedida ao encerrar, se a avaliação estiver ativa.' },
      { chave: 'agradecimento_avaliacao', label: 'Agradecimento pela avaliação', dica: 'Depois que o cliente dá a nota.' },
      {
        chave: 'avaliacao_invalida',
        label: 'Erro sem avaliação',
        dica: 'Enviada se o cliente não avalia e manda outra mensagem.',
      },
    ],
  },
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

  const porChave = Object.fromEntries((mensagens.data ?? []).map((m) => [m.chave, m]))

  async function salvarMensagens() {
    const originais = Object.fromEntries((mensagens.data ?? []).map((m) => [m.id, m.texto]))
    const alteradas = Object.entries(textos).filter(([id, t]) => t !== originais[id])
    await Promise.all(alteradas.map(([id, texto]) => salvarMensagem.mutateAsync({ id, texto })))
  }
  function descartarMensagens() {
    setTextos(Object.fromEntries((mensagens.data ?? []).map((m) => [m.id, m.texto])))
  }

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

      <Bloco
        titulo="Mensagens automáticas"
        descricao="Escreva entre chaves as variáveis; o bot troca pelo dado real ao enviar. O menu de setores é montado sozinho."
      >
        {mensagens.isLoading ? (
          <LinhasCarregando linhas={6} />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-tx-2">
              {VARIAVEIS.map((v) => (
                <span key={v.chave} className="flex items-center gap-1.5">
                  <span className="dado text-tx-1">{`{{${v.chave}}}`}</span>
                  {v.desc}
                </span>
              ))}
            </div>

            {SESSOES.map((sessao) => (
              <div key={sessao.titulo}>
                <h3 className="text-[13px] font-semibold text-tx-1 mb-3">{sessao.titulo}</h3>
                <div className="grid gap-4 lg:grid-cols-2 items-start">
                  {sessao.itens.map((item) => {
                    const m = porChave[item.chave]
                    if (!m) return null
                    return (
                      <AreaTexto
                        key={item.chave}
                        rotulo={item.label}
                        dica={item.dica}
                        value={textos[m.id] ?? ''}
                        onChange={(e) => setTextos((t) => ({ ...t, [m.id]: e.target.value }))}
                      />
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 pt-1">
              <Botao
                variante="primario"
                tamanho="sm"
                onClick={salvarMensagens}
                disabled={salvarMensagem.isPending}
              >
                Salvar mensagens
              </Botao>
              <Botao variante="neutro" tamanho="sm" onClick={descartarMensagens}>
                Descartar
              </Botao>
            </div>
          </div>
        )}
      </Bloco>
    </div>
  )
}
