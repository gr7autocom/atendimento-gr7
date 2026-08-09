import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ShieldOff, TriangleAlert } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Botao } from '../ui/Botao'
import { Entrada } from '../ui/Campo'
import { AvisoErro } from '../ui/Estados'
import { supabase } from '../../lib/supabase'
import type { ContatoResumo } from '../../lib/useInbox'

/**
 * Eliminação de dados do titular a pedido dele (LGPD, Art. 18, VI).
 *
 * Vive no rodapé do painel do contato, e não em tela própria, porque a ação
 * pertence ao contato que o admin já tem na frente. Numa tela separada ele
 * precisaria buscar a pessoa de novo, e buscar para depois destruir é um passo
 * a mais para errar de quem.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE PEDE O TELEFONE DIGITADO
 *
 * A diretriz de UX para ação destrutiva é "confirme antes, e ofereça desfazer".
 * A segunda metade **não existe aqui**: quando o modal fecha, os arquivos já
 * saíram do Cloudinary e não voltam com nenhum botão.
 *
 * Sem volta, a confirmação precisa ser mais dura que um "Confirmar", e o motivo
 * é concreto: o painel do contato troca de conteúdo conforme a conversa aberta,
 * então clicar em eliminar achando que é outro titular é um erro plausível, não
 * hipotético. Digitar o telefone obriga a conferir de quem é.
 * ─────────────────────────────────────────────────────────────────────────────
 */

type Arquivo = { public_id: string; apagado: boolean; motivo?: string }
type Resultado = {
  mensagens_apagadas: number
  anexos_apagados: number
  atendimentos_afetados: number
  arquivos_nao_apagados: Arquivo[]
}

