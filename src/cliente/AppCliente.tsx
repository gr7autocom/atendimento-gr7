import { useCallback, useEffect, useRef, useState } from 'react'
import { Identificacao, type DadosIdentificacao } from './Identificacao'
import { ConversaCliente, type MensagemPendente } from './ConversaCliente'
import { Carregando, Recado } from './Estados'
import { avisar, tocarAvisoSonoro } from '../lib/notificacoes'
import {
  api,
  erroDeCampo,
  mensagemDeErro,
  sessaoMorreu,
  type Conversa,
  type DepartamentoWeb,
  type Disponibilidade,
} from './api'
import { lerSessao, limparSessao, salvarSessao } from './sessao'

/**
 * Casca do PWA do cliente: decide entre formulário e conversa, e mantém a
 * conversa atualizada.
 *
 * Não existe roteador. São dois destinos, e quem decide entre eles é ter ou não
 * uma sessão viva no navegador, não a URL. Um roteador aqui só acrescentaria uma
 * dependência e um caminho a mais para o cliente cair fora do lugar.
 */

/*
  Ritmo do polling. 10s é o mesmo número que a presença do cliente na central
  assume ao considerar alguém ausente depois de 45s (três ciclos perdidos), então
  mudar aqui pede mudar lá.
*/
const INTERVALO_MS = 10_000

type Rascunho = {
  dados: DadosIdentificacao
  setor: DepartamentoWeb | null
  /** O que o bot ja disse na tela, na ordem. O servidor grava igual depois. */
  falas: { origem: 'bot' | 'cliente'; corpo: string }[]
}

/** A conversa que a tela mostra enquanto o chamado ainda nao existe. */
function conversaLocal(rascunho: Rascunho): Conversa {
  const base = Date.now()
  return {
    protocolo: null,
    status: 'na_fila',
    encerrado: false,
    departamento: rascunho.setor?.nome ?? null,
    atendente: null,
    aguardando_avaliacao: false,
    // Antes da primeira mensagem nada foi gravado, então não há anexo: só o
    // bot falou até aqui.
    anexos: [],
    mensagens: rascunho.falas.map((f, i) => ({
      id: `local-${i}`,
      direcao: f.origem === 'cliente' ? 'entrada' : 'saida',
      origem: f.origem,
      corpo: f.corpo,
      created_at: new Date(base + i).toISOString(),
    })),
  }
}

