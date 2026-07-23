import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('junta classes e resolve conflito do tailwind', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold')
  })
})
