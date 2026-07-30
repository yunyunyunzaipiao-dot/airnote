import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CardPropertyPanel } from '../components/CardPropertyPanel'
import type { InkCard, TextCard } from '../types/workspace'

const inkCard: InkCard = {
  id: 'ink-card',
  kind: 'ink',
  title: '用户访谈关键词',
  strokeIds: ['stroke-1'],
  position: { x: 20, y: 30 },
  size: { width: 200, height: 140 },
}

const textCard: TextCard = {
  id: 'text-card',
  kind: 'text',
  title: '文字卡片',
  content: '正文',
  textStyle: { bold: false, italic: false, underline: false, color: '#172B3A' },
  position: { x: 20, y: 30 },
  size: { width: 200, height: 140 },
}

describe('CardPropertyPanel', () => {
  it('shows ink-card actions and commits annotation, restore, delete, and close interactions', () => {
    const onRenameCard = vi.fn()
    const onRestoreInkCard = vi.fn()
    const onDeleteCard = vi.fn()
    const onClose = vi.fn()
    render(
      <CardPropertyPanel
        card={inkCard}
        onRenameCard={onRenameCard}
        onRestoreInkCard={onRestoreInkCard}
        onDeleteCard={onDeleteCard}
        onClose={onClose}
      />,
    )

    const annotation = screen.getByLabelText('标注')
    expect(annotation).toHaveValue('用户访谈关键词')
    fireEvent.change(annotation, { target: { value: '新的标注' } })
    fireEvent.blur(annotation)
    expect(onRenameCard).toHaveBeenCalledWith('ink-card', '新的标注')

    fireEvent.click(screen.getByRole('button', { name: '恢复为自由笔迹' }))
    expect(onRestoreInkCard).toHaveBeenCalledWith('ink-card')
    fireEvent.click(screen.getByRole('button', { name: '删除卡片（含笔迹）' }))
    expect(onDeleteCard).toHaveBeenCalledWith('ink-card')
    fireEvent.click(screen.getByRole('button', { name: '关闭卡片属性' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('applies whole-card text formatting and the reference color palette', () => {
    const onUpdateTextCard = vi.fn()
    render(<CardPropertyPanel card={textCard} onUpdateTextCard={onUpdateTextCard} />)

    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onUpdateTextCard).toHaveBeenCalledWith('text-card', { textStyle: { bold: true } })

    fireEvent.click(screen.getByRole('button', { name: '文字颜色：绿色' }))
    expect(onUpdateTextCard).toHaveBeenCalledWith('text-card', { textStyle: { color: '#30A46C' } })
    expect(screen.getAllByRole('button', { name: /文字颜色：/ })).toHaveLength(7)
  })
})
