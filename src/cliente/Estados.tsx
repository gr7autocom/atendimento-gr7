import { WifiOff } from 'lucide-react'
import { Botao } from '../components/ui/Botao'
import { Skeleton } from '../components/ui/Estados'
import { Moldura } from './Identificacao'

/**
 * Os dois estados que existem antes de qualquer tela: esperando o servidor e
 * não conseguindo falar com ele.
 *
 * O segundo importa mais do que parece: sem ele, quem está sem sinal veria a
 * tela vazia e concluiria que o suporte da GR7 está fora do ar.
 */

/**
 * Esqueleto, não roda-roda. A guarda em `padroes-ui.test.ts` barrou o spinner
 * montado à mão e estava certa duas vezes: além do padrão do projeto, esqueleto
 * mostra o formato do que vem e faz a espera parecer menor. Ele desenha a marca
 * e três campos, que é o que aparece logo em seguida.
 */
export function Carregando() {
  return (
    <Moldura>
      <div role="status" aria-busy="true" aria-label="Abrindo o atendimento" className="flex flex-col gap-4">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </Moldura>
  )
}

export function Recado({
  titulo,
  texto,
  aoTentarDeNovo,
}: {
  titulo: string
  texto: string
  aoTentarDeNovo?: () => void
}) {
  return (
    <Moldura>
      <div role="alert" className="flex flex-col items-center gap-4 text-center py-6">
        <div className="w-14 h-14 rounded-full bg-sf-2 border border-bd-1 flex items-center justify-center">
          <WifiOff size={24} className="text-tx-2" aria-hidden="true" />
        </div>
        <h1 className="text-titulo font-medium text-tx-1">{titulo}</h1>
        <p className="text-corpo-lg text-tx-2 leading-relaxed">{texto}</p>
        {aoTentarDeNovo && (
          <Botao variante="neutro" onClick={aoTentarDeNovo} className="h-11 text-corpo-lg">
            Tentar de novo
          </Botao>
        )}
      </div>
    </Moldura>
  )
}
