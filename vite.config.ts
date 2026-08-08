import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/*
  Um repositório, um `src/`, DOIS pacotes de publicação.

  As duas aplicações compartilham o design system (`components/ui/`, `tema.css`)
  e por isso vivem no mesmo projeto: separá-las em repositórios obrigaria a
  copiar Botao, Campo, Modal e o tema, que é o custo já pago com o painel e que
  não se paga duas vezes de graça — a segunda cópia começa igual e diverge em
  silêncio na primeira correção que alguém aplicar num lado só.

  O que se separa aqui é o RESULTADO do build. Cada aplicação sai numa pasta
  própria, completa, para subir direto no seu subdomínio:

    dist/atendimento/  →  atendimento.gr7autocom.com.br  (equipe)
    dist/suporte/      →  suporte.gr7autocom.com.br      (cliente)

  Assim o cliente não baixa código da equipe (antes as duas dividiam o mesmo
  pacote de JavaScript), a tela de login da equipe não existe fisicamente no
  endereço do cliente, e publicar é copiar uma pasta para um lugar.
*/

type NomeApp = 'central' | 'cliente'

const APPS = {
  central: {
    entrada: 'index.html',
    saida: 'dist/atendimento',
    htaccess: 'deploy/htaccess-central',
    /*
      Estáticos só da central. O `sw-central.js` não faz cache e não tem
      manifesto ao lado: existe para a notificação do sistema, que em PWA no
      Windows só funciona pelo service worker. A central segue não instalável
      (ADR-11), porque quem torna um site instalável é o manifesto.
    */
    estaticos: ['sw-central.js'] as string[],
  },
  cliente: {
    entrada: 'cliente.html',
    saida: 'dist/suporte',
    htaccess: 'deploy/htaccess-cliente',
    // Tudo de PWA mora só aqui: é o que garante que a central nunca vire
    // instalável, sem depender de configuração de servidor (ADR-11).
    estaticos: [
      'sw.js',
      'cliente.webmanifest',
      'icone-512.png',
      'icone-maskable-512.png',
      'apple-touch-icon.png',
    ],
  },
} satisfies Record<NomeApp, { entrada: string; saida: string; htaccess: string; estaticos: string[] }>

/*
  Estáticos que as duas aplicações usam.

  `icone-192.png` e `nova-mensagem.mp3` são das notificações, e por isso valem
  para os dois lados: o card do sistema mostra o ícone e o som toca quando chega
  mensagem, tanto para o atendente quanto para o cliente. Deixá-los só no pacote
  do cliente daria notificação sem ícone na central, e o navegador não avisa
  quando o ícone não carrega, apenas mostra o padrão dele.
*/
const COMUNS = ['favicon.svg', 'marca-gr7.png', 'icone-192.png', 'nova-mensagem.mp3']

/*
  Arquivo que está em `public/` e não vai para pacote nenhum. Manter a lista
  explícita, com o motivo: um estático que ninguém referencia é indistinguível
  de um estático que alguém esqueceu de ligar.
*/
const SEM_USO = [
  // Sprite de ícones do scaffold, sem nenhuma referência no código (conferido
  // por busca em 2026-08-07). Fica fora dos dois pacotes até virar uso ou lixo.
  'icons.svg',
]

/**
 * Copia os estáticos da aplicação para a pasta dela e leva o `.htaccess` certo.
 *
 * O `publicDir` do Vite é desligado no build (ver abaixo) porque ele copiaria
 * `public/` inteiro para os dois lados, e o service worker do PWA acabaria
 * dentro do pacote da equipe.
 */
