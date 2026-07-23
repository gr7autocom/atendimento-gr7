import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { cn } from '../lib/utils'
import { Departamentos } from './admin/Departamentos'
import { Tags } from './admin/Tags'
import { Motivos } from './admin/Motivos'
import { MensagensRapidas } from './admin/MensagensRapidas'

const ABAS = [
  { slug: 'departamentos', label: 'Departamentos' },
  { slug: 'tags', label: 'Tags' },
  { slug: 'motivos', label: 'Motivos' },
  { slug: 'mensagens-rapidas', label: 'Mensagens rápidas' },
  { slug: 'horario', label: 'Horário de Funcionamento' },
  { slug: 'bot', label: 'Configurações BOT' },
  { slug: 'usuarios', label: 'Usuários' },
]

const IMPLEMENTADAS = new Set(['departamentos', 'tags', 'motivos', 'mensagens-rapidas'])

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
        <Route path="departamentos" element={<Departamentos />} />
        <Route path="tags" element={<Tags />} />
        <Route path="motivos" element={<Motivos />} />
        <Route path="mensagens-rapidas" element={<MensagensRapidas />} />
        {ABAS.filter((a) => !IMPLEMENTADAS.has(a.slug)).map((a) => (
          <Route
            key={a.slug}
            path={a.slug}
            element={<p className="text-[#ffffffb3]">{a.label}: chega no Plano 4.</p>}
          />
        ))}
      </Routes>
    </div>
  )
}
