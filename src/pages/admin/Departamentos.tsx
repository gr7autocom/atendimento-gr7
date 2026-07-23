import { CatalogoCrud } from '../../components/admin/CatalogoCrud'

export function Departamentos() {
  return (
    <CatalogoCrud
      titulo="Departamentos"
      singular="departamento"
      tabela="departamentos"
      campos={[
        { nome: 'nome', label: 'Nome', tipo: 'texto', obrigatorio: true },
        { nome: 'ordem', label: 'Ordem no menu', tipo: 'numero' },
      ]}
      colunas={['nome', 'ordem']}
    />
  )
}
