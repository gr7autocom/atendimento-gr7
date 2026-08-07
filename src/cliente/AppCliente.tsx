import { useEffect, useState } from 'react'
import { Identificacao, type DadosIdentificacao } from './Identificacao'
import { ConversaCliente } from './ConversaCliente'
import {
  CONVERSA_EM_ATENDIMENTO,
  DISPONIBILIDADE_MENTIRA,
  FORA_DE_HORARIO_MENTIRA,
  type Conversa,
} from './dados-mentira'

/**
 * Casca do PWA do cliente.
 *
 * **Etapa de telas: nada aqui fala com o servidor.** O estado é local e os dados
 * saem de `dados-mentira.ts`, no mesmo formato que as rotas de `atendimento-web`
 * devolvem. A integração entra depois, trocando estas funções por `fetch`, sem
 * mexer nas telas.
 *
 * O seletor de cenários existe só enquanto isto for mock: sem ele, estados como
 * "fora do horário" e "pedindo a nota" não teriam como ser vistos.
 */

type Cenario = 'identificacao' | 'fora_horario' | 'conversa'

export function AppCliente() {
  const [cenario, setCenario] = useState<Cenario>('identificacao')
  const [conversa, setConversa] = useState<Conversa>(CONVERSA_EM_ATENDIMENTO)
  const [online, setOnline] = useState(true)

  // Estado de rede de verdade, mesmo no mock: é ele que bloqueia o envio.
  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine)
    atualizar()
    window.addEventListener('online', atualizar)
    window.addEventListener('offline', atualizar)
    return () => {
      window.removeEventListener('online', atualizar)
      window.removeEventListener('offline', atualizar)
    }
  }, [])

  function abrirAtendimento(dados: DadosIdentificacao) {
    setConversa({
      ...CONVERSA_EM_ATENDIMENTO,
      status: 'na_fila',
      atendente: null,
      encerrado: false,
      aguardando_avaliacao: false,
      mensagens: [
        {
          id: 'nova-1',
          origem: 'cliente',
          corpo: dados.mensagem,
          criada_em: new Date().toISOString(),
        },
        {
          id: 'nova-2',
          origem: 'bot',
          corpo: 'Olá! Recebemos seu atendimento e já encaminhamos para o setor responsável. Em instantes alguém responde por aqui.',
          criada_em: new Date().toISOString(),
        },
      ],
    })
    setCenario('conversa')
  }

  function enviarMensagem(texto: string) {
    setConversa((c) => ({
      ...c,
      mensagens: [
        ...c.mensagens,
        { id: `local-${c.mensagens.length}`, origem: 'cliente', corpo: texto, criada_em: new Date().toISOString() },
      ],
    }))
  }

  return (
    <>
      {cenario === 'conversa' ? (
        <ConversaCliente
          conversa={conversa}
          online={online}
          aoEnviar={enviarMensagem}
          aoEncerrar={() =>
            setConversa((c) => ({ ...c, status: 'finalizado', encerrado: true, aguardando_avaliacao: false }))
          }
          aoAvaliar={() => setConversa((c) => ({ ...c, aguardando_avaliacao: false }))}
          aoAbrirOutro={() => setCenario('identificacao')}
        />
      ) : (
        <Identificacao
          disponibilidade={cenario === 'fora_horario' ? FORA_DE_HORARIO_MENTIRA : DISPONIBILIDADE_MENTIRA}
          aoEnviar={abrirAtendimento}
        />
      )}

      <SeletorDeCenario cenario={cenario} aoTrocar={setCenario} aoTrocarConversa={setConversa} />
    </>
  )
}

/**
 * Barra de cenários, **temporária**: existe só para conferir as telas sem rede.
 * Some junto com `dados-mentira.ts` quando a integração entrar.
 */
function SeletorDeCenario({
  cenario,
  aoTrocar,
  aoTrocarConversa,
}: {
  cenario: Cenario
  aoTrocar: (c: Cenario) => void
  aoTrocarConversa: (c: Conversa) => void
}) {
  return (
    <div className="fixed bottom-2 left-2 z-50 flex flex-wrap justify-start gap-1 rounded-2 border border-bd-2 bg-sf-3 px-2 py-1.5 shadow-2 max-w-[240px] opacity-90">
      <span className="text-mini text-tx-3 self-center px-1">MOCK:</span>
      {(
        [
          ['identificacao', 'Formulário'],
          ['fora_horario', 'Fora do horário'],
        ] as [Cenario, string][]
      ).map(([id, label]) => (
        <button
          key={id}
          onClick={() => aoTrocar(id)}
          className={`text-mini px-2 h-6 rounded-micro ${cenario === id ? 'bg-br-soft text-br-2' : 'text-tx-2 hover:bg-sf-2'}`}
        >
          {label}
        </button>
      ))}
      {(
        [
          ['Na fila', { ...CONVERSA_EM_ATENDIMENTO, status: 'na_fila' as const, atendente: null }],
          ['Em atendimento', CONVERSA_EM_ATENDIMENTO],
          [
            'Pedindo nota',
            { ...CONVERSA_EM_ATENDIMENTO, status: 'finalizado' as const, encerrado: true, aguardando_avaliacao: true },
          ],
          [
            'Encerrado',
            { ...CONVERSA_EM_ATENDIMENTO, status: 'finalizado' as const, encerrado: true, aguardando_avaliacao: false },
          ],
        ] as [string, Conversa][]
      ).map(([label, dados]) => (
        <button
          key={label}
          onClick={() => {
            aoTrocarConversa(dados)
            aoTrocar('conversa')
          }}
          className="text-mini px-2 h-6 rounded-micro text-tx-2 hover:bg-sf-2"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
