import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import {
  LayoutDashboard, Database, Terminal, UploadCloud, ArrowLeftRight,
  LogOut, ChevronDown, Activity
} from 'lucide-react'
import { useState, useEffect } from 'react'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/connections', icon: Database, label: 'Connections' },
  { to: '/query', icon: Terminal, label: 'Query Editor' },
  { to: '/restore', icon: UploadCloud, label: 'Restore' },
  { to: '/migration', icon: ArrowLeftRight, label: 'Migration' },
]

export default function Layout() {
  const { user, logout, connections, fetchConnections, activeConnection, setActiveConnection } = useStore()
  const navigate = useNavigate()
  const [connOpen, setConnOpen] = useState(false)

  useEffect(() => { fetchConnections() }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const dbBadge = (type) => ({
    postgresql: 'badge-pg', mysql: 'badge-mysql', clickhouse: 'badge-ch'
  }[type] || 'badge-pg')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col bg-gray-900 border-r border-gray-800 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <Activity className="text-indigo-400" size={20} />
          <span className="font-semibold text-white tracking-tight">DBPilot</span>
        </div>

        {/* Active Connection Picker */}
        <div className="px-3 py-3 border-b border-gray-800">
          <p className="label px-1 mb-1">Active connection</p>
          <button
            onClick={() => setConnOpen(!connOpen)}
            className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <span className="truncate text-gray-200">
              {activeConnection ? activeConnection.name : 'Select…'}
            </span>
            <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1" />
          </button>
          {connOpen && (
            <div className="mt-1 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              {connections.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setActiveConnection(c); setConnOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center gap-2"
                >
                  <span className={dbBadge(c.db_type)}>{c.db_type}</span>
                  <span className="truncate text-gray-200">{c.name}</span>
                </button>
              ))}
              {connections.length === 0 && (
                <p className="text-xs text-gray-500 px-3 py-2">No connections yet</p>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-800 px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="text-sm text-gray-300 truncate flex-1">{user?.username || 'User'}</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
