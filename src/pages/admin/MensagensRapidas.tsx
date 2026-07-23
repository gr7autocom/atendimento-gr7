import { CatalogoCrud } from '../../components/admin/CatalogoCrud'

export function MensagensRapidas() {
  return (
    <CatalogoCrud
      titulo="Mensagens rápidas"
      tabela="atendimento_mensagens_rapidas"
      orderBy="atalho"
      campos={[
        { nome: 'atalho', label: 'Atalho (depois da /)', tipo: 'texto', obrigatorio: true },
        { nome: 'titulo', label: 'Título', tipo: 'texto', obrigatorio: true },
        { nome: 'texto', label: 'Texto', tipo: 'textarea', obrigatorio: true },
      ]}
      colunas={['atalho', 'titulo']}
    />
  )
}
