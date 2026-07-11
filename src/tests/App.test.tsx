import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../App'

describe('AirNote initialization shell', () => {
  it('renders every required placeholder region', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByLabelText('左侧工具栏')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /想法落下之前/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '摄像头预览' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '手势状态' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '属性面板' })).toBeInTheDocument()
  })

  it('keeps unfinished actions disabled', () => {
    render(<App />)

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })
})

