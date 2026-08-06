/**
 * Canal de origem do atendimento, do lado da interface.
 *
 * Espelha `supabase/functions/_shared/canal.ts`, que guarda a mesma noção no
 * backend. São dois arquivos porque o frontend não importa de dentro de
 * `supabase/functions` (código Deno) e o rótulo em português só existe aqui.
 *
 * O rótulo importa por acessibilidade: o selo do avatar distingue os canais por
 * **ícone**, não só por cor, e leitor de tela lê o texto daqui. Cor sozinha não
 * transmite informação (WCAG 1.4.1) — verde e azul são o mesmo tom para boa parte
 * das pessoas com daltonismo.
 */

export type Canal = 'whatsapp' | 'web'

export const ROTULO_CANAL: Record<Canal, string> = {
  whatsapp: 'WhatsApp',
  web: 'Site',
}

/** Frase do selo, lida por leitor de tela no lugar do ícone. */
export const DESCRICAO_CANAL: Record<Canal, string> = {
  whatsapp: 'Atendimento pelo WhatsApp',
  web: 'Atendimento pelo site',
}

export function ehCanal(valor: unknown): valor is Canal {
  return valor === 'whatsapp' || valor === 'web'
}

/**
 * Canal de um chamado, com o padrão de quem nasceu antes do canal web existir.
 * A coluna é `NOT NULL DEFAULT 'whatsapp'`, então isto é rede de segurança para
 * consulta que esqueceu de trazer a coluna, não para dado faltando no banco.
 */
export function canalDoChamado(valor: unknown): Canal {
  return ehCanal(valor) ? valor : 'whatsapp'
}
