import { useNavigate } from 'react-router-dom'
import { GalleryCard } from '../components/GalleryCard'
import { loadProjectIndex, removeProjectIndex, saveProjectIndex } from '../persistence/projectIndexStorage'
import { deleteWorkspaceById } from '../persistence/workspaceStorage'
import { createWorkspaceDocument, projectFromDocument } from '../store/workspaceDocument'
import { saveWorkspaceById, safeDefaultSettings } from '../persistence/workspaceStorage'
import { useState } from 'react'

function generateId() {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function Gallery() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState(loadProjectIndex)

  const createProject = () => {
    const id = generateId()
    const document = createWorkspaceDocument()
    document.workspace.name = '未命名画布'
    const project = projectFromDocument(document, safeDefaultSettings())
    saveWorkspaceById(id, project)
    const updated = [...projects, {
      id,
      name: document.workspace.name,
      updatedAt: Date.now(),
      strokeCount: 0,
      cardCount: 0,
    }]
    saveProjectIndex(updated)
    setProjects(updated)
    navigate(`/workspace/${id}`)
  }

  const deleteProject = (id: string) => {
    if (!window.confirm('确定要删除这个作品吗？此操作不可撤销。')) return
    deleteWorkspaceById(id)
    removeProjectIndex(id)
    setProjects((current) => current.filter((p) => p.id !== id))
  }

  return (
    <div className="gallery">
      <header className="gallery-header">
        <h1>我的作品</h1>
        <button type="button" className="gallery-new" onClick={createProject}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建画布
        </button>
      </header>
      <div className="gallery-grid">
        {projects.length === 0 ? (
          <div className="gallery-empty">
            <p>还没有作品</p>
            <button type="button" onClick={createProject}>创建第一个画布</button>
          </div>
        ) : (
          projects.map((project) => (
            <GalleryCard
              key={project.id}
              id={project.id}
              name={project.name}
              updatedAt={project.updatedAt}
              strokeCount={project.strokeCount}
              cardCount={project.cardCount}
              thumbnail={project.thumbnail}
              onOpen={() => navigate(`/workspace/${project.id}`)}
              onDelete={() => deleteProject(project.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
