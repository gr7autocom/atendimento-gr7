// A referência fica aqui, e não em `types` do tsconfig.app.json, porque o código
// da aplicação roda no navegador e não deve enxergar a API do Node. Só este teste
// precisa ler arquivos.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Guarda do design system.
 *
 * Por que existe: a auditoria de 2026-07-29/30 encontrou 24 problemas e a maioria
 * era mecânica (valor literal onde havia token, campo reescrito à mão em vez do
 * componente, `confirm()` do navegador). Tudo isso estava documentado em
 * docs/design.md ANTES da auditoria, e ainda assim aconteceu, porque documentação
 * depende de alguém abrir o arquivo. Este teste falha na hora, no mesmo `npm test`
 * que já roda, e diz o que usar no lugar.
 *
 * O que este teste NÃO cobre (continua exigindo olhar humano): contraste de cor
 * nova, hierarquia de título, qualidade de copy, alvo de toque e responsividade.
 * Ver o checklist em docs/design.md.
 *
 * Ao adicionar exceção, escreva o motivo na allowlist. Exceção sem motivo é
 * como o problema começa.
 */

// `process.cwd()` e não `import.meta.url`: no vitest com jsdom o import.meta.url
// vem como URL http do servidor do vite, não como file://, e a conversão falha.
// O vitest roda a partir da raiz do projeto.
const RAIZ = join(process.cwd(), 'src')

function arquivosUI(dir = RAIZ): string[] {
  return readdirSync(dir).flatMap((nome: string) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivosUI(caminho)
    // .ts entra junto: hook e helper de UI moram em lib/ e escapavam da varredura.
    const ehFonte = /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)
    return ehFonte ? [caminho] : []
  })
}

type Achado = { arquivo: string; linha: number; trecho: string }