function estaticosDoApp(app: NomeApp): Plugin {
  /*
    Nome do JavaScript gerado, que carrega o hash do conteúdo. Vira a versão do
    cache do service worker: muda quando o código muda, e só então.
  */
  let versao = 'dev'

  return {
    name: 'gr7:estaticos-por-app',
    apply: 'build',
    writeBundle(_opcoes, bundle) {
      const entrada = Object.keys(bundle).find((nome) => nome.endsWith('.js'))
      if (entrada) versao = entrada.replace(/^assets\//, '').replace(/\.js$/, '')
    },
    closeBundle() {
      /*
        Guarda: todo arquivo de `public/` precisa estar classificado em uma das
        três listas. Sem isso, acrescentar um estático novo o faria sumir do
        build sem erro nenhum — e sumir em silêncio é pior que quebrar.
      */
      const classificados = new Set([...COMUNS, ...APPS.central.estaticos, ...APPS.cliente.estaticos, ...SEM_USO])
      const soltos = readdirSync('public').filter((arq) => !classificados.has(arq))
      if (soltos.length > 0) {
        throw new Error(
          `Arquivo em public/ sem classificação: ${soltos.join(', ')}.\n` +
            `Acrescente em COMUNS, no estaticos de uma das apps, ou em SEM_USO (com o motivo) no vite.config.ts.`
        )
      }

      const destino = APPS[app].saida
      mkdirSync(destino, { recursive: true })
      for (const arq of [...COMUNS, ...APPS[app].estaticos]) {
        /*
          O service worker é o único estático que não é copiado como está: o
          marcador de versão vira o hash do build, e é isso que faz o cache
          antigo ser apagado quando publicamos (ver o comentário no sw.js).
        */
        if (arq === 'sw.js') {
          const codigo = readFileSync(join('public', arq), 'utf-8').replace('__VERSAO_BUILD__', versao)
          if (codigo.includes('__VERSAO_BUILD__')) {
            throw new Error('sw.js: o marcador __VERSAO_BUILD__ não foi substituído.')
          }
          writeFileSync(join(destino, arq), codigo)
          continue
        }
        copyFileSync(join('public', arq), join(destino, arq))
      }
      copyFileSync(APPS[app].htaccess, join(destino, '.htaccess'))

      /*
        A entrada do cliente se chama `cliente.html` no repositório, para
        conviver com o `index.html` da central na mesma raiz. Publicada, ela é
        a única página da pasta e vira `index.html`: é o nome que todo servidor
        procura sozinho, e sem isso `suporte.gr7autocom.com.br/` dependeria de
        uma regra de reescrita para achar a própria entrada.
      */
      const entradaGerada = join(destino, APPS[app].entrada)
      if (APPS[app].entrada !== 'index.html' && existsSync(entradaGerada)) {
        renameSync(entradaGerada, join(destino, 'index.html'))
      }
    },
  }
}

/**
 * Apaga o `dist/` inteiro antes da primeira passada.
 *
 * O `emptyOutDir` do Vite limpa só a subpasta da aplicação, então sem isto
 * sobrariam os arquivos da estrutura antiga (quando os dois HTML saíam juntos
 * na raiz de `dist/`) e ninguém saberia que estão velhos.
 */
function limparDist(): Plugin {
  return {
    name: 'gr7:limpar-dist',
    apply: 'build',
    buildStart() {
      rmSync('dist', { recursive: true, force: true })
    },
  }
}

export function configDoApp(app: NomeApp) {
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(app === 'central' ? [limparDist()] : []),
      estaticosDoApp(app),
    ],
    /*
      Desligado no build (a cópia vira responsabilidade do plugin acima) e
      ligado no dev, onde as duas aplicações dividem o mesmo servidor e
      precisam alcançar a logo e o favicon em `/`.
    */
    publicDir: false as const,
    build: {
      outDir: APPS[app].saida,
      emptyOutDir: true,
      rollupOptions: { input: { [app]: APPS[app].entrada } },
    },
  }
}

// Config padrão: a central. É a que o `vite` (dev) e o `vitest` leem.
// O pacote do cliente sai por `vite build --config vite.cliente.config.ts`.
export default defineConfig(({ command }) => ({
  ...configDoApp('central'),
  // Em dev o servidor responde por `/` (central) e `/cliente.html` (cliente),
  // então `public/` precisa ser servido normalmente.
  publicDir: command === 'serve' ? 'public' : false,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // env dummy p/ os testes: sem isso, src/lib/supabase.ts lança no import
    // (ele exige VITE_SUPABASE_URL/ANON_KEY). Valores falsos bastam: sem sessão
    // salva, getSession() resolve como null sem bater na rede.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
}))
