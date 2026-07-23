import { CatalogoCrud } from '../../components/admin/CatalogoCrud'

export function Tags() {
  return (
    <CatalogoCrud
      titulo="Tags"
      tabela="atendimento_tags"
      campos={[
        { nome: 'nome', label: 'Nome', tipo: 'texto', obrigatorio: true },
        { nome: 'ordem', label: 'Ordem', tipo: 'numero' },
      ]}
      colunas={['nome', 'ordem']}
    />
  )
}
