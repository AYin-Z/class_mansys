import { describe, it, expect } from 'vitest'
import { buildMcpAgentPrompt, buildMcpConfigJson, buildMcpStdioConfig, buildMcpBridgeCommand, maskToken } from '@/utils/mcpPrompt'

const ENDPOINT = 'https://cls.ayinserver.xin/api/mcp'
const TOKEN = 'cm_1234567890abcdef'

describe('MCP 接入文案', () => {
  it('HTTP 配置里带 url 与 Authorization 头', () => {
    const cfg = JSON.parse(buildMcpConfigJson(ENDPOINT, TOKEN))
    expect(cfg.mcpServers['class-mansys'].url).toBe(ENDPOINT)
    expect(cfg.mcpServers['class-mansys'].headers.Authorization).toBe('Bearer ' + TOKEN)
  })

  it('stdio 配置里带 command/args/env', () => {
    const cfg = JSON.parse(buildMcpStdioConfig(TOKEN))
    expect(cfg.mcpServers['class-mansys'].command).toBe('node')
    expect(cfg.mcpServers['class-mansys'].env.CM_API_TOKEN).toBe(TOKEN)
  })

  it('桥接命令用 mcp-remote 且带上令牌（回答"要不要下载"的问题）', () => {
    const cmd = buildMcpBridgeCommand(ENDPOINT, TOKEN)
    expect(cmd).toContain('npx -y mcp-remote')
    expect(cmd).toContain(ENDPOINT)
    expect(cmd).toContain('Bearer ' + TOKEN)
  })

  it('给 AI 的提示词包含端点、令牌、配置位置与验证步骤', () => {
    const p = buildMcpAgentPrompt({ endpoint: ENDPOINT, token: TOKEN, allowWrite: false, toolCount: 38 })
    expect(p).toContain(ENDPOINT)
    expect(p).toContain(TOKEN)
    expect(p).toContain('claude_desktop_config.json')
    expect(p).toContain('.cursor/mcp.json')
    expect(p).toContain('tools/list')
    expect(p).toContain('cm_my_leaves')
    expect(p).toContain('只读')
    expect(p).toContain('38')
    expect(p).toContain('不要修改系统里的任何数据')
  })

  it('读写令牌的提示词会说明需要二次确认', () => {
    const p = buildMcpAgentPrompt({ endpoint: ENDPOINT, token: TOKEN, allowWrite: true })
    expect(p).toContain('读写')
    expect(p).toContain('确认')
  })

  it('令牌掩码只保留前后段', () => {
    expect(maskToken('cm_1234567890abcdef')).toBe('cm_1234567…cdef')
    expect(maskToken('')).toBe('cm_你的令牌')
  })
})
