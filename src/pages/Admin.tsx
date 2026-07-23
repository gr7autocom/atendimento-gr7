import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { cn } from '../lib/utils'

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
    <div className="p-6 text-[#ffffff]">
      <h1 className="text-xl font-bold mb-4">Administração</h1>
      <nav className="flex flex-wrap gap-2 mb-6">
        {ABAS.map((a) => (
          <NavLink
            key={a.slug}
            to={`/admin/${a.slug}`}
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded text-sm', isActive ? 'bg-[#ffffff26]' : 'bg-[#ffffff14]')
            }
          >
            {a.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to="departamentos" replace />} />
        {ABAS.map((a) => (
          <Route key={a.slug} path={a.slug} element={<p className="text-[#ffffffb3]">{a.label}: em construção (Plano 3).</p>} />
        ))}
      </Routes>
    </div>
  )
}
