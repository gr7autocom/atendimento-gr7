import { Routes, Route, Navigate } from 'react-router-dom'
import { Departamentos } from './admin/Departamentos'
import { Tags } from './admin/Tags'
import { Motivos } from './admin/Motivos'
import { MensagensRapidas } from './admin/MensagensRapidas'
import { ConfiguracoesBot } from './admin/ConfiguracoesBot'
import { HorarioFuncionamento } from './admin/HorarioFuncionamento'
import { Usuarios } from './admin/Usuarios'

/** A navegação entre as seções fica no sidebar; aqui só renderiza a tela da rota. */
export function Admin() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 sm:p-6">
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
