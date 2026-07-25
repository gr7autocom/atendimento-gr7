import { Routes, Route, Navigate } from 'react-router-dom'
import { Departamentos } from './admin/Departamentos'
import { DepartamentoDetalhe } from './admin/DepartamentoDetalhe'
import { Tags } from './admin/Tags'
import { MensagensRapidas } from './admin/MensagensRapidas'
import { ConfiguracoesBot } from './admin/ConfiguracoesBot'
import { HorarioFuncionamento } from './admin/HorarioFuncionamento'
import { Usuarios } from './admin/Usuarios'
import { AtendenteDetalhe } from './admin/AtendenteDetalhe'

/** A navegação entre as seções fica no sidebar; aqui só renderiza a tela da rota. */
export function Admin() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 sm:p-6">
        <Routes>
          <Route index element={<Navigate to="departamentos" replace />} />
          <Route path="departamentos" element={<Departamentos />} />
          <Route path="departamentos/:id" element={<DepartamentoDetalhe />} />
          <Route path="tags" element={<Tags />} />
          <Route path="mensagens-rapidas" element={<MensagensRapidas />} />
          <Route path="horario" element={<HorarioFuncionamento />} />
          <Route path="bot" element={<ConfiguracoesBot />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="usuarios/:id" element={<AtendenteDetalhe />} />
        </Routes>
      </div>
    </div>
  )
}
