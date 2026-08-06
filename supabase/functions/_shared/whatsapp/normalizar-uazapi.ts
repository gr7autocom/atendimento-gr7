import type { EventoNormalizado, StatusConexao } from './tipos.ts'
import { e164 } from '../telefone.ts'

/**
 * Tradução do payload cru da uazapi para o `EventoNormalizado` do domínio.
 *
 * Mora fora do `driver-uazapi.ts` de propósito: aqui não há `fetch` nem
 * `Deno.env`, então dá para testar cada caso sem rede e sem chaves (ver
 * `normalizar-uazapi.test.ts`).
 *
 * ⚠️ O **envelope** (o que embrulha os dados) ainda não foi visto em tráfego
 * real — o spec OpenAPI se contradiz: o schema `WebhookEvent` descreve
 * `{ event, instance, data }` com `data` livre e sem exemplo, e o exemplo do
 * `/sse` mostra `{ type, data }` com nomes de evento no singular. Por isso este
 * módulo aceita as duas formas e, na dúvida, devolve `{ tipo: 'ignorado' }` em
 * vez de gravar dado com shape errado.
 *
 * O **conteúdo** de dentro do envelope, esse sim, segue o schema `Message`
 * documentado. Ver docs/whatsapp.md, "Payload do webhook".
 */

type Obj = Record<string, unknown>

function obj(v: unknown): Obj | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Estado da instância (`instance.status`) para o nosso vocabulário. */
export function mapearStatusConexao(estado: unknown): StatusConexao {
  const e = str(estado).toLowerCase()
  return e === 'connected' || e === 'connecting' || e === 'hibernated' ? e : 'disconnected'
}

/**
 * Status do ciclo de vida da mensagem. `Queued` e desconhecidos devolvem null:
 * ainda não há nada para atualizar na conversa.
 */
export function mapearStatusMensagem(
  status: unknown,
): 'enviado' | 'entregue' | 'lido' | 'falhou' | null {
  switch (str(status).toLowerCase()) {
    case 'sent':
      return 'enviado'
    case 'delivered':
      return 'entregue'
    case 'read':
      return 'lido'
    case 'failed':
    case 'canceled':
      return 'falhou'
    default:
      return null
  }
}

/**
 * JID da uazapi para telefone E.164. Aceita `5516991234567` e
 * `5516991234567@s.whatsapp.net`.
 *
 * Devolve string vazia para o que não é telefone de pessoa: grupo (`@g.us`),
 * canal (`@newsletter`) e o id oculto do WhatsApp (`@lid`, que é um
 * identificador interno, não um número — nesse caso o telefone real vem no
 * campo `sender_pn`).
 */
export function telefoneDeJid(jid: unknown): string {
  const bruto = str(jid).trim()
  if (!bruto) return ''
  const arroba = bruto.indexOf('@')
  const dominio = arroba === -1 ? '' : bruto.slice(arroba + 1)
  if (dominio && dominio !== 's.whatsapp.net') return ''
  // A formatação sai daqui e vai para `_shared/telefone.ts`: o canal web grava na
  // mesma coluna `contatos.telefone`, que é UNIQUE, e dois formatos diferentes
  // criariam dois contatos para a mesma pessoa. O JID já traz o DDI, então é `e164`
  // e não a normalização brasileira — cliente de fora do país continua funcionando.
  return e164(arroba === -1 ? bruto : bruto.slice(0, arroba))
}

/**
 * O spec declara `messageTimestamp` em milissegundos, mas o WhatsApp costuma
 * mandar segundos. Abaixo de 1e12 (que é o ano 2001 em ms) só pode ser segundo.
 */
function instanteISO(valor: unknown): string | null {
  const n = typeof valor === 'number' ? valor : Number(str(valor))
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = n < 1e12 ? n * 1000 : n
  const data = new Date(ms)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

/**
 * Descasca o envelope. Cobre `{ data }`, `{ data: { message } }`, `{ message }`
 * e o próprio objeto na raiz.
 *
 * ⚠️ Se `data` vier como lista, só o primeiro item é aproveitado — o
 * `EventoNormalizado` representa um evento por vez. Conferir na captura do
 * tráfego real se a uazapi manda mensagens em lote; se mandar, esta função e a
 * assinatura do `normalizarWebhook` precisam devolver lista.
 */
function extrairDados(raiz: Obj): Obj | null {
  const bruto = raiz.data ?? raiz.message ?? raiz
  if (Array.isArray(bruto)) return obj(bruto[0])
  const dados = obj(bruto)
  if (!dados) return null
  return obj(dados.message) ?? obj(dados.messages) ?? dados
}

function comoMensagem(d: Obj): EventoNormalizado {
  // Atendimento é sempre 1:1: grupo e canal não abrem chamado.
  if (d.isGroup === true) return { tipo: 'ignorado' }
  // Eco do que nós mesmos enviamos. O filtro `excludeMessages: ["wasSentByApi"]`
  // do webhook já deveria barrar, mas se alguém reconfigurar sem ele, o bot
  // responderia a si mesmo em loop. Trava dupla, de propósito.
  if (d.fromMe === true || d.wasSentByApi === true) return { tipo: 'ignorado' }

  const wa_message_id = str(d.messageid) || str(d.id)
  // `sender_pn` primeiro: quando o remetente vem como `@lid`, é o único campo
  // com o telefone de verdade.
  const telefone =
    telefoneDeJid(d.sender_pn) || telefoneDeJid(d.sender) || telefoneDeJid(d.chatid)
  if (!wa_message_id || !telefone) return { tipo: 'ignorado' }

  const recebido_em = instanteISO(d.messageTimestamp)
  return {
    tipo: 'mensagem',
    wa_message_id,
    telefone,
    nome_whatsapp: str(d.senderName) || null,
    corpo: str(d.text) || null,
    ...(recebido_em ? { recebido_em } : {}),
  }
}

function comoStatusMensagem(d: Obj): EventoNormalizado {
  const wa_message_id = str(d.messageid) || str(d.id)
  const status = mapearStatusMensagem(d.status)
  if (!wa_message_id || !status) return { tipo: 'ignorado' }
  return { tipo: 'status_mensagem', wa_message_id, status }
}

function comoConexao(d: Obj): EventoNormalizado {
  const estado = d.status ?? d.state ?? obj(d.instance)?.status
  return { tipo: 'conexao', status: mapearStatusConexao(estado) }
}

export function normalizarEventoUazapi(payload: unknown): EventoNormalizado {
  const raiz = obj(payload)
  if (!raiz) return { tipo: 'ignorado' }

  const dados = extrairDados(raiz)
  if (!dados) return { tipo: 'ignorado' }

  // `event` é o nome no webhook; `type`, o do exemplo de SSE. Aceitamos os dois
  // porque o spec usa um em cada lugar.
  switch ((str(raiz.event) || str(raiz.type)).toLowerCase()) {
    case 'messages':
    case 'message':
      return comoMensagem(dados)
    case 'messages_update':
    case 'status':
      return comoStatusMensagem(dados)
    case 'connection':
      return comoConexao(dados)
    case '':
      // Sem nome de evento: decide pelo conteúdo. Mensagem tem texto ou tipo;
      // atualização de status só traz o id e o status.
      if ('text' in dados || 'messageType' in dados) return comoMensagem(dados)
      if ('status' in dados) return comoStatusMensagem(dados)
      return { tipo: 'ignorado' }
    default:
      // history, presence, groups, chats, call, labels, blocks, sender...
      return { tipo: 'ignorado' }
  }
}