/** Varre os .tsx e devolve as linhas que casam, respeitando a allowlist. */
function procurar(padrao: RegExp, permitir: (arquivo: string, linha: string) => boolean = () => false): Achado[] {
  const achados: Achado[] = []
  for (const caminho of arquivosUI()) {
    const arquivo = relative(RAIZ, caminho).replace(/\\/g, '/')
    readFileSync(caminho, 'utf-8')
      // `\r?\n`, não `\n`: os arquivos estão em CRLF e o `\r` sobrando quebra
      // todo regex ancorado em `$`, porque em JS o `.` não casa `\r`. Sem isso o
      // filtro de comentário não filtrava nada.
      .split(/\r?\n/)
      .forEach((linha: string, i: number) => {
        // Comentário não é código: não vale como violação. Cobre `//`, `/* */` e
        // a linha de continuação de JSDoc, que começa com `*`.
        const semComentario = linha
          .replace(/\/\/.*$/, '')
          .replace(/\/\*.*?\*\//g, '')
          .replace(/^\s*\*.*$/, '')
          .replace(/^\s*\/\*.*$/, '')
        if (!padrao.test(semComentario)) return
        if (permitir(arquivo, linha)) return
        achados.push({ arquivo, linha: i + 1, trecho: linha.trim().slice(0, 100) })
      })
  }
  return achados
}

function relatar(achados: Achado[], comoCorrigir: string) {
  if (achados.length === 0) return ''
  const lista = achados.map((a) => `  ${a.arquivo}:${a.linha}\n    ${a.trecho}`).join('\n')
  return `\n${achados.length} ocorrência(s).\n${comoCorrigir}\nVer docs/design.md.\n\n${lista}\n`
}

describe('padrões de UI (docs/design.md)', () => {
  it('usa os tokens de raio, não o valor em px', () => {
    const achados = procurar(/rounded-\[\d+px\]/, (arquivo, linha) =>
      // A marca d'água da conversa vazia é ornamento de um lugar só, com raio
      // muito maior que qualquer superfície do sistema.
      arquivo === 'components/inbox/Conversa.tsx' && linha.includes('rounded-[24px]')
    )
    expect(
      relatar(achados, 'Use rounded-micro (4px), rounded-1 (6px), rounded-2 (10px) ou rounded-3 (12px).')
    ).toBe('')
  })

  it('usa a escala tipográfica, não o tamanho em px', () => {
    const achados = procurar(/text-\[\d+px\]/)
    expect(
      relatar(
        achados,
        'Use text-micro, text-mini, text-apoio, text-corpo, text-corpo-lg, text-titulo, text-destaque ou text-metrica.'
      )
    ).toBe('')
  })

  it('usa a classe de transição, não duração literal', () => {
    const achados = procurar(/duration-\[\d+ms\]|transition-colors/)
    expect(relatar(achados, 'Use a classe transicao (ou transicao-2 quando houver transform).')).toBe('')
  })

  it('usa os tokens de sombra, não o valor literal', () => {
    const achados = procurar(/shadow-\[/)
    expect(relatar(achados, 'Use shadow-1 (sutil) ou shadow-2 (elevado).')).toBe('')
  })

  it('dá contraste de borda aos campos (WCAG 1.4.11)', () => {
    // Borda de controle precisa de 3:1. bd-2 dá 1,31:1 e o campo desaparece.
    const achados = procurar(/border-bd-2/, (_arquivo, linha) => {
      const ehCampo = /<input|<select|<textarea|placeholder:|placeholder=/.test(linha)
      return !ehCampo // borda de botão e de contêiner pode ser sutil
    })
    expect(relatar(achados, 'Campo usa border-bd-campo. Melhor ainda: use Entrada/Selecao/AreaTexto de ui/Campo.')).toBe('')
  })

  it('não usa diálogo do navegador', () => {
    const achados = procurar(/\b(confirm|alert|prompt)\(/)
    expect(
      relatar(achados, 'Use ModalConfirmar (ação destrutiva) ou Modal. O diálogo do sistema abre em tema claro.')
    ).toBe('')
  })

  it('mantém cor categórica em lib/cores.ts', () => {
    const achados = procurar(
      /#[0-9a-fA-F]{3,8}\b/,
      (arquivo) =>
        // lib/cores.ts É o lugar da cor categórica, então é o único que pode ter
        // hex. Tags deixa o admin escolher a cor, e o padrão precisa de um valor.
        arquivo === 'lib/cores.ts' || arquivo === 'pages/admin/Tags.tsx'
    )
    expect(
      relatar(achados, 'Cor de superfície e texto vem dos tokens (tema.css). Cor por item vem de lib/cores.ts.')
    ).toBe('')
  })

  it('centraliza o fechar-ao-clicar-fora em lib/useFecharFora', () => {
    const achados = procurar(/addEventListener\('mousedown'|addEventListener\("mousedown"/, (arquivo) =>
      arquivo === 'lib/useFecharFora.ts'
    )
    expect(relatar(achados, 'Use o hook useFecharFora de lib/useFecharFora, que também fecha no Esc.')).toBe('')
  })

  it('não usa emoji como ícone', () => {
    const achados = procurar(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    expect(relatar(achados, 'Use ícone do lucide-react. Emoji muda de desenho por sistema e não aceita token de cor.')).toBe('')
  })

  it('não monta spinner de carregamento à mão', () => {
    const achados = procurar(/Loader2/, (arquivo) => arquivo === 'components/ui/Botao.tsx')
    expect(relatar(achados, 'Use a prop carregando do Botao, que também marca aria-busy e trava o clique.')).toBe('')
  })

  /*
    As duas regras abaixo valem só para `src/cliente/`, o app do cliente. Elas
    estavam escritas em docs/canal-web.md desde o desenho do canal e nunca foram
    verificadas por nada — e este projeto já tem o caso de 2026-08-06, em que as
    regras da Edge Function estavam no comentário e só viraram teste depois.
  */
  it('o app do cliente não embarca o Supabase nem o login', () => {
    const achados = procurar(/@supabase|lib\/supabase|lib\/auth/, (arquivo) => !arquivo.startsWith('cliente/'))
    expect(
      relatar(
        achados,
        'src/cliente/ fala com o servidor só pela Edge Function, por fetch (cliente/api.ts). ' +
          'Importar o supabase-js aqui embarcaria a chave anônima num app que qualquer pessoa abre sem login.'
      )
    ).toBe('')
  })

  it('o app do cliente não sobe arquivo direto para o Storage', () => {
    const achados = procurar(/lib\/storage/, (arquivo) => !arquivo.startsWith('cliente/'))
    expect(
      relatar(
        achados,
        'lib/storage.ts manda o arquivo do navegador com a sessão do atendente logado. Na central ' +
          'tudo bem, quem abre é funcionário autenticado. No app do cliente o navegador é de ' +
          'qualquer pessoa da internet, sem sessão de atendente nenhuma. Lá o upload passa pela ' +
          'Edge Function (rota /anexo).'
      )
    ).toBe('')
  })

  it('o app do cliente não injeta HTML', () => {
    const achados = procurar(/dangerouslySetInnerHTML/, (arquivo) => !arquivo.startsWith('cliente/'))
    expect(
      relatar(
        achados,
        'Renderize como texto. O token de sessão do cliente fica no localStorage, ' +
          'então XSS aqui não é teórico: é a conversa de outra pessoa.'
      )
    ).toBe('')
  })
})
