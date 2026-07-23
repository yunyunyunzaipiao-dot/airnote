import { Route, Routes } from 'react-router-dom'
import { Gallery } from './pages/Gallery'
import { WorkspacePage } from './pages/WorkspacePage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Gallery />} />
      <Route path="/workspace/:id" element={<WorkspacePage />} />
    </Routes>
  )
}
