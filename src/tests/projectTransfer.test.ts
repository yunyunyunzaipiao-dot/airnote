import { describe, expect, it } from 'vitest'
import { parseProjectJson, serializeProject } from '../export/projectTransfer'
import { DEFAULT_SETTINGS, type AirNoteProject, type Edge, type IdeaCard, type Stroke } from '../types/workspace'

function largeProject(): AirNoteProject {
  const cards: IdeaCard[] = Array.from({ length: 10 }, (_, cardIndex) => ({
    id: `card-${cardIndex}`,
    strokeIds: Array.from({ length: 10 }, (_, offset) => `stroke-${cardIndex * 10 + offset}`),
    title: `想法 ${cardIndex + 1}`,
    position: { x: cardIndex * 180, y: (cardIndex % 2) * 220 },
    size: { width: 160, height: 180 },
  }))
  const strokes: Stroke[] = Array.from({ length: 100 }, (_, index) => ({
    id: `stroke-${index}`,
    points: [{ x: index, y: index, t: 0 }, { x: index + 20, y: index + 10, t: 16 }],
    color: '#172B3A',
    width: 4,
    style: 'ink',
    createdAt: index,
    cardId: `card-${Math.floor(index / 10)}`,
  }))
  const edges: Edge[] = Array.from({ length: 15 }, (_, index) => ({
    id: `edge-${index}`,
    sourceCardId: `card-${index % 10}`,
    targetCardId: `card-${(index + Math.floor(index / 10) + 1) % 10}`,
    type: index % 2 === 0 ? 'undirected' : 'directed',
    sourceAnchor: 'right',
    targetAnchor: 'left',
  }))
  return {
    schemaVersion: 1,
    workspace: {
      id: 'workspace-1',
      name: '往返验收',
      createdAt: 0,
      updatedAt: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    strokes,
    groups: [],
    cards,
    edges,
    settings: structuredClone(DEFAULT_SETTINGS),
  }
}

describe('SAVE-02 project JSON transfer', () => {
  it('round-trips 100 strokes, 10 cards and 15 edges without changing IDs', () => {
    const source = largeProject()
    const result = parseProjectJson(serializeProject(source))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.strokes.map((item) => item.id)).toEqual(source.strokes.map((item) => item.id))
    expect(result.project.cards.map((item) => item.id)).toEqual(source.cards.map((item) => item.id))
    expect(result.project.edges.map((item) => item.id)).toEqual(source.edges.map((item) => item.id))
  })

  it('does not add video, landmark, credential or request-header fields', () => {
    const json = serializeProject(largeProject())
    expect(json).not.toMatch(/videoFrame|landmarks|apiKey|accessToken|authorization|requestHeaders/i)
  })

  it('distinguishes invalid JSON from a newer schema version', () => {
    const invalid = parseProjectJson('{broken')
    expect(invalid).toMatchObject({ ok: false, error: { reason: 'invalid-format' } })
    expect(invalid.ok ? '' : invalid.message).toBe('项目文件格式不正确，当前画布未被修改。')

    const newer = parseProjectJson(JSON.stringify({ schemaVersion: 2 }))
    expect(newer).toMatchObject({ ok: false, error: { reason: 'version-too-new' } })
    expect(newer.ok ? '' : newer.message).toBe('该项目由更高版本AirNote创建，当前版本无法打开。')
  })

  it('rejects missing references and reports the damaged object count', () => {
    const project = largeProject()
    project.edges[0] = { ...project.edges[0], targetCardId: 'missing-card' }
    const result = parseProjectJson(JSON.stringify(project))
    expect(result).toMatchObject({ ok: false, error: { reason: 'missing-references', damagedObjectCount: 1 } })
    expect(result.ok ? '' : result.message).toContain('发现1个损坏对象')
  })

  it('round-trips enabled visual styles without changing any Stroke points', () => {
    const source = largeProject()
    source.settings.experimentalStylesEnabled = true
    source.settings.brush.style = 'particle'
    source.strokes[0].style = 'glow'
    source.strokes[1].style = 'particle'
    const pointsBefore = structuredClone(source.strokes.map((stroke) => stroke.points))
    const result = parseProjectJson(serializeProject(source))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.settings.brush.style).toBe('particle')
    expect(result.project.strokes.slice(0, 2).map((stroke) => stroke.style)).toEqual(['glow', 'particle'])
    expect(result.project.strokes.map((stroke) => stroke.points)).toEqual(pointsBefore)
  })
})
