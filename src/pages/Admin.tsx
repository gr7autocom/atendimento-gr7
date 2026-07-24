import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { cn } from '../lib/utils'
import { Departamentos } from './admin/Departamentos'
import { Tags } from './admin/Tags'
import { Motivos } from './admin/Motivos'
import { MensagensRapidas } from './admin/MensagensRapidas'
import { ConfiguracoesBot } from './admin/ConfiguracoesBot'
import { HorarioFuncionamento } from './admin/HorarioFuncionamento'
import { Usuarios } from './admin/Usuarios'

const ABAS = [
  { slug: 'departamentos', label: 'Departamentos' },
  { slug: 'tags', label: 'Tags' },
  { slug: 'motivos', label: 'Motivos' },
  { slug: 'mensagens-rapidas', label: 'Mensagens rápidas' },
  { slug: 'horario', label: 'Horário de Funcionamento' },
  { slug: 'bot', label: 'Configurações BOT' },
  { slug: 'usuarios', label: 'Usuários' },
]

export function Admin() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 bg-sf-0/95 backdrop-blur border-b border-bd-1">
        <div className="px-6 h-14 flex items-center">
          <h1 className="text-[15px] font-semibold text-tx-1">Administração</h1>
        </div>
        <nav className="px-6 pb-3 flex flex-wrap gap-1.5">
          {ABAS.map((a) => (
            <NavLink
              key={a.slug}
              to={`/admin/${a.slug}`}
              className={({ isActive }) =>
                cn(
                  'h-7 px-2.5 inline-flex items-center rounded-[6px] text-[13px] transition-colors duration-[120ms]',
                  isActive
                    ? 'bg-br-soft text-br-2 font-medium'
                    : 'text-tx-2 hover:text-tx-1 hover:bg-sf-2'
                )
              }
            >
              {a.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="p-6">
        <Routes>
          <Route index element={<Navigate to="departamentos" replace />} />
          <Route path="departamentos" element={<Departamentos />} />
          <Route path="tags" element={<Tags />} />
          <Route path="motivos" element={<Motivos />} />
          <Route path="mensagens-rapidas" element={<MensagensRapidas />} />
          <Route path="horario" element={<HorarioFuncionamento />} />
          <Route path="bot" element={<ConfiguracoesBot />} />
          <Route path="usuarios" element={<Usuarios />} />
        </Routes>
      </div>
    </div>
  )
}
