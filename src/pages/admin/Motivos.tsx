import { CatalogoCrud } from '../../components/admin/CatalogoCrud'

export function Motivos() {
  return (
    <CatalogoCrud
      titulo="Motivos"
      singular="motivo"
      tabela="atendimento_motivos"
      campos={[
        { nome: 'nome', label: 'Nome', tipo: 'texto', obrigatorio: true },
        { nome: 'ordem', label: 'Ordem', tipo: 'numero' },
      ]}
      colunas={['nome', 'ordem']}
    />
  )
}
