import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useStore } from './store/useStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import QueryPage from './pages/QueryPage'
import RestorePage from './pages/RestorePage'
import MigrationPage from './pages/MigrationPage'
import ConnectionsPage from './pages/ConnectionsPage'

function PrivateRoute({ children }) {
  const token = useStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151' },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="query" element={<QueryPage />} />
          <Route path="restore" element={<RestorePage />} />
          <Route path="migration" element={<MigrationPage />} />
        </Route>
      </Routes>
    </>
  )
}
