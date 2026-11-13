import { describe, expect, it, vi } from 'vitest'
import { registerAntigravityPetBalance } from '../src/pet-balance.ts'
import type { PetCustomBalanceResult } from '../src/pet-balance.ts'
import type { AntigravityAuthService } from '../src/auth-service.ts'
import type { QuotaStatusView } from '../src/quota.ts'

describe('registerAntigravityPetBalance', () => {
  const MOCK_QUOTA: QuotaStatusView = {
    state: 'available',
    checkedAt: '2026-10-25T00:00:00.000Z',
    groups: [
      {
        group: 'gemini',
        modelCount: 5,
        windows: [
          { window: '5h', remainingFraction: 0.88, resetTime: '2026-10-25T05:00:00.000Z' },
          { window: 'weekly', remainingFraction: 0.94, resetTime: '2026-10-31T00:00:00.000Z' },
        ],
      },
      {
        group: 'non-gemini',
        modelCount: 2,
        windows: [
          { window: '5h', remainingFraction: 0.5, resetTime: '2026-10-25T06:00:00.000Z' },
          { window: 'weekly', remainingFraction: 0.35, resetTime: '2026-10-31T00:00:00.000Z' },
        ],
      },
    ],
  }

  it('registers google-antigravity balance provider into petApi7340', async () => {
    let registeredProvider: { id: string; fetch: (args: { provider: string }) => Promise<unknown> } | undefined
    const mockUnregister = vi.fn()

    const mockCtx = {
      inject: vi.fn((deps: string[], cb: (ctx: Record<string, unknown>) => unknown) => {
        if (deps.includes('petApi7340')) {
          cb({
            petApi7340: {
              balance: {
                register: vi.fn((def) => {
                  registeredProvider = def
                  return mockUnregister
                }),
              },
            },
          })
        }
      }),
      agentDefaultModel: {
        currentSelection: () => ({ model: 'gemini-2.5-pro' }),
      },
    }

    const mockService = {
      usage: vi.fn(async () => MOCK_QUOTA),
    } as unknown as AntigravityAuthService

    registerAntigravityPetBalance(mockCtx as never, mockService)
    expect(mockCtx.inject).toHaveBeenCalledWith(['petApi7340'], expect.any(Function))
    expect(registeredProvider?.id).toBe('google-antigravity')

    const res = (await registeredProvider!.fetch({ provider: 'google-antigravity' })) as {
      ok: boolean
      provider: string
      shape: string
      data: { views: unknown[]; percent: number }
    }

    expect(res.ok).toBe(true)
    expect(res.provider).toBe('google-antigravity')
    expect(res.shape).toBe('custom')
    expect(res.data.views).toHaveLength(2)
    // 5h 剩余 88% (已用 12%)，周剩余 94% (已用 6%)，最告急已用 12%
    expect(res.data.percent).toBe(12)

    // 第一页为 Gemini
    const page1Str = JSON.stringify(res.data.views[0])
    expect(page1Str).toContain('google-antigravity')
    expect(page1Str).toContain('Gemini')
    expect(page1Str).toContain('剩余 88%')
    expect(page1Str).toContain('剩余 94%')
  })

  it('prioritizes Claude / non-gemini group on page 1 when current model is Claude', async () => {
    let registeredProvider: { id: string; fetch: (args: { provider: string }) => Promise<unknown> } | undefined

    const mockCtx = {
      inject: vi.fn((deps: string[], cb: (ctx: Record<string, unknown>) => unknown) => {
        cb({
          petApi7340: {
            balance: {
              register: vi.fn((def) => {
                registeredProvider = def
                return () => {}
              }),
            },
          },
        })
      }),
      agentDefaultModel: {
        currentSelection: () => ({ model: 'claude-3-7-sonnet' }),
      },
    }

    const mockService = {
      usage: vi.fn(async () => MOCK_QUOTA),
    } as unknown as AntigravityAuthService

    registerAntigravityPetBalance(mockCtx as never, mockService)
    const res = (await registeredProvider!.fetch({ provider: 'google-antigravity' })) as {
      data: { views: unknown[]; percent: number }
    }

    // 第一页为 Claude
    const page1Str = JSON.stringify(res.data.views[0])
    expect(page1Str).toContain('Claude')
    expect(page1Str).toContain('剩余 50%')
    expect(page1Str).toContain('剩余 35%')
  })

  it('reads agentDefaultModel via ctx.get and renders GPT-OSS badge for gpt models', async () => {
    let registeredProvider: { id: string; fetch: (args: { provider: string }) => Promise<unknown> } | undefined

    const mockCtx = {
      inject: vi.fn((_deps: string[], cb: (ctx: Record<string, unknown>) => unknown) => {
        cb({
          petApi7340: {
            balance: {
              register: vi.fn((def) => {
                registeredProvider = def
                return () => {}
              }),
            },
          },
        })
      }),
      get: vi.fn((name: string) =>
        name === 'agentDefaultModel'
          ? { currentSelection: () => ({ model: 'antigravity-gpt-oss-120b-medium' }) }
          : undefined,
      ),
    }

    const mockService = {
      usage: vi.fn(async () => MOCK_QUOTA),
    } as unknown as AntigravityAuthService

    registerAntigravityPetBalance(mockCtx as never, mockService)
    const res = (await registeredProvider!.fetch({ provider: 'google-antigravity' })) as {
      data: { views: unknown[]; percent: number }
    }

    const page1Str = JSON.stringify(res.data.views[0])
    expect(page1Str).toContain('GPT-OSS')
    expect(page1Str).toContain('点击切换至 Gemini 额度')
  })

  it.each([
    { model: 'antigravity-gemini-4-hydrogen', badge: 'Gemini', percent: 5, remaining: ['剩余 95%', '剩余 96%'] },
    { model: 'antigravity-gemini-4-argon', badge: 'Gemini 4 Argon', percent: 84, remaining: ['剩余 16%'] },
    { model: 'gemini-4-argon-high', badge: 'Gemini 4 Argon', percent: 84, remaining: ['剩余 16%'] },
    { model: 'antigravity-claude-sonnet-4-6', badge: 'Claude', percent: 65, remaining: ['剩余 50%', '剩余 35%'] },
    { model: 'antigravity-gpt-oss-120b-medium', badge: 'GPT-OSS', percent: 65, remaining: ['剩余 50%', '剩余 35%'] },
  ])('uses only the selected quota pool for $model with all three groups present', async ({ model, badge, percent, remaining }) => {
    let registeredProvider: { fetch: (args: { provider: string }) => Promise<PetCustomBalanceResult> } | undefined
    const quota: QuotaStatusView = {
      state: 'available',
      groups: [
        {
          group: 'gemini-argon',
          modelCount: 1,
          windows: [{ window: 'weekly', remainingFraction: 0.16, resetTime: '2026-11-20T00:00:00.000Z' }],
        },
        {
          group: 'non-gemini',
          modelCount: 2,
          windows: [
            { window: '5h', remainingFraction: 0.5, resetTime: '2026-11-14T00:00:00.000Z' },
            { window: 'weekly', remainingFraction: 0.35, resetTime: '2026-11-20T00:00:00.000Z' },
          ],
        },
        {
          group: 'gemini',
          modelCount: 3,
          windows: [
            { window: '5h', remainingFraction: 0.95, resetTime: '2026-11-14T00:00:00.000Z' },
            { window: 'weekly', remainingFraction: 0.96, resetTime: '2026-11-20T00:00:00.000Z' },
          ],
        },
      ],
    }
    const mockCtx = {
      inject: (_deps: string[], cb: (ctx: Record<string, unknown>) => unknown) => cb({
        petApi7340: {
          balance: {
            register: (def: typeof registeredProvider) => {
              registeredProvider = def
              return () => {}
            },
          },
        },
      }),
      agentDefaultModel: { currentSelection: () => ({ model }) },
    }
    const mockService = { usage: async () => quota } as unknown as AntigravityAuthService

    registerAntigravityPetBalance(mockCtx as never, mockService)
    const result = await registeredProvider!.fetch({ provider: 'google-antigravity' })
    const badges = result.data.views.map(page => page.children?.[0]?.children?.[0]?.children?.[1]?.text)
    expect(badges).toHaveLength(3)
    expect(badges[0]).toBe(badge)
    expect(badges).toContain('Gemini')
    expect(badges).toContain('Gemini 4 Argon')
    expect(badges).toContain(model.includes('gpt') ? 'GPT-OSS' : 'Claude')
    expect(result.data.percent).toBe(percent)
    for (const value of remaining) {
      expect(JSON.stringify(result.data.views[0])).toContain(value)
    }

    const argonPage = JSON.stringify(result.data.views[badges.indexOf('Gemini 4 Argon')])
    expect(argonPage).toContain('剩余 16%')
    expect(argonPage).toContain('周额度')
    expect(argonPage).not.toContain('5h 额度')
    const geminiPage = JSON.stringify(result.data.views[badges.indexOf('Gemini')])
    expect(geminiPage).toContain('剩余 95%')
    expect(geminiPage).toContain('剩余 96%')
    expect(geminiPage).not.toContain('剩余 16%')
  })

  it.each([
    { model: 'antigravity-gemini-4-argon', missingGroup: 'gemini-argon' },
    { model: 'antigravity-gemini-4-hydrogen', missingGroup: 'gemini' },
    { model: 'antigravity-claude-sonnet-4-6', missingGroup: 'non-gemini' },
  ])('rejects missing selected quota instead of borrowing another pool for $model', async ({ model, missingGroup }) => {
    let registeredProvider: { fetch: (args: { provider: string }) => Promise<PetCustomBalanceResult> } | undefined
    const mockCtx = {
      inject: (_deps: string[], cb: (ctx: Record<string, unknown>) => unknown) => cb({
        petApi7340: {
          balance: {
            register: (def: typeof registeredProvider) => {
              registeredProvider = def
              return () => {}
            },
          },
        },
      }),
      agentDefaultModel: { currentSelection: () => ({ model }) },
    }
    const quota: QuotaStatusView = {
      ...MOCK_QUOTA,
      groups: ([
        ...MOCK_QUOTA.groups!,
        {
          group: 'gemini-argon',
          modelCount: 1,
          windows: [{ window: 'weekly', remainingFraction: 0.16, resetTime: '2026-11-20T00:00:00.000Z' }],
        },
      ] satisfies NonNullable<QuotaStatusView['groups']>).filter(group => group.group !== missingGroup),
    }
    const mockService = { usage: async () => quota } as unknown as AntigravityAuthService

    registerAntigravityPetBalance(mockCtx as never, mockService)
    await expect(registeredProvider!.fetch({ provider: 'google-antigravity' })).rejects.toThrow(
      'Antigravity 响应缺少当前模型的配额分组',
    )
  })

  it('throws friendly error on unauthenticated quota', async () => {
    let registeredProvider: { id: string; fetch: (args: { provider: string }) => Promise<unknown> } | undefined

    const mockCtx = {
      inject: vi.fn((deps: string[], cb: (ctx: Record<string, unknown>) => unknown) => {
        cb({
          petApi7340: {
            balance: {
              register: vi.fn((def) => {
                registeredProvider = def
                return () => {}
              }),
            },
          },
        })
      }),
    }

    const mockService = {
      usage: vi.fn(async () => ({ state: 'unauthenticated' })),
    } as unknown as AntigravityAuthService

    registerAntigravityPetBalance(mockCtx as never, mockService)
    await expect(registeredProvider!.fetch({ provider: 'google-antigravity' })).rejects.toThrow(
      /Antigravity 未登录/,
    )
  })
})
