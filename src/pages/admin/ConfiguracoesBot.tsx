import { useEffect, useState } from 'react'
import { Settings2, Headset, UserPlus } from 'lucide-react'
import { useBotMensagens, useConfig } from '../../lib/useConfig'
import { cn } from '../../lib/utils'
import { Botao } from '../../components/ui/Botao'
import { AreaTexto, Entrada, Selecao } from '../../components/ui/Campo'
import { LinhasCarregando } from '../../components/ui/Estados'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'

type Aba = 'geral' | 'atendimento' | 'potenciais'

const ABAS: { id: Aba; label: string; icone: typeof Settings2 }[] = [
  { id: 'geral', label: 'Geral', icone: Settings2 },
  { id: 'atendimento', label: 'Atendimento', icone: Headset },
  { id: 'potenciais', label: 'Potenciais', icone: UserPlus },
]

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

/** Rótulo e dica de cada mensagem, por chave. */
const MSG: Record<string, { label: string; dica: string }> = {
  bem_vindo: { label: 'Mensagem de boas-vindas', dica: 'Primeiro contato do cliente.' },
  instrucao_menu: { label: 'Escolha de departamento', dica: 'Pede o número do setor.' },
  voltar_menu: { label: 'Voltar ao menu', dica: 'Como voltar ao menu principal.' },
  opcao_invalida: { label: 'Opção inválida', dica: 'Quando o cliente digita algo fora do menu.' },
  entrou_fila: { label: 'Abertura de protocolo', dica: 'Quando o protocolo é aberto.' },
  encaminhado_padrao: {
    label: 'Encaminhado ao departamento padrão',
    dica: 'Quando o cliente não escolhe o setor e cai no padrão.',
  },
  encerramento: { label: 'Atendimento finalizado', dica: 'Ao finalizar o atendimento.' },
  fora_horario: { label: 'Fora do horário comercial', dica: 'Fora do horário, sem plantão.' },
  plantao: { label: 'Fora do horário comercial (plantão)', dica: 'Fora do comercial, com plantão ativo.' },
  solicitar_avaliacao: { label: 'Solicitação de avaliação', dica: 'Pedida ao encerrar, se a avaliação estiver ativa.' },
  agradecimento_avaliacao: { label: 'Agradecimento pela avaliação', dica: 'Depois que o cliente dá a nota.' },
  avaliacao_invalida: { label: 'Erro sem avaliação', dica: 'Enviada se o cliente não avalia e manda outra mensagem.' },
  pedir_identificacao: {
    label: 'Pedir identificação',
    dica: 'Enviada a um contato sem cadastro, antes do menu (nome + empresa + CNPJ).',
  },
  identificacao_vinculada: {
    label: 'Identificação vinculada',
    dica: 'Enviada quando o CNPJ do cliente casa com a base e o vínculo é feito sozinho.',
  },
}

const MSGS_GERAIS = ['bem_vindo', 'instrucao_menu', 'voltar_menu', 'opcao_invalida']
const MSGS_ATENDIMENTO = [
  'entrou_fila',
  'encaminhado_padrao',
  'encerramento',
  'fora_horario',
  'plantao',
  'solicitar_avaliacao',
  'agradecimento_avaliacao',
  'avaliacao_invalida',
]
const MSGS_POTENCIAIS = ['pedir_identificacao', 'identificacao_vinculada']

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
  const [aba, setAba] = useState<Aba>('geral')
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

  async function salvarTudo() {
    await salvarConfig.mutateAsync(flags)
    const originais = Object.fromEntries((mensagens.data ?? []).map((m) => [m.id, m.texto]))
    const alteradas = Object.entries(textos).filter(([id, t]) => t !== originais[id])
    await Promise.all(alteradas.map(([id, texto]) => salvarMensagem.mutateAsync({ id, texto })))
  }
  function descartar() {
    if (config.data) setFlags({ ...PADROES, ...config.data })
    if (mensagens.data) setTextos(Object.fromEntries(mensagens.data.map((m) => [m.id, m.texto])))
  }

  const salvando = salvarConfig.isPending || salvarMensagem.isPending

  const CampoMensagem = ({ chave }: { chave: string }) => {
    const m = porChave[chave]
    if (!m) return null
    const meta = MSG[chave]
    return (
      <AreaTexto
        rotulo={meta?.label ?? chave}
        dica={meta?.dica}
        value={textos[m.id] ?? ''}
        onChange={(e) => setTextos((t) => ({ ...t, [m.id]: e.target.value }))}
      />
    )
  }

  const LegendaVariaveis = () => (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-tx-2">
      {VARIAVEIS.map((v) => (
        <span key={v.chave} className="flex items-center gap-1.5">
          <span className="dado text-tx-1">{`{{${v.chave}}}`}</span>
          {v.desc}
        </span>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoAdmin
        titulo="Configurações do bot"
        descricao="Defina como o bot se apresenta ao cliente e o que ele faz antes de passar para um atendente."
      />

      <div className="flex flex-wrap gap-1">
        {ABAS.map((a) => {
          const Icone = a.icone
          const ativo = aba === a.id
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={cn(
                'flex items-center gap-2 h-9 px-3.5 rounded-[8px] text-[13px] font-medium transition-colors duration-[120ms]',
                ativo ? 'bg-br-1 text-white' : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
              )}
            >
              <Icone size={15} />
              {a.label}
            </button>
          )
        })}
      </div>

      <div className="rounded-[10px] border border-bd-1 bg-sf-1 p-5">
        {mensagens.isLoading ? (
          <LinhasCarregando linhas={6} />
        ) : aba === 'geral' ? (
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-5">
              <h3 className="text-[13px] font-semibold text-tx-1">Comportamento</h3>
              <div className="sm:max-w-md">
                <Entrada
                  rotulo="Nome do bot"
                  dica="Aparece para o cliente quando nenhum atendente está ativo."
                  placeholder="Ex.: GR7 Atendimento"
                  value={flags.nome_bot ?? ''}
                  onChange={(e) => setFlag('nome_bot', e.target.value)}
                />
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
              <div className="flex flex-wrap gap-x-6 gap-y-3">
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
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-[13px] font-semibold text-tx-1">Mensagens gerais</h3>
              <LegendaVariaveis />
              <div className="grid gap-4 lg:grid-cols-2 items-start">
                {MSGS_GERAIS.map((chave) => (
                  <CampoMensagem key={chave} chave={chave} />
                ))}
              </div>
            </div>
          </div>
        ) : aba === 'atendimento' ? (
          <div className="flex flex-col gap-4">
            <LegendaVariaveis />
            <div className="grid gap-4 lg:grid-cols-2 items-start">
              {MSGS_ATENDIMENTO.map((chave) => (
                <CampoMensagem key={chave} chave={chave} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            <div className="sm:max-w-2xl">
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

            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-[13px] font-semibold text-tx-1">Identificação do cliente</h3>
                <p className="text-[12px] text-tx-2 mt-0.5">
                  Contato sem cadastro cai em Potenciais sem empresa. O bot pede estes dados antes do menu para o
                  atendente não receber um potencial em branco.
                </p>
              </div>
              <LegendaVariaveis />
              <div className="grid gap-4 lg:grid-cols-2 items-start">
                {MSGS_POTENCIAIS.map((chave) => (
                  <CampoMensagem key={chave} chave={chave} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Botao variante="neutro" tamanho="sm" onClick={descartar} disabled={salvando}>
          Descartar
        </Botao>
        <Botao variante="primario" tamanho="sm" onClick={salvarTudo} disabled={salvando}>
          Salvar alterações
        </Botao>
      </div>
    </div>
  )
}
