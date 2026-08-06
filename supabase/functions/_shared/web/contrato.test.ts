import { describe, it, expect } from 'vitest'
import {
  ErroContrato,
  primeiroNome,
  validarClientMsgId,
  validarCnpjOpcional,
  validarMensagem,
  validarNome,
  validarNota,
  MAX_MENSAGEM,
} from './contrato'

const codigoDe = (fn: () => unknown): string => {
  try {
    fn()
    return 'nao lancou'
  } catch (e) {
    return e instanceof ErroContrato ? `${e.codigo}:${e.campo}` : 'erro errado'
  }
}

describe('validarNome', () => {
  it('aceita e normaliza espaço', () => {
    expect(validarNome('  Joao   da  Silva ')).toBe('Joao da Silva')
  })

  it('recusa curto demais e longo demais', () => {
    expect(codigoDe(() => validarNome('A'))).toBe('campo_invalido:nome')
    expect(codigoDe(() => validarNome('x'.repeat(81)))).toBe('campo_invalido:nome')
    expect(codigoDe(() => validarNome(null))).toBe('campo_invalido:nome')
  })
})

describe('validarMensagem', () => {
  it('aceita texto normal', () => {
    expect(validarMensagem('  meu PDV travou ')).toBe('meu PDV travou')
  })

  it('recusa vazio e acima do teto', () => {
    expect(codigoDe(() => validarMensagem('   '))).toBe('campo_invalido:mensagem')
    expect(codigoDe(() => validarMensagem('x'.repeat(MAX_MENSAGEM + 1)))).toBe('campo_invalido:mensagem')
  })
})

describe('validarNota', () => {
  it('aceita as pontas e o meio', () => {
    expect(validarNota(0)).toBe(0)
    expect(validarNota(10)).toBe(10)
    expect(validarNota('7')).toBe(7)
  })

  it('recusa fora da faixa e quebrado', () => {
    expect(codigoDe(() => validarNota(11))).toBe('campo_invalido:nota')
    expect(codigoDe(() => validarNota(-1))).toBe('campo_invalido:nota')
    expect(codigoDe(() => validarNota(7.5))).toBe('campo_invalido:nota')
    expect(codigoDe(() => validarNota('otimo'))).toBe('campo_invalido:nota')
  })
})

describe('validarCnpjOpcional', () => {
  it('devolve nulo quando não veio (o campo é opcional)', () => {
    expect(validarCnpjOpcional('')).toBeNull()
    expect(validarCnpjOpcional(null)).toBeNull()
    expect(validarCnpjOpcional(undefined)).toBeNull()
  })

  it('aceita CNPJ válido com e sem máscara', () => {
    // CNPJ da Petrobras, público e com DV correto.
    expect(validarCnpjOpcional('33.000.167/0001-01')).toBe('33000167000101')
    expect(validarCnpjOpcional('33000167000101')).toBe('33000167000101')
  })

  // Este é o teste que importa: sem checar o DV, a rota vira oráculo da carteira
  // de clientes, porque dá para varrer CNPJ e ver quais respondem "encontrado".
  it('recusa CNPJ com dígito verificador errado antes de qualquer consulta', () => {
    expect(codigoDe(() => validarCnpjOpcional('33.000.167/0001-99'))).toBe('campo_invalido:cnpj')
    expect(codigoDe(() => validarCnpjOpcional('12345678000199'))).toBe('campo_invalido:cnpj')
  })

  it('recusa tamanho errado e dígito repetido', () => {
    expect(codigoDe(() => validarCnpjOpcional('123'))).toBe('campo_invalido:cnpj')
    expect(codigoDe(() => validarCnpjOpcional('11111111111111'))).toBe('campo_invalido:cnpj')
  })
})

describe('validarClientMsgId', () => {
  it('aceita UUID e normaliza caixa', () => {
    const id = '3F2504E0-4F89-11D3-9A0C-0305E82C3301'
    expect(validarClientMsgId(id)).toBe(id.toLowerCase())
  })

  it('recusa o que não é UUID', () => {
    expect(codigoDe(() => validarClientMsgId('abc'))).toBe('campo_invalido:client_msg_id')
    expect(codigoDe(() => validarClientMsgId(''))).toBe('campo_invalido:client_msg_id')
  })
})

describe('primeiroNome', () => {
  // Nome completo de funcionário é dado pessoal e não acrescenta nada ao cliente.
  it('devolve só o primeiro nome do atendente', () => {
    expect(primeiroNome('Pabllo Martins da Silva')).toBe('Pabllo')
    expect(primeiroNome('  Ana  ')).toBe('Ana')
  })

  it('devolve nulo quando não há nome', () => {
    expect(primeiroNome(null)).toBeNull()
    expect(primeiroNome('   ')).toBeNull()
  })
})
