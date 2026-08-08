import { useState, type ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Bell, BellOff, ChevronDown, LogOut, ArrowLeft } from 'lucide-react'
import { estadoDaPermissao, pedirPermissao, type EstadoPermissao } from '../lib/notificacoes'
import { useAuth } from '../lib/auth'
import { usePermissao } from '../lib/permissoes'
import { useStatusBot } from '../lib/useStatusBot'
import { ITENS_NAV } from './SidebarRecolhida'
import { Avatar } from './ui/Avatar'
import { PainelMenu, ItemMenu } from './ui/Menu'
import { Marca } from './ui/Marca'
import { useFecharFora } from '../lib/useFecharFora'
import { cn } from '../lib/utils'

/** Pílula de status da conexão do WhatsApp, visível a admin e atendente. */
function PilulaStatusBot({ isAdmin }: { isAdmin: boolean }) {
  const { status } = useStatusBot()
  const conectado = status === 'conectado'
  const titulo = conectado
    ? 'WhatsApp conectado. O bot está recebendo mensagens.'
    : 'WhatsApp desconectado. As mensagens não chegam até reconectar.'

  const pilula = (
    <span
      title={titulo}
      className={cn(
        'inline-flex items-center gap-1.5 h-6 pl-1.5 pr-2 rounded-full text-mini font-medium shrink-0',
        conectado ? 'bg-ok-soft text-ok' : 'bg-err-soft text-err'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', conectado ? 'bg-ok' : 'bg-err')} />
      <span className="hidden sm:inline">Bot {conectado ? 'conectado' : 'desconectado'}</span>
    </span>
  )

  // Admin pode agir: a pílula leva à tela de Conexão para reconectar.
  return isAdmin ? (
    <Link to="/admin/conexao" className="rounded-full focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]">
      {pilula}
    </Link>
  ) : (
    pilula
  )
}

/**
 * Sino do topo: liga a notificação do sistema.
 *
 * Antes era um ícone sem função nenhuma, o que é pior que não existir: quem
 * clicava concluía que o produto estava quebrado. Agora ele tem três estados,
 * e cada um diz a verdade sobre o que acontece.
 *
 * O pedido de permissão sai daqui, de um clique, e não sozinho ao carregar a
 * página: navegador pune quem pede sem contexto, e um "bloquear" dado no susto
 * é praticamente definitivo, porque o caminho para desfazer está escondido nas
 * configurações do site.
 */
function BotaoNotificacoes() {
  const [estado, setEstado] = useState<EstadoPermissao>(() => estadoDaPermissao())
  if (estado === 'indisponivel') return null

  const rotulo =
    estado === 'concedida'
      ? 'Avisos do sistema ligados'
      : estado === 'negada'
        ? 'Avisos bloqueados pelo navegador. Libere nas permissões do site.'
        : 'Ligar avisos de mensagem nova'

  return (
    <button
      type="button"
      onClick={async () => {
        if (estado === 'a_perguntar') setEstado(await pedirPermissao())
      }}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        'w-8 h-8 rounded-1 flex items-center justify-center transicao',
        estado === 'concedida'
          ? 'text-br-2 hover:bg-sf-2'
          : estado === 'negada'
            ? 'text-tx-3 hover:bg-sf-2'
            : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
      )}
    >
      {estado === 'negada' ? <BellOff size={17} /> : <Bell size={17} />}
    </button>
  )
}

/**
 * Barra horizontal do topo, comum às duas cascas (Atendimento e Admin).
 * Marca à esquerda, notificações e usuário à direita. O menu do usuário
 * guarda o "Sair" e qualquer navegação secundária passada em `menu`.
 */
