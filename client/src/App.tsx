import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import NewSessionPage from './pages/NewSessionPage'
import SessionPage from './pages/SessionPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/sessions/new" element={<NewSessionPage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