export function AppCliente() {
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade | null>(null)
  const [conversa, setConversa] = useState<Conversa | null>(null)
  /*
    Cópia em ref para o `buscarConversa` comparar o antes e o depois. Ela é
    `useCallback` com dependências fixas: lendo o estado direto, veria sempre a
    conversa do primeiro render e acharia que tudo é mensagem nova.
  */
  const conversaRef = useRef<Conversa | null>(null)
  const [token, setToken] = useState<string | null>(() => lerSessao()?.token ?? null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [recado, setRecado] = useState<string | null>(null)
  const [erroCampo, setErroCampo] = useState<{ campo: string; texto: string } | null>(null)
  const [pendentes, setPendentes] = useState<MensagemPendente[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  /*
    O rascunho e a conversa antes de existir chamado: identidade preenchida,
    setor escolhido e as falas do bot que a pessoa ja leu na tela. Nada disso
    foi gravado, e some se ela fechar a aba, que e exatamente a intencao (quem
    desiste no meio nao deixa contato orfao nem protocolo gasto).
  */
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)

  // Guarda o token para o polling não reiniciar a cada render.
  const tokenRef = useRef(token)
  tokenRef.current = token

  const encerrarSessaoLocal = useCallback((aviso: string | null) => {
    limparSessao()
    setToken(null)
    setConversa(null)
    setPendentes([])
    if (aviso) setRecado(aviso)
  }, [])

  const buscarConversa = useCallback(async () => {
    const t = tokenRef.current
    if (!t) return
    try {
      const nova = await api.conversa(t)
      /*
        Aviso de resposta do atendente.

        Compara com o que já estava na tela: se apareceu mensagem que não é do
        próprio cliente, é resposta chegando. Sem a comparação, cada volta do
        polling (de 10 em 10 segundos) tocaria o som de novo.

        Só o que veio de fora conta. A mensagem que o próprio cliente acabou de
        mandar também aumenta a lista, e avisar a pessoa sobre o que ela mesma
        escreveu seria ruído puro.
      */
      const antes = conversaRef.current
      if (antes) {
        const conhecidas = new Set(antes.mensagens.map((m) => m.id))
        const chegaram = nova.mensagens.filter((m) => !conhecidas.has(m.id) && m.origem !== 'cliente')
        if (chegaram.length > 0) {
          tocarAvisoSonoro()
          // Card do sistema só com a aba escondida: com o app à frente, a
          // mensagem já apareceu na conversa.
          if (document.visibilityState !== 'visible') {
            avisar({
              titulo: 'GR7 Atendimento',
              corpo: chegaram[chegaram.length - 1].corpo ?? 'Você recebeu um arquivo.',
              url: '/',
              tag: 'resposta-atendimento',
            })
          }
        }
      }
      conversaRef.current = nova
      setConversa(nova)
    } catch (erro) {
      // Só a morte da sessão derruba o cliente para o formulário. Falha de rede
      // mantém a conversa na tela: ele volta do elevador e continua de onde parou.
      if (sessaoMorreu(erro)) {
        encerrarSessaoLocal('Sua conversa não está mais disponível neste aparelho. Inicie outro atendimento.')
      }
    }
  }, [encerrarSessaoLocal])

  // Primeira carga: com sessão viva vai direto para a conversa; sem ela, pergunta
  // ao servidor se dá para abrir chamado agora.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        if (tokenRef.current) {
          const c = await api.conversa(tokenRef.current)
          if (vivo) setConversa(c)
        } else {
          const d = await api.disponibilidade()
          if (vivo) setDisponibilidade(d)
        }
      } catch (erro) {
        if (!vivo) return
        if (sessaoMorreu(erro)) {
          limparSessao()
          setToken(null)
          tokenRef.current = null
          try {
            setDisponibilidade(await api.disponibilidade())
          } catch {
            setRecado(mensagemDeErro(erro))
          }
        } else {
          setRecado(mensagemDeErro(erro))
        }
      } finally {
        if (vivo) setCarregando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [])

  /*
    Polling pausado com a aba escondida, e uma busca imediata ao voltar.

    Dois ganhos: não gastamos invocação com quem deixou a aba aberta a manhã
    toda, e a presença que o atendente vê passa a dizer a verdade, porque quem
    está com a aba em segundo plano de fato não está lendo.
  */
  useEffect(() => {
    if (!token || conversa?.encerrado) return
    let id: number | undefined
    const parar = () => {
      if (id) window.clearInterval(id)
      id = undefined
    }
    const comecar = () => {
      parar()
      id = window.setInterval(buscarConversa, INTERVALO_MS)
    }
    const aoMudarVisibilidade = () => {
      if (document.hidden) parar()
      else {
        buscarConversa()
        comecar()
      }
    }
    if (!document.hidden) comecar()
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => {
      parar()
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    }
  }, [token, conversa?.encerrado, buscarConversa])

  /*
    Ficou sem sessão e sem formulário para mostrar? Busca a disponibilidade.

    O caso concreto apareceu no teste: o cliente entrou direto na conversa (tinha
    token), o atendente encerrou o acesso, e a tela caiu num "não conseguimos
    carregar o atendimento" porque a disponibilidade nunca tinha sido buscada
    nesta visita. O certo é ele voltar ao formulário podendo abrir outro chamado.
  */
  useEffect(() => {
    if (token || disponibilidade || carregando) return
    let vivo = true
    ;(async () => {
      try {
        const d = await api.disponibilidade()
        if (vivo) setDisponibilidade(d)
      } catch (erro) {
        if (vivo) setRecado((atual) => atual ?? mensagemDeErro(erro))
      }
    })()
    return () => {
      vivo = false
    }
  }, [token, disponibilidade, carregando])

  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine)
    window.addEventListener('online', atualizar)
    window.addEventListener('offline', atualizar)
    return () => {
      window.removeEventListener('online', atualizar)
      window.removeEventListener('offline', atualizar)
    }
  }, [])

  /*
    Sair do formulario NAO cria nada no servidor. Guarda a identidade e comeca a
    conversa na tela, com as falas do bot que vieram na disponibilidade.
  */
  function comecarConversa(dados: DadosIdentificacao) {
    if (!disponibilidade) return
    const t = disponibilidade.textos
    setErroCampo(null)
    setRecado(null)
    setRascunho({
      dados,
      setor: null,
      falas: [
        ...(t.bem_vindo ? [{ origem: 'bot' as const, corpo: t.bem_vindo }] : []),
        { origem: 'bot', corpo: t.pergunta_setor },
      ],
    })
  }

  /*
    Escolha do setor: continua so na tela. O bot responde pedindo o relato, e e
    esse relato que vai finalmente criar o chamado.
  */
  function escolherSetor(departamentoId: string) {
    const setor = disponibilidade?.departamentos.find((d) => d.id === departamentoId)
    if (!setor || !rascunho || !disponibilidade) return
    setRascunho({
      ...rascunho,
      setor,
      falas: [
        ...rascunho.falas,
        { origem: 'cliente', corpo: setor.nome },
        { origem: 'bot', corpo: disponibilidade.textos.pedir_relato },
      ],
    })
  }

  /*
    Primeira mensagem: e aqui que o chamado nasce, com identidade, setor e
    relato de uma vez. Falhou? O rascunho fica na tela e a pessoa tenta de novo,
    sem reescrever nada.
  */
  async function abrirChamado(texto: string) {
    if (!rascunho?.setor) return
    setEnviando(true)
    setErroCampo(null)
    setRecado(null)
    try {
      const sessao = await api.identificar({
        nome: rascunho.dados.nome,
        telefone: rascunho.dados.telefone,
        cnpj: rascunho.dados.cnpj || undefined,
        departamento_id: rascunho.setor.id,
        mensagem: texto,
        aceite: rascunho.dados.aceite,
      })
      salvarSessao({ token: sessao.token, expira_em: sessao.expira_em, protocolo: sessao.protocolo })
      setToken(sessao.token)
      tokenRef.current = sessao.token
      setRascunho(null)
      await buscarConversa()
    } catch (erro) {
      const doCampo = erroDeCampo(erro)
      // Erro num campo do formulario (telefone, CNPJ) volta para o formulario:
      // o campo errado esta la, nao aqui.
      if (doCampo && doCampo.campo !== 'mensagem') {
        setErroCampo(doCampo)
        setRascunho(null)
      } else {
        setRecado(doCampo?.texto ?? mensagemDeErro(erro))
      }
    } finally {
      setEnviando(false)
    }
  }

  /*
    Envio otimista com marca de pendente. A mensagem aparece na hora e só sai da
    lista de pendentes quando a conversa recarregada já a contém. Se falhar, ela
    FICA na tela marcada como não enviada, com "tentar de novo": sumir em
    silêncio faria o cliente achar que pediu socorro.
  */
  /**
   * Manda um anexo. Devolve o texto do erro, ou `null` se deu certo.
   *
   * Sem envio otimista, ao contrário do texto: a bolha de texto aparece na hora
   * porque o conteúdo já está na tela e é barato repetir. Aqui o arquivo ainda
   * precisa viajar, e desenhar uma miniatura que talvez não exista no servidor
   * seria a promessa exata que este canal evita fazer. O botão gira enquanto
   * sobe e a conversa recarrega quando termina.
   */
  async function enviarArquivo(arquivo: File): Promise<string | null> {
    const t = tokenRef.current
    if (!t) return 'Sua conversa não está mais disponível neste aparelho.'
    try {
      await api.anexo(t, arquivo)
      await buscarConversa()
      return null
    } catch (erro) {
      if (sessaoMorreu(erro)) {
        // Mesmo caminho do polling: derruba para o formulário com o motivo, em
        // vez de deixar o cliente insistindo num token que já morreu.
        limparSessao()
        setToken(null)
        tokenRef.current = null
        setRecado(mensagemDeErro(erro))
        return null
      }
      return mensagemDeErro(erro)
    }
  }

  /**
   * Apagar e editar a própria mensagem. Devolvem o texto do erro, ou `null`.
   *
   * A conversa é recarregada no sucesso em vez de a tela ajustar sozinha: o
   * servidor é quem sabe se o prazo valia, e mexer na lista local antes da
   * resposta mostraria uma mensagem sumindo que continua lá.
   */
  async function apagarMensagem(id: string): Promise<string | null> {
    const t = tokenRef.current
    if (!t) return 'Sua conversa não está mais disponível neste aparelho.'
    try {
      await api.apagarMensagem(t, id)
      await buscarConversa()
      return null
    } catch (erro) {
      return mensagemDeErro(erro)
    }
  }

  async function editarMensagem(id: string, texto: string): Promise<string | null> {
    const t = tokenRef.current
    if (!t) return 'Sua conversa não está mais disponível neste aparelho.'
    try {
      await api.editarMensagem(t, id, texto)
      await buscarConversa()
      return null
    } catch (erro) {
      return mensagemDeErro(erro)
    }
  }

  async function enviarMensagem(texto: string, idExistente?: string) {
    const t = tokenRef.current
    if (!t) return
    const id = idExistente ?? crypto.randomUUID()
    setPendentes((atual) => [
      ...atual.filter((p) => p.client_msg_id !== id),
      { client_msg_id: id, corpo: texto, falhou: false },
    ])
    try {
      await api.mensagem(t, texto, id)
      await buscarConversa()
      setPendentes((atual) => atual.filter((p) => p.client_msg_id !== id))
    } catch (erro) {
      if (sessaoMorreu(erro)) {
        encerrarSessaoLocal('Sua conversa foi encerrada. Inicie outro atendimento se precisar.')
        return
      }
      setPendentes((atual) => atual.map((p) => (p.client_msg_id === id ? { ...p, falhou: true } : p)))
    }
  }

  async function encerrar() {
    const t = tokenRef.current
    if (!t) return
    setEnviando(true)
    try {
      await api.encerrar(t)
      await buscarConversa()
    } catch (erro) {
      setRecado(mensagemDeErro(erro))
    } finally {
      setEnviando(false)
    }
  }

  async function avaliar(nota: number) {
    const t = tokenRef.current
    if (!t) return
    setEnviando(true)
    try {
      await api.avaliar(t, nota)
      await buscarConversa()
    } catch (erro) {
      setRecado(mensagemDeErro(erro))
    } finally {
      setEnviando(false)
    }
  }

  function abrirOutro() {
    encerrarSessaoLocal(null)
    tokenRef.current = null
    // A disponibilidade é recarregada pelo efeito acima: o horário pode ter
    // virado enquanto a conversa estava aberta, e abrir chamado fora do
    // expediente é justamente o que a tela evita.
    setDisponibilidade(null)
  }

  if (carregando) return <Carregando />

  // Conversa que ainda so existe na tela, antes de o chamado nascer.
  if (!token && rascunho) {
    return (
      <ConversaCliente
        conversa={conversaLocal(rascunho)}
        aguardandoSetor={!rascunho.setor}
        departamentos={disponibilidade?.departamentos ?? []}
        online={online}
        enviando={enviando}
        recado={recado}
        aoDispensarRecado={() => setRecado(null)}
        aoEnviar={abrirChamado}
        /*
          Antes do chamado existir não há onde pendurar o anexo: contato,
          protocolo e token nascem juntos com a primeira mensagem. Em vez de
          esconder o botão (que sumiria e voltaria sem explicação), ele recusa
          dizendo o que fazer.
        */
        aoEnviarArquivo={async () =>
          'Descreva o problema primeiro. Depois disso você pode anexar arquivos.'
        }
        aoEscolherSetor={escolherSetor}
        aoReenviar={() => {}}
        aoEncerrar={() => setRascunho(null)}
        aoAvaliar={() => {}}
        aoAbrirOutro={() => setRascunho(null)}
      />
    )
  }

  if (token && conversa) {
    return (
      <ConversaCliente
        conversa={conversa}
        pendentes={pendentes}
        online={online}
        enviando={enviando}
        recado={recado}
        aoDispensarRecado={() => setRecado(null)}
        aoEnviar={(texto) => enviarMensagem(texto)}
        aoEnviarArquivo={enviarArquivo}
        aoApagarMensagem={apagarMensagem}
        aoEditarMensagem={editarMensagem}
        aoEscolherSetor={() => {}}
        aoReenviar={(p) => enviarMensagem(p.corpo, p.client_msg_id)}
        aoEncerrar={encerrar}
        aoAvaliar={avaliar}
        aoAbrirOutro={abrirOutro}
      />
    )
  }

  if (!disponibilidade) {
    return (
      <Recado
        titulo="Não conseguimos carregar o atendimento"
        texto={recado ?? 'Confira sua internet e tente de novo.'}
        aoTentarDeNovo={() => window.location.reload()}
      />
    )
  }

  return (
    <Identificacao
      disponibilidade={disponibilidade}
      enviando={enviando}
      erroDoServidor={erroCampo}
      recado={recado}
      aoEnviar={comecarConversa}
    />
  )
}
