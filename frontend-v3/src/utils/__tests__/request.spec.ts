import { describe, it, expect } from 'vitest'
import { appendQueryParams } from '@/utils/request'

describe('appendQueryParams', () => {
  it('普通对象转查询串', () => {
    expect(appendQueryParams('/api/x', { a: 1, b: 'y' })).toBe('/api/x?a=1&b=y')
  })

  it('跳过 null/undefined/空串', () => {
    expect(appendQueryParams('/api/x', { a: null, b: undefined, c: '', d: 1 })).toBe('/api/x?d=1')
  })

  it('数组展开为重复键', () => {
    expect(appendQueryParams('/api/x', { ids: [1, 2] })).toBe('/api/x?ids=1&ids=2')
  })

  it('已有查询串时用 & 拼接', () => {
    expect(appendQueryParams('/api/x?a=1', { b: 2 })).toBe('/api/x?a=1&b=2')
  })

  it('无有效参数时原样返回', () => {
    expect(appendQueryParams('/api/x', {})).toBe('/api/x')
    expect(appendQueryParams('/api/x', null)).toBe('/api/x')
  })
})
