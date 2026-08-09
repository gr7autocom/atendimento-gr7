/**
 * Apagar arquivo no Cloudinary.
 *
 * Existe para a eliminação de titular (LGPD, Art. 18, VI): o relato sai do banco
 * e o arquivo tem de sair do provedor, senão continua alcançável por quem tiver
 * a URL — e depois da eliminação nem existe mais registro apontando para ele.
 *
 * Não pode viver no frontend: o `destroy` exige assinatura com o
 * `CLOUDINARY_API_SECRET`, e o preset aberto que a central usa para subir não
 * autoriza remoção. É a mesma razão pela qual o upload do cliente passa por
 * Edge Function.
 */
import { assinar } from './web/anexo.ts'

/**
 * O `resource_type` é a armadilha desta operação.
 *
 * O upload usa `auto`, então o Cloudinary decide sozinho onde o arquivo entra:
 * imagem em `image`, **áudio em `video`** (ele não tem categoria de áudio), e
 * PDF, planilha e documento em `raw`. O `destroy`, ao contrário, exige o tipo
 * certo — e com o tipo errado ele responde `not found` **com HTTP 200**. Quem
 * não olhar o corpo da resposta conclui que apagou, e o arquivo fica lá.
 *
 * Por isso o tipo é deduzido do mime e, se não bater, os outros são tentados.
 * Chute único aqui custaria um arquivo de titular sobrevivendo a um pedido de
 * exclusão, que é exatamente o que esta função existe para evitar.
 */
function tiposParaTentar(tipoMime: string | null): string[] {
  const preferido = tipoMime?.startsWith('image/')
    ? 'image'
    : tipoMime?.startsWith('audio/') || tipoMime?.startsWith('video/')
      ? 'video'
      : 'raw'
  return [preferido, ...['image', 'video', 'raw'].filter((t) => t !== preferido)]
}

export type ResultadoApagar = {
  public_id: string
  apagado: boolean
  /** Só quando não apagou: o que o Cloudinary respondeu, para o relatório. */
  motivo?: string
}

/**
 * Apaga um arquivo. Nunca lança: a eliminação do banco não pode ser abortada
 * porque o provedor falhou em um arquivo, senão um erro de rede transitório
 * deixaria o pedido do titular sem atendimento nenhum. O que não saiu volta
 * marcado, para o relatório dizer a verdade e alguém poder repetir.
 */
export async function apagarNoCloudinary(
  publicId: string,
  tipoMime: string | null
): Promise<ResultadoApagar> {
  const cloud = Deno.env.get('CLOUDINARY_CLOUD_NAME')
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')
  if (!cloud || !apiKey || !apiSecret) {
    return { public_id: publicId, apagado: false, motivo: 'credencial do Cloudinary ausente' }
  }

  let ultimoMotivo = 'sem resposta'

  for (const tipo of tiposParaTentar(tipoMime)) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const assinatura = await assinar({ public_id: publicId, timestamp }, apiSecret)

    const form = new FormData()
    form.append('public_id', publicId)
    form.append('api_key', apiKey)
    form.append('timestamp', timestamp)
    form.append('signature', assinatura)

    try {
      const resposta = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud}/${tipo}/destroy`,
        { method: 'POST', body: form }
      )
      const dados = (await resposta.json().catch(() => ({}))) as { result?: string; error?: { message?: string } }

      if (dados.result === 'ok') return { public_id: publicId, apagado: true }

      /*
        `not found` neste tipo: pode ser o tipo errado, e aí a próxima volta
        acha. Se todos derem `not found`, o arquivo já não está no Cloudinary —
        conta como apagado, porque o efeito desejado (não existir) é o que
        importa para o titular, e não quem o removeu.
      */
      ultimoMotivo = dados.error?.message ?? dados.result ?? `http ${resposta.status}`
    } catch (erro) {
      ultimoMotivo = erro instanceof Error ? erro.message : 'falha de rede'
    }
  }

  const inexistente = ultimoMotivo === 'not found'
  return {
    public_id: publicId,
    apagado: inexistente,
    motivo: inexistente ? undefined : ultimoMotivo,
  }
}
