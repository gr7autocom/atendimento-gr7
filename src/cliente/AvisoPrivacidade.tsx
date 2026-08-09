import { Modal } from '../components/ui/Modal'

/**
 * O que a GR7 faz com os dados de quem pede suporte pelo site.
 *
 * Existe porque o aceite ao lado é o registro do consentimento da LGPD, e
 * consentimento sem a pessoa poder ler o que está aceitando é assinatura no
 * escuro. Fica em janela, e não no corpo do formulário, porque quem chega aqui
 * está com um problema e quer descrever o problema: alongar a primeira tela com
 * cinco parágrafos afastaria justamente quem precisa de ajuda.
 *
 * O texto evita juridiquês sem cair na informalidade: quem lê não é advogado,
 * mas é um cliente empresarial relatando uma falha e esperando resolução. A
 * primeira versão tratava isso como conversa ("sem você contar a história de
 * novo"), e o próprio usuário apontou que ninguém conta história ao suporte:
 * descreve um problema técnico.
 */
export function AvisoPrivacidade({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  return (
    <Modal titulo="Como usamos seus dados" aberto={aberto} onFechar={onFechar}>
      <div className="flex flex-col gap-4 text-corpo text-tx-2 leading-relaxed">
        <Secao titulo="O que pedimos">
          Nome e telefone, para identificar quem abriu o chamado e retornar o contato. O CNPJ é
          opcional e vincula o atendimento à empresa.
        </Secao>

        <Secao titulo="O relato fica registrado">
          As mensagens deste atendimento ficam registradas junto ao chamado. Esse registro
          permite que qualquer atendente da equipe retome o caso com o contexto completo, sem que
          você precise descrever o problema outra vez.
        </Secao>

        <Secao titulo="Arquivos e áudios que você envia">
          Prints, fotos, documentos e áudios ficam guardados junto do chamado, com o mesmo prazo
          das mensagens. Envie apenas o necessário para explicar o problema: uma tela do sistema
          pode conter dados de terceiros que não fazem parte do atendimento.
        </Secao>

        <Secao titulo="Quem tem acesso">
          Apenas a equipe de atendimento da GR7 Autocom. Seus dados não são compartilhados com
          terceiros para fins comerciais. Dois serviços contratados atuam sob nossa
          responsabilidade: o <span className="text-tx-1">Supabase</span>, que hospeda o sistema e o
          banco de dados, e o <span className="text-tx-1">Cloudinary</span>, que guarda os arquivos
          enviados na conversa.
        </Secao>

        <Secao titulo="Por quanto tempo mantemos">
          Cinco anos após o encerramento do chamado. O prazo segue o Código de Defesa do
          Consumidor: o registro comprova o atendimento prestado e resguarda tanto você quanto a
          GR7 Autocom.
        </Secao>

        <Secao titulo="Para corrigir ou excluir seus dados">
          Envie sua solicitação para{' '}
          <span className="text-tx-1">suporte@gr7autocom.com.br</span>. Retiramos seu nome, seu
          telefone, as mensagens e os arquivos. O registro do chamado permanece pelos cinco anos,
          sem identificar você, porque é a comprovação do atendimento.
        </Secao>
      </div>
    </Modal>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-corpo-lg font-medium text-tx-1 mb-1">{titulo}</h3>
      <p>{children}</p>
    </div>
  )
}
