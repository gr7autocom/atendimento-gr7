import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Clock, ShieldCheck, MessageSquareText, MessagesSquare } from 'lucide-react'
import { Botao } from '../components/ui/Botao'
import { Entrada, AreaTexto } from '../components/ui/Campo'
import { cn } from '../lib/utils'
import type { Disponibilidade } from './dados-mentira'

/**
 * Primeira tela do cliente: quem é você e qual o problema.
 *
 * Duas diferenças propositais em relação às telas da equipe: os alvos e os textos
 * são maiores (a central é ferramenta de uso diário para quem tem prática; aqui a
 * pessoa entra uma ou duas vezes por mês, muitas vezes pelo celular e com pressa),
 * e a coluna é estreita. Chat em linha de 1400px não se lê.
 */

export type DadosIdentificacao = {
  nome: string
  telefone: string
  cnpj: string
  departamento_id: string
  mensagem: string
  aceite: boolean
}

/** Máscara de telefone brasileiro, só para leitura: o servidor normaliza em E.164. */
function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function mascararCnpj(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function Identificacao({
  disponibilidade,
  enviando = false,
  aoEnviar,
}: {
  disponibilidade: Disponibilidade
  enviando?: boolean
  aoEnviar: (dados: DadosIdentificacao) => void
}) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [departamentoId, setDepartamentoId] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [aceite, setAceite] = useState(false)
  const [tentativas, setTentativas] = useState(0)
  const tentouEnviar = tentativas > 0
  const formRef = useRef<HTMLFormElement>(null)

  /*
    Depois de uma tentativa recusada, o foco vai para o primeiro campo com erro.
    Sem isso, quem usa teclado ou leitor de tela recebe cinco alertas e continua
    parado no botão, tendo que caçar onde está o problema. Num formulário longo
    como este, no celular, o campo errado pode estar fora da tela.
  */
  useEffect(() => {
    if (!tentativas) return
    const alvo = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalido="true"]')
    alvo?.focus()
    alvo?.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [tentativas])

  const digitosTelefone = telefone.replace(/\D/g, '')
  const erros = {
    nome: nome.trim().length < 2 ? 'Escreva seu nome completo.' : null,
    // 10 dígitos cobre fixo com DDD; 11, celular. Sem DDD o servidor recusa,
    // porque adivinhar o DDD amarraria o chamado ao contato errado.
    telefone: digitosTelefone.length < 10 ? 'Informe DDD e número.' : null,
    departamento: !departamentoId ? 'Escolha o assunto.' : null,
    mensagem: mensagem.trim().length < 5 ? 'Conte rapidamente o que está acontecendo.' : null,
    aceite: !aceite ? 'Precisamos do seu aceite para começar.' : null,
  }
  const temErro = Object.values(erros).some(Boolean)

  function enviar(e: FormEvent) {
    e.preventDefault()
    setTentativas((n) => n + 1)
    if (temErro) return
    aoEnviar({ nome: nome.trim(), telefone, cnpj, departamento_id: departamentoId, mensagem: mensagem.trim(), aceite })
  }

  // Fora do horário o formulário nem aparece: abrir chamado que ninguém vai ler
  // agora é pior do que dizer quando voltamos.
  if (!disponibilidade.pode_abrir) {
    return (
      <Moldura>
        <div className="flex flex-col items-center gap-4 text-center py-6">
          <div className="w-14 h-14 rounded-full bg-sf-2 border border-bd-1 flex items-center justify-center">
            <Clock size={26} className="text-tx-2" />
          </div>
          <h1 className="text-titulo font-medium text-tx-1">Estamos fora do horário</h1>
          <p className="text-corpo-lg text-tx-2 leading-relaxed">
            {disponibilidade.mensagem_fora_horario ??
              'Nosso atendimento está fechado no momento. Volte no horário comercial que respondemos por aqui.'}
          </p>
        </div>
      </Moldura>
    )
  }

  return (
    <Moldura>
      <div className="flex flex-col gap-1.5 mb-6">
        <h1 className="text-destaque font-medium text-tx-1">Falar com o suporte</h1>
        <p className="text-corpo-lg text-tx-2">
          Conte o que está acontecendo. Um atendente responde nesta mesma tela.
          {disponibilidade.plantao && ' Agora estamos em plantão, então a resposta pode demorar um pouco mais.'}
        </p>
      </div>

      <form ref={formRef} onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Entrada
          rotulo="Seu nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Como podemos te chamar"
          autoComplete="name"
          erro={tentouEnviar ? erros.nome : null}
          className="h-11 text-corpo-lg"
        />

        <Entrada
          rotulo="Telefone com DDD"
          value={telefone}
          onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
          placeholder="(16) 99123-4567"
          // `tel` abre o teclado numérico no celular, que é de onde vem boa parte
          // dos chamados.
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          erro={tentouEnviar ? erros.telefone : null}
          dica="É por ele que reconhecemos você e seu histórico."
          className="h-11 text-corpo-lg dado"
        />

        <Entrada
          rotulo="CNPJ da empresa (opcional)"
          value={cnpj}
          onChange={(e) => setCnpj(mascararCnpj(e.target.value))}
          placeholder="00.000.000/0000-00"
          inputMode="numeric"
          dica="Informando o CNPJ, já chegamos com o cadastro da sua empresa em mãos."
          className="h-11 text-corpo-lg dado"
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-corpo text-tx-2 mb-2">Sobre o que é</legend>
          {/*
            Lista clicável, não um `select`: são cinco opções e a escolha define o
            setor que atende. Num `select` fechado o cliente escolhe no escuro, e
            errar o setor custa uma transferência do lado de cá.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {disponibilidade.departamentos.map((d, i) => {
              const escolhido = departamentoId === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDepartamentoId(d.id)}
                  aria-pressed={escolhido}
                  data-invalido={tentouEnviar && erros.departamento && i === 0 ? 'true' : undefined}
                  className={cn(
                    'min-h-11 px-3 py-2 rounded-1 border text-corpo-lg text-left transicao',
                    'focus:outline-none focus:ring-2 focus:ring-[color:var(--br-soft)]',
                    escolhido
                      ? 'bg-br-soft border-br-2 text-br-2 font-medium'
                      : 'bg-sf-2 border-bd-campo text-tx-2 hover:border-tx-3 hover:text-tx-1'
                  )}
                >
                  {d.nome}
                </button>
              )
            })}
          </div>
          {tentouEnviar && erros.departamento && (
            <span role="alert" className="text-apoio text-err">
              {erros.departamento}
            </span>
          )}
        </fieldset>

        <AreaTexto
          rotulo="O que está acontecendo"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Ex.: o sistema não emite nota fiscal desde ontem"
          rows={4}
          erro={tentouEnviar ? erros.mensagem : null}
          className="text-corpo-lg"
        />

        {/*
          Aceite obrigatório: grava `aceite_em` na sessão e é o registro do
          consentimento exigido pela LGPD. Fica como caixa marcável e não como
          "ao continuar você concorda", que não registra nada.
        */}
        <label className="flex gap-3 items-start cursor-pointer">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="mt-0.5 w-5 h-5 shrink-0 accent-[color:var(--br-1)] cursor-pointer"
          />
          <span className="text-corpo text-tx-2 leading-relaxed">
            Autorizo a GR7 a usar meu nome e telefone para este atendimento e para o registro do
            chamado.
          </span>
        </label>
        {tentouEnviar && erros.aceite && (
          <span role="alert" className="text-apoio text-err -mt-2">
            {erros.aceite}
          </span>
        )}

        <Botao
          type="submit"
          variante="primario"
          carregando={enviando}
          icone={<MessageSquareText size={17} />}
          className="h-12 text-corpo-lg w-full"
        >
          Iniciar atendimento
        </Botao>
      </form>

      {/*
        O aviso mais importante da tela, e o único que não tem solução técnica
        dentro de "sem login": a conversa vive no navegador deste aparelho.
      */}
      <div className="mt-5 flex gap-2.5 rounded-2 bg-sf-2 border border-bd-1 p-3">
        <ShieldCheck size={17} className="text-tx-3 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-apoio text-tx-2 leading-relaxed">
          A conversa fica guardada neste navegador. Se limpar os dados, trocar de aparelho ou usar
          uma janela anônima, você precisa iniciar outro atendimento.
        </p>
      </div>
    </Moldura>
  )
}

/** Coluna estreita e centralizada, o oposto da central: aqui se lê, não se opera. */
export function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-sf-0 flex justify-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-[560px]">
        {/*
          A marca abre a tela porque o cliente chega por um link e precisa saber
          de cara com quem está falando antes de digitar telefone e CNPJ.
        */}
        <div className="flex items-center gap-2.5 mb-7">
          <div className="w-9 h-9 rounded-1 bg-br-1 flex items-center justify-center shrink-0">
            <MessagesSquare size={20} className="text-white" />
          </div>
          <span className="text-corpo-lg font-medium text-tx-1">GR7 Atendimento</span>
        </div>
        {children}
      </div>
    </div>
  )
}