export function EliminarTitular({ contato }: { contato: ContatoResumo | null | undefined }) {
  const [aberto, setAberto] = useState(false)
  const [confirmacao, setConfirmacao] = useState('')
  const [referencia, setReferencia] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const queryClient = useQueryClient()

  if (!contato) return null

  /*
    Já anonimizado: nada a eliminar, e o botão some em vez de ficar abrindo um
    modal que não tem o que fazer.

    O `&& !resultado` não é detalhe: sem ele, a eliminação bem-sucedida entra
    aqui no mesmo instante (o contato acabou de virar anônimo) e este retorno
    engole o relatório antes de alguém ler quanto saiu. Aconteceu na primeira
    validação pela tela.
  */
  if (contato.telefone?.startsWith('anonimizado:') && !resultado) {
    return (
      <div className="border-t border-bd-1 px-4 py-3">
        <div className="flex items-center gap-2 text-corpo text-tx-3">
          <ShieldOff size={14} />
          Dados deste titular já foram eliminados a pedido dele.
        </div>
      </div>
    )
  }

  function fechar() {
    setAberto(false)
    setConfirmacao('')
    setReferencia('')
    setErro(null)
    setResultado(null)
  }

  /*
    O TypeScript não mantém o estreitamento de uma prop dentro de closure async,
    e aqui isso é bem-vindo: a const também congela de quem é a eliminação no
    momento do clique. Se a conversa aberta trocar enquanto o modal está de pé,
    o pedido continua sendo do titular que a pessoa confirmou.
  */
  const alvo = contato
  const confere = confirmacao.trim() === alvo.telefone

  async function eliminar() {
    if (!confere || enviando) return
    setEnviando(true)
    setErro(null)
    try {
      /*
        `getSession` e não a chave anônima: a function exige JWT e quem decide se
        pode eliminar é o `e_admin()` no banco. Sessão vencida vira erro na tela,
        não uma chamada que o gateway recusa com 401 sem explicação.
      */
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sua sessão expirou. Entre de novo para continuar.')

      const resposta = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atendimento-lgpd`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contato_id: alvo.id, referencia_pedido: referencia.trim() || null }),
        }
      )
      const corpo = await resposta.json().catch(() => ({}))

      if (!resposta.ok) {
        // O aviso do servidor é mais útil que o código: ele diz se os arquivos
        // já saíram e se repetir a operação termina o serviço.
        throw new Error(corpo.aviso ?? corpo.detalhe ?? 'Não foi possível eliminar os dados.')
      }
      setResultado(corpo as Resultado)
      /*
        Invalidação ampla, e de propósito: a eliminação mexe na lista, na
        conversa aberta, nos contadores e no histórico do contato de uma vez.
        Sem isto a conversa continua exibindo as mensagens que acabaram de ser
        apagadas — foi o que a primeira validação pela tela mostrou, e é o pior
        desfecho possível aqui, porque parece que a eliminação não funcionou.
      */
      await queryClient.invalidateQueries()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível eliminar os dados.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="border-t border-bd-1 px-4 py-3">
      <div className="flex items-start gap-2">
        <ShieldOff size={14} className="text-err mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-corpo font-medium text-tx-1">Eliminar dados a pedido do titular</div>
          <p className="text-corpo text-tx-3 mt-0.5">
            Para quando o cliente pede exclusão dos dados dele. O chamado continua registrado.
          </p>
          <Botao variante="perigo" tamanho="sm" className="mt-2" onClick={() => setAberto(true)}>
            Eliminar dados
          </Botao>
        </div>
      </div>

      <Modal titulo="Eliminar dados do titular" aberto={aberto} onFechar={fechar}>
        {resultado ? (
          <ResultadoEliminacao resultado={resultado} onFechar={fechar} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 rounded-2 bg-err-soft p-3">
              <TriangleAlert size={16} className="text-err mt-0.5 shrink-0" />
              <p className="text-corpo text-tx-1">
                Não há como desfazer. Os arquivos são apagados também no serviço que os armazena.
              </p>
            </div>

            <div>
              <div className="text-corpo font-medium text-tx-1 mb-1">O que sai</div>
              <ul className="text-corpo text-tx-2 flex flex-col gap-0.5">
                <li>Nome e telefone do contato</li>
                <li>Todas as mensagens deste e dos chamados anteriores</li>
                <li>Prints, fotos, documentos e áudios enviados</li>
              </ul>
            </div>

            <div>
              <div className="text-corpo font-medium text-tx-1 mb-1">O que fica</div>
              <p className="text-corpo text-tx-2">
                O chamado, com protocolo, datas, setor, motivo e nota. É a prova do atendimento
                prestado, que a lei manda guardar por cinco anos.
              </p>
            </div>

            <Entrada
              rotulo="Digite o telefone do titular para confirmar"
              dica={alvo.telefone ?? undefined}
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="off"
              inputMode="tel"
            />

            <Entrada
              rotulo="Onde o pedido está registrado (opcional)"
              dica="E-mail, protocolo ou ata. Fica na auditoria."
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              autoComplete="off"
            />

            {erro && <AvisoErro mensagem={erro} />}

            <div className="flex justify-end gap-2">
              <Botao variante="neutro" onClick={fechar} disabled={enviando}>
                Cancelar
              </Botao>
              <Botao variante="perigo" onClick={eliminar} disabled={!confere} carregando={enviando}>
                Eliminar definitivamente
              </Botao>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/**
 * O resultado fica na tela, e não em toast que desaparece: a pessoa precisa ler
 * quanto saiu, e principalmente o que **não** saiu. Eliminação parcial
 * anunciada como completa é pior que falha declarada — quem pediu a exclusão
 * ficaria com arquivo no ar e um "pronto" na tela.
 */
function ResultadoEliminacao({ resultado, onFechar }: { resultado: Resultado; onFechar: () => void }) {
  const sobraram = resultado.arquivos_nao_apagados ?? []

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-corpo-lg font-medium text-tx-1 mb-1">
          {sobraram.length === 0 ? 'Dados eliminados' : 'Eliminado, com pendência'}
        </div>
        <ul className="text-corpo text-tx-2 flex flex-col gap-0.5">
          <li>Contato anonimizado</li>
          <li>
            <span className="dado">{resultado.mensagens_apagadas}</span> mensagem(ns) apagada(s)
          </li>
          <li>
            <span className="dado">{resultado.anexos_apagados}</span> arquivo(s) apagado(s)
          </li>
          <li>
            <span className="dado">{resultado.atendimentos_afetados}</span> chamado(s) mantido(s) como
            registro
          </li>
        </ul>
      </div>

      {sobraram.length > 0 && (
        <div className="flex gap-2 rounded-2 bg-warn-soft p-3" role="alert">
          <TriangleAlert size={16} className="text-warn mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-corpo font-medium text-tx-1">
              {sobraram.length} arquivo(s) o serviço de armazenamento não apagou
            </div>
            <p className="text-corpo text-tx-2 mt-0.5">
              O restante saiu. Repita a operação neste contato para tentar de novo, ou avise a
              equipe técnica com os identificadores abaixo.
            </p>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {sobraram.map((a) => (
                <li key={a.public_id} className="text-corpo text-tx-3 dado break-all">
                  {a.public_id}
                  {a.motivo ? ` — ${a.motivo}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Botao variante="primario" onClick={onFechar}>
          Fechar
        </Botao>
      </div>
    </div>
  )
}
