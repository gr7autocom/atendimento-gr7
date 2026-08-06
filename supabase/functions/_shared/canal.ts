/**
 * Canal de origem do atendimento.
 *
 * Por que existe, sendo hoje quase trivial: quando a uazapi for contratada, a
 * resposta do atendente vai passar a ser despachada de verdade, e o despacho será
 * plugado no lugar mais fácil (o `responder` do app, ou um trigger genérico em
 * `atendimento_mensagens`). Nos dois casos, **a regra de não mandar para o WhatsApp
 * uma conversa que nasceu na web é o `if` que ninguém escreve**. Deixá-la aqui, com
 * teste, faz o dia do despacho ser "chamar a função que já existe".
 *
 * A defesa forte é a do banco (`CHECK (canal <> 'web' OR wa_message_id IS NULL)` em
 * `atendimento_mensagens`), que torna o erro impossível em vez de desaconselhado.
 * Este módulo é a camada de aplicação da mesma regra, para falhar antes e com
 * mensagem melhor. Ver docs/canal-web.md.
 *
 * Sobre a assimetria: **WhatsApp é push, web é pull**. No WhatsApp o provedor
 * empurra a mensagem e a resposta precisa ser despachada de volta; na web o cliente
 * pergunta pelo que há de novo, então "entregar" é apenas gravar no banco. É por
 * isso que o canal web não tem driver, e por isso `WhatsAppDriver` **não** deve ser
 * generalizado em `CanalDriver`: web não tem envio, status de conexão, QR nem webhook.
 */

export type Canal = 'whatsapp' | 'web'

/** Canal de quem já estava no banco antes de o web existir. */
export const CANAL_PADRAO: Canal = 'whatsapp'

const CANAIS: readonly string[] = ['whatsapp', 'web']

export function ehCanal(valor: unknown): valor is Canal {
  return typeof valor === 'string' && CANAIS.includes(valor)
}

/**
 * Se a mensagem deste atendimento deve sair pelo provedor de WhatsApp.
 *
 * Falha fechada de propósito: canal desconhecido, nulo ou ausente devolve `false`.
 * Deixar de entregar é uma falha visível (o cliente cobra o retorno); entregar no
 * canal errado é mensagem de um atendimento indo para o número de outro.
 *
 * Quem precisar distinguir "não é para despachar" de "não sei qual é o canal" deve
 * checar `ehCanal()` antes, porque esta função devolve `false` nos dois casos.
 */
export function despachaPeloWhatsApp(canal: unknown): boolean {
  return canal === 'whatsapp'
}
