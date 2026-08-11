import { QrCode, RefreshCw, Lightbulb } from 'lucide-react'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { Bloco } from '../../components/admin/Bloco'
import { Botao } from '../../components/ui/Botao'
import { Selo, Ponto } from '../../components/ui/Selo'
import { Skeleton, AvisoErro } from '../../components/ui/Estados'
import { useConexaoStatus, useConectarWhatsapp, useConfigurarWebhookWhatsapp } from '../../lib/useConexaoWhatsapp'

const PASSOS: { titulo: string; texto: React.ReactNode }[] = [
  { titulo: '1', texto: 'Abra o WhatsApp no seu celular.' },
  {
    titulo: '2',
    texto: (
      <>
        Toque em <strong className="text-tx-1 font-medium">Aparelhos conectados</strong> nas configurações.
      </>
    ),
  },
  {
    titulo: '3',
    texto: (
      <>
        Toque em <strong className="text-tx-1 font-medium">Conectar um aparelho</strong> e aponte para o QR Code.
      </>
    ),
  },
]

/** A uazapi devolve o QR cru em base64; se algum dia vier como data URL, usa direto. */
function fonteQr(qrCode: string) {
  return qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`
}

export function Conexao() {
  const status = useConexaoStatus()
  const conectar = useConectarWhatsapp()
  // Aponta o webhook no mesmo clique que gera a sessão: é configuração de uma vez
  // só, e não faz sentido pedir pro atendente decidir isso à parte.
  const configurarWebhook = useConfigurarWebhookWhatsapp()

  const conectado = status.data?.status === 'connected'
  const qrCode = status.data?.qrCode

  /*
    Enquanto não está conectado, gera QR e aponta o webhook juntos. Já
    conectado, só reaponta o webhook — sem isso não tinha como recuperar de um
    webhook que falhou ao configurar (aconteceu de verdade: a sessão conectou,
    o apontamento falhou calado, e nenhum botão sobrava pra tentar de novo
    porque este ficava desabilitado com `conectado`).
  */
  function gerarSessao() {
    configurarWebhook.mutate()
    if (!conectado) conectar.mutate(undefined)
  }

  return (
    <div className="w-full">
      <CabecalhoAdmin
        titulo="Conexão do WhatsApp"
        descricao="Ligue o número de WhatsApp que o bot usa para atender."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bloco titulo="Como conectar">
          <ol className="flex flex-col gap-3">
            {PASSOS.map((p) => (
              <li key={p.titulo} className="flex items-center gap-3">
                <span className="dado shrink-0 grid place-items-center w-7 h-7 rounded-full bg-br-soft text-br-2 text-corpo font-semibold">
                  {p.titulo}
                </span>
                <span className="text-corpo text-tx-2">{p.texto}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex items-start gap-2 rounded-2 border border-bd-1 bg-sf-2 px-3 py-2.5">
            <Lightbulb size={15} className="text-warn shrink-0 mt-0.5" />
            <p className="text-apoio text-tx-2">
              <strong className="text-tx-1 font-medium">Dica:</strong> use um número só para o atendimento. Isso
              evita bloqueio por envio em massa.
            </p>
          </div>
        </Bloco>

        <section className="rounded-2 border border-bd-1 bg-sf-1 flex flex-col items-center justify-center gap-4 p-6">
          {status.isLoading ? (
            <Skeleton className="w-[220px] h-[220px] rounded-3" />
          ) : conectado ? (
            <div className="w-[220px] h-[220px] rounded-3 border border-bd-3 bg-sf-0 flex flex-col items-center justify-center gap-2 text-center px-4">
              <QrCode size={40} className="text-ok" />
              <span className="text-apoio text-tx-2">WhatsApp conectado. O bot já está recebendo mensagens.</span>
            </div>
          ) : qrCode ? (
            <img
              src={fonteQr(qrCode)}
              alt="QR Code para conectar o WhatsApp"
              className="w-[220px] h-[220px] rounded-3 border border-bd-3 bg-white p-2"
            />
          ) : (
            <div className="w-[220px] h-[220px] rounded-3 border border-dashed border-bd-3 bg-sf-0 flex flex-col items-center justify-center gap-2 text-center px-4">
              <QrCode size={40} className="text-bd-3" />
              <span className="text-apoio text-tx-3">O QR Code aparece aqui quando você gerar uma sessão.</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Ponto cor={conectado ? 'var(--ok)' : 'var(--tx-3)'} rotuloOculto>
              {conectado ? 'Conectado' : 'Desconectado'}
            </Ponto>
            <Selo tom={conectado ? 'ok' : 'neutro'}>{conectado ? 'Conectado' : 'Desconectado'}</Selo>
          </div>

          {!conectado && (
            <p className="text-apoio text-tx-3 text-center max-w-xs">
              {qrCode
                ? 'O QR Code expira em 2 minutos. Se sumir antes de escanear, gere outro.'
                : 'Clique abaixo para gerar o QR Code e ligar o bot.'}
            </p>
          )}

          <Botao
            variante="neutro"
            tamanho="sm"
            onClick={gerarSessao}
            carregando={conectar.isPending || configurarWebhook.isPending}
            icone={<RefreshCw size={15} />}
          >
            {conectado ? 'Reapontar webhook' : 'Gerar nova sessão'}
          </Botao>

          <AvisoErro
            mensagem={
              conectar.isError
                ? 'Não foi possível gerar a sessão. Tente de novo.'
                : configurarWebhook.isError
                  ? 'A sessão conectou, mas não deu para apontar o webhook — o bot não recebe mensagens assim. Tente de novo.'
                  : null
            }
          />
        </section>
      </div>
    </div>
  )
}
