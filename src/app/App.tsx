import { useAuth } from '@/lib/auth'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ProjectList from './pages/ProjectList'
import ProjectPage from './pages/ProjectPage'

function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route 
          path="/login" 
          element={user ? <Navigate to="/projects" /> : <Login />} 
        />
        <Route 
          path="/projects" 
          element={user ? <ProjectList /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/projects/:id" 
          element={user ? <ProjectPage /> : <Navigate to="/login" />} 
        />
        <Route path="/" element={<Navigate to="/projects" />} />
      </Routes>
    </div>
  )
}

export default App
