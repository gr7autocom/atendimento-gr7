import { useEffect, useRef } from 'react'
import { avisar, tocarAvisoSonoro, tocarSomEnvio, estadoDaPermissao } from './notificacoes'
import type { AtendimentoLista } from './useInbox'

/**
 * Avisa o atendente quando chega mensagem nova, com som e card do sistema.
 *
 * Como sabe que é nova: guarda o `ultima_mensagem_em` de cada chamado e compara
 * a cada atualização da lista. Não é assinatura de tempo real; é a mesma lista
 * que a inbox já busca de dez em dez segundos, então o aviso não custa nenhuma
 * chamada a mais.
 *
 * Três cuidados que decidem se isso ajuda ou irrita:
 *
 * - **A primeira carga não avisa.** Sem isso, abrir a central de manhã dispararia
 *   um card para cada chamado da fila.
 * - **O chamado aberto na tela leva o som discreto, não o alerta.** A pessoa está
 *   lendo aquela conversa: sirene e card por cima do que ela lê é ruído, mas
 *   silêncio total esconde a mensagem que chega enquanto ela olha outra janela.
 * - **Não avisa com a aba em foco**, só som. O card do sistema serve para quem
 *   está em outro programa; com a central à frente, a conversa já se atualiza
 *   sozinha.
 */
export function useAvisoMensagem(lista: AtendimentoLista[] | undefined, abertoId: string | null) {
  const conhecidos = useRef<Map<string, string> | null>(null)
  const abertoRef = useRef(abertoId)
  abertoRef.current = abertoId

  useEffect(() => {
    if (!lista) return

    const agora = new Map(lista.map((a) => [a.id, a.ultima_mensagem_em ?? '']))

    // Primeira carga: só memoriza. Tudo aqui já existia antes de a tela abrir.
    if (conhecidos.current === null) {
      conhecidos.current = agora
      return
    }

    const novidades = lista.filter((a) => {
      const antes = conhecidos.current?.get(a.id)
      const depois = a.ultima_mensagem_em ?? ''
      // Chamado que apareceu agora conta como novidade; chamado conhecido, só
      // se o carimbo da última mensagem andou.
      return antes === undefined ? !!depois : !!depois && depois > antes
    })

    conhecidos.current = agora
    if (novidades.length === 0) return

    // O chamado aberto sai da lista de alertas, mas não fica muda: som discreto
    // de conversa em movimento, o mesmo que sai ao responder.
    if (novidades.some((a) => a.id === abertoRef.current)) tocarSomEnvio()

    const relevantes = novidades.filter((a) => a.id !== abertoRef.current)
    if (relevantes.length === 0) return

    tocarAvisoSonoro()

    if (document.visibilityState === 'visible') return
    if (estadoDaPermissao() !== 'concedida') return

    if (relevantes.length === 1) {
      const a = relevantes[0]
      const quem = a.contato?.nome ?? a.contato?.nome_whatsapp ?? 'Cliente'
      avisar({
        titulo: `Nova mensagem de ${quem}`,
        corpo: a.protocolo ? `Chamado #${a.protocolo}` : undefined,
        url: '/inbox',
        // Uma `tag` por chamado: mensagens seguidas do mesmo cliente
        // substituem o card anterior em vez de empilhar.
        tag: `chamado-${a.id}`,
      })
    } else {
      avisar({
        titulo: `${relevantes.length} chamados com mensagem nova`,
        corpo: 'Abra a central para responder.',
        url: '/inbox',
        tag: 'chamados-varios',
      })
    }
  }, [lista])
}
