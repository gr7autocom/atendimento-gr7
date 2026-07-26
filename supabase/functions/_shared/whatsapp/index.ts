import type { WhatsAppDriver } from './tipos.ts'
import { DriverUazapi } from './driver-uazapi.ts'
import { DriverMock } from './driver-mock.ts'

export type {
  ConteudoEnvio,
  EventoNormalizado,
  ResultadoConexao,
  ResultadoEnvio,
  StatusConexao,
  WhatsAppDriver,
} from './tipos.ts'

/**
 * Escolhe o driver pelo ambiente: com UAZAPI_BASE_URL + UAZAPI_TOKEN configurados,
 * usa a uazapi real; sem eles, o mock de desenvolvimento. É o único ponto que sabe
 * qual provedor está ativo.
 */
export function criarDriver(): WhatsAppDriver {
  const temChaves = Boolean(Deno.env.get('UAZAPI_BASE_URL') && Deno.env.get('UAZAPI_TOKEN'))
  return temChaves ? new DriverUazapi() : new DriverMock()
}