export function BarraTopo({ menu }: { menu?: ReactNode }) {
  const { signOut, usuario } = useAuth()
  const { isAdmin } = usePermissao()
  const [aberto, setAberto] = useState(false)
  // Fechar ao clicar fora e no Esc vem do hook compartilhado (lib/useFecharFora).
  const ref = useFecharFora<HTMLDivElement>(aberto, () => setAberto(false))
  const itensNav = ITENS_NAV.filter((i) => !i.adminOnly || isAdmin)

  return (
    <header className="h-14 shrink-0 px-3 sm:px-4 flex items-center justify-between gap-3 bg-sf-1 border-b border-bd-1">
      <div className="flex items-center gap-2.5 min-w-0">
        <Marca />
        <PilulaStatusBot isAdmin={isAdmin} />
      </div>

      <div className="flex items-center gap-1.5">
        <BotaoNotificacoes />

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={aberto}
            className="flex items-center gap-2 h-8 pl-1 pr-1.5 rounded-1 hover:bg-sf-2 transicao"
          >
            <Avatar nome={usuario?.nome ?? usuario?.email ?? '?'} fotoUrl={usuario?.foto_url} tamanho={26} />
            <span className="hidden sm:block text-corpo text-tx-1 max-w-[140px] truncate">
              {usuario?.nome ?? 'Usuário'}
            </span>
            <ChevronDown size={14} className={cn('text-tx-3 transition-transform', aberto && 'rotate-180')} />
          </button>

          {aberto && (
            <PainelMenu
              rotulo="Conta"
              className="hidden lg:block right-0 top-[calc(100%+6px)] w-56 py-1"
            >
              <div className="px-3 py-2 border-b border-bd-1">
                <div className="text-corpo text-tx-1 truncate">{usuario?.nome ?? 'Usuário'}</div>
                <div className="text-mini text-tx-3 truncate">{usuario?.email}</div>
              </div>
              {menu && <div className="py-1 border-b border-bd-1">{menu}</div>}
              {/* Sair é destrutivo (encerra a sessão): tom de perigo e por último,
                  separado das ações comuns. */}
              <ItemMenu onClick={() => signOut()} icone={<LogOut size={15} />} perigo>
                Sair
              </ItemMenu>
            </PainelMenu>
          )}

          {/* Mobile: menu em tela cheia, aberto ao tocar na foto (o sidebar de ícones não existe no mobile) */}
          {aberto && (
        <div className="lg:hidden fixed inset-0 z-40 bg-sf-0 flex flex-col">
          <div className="h-16 shrink-0 px-3 flex items-center gap-3 bg-sf-1 border-b border-bd-1">
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Voltar"
              className="w-9 h-9 shrink-0 rounded-1 flex items-center justify-center text-tx-2 hover:text-tx-1 hover:bg-sf-2"
            >
              <ArrowLeft size={18} />
            </button>
            <Avatar nome={usuario?.nome ?? usuario?.email ?? '?'} fotoUrl={usuario?.foto_url} tamanho={38} />
            <div className="min-w-0">
              <div className="text-corpo-lg font-semibold text-tx-1 truncate">{usuario?.nome ?? 'Usuário'}</div>
              <div className="text-apoio text-tx-3 truncate">{usuario?.permissao?.nome ?? usuario?.email}</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-2" aria-label="Menu">
            <div className="rotulo px-4 pt-2 pb-1 text-tx-3">Menu</div>
            {itensNav.map((i) => {
              const Icone = i.icone
              return (
                <NavLink
                  key={i.to}
                  to={i.to}
                  onClick={() => setAberto(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 w-full px-4 h-12 text-corpo-lg border-b border-bd-1 transicao',
                      isActive ? 'text-tx-1 bg-sf-2 font-medium' : 'text-tx-1 hover:bg-sf-2'
                    )
                  }
                >
                  <Icone size={18} className="text-tx-2 shrink-0" /> {i.label}
                </NavLink>
              )
            })}

            <div className="rotulo px-4 pt-4 pb-1 text-tx-3">Conta</div>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-3 w-full px-4 h-12 text-corpo-lg text-tx-1 border-b border-bd-1 hover:bg-sf-2 transicao"
            >
              <LogOut size={18} className="text-tx-2 shrink-0" /> Sair
            </button>
          </nav>

          <div className="shrink-0 flex justify-center py-3">
            <Marca tamanho="sm" />
          </div>
        </div>
      )}
        </div>
      </div>
    </header>
  )
}

/**
 * Item de navegação usado dentro do menu do usuário (ex.: acesso cruzado do
 * admin). Reexporta o `ItemMenu` de ui/Menu para as telas que já importavam
 * daqui não precisarem mudar.
 */
export { ItemMenu as ItemMenuTopo }
