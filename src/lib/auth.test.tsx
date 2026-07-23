import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuth } from './auth'

describe('useAuth', () => {
  it('lança erro fora do AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth deve ser usado dentro de AuthProvider')
  })
})
