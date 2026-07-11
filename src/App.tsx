import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import ReloadPrompt from './components/ReloadPrompt'
import HomePage from './pages/HomePage'
import NewSessionPage from './pages/NewSessionPage'
import SessionPage from './pages/SessionPage'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <InnerApp />
    </BrowserRouter>
  )
}

function InnerApp() {
  const navigate = useNavigate()

  useEffect(() => {
    const redirect = sessionStorage.getItem('redirect')
    if (redirect) {
      sessionStorage.removeItem('redirect')
      const base = import.meta.env.BASE_URL
      const path = redirect.startsWith(base)
        ? redirect.slice(base.length - 1)
        : redirect
      navigate(path)
    }
  }, [navigate])

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/sessions/new" element={<NewSessionPage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
        </Route>
      </Routes>
      <ReloadPrompt />
    </>
  )
}

export default App
