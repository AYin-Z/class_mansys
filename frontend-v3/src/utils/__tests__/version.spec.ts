import { describe, it, expect } from 'vitest'
import { compareVersion, hasUpdate, APP_VERSION } from '@/utils/version'
import pkg from '../../../package.json'

describe('版本号工具（设置页「当前版本」与更新判断）', () => {
  it('APP_VERSION 来自 package.json（不再是写死的 1.0.0）', () => {
    expect(APP_VERSION).toBe(pkg.version)
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('compareVersion 按语义化版本比较', () => {
    expect(compareVersion('1.3.0', '1.2.0')).toBe(1)
    expect(compareVersion('1.2.0', '1.3.0')).toBe(-1)
    expect(compareVersion('1.3.0', '1.3.0')).toBe(0)
    expect(compareVersion('v1.10.0', '1.9.9')).toBe(1)
    expect(compareVersion('2.0.0', '10.0.0')).toBe(-1)
  })

  it('缺失/非法段按 0 处理，不抛异常', () => {
    expect(compareVersion('1', '1.0.0')).toBe(0)
    expect(compareVersion('', '0.0.0')).toBe(0)
    expect(compareVersion('abc', '0.0.0')).toBe(0)
  })

  it('hasUpdate：服务端更高才算有更新（相等/更低都不提示）', () => {
    expect(hasUpdate('1.4.0', '1.3.0')).toBe(true)
    expect(hasUpdate('1.3.0', '1.3.0')).toBe(false)
    expect(hasUpdate('1.2.0', '1.3.0')).toBe(false)
    expect(hasUpdate('1.4.0')).toBe(compareVersion('1.4.0', APP_VERSION) > 0)
  })
})
