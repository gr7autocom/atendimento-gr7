import { QrCode, RefreshCw, Lightbulb } from 'lucide-react'
import { CabecalhoAdmin } from '../../components/admin/CabecalhoAdmin'
import { Bloco } from '../../components/admin/Bloco'
import { Botao } from '../../components/ui/Botao'
import { Selo, PontoStatus } from '../../components/ui/Selo'

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

export function Conexao() {
  // Quando a integração uazapi entrar, o status e o QR vêm do adapter
  // (statusConexao: conectado / qr / desconectado). Por ora, pendente.
  const conectado = false

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
                <span className="dado shrink-0 grid place-items-center w-7 h-7 rounded-full bg-br-soft text-br-2 text-[13px] font-semibold">
                  {p.titulo}
                </span>
                <span className="text-[13px] text-tx-2">{p.texto}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex items-start gap-2 rounded-[8px] border border-bd-1 bg-sf-2 px-3 py-2.5">
            <Lightbulb size={15} className="text-warn shrink-0 mt-0.5" />
            <p className="text-[12px] text-tx-2">
              <strong className="text-tx-1 font-medium">Dica:</strong> use um número só para o atendimento. Isso
              evita bloqueio por envio em massa.
            </p>
          </div>
        </Bloco>

        <section className="rounded-[10px] border border-bd-1 bg-sf-1 flex flex-col items-center justify-center gap-4 p-6">
          <div className="w-[220px] h-[220px] rounded-[12px] border border-dashed border-bd-3 bg-sf-0 flex flex-col items-center justify-center gap-2 text-center px-4">
            <QrCode size={40} className="text-bd-3" />
            <span className="text-[12px] text-tx-3">O QR Code aparece aqui quando a conexão estiver disponível.</span>
          </div>

          <div className="flex items-center gap-2">
            <PontoStatus status={conectado ? 'em_atendimento' : 'triagem'} />
            <Selo tom={conectado ? 'ok' : 'neutro'}>{conectado ? 'Conectado' : 'Desconectado'}</Selo>
          </div>

          <p className="text-[12px] text-tx-3 text-center max-w-xs">
            Integração ainda não conectada. Configure a uazapi (conta e número) para gerar o QR Code e ligar o bot.
          </p>

          <Botao
            variante="neutro"
            tamanho="sm"
            disabled
            title="Disponível quando a integração uazapi estiver configurada"
            icone={<RefreshCw size={15} />}
          >
            Gerar nova sessão
          </Botao>
        </section>
      </div>
    </div>
  )
}
