import { useState } from 'react'
import { MessageSquarePlus, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCrud } from '../../lib/useCrud'
import { Botao } from '../ui/Botao'
import { cn } from '../../lib/utils'

type Departamento = { id: string; nome: string; ativo: boolean }

const DICA = 'Cria um chamado de exemplo enquanto a integração com o WhatsApp não existe'

/**
 * Cria um chamado de exemplo enquanto não existe integração com o WhatsApp.
 * Some quando a uazapi entrar (aí os chamados chegam pelo webhook).
 * `compacto` rende só o botão de ícone, para caber na barra de ferramentas.
 */
export function SimuladorChamado({ compacto = false }: { compacto?: boolean }) {
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

  if (compacto) {
    return (
      <button
        type="button"
        onClick={simular}
        disabled={criando}
        aria-label="Novo chamado de exemplo"
        title={erro ?? DICA}
        className="w-8 h-8 shrink-0 rounded-[6px] flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2 border border-bd-2 disabled:opacity-60 transition-colors duration-[120ms]"
      >
        <Plus size={16} className={cn(criando && 'animate-spin')} />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {erro && <span className="text-[12px] text-err">{erro}</span>}
      <Botao
        variante="neutro"
        tamanho="sm"
        onClick={simular}
        disabled={criando}
        icone={<MessageSquarePlus size={15} />}
        title={DICA}
      >
        {criando ? 'Criando…' : 'Simular chamado'}
      </Botao>
    </div>
  )
}
