import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCrud } from '../../lib/useCrud'

type Departamento = { id: string; nome: string; ativo: boolean }

/**
 * Cria um chamado de exemplo enquanto não existe integração com o WhatsApp.
 * Some quando a uazapi entrar (aí os chamados chegam pelo webhook).
 */
export function SimuladorChamado() {
  const departamentos = useCrud<Departamento>('departamentos')
  const qc = useQueryClient()
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function simular() {
    setCriando(true)
    setErro(null)
    try {
      const dep = (departamentos.lista.data ?? []).find((d) => d.ativo !== false)
      const sufixo = String(Math.floor(Math.random() * 90000) + 10000)
      const telefone = `+5511${sufixo}9000`

      const { data: contato, error: e1 } = await supabase
        .from('contatos')
        .insert({ telefone, nome_whatsapp: `Cliente ${sufixo}` } as never)
        .select('id')
        .single()
      if (e1) throw e1

      const { data: at, error: e2 } = await supabase
        .from('atendimentos')
        .insert({
          contato_id: (contato as { id: string }).id,
          departamento_id: dep?.id ?? null,
          status: 'na_fila',
          canal: 'whatsapp',
        } as never)
        .select('id')
        .single()
      if (e2) throw e2

      const { error: e3 } = await supabase.from('atendimento_mensagens').insert({
        atendimento_id: (at as { id: string }).id,
        direcao: 'entrada',
        origem: 'cliente',
        corpo: 'Olá, preciso de ajuda com o sistema.',
      } as never)
      if (e3) throw e3

      qc.invalidateQueries({ queryKey: ['atendimentos'] })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao simular o chamado.')
    } finally {
      setCriando(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={simular}
        disabled={criando}
        title="Cria um chamado de exemplo enquanto a integração com o WhatsApp não existe"
        className="flex items-center gap-1 rounded bg-[#ffffff14] text-[#ffffff] text-sm px-3 py-1.5 disabled:opacity-50"
      >
        <MessageSquarePlus size={16} /> {criando ? 'Criando…' : 'Simular chamado'}
      </button>
      {erro && <span className="text-red-400 text-xs">{erro}</span>}
    </div>
  )
}
