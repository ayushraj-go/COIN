import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from './store/useStore'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Home from './pages/Home'
import IdeaRegister from './pages/IdeaRegister'
import Idea360 from './pages/Idea360'
import SubmitIdea from './pages/SubmitIdea'
import Feasibility from './pages/Feasibility'
import Workshops from './pages/Workshops'
import Campaigns from './pages/Campaigns'
import CampaignPage from './pages/CampaignPage'
import ExecutionHub from './pages/ExecutionHub'
import Reports from './pages/Reports'
import Admin from './pages/Admin'
import Scope from './pages/Scope'
import Npd from './pages/Npd'

function Protected({ children }: { children: JSX.Element }) {
  const userId = useStore((s) => s.userId)
  const loc = useLocation()
  if (!userId) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected><AppShell /></Protected>}>
          <Route path="/" element={<Home />} />
          <Route path="/ideas" element={<IdeaRegister mode="all" />} />
          <Route path="/my-ideas" element={<IdeaRegister mode="mine" />} />
          <Route path="/ideas/:id" element={<Idea360 />} />
          <Route path="/submit" element={<SubmitIdea />} />
          <Route path="/feasibility" element={<Feasibility />} />
          <Route path="/workshops" element={<Workshops />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignPage />} />
          <Route path="/execution" element={<ExecutionHub />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:key" element={<Reports />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/scope" element={<Scope />} />
          <Route path="/npd" element={<Npd />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
