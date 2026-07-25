/**
 * Variáveis das mensagens rápidas. Ao inserir a mensagem no chat, troca:
 *  - {{agent.name}}   → nome do atendente logado
 *  - {{contact.name}} → nome do contato do chamado
 * Tolerante a espaços dentro das chaves.
 */
export function aplicarVariaveis(
  texto: string,
  vars: { agente?: string | null; contato?: string | null }
): string {
  return texto
    .replace(/\{\{\s*agent\.name\s*\}\}/gi, vars.agente ?? '')
    .replace(/\{\{\s*contact\.name\s*\}\}/gi, vars.contato ?? '')
}
