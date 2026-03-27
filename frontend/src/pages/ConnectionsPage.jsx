import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Plus, Trash2, TestTube2, CheckCircle2, XCircle, Database, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const DB_TYPES = ['postgresql', 'mysql', 'clickhouse']
const DEFAULT_PORTS = { postgresql: 5432, mysql: 3306, clickhouse: 9000 }

function ConnectionForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '', db_type: 'postgresql', host: 'localhost',
    port: 5432, database: '', username: '', password: '', ssl_enabled: false, notes: '',
  })
  const [saving, setSaving] = useState(false)
  const addConnection = useStore((s) => s.addConnection)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleTypeChange = (t) => setForm(f => ({ ...f, db_type: t, port: DEFAULT_PORTS[t] }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await addConnection({ ...form, port: Number(form.port) })
      toast.success('Connection saved')
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="text-sm font-medium text-white">New connection</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Name</label>
          <input className="input" placeholder="Production PG" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.db_type} onChange={e => handleTypeChange(e.target.value)}>
            {DB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Host</label>
          <input className="input" placeholder="localhost" value={form.host} onChange={e => set('host', e.target.value)} required />
        </div>
        <div>
          <label className="label">Port</label>
          <input className="input" type="number" value={form.port} onChange={e => set('port', e.target.value)} required />
        </div>
        <div>
          <label className="label">Database</label>
          <input className="input" placeholder="mydb" value={form.database} onChange={e => set('database', e.target.value)} required />
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" placeholder="postgres" value={form.username} onChange={e => set('username', e.target.value)} required />
        </div>
        <div className="col-span-2">
          <label className="label">Password</label>
          <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} required />
        </div>
        <div className="col-span-2">
          <label className="label">Notes (optional)</label>
          <input className="input" placeholder="Production DB, read-only replica…" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="ssl" checked={form.ssl_enabled} onChange={e => set('ssl_enabled', e.target.checked)} className="rounded" />
          <label htmlFor="ssl" className="text-sm text-gray-400">Enable SSL</label>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save connection'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function ConnectionRow({ conn }) {
  const { testConnection, deleteConnection } = useStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection(conn.id)
      setTestResult(result)
      if (result.success) toast.success(`Connected: ${result.version?.slice(0, 60)}`)
      else toast.error(`Failed: ${result.error}`)
    } catch (e) {
      toast.error('Test request failed')
    } finally {
      setTesting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete connection "${conn.name}"?`)) return
    try {
      await deleteConnection(conn.id)
      toast.success('Connection removed')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const badgeClass = { postgresql: 'badge-pg', mysql: 'badge-mysql', clickhouse: 'badge-ch' }[conn.db_type] || 'badge-pg'

  return (
    <div className="card flex items-center gap-4">
      <div className="p-2 bg-gray-800 rounded-lg">
        <Database size={16} className="text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{conn.name}</span>
          <span className={badgeClass}>{conn.db_type}</span>
          {conn.ssl_enabled && <span className="text-xs text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">SSL</span>}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 font-mono">
          {conn.username}@{conn.host}:{conn.port}/{conn.database}
        </p>
        {conn.notes && <p className="text-xs text-gray-600 mt-0.5 truncate">{conn.notes}</p>}
      </div>

      {testResult && (
        <div className={clsx('flex items-center gap-1 text-xs', testResult.success ? 'text-green-400' : 'text-red-400')}>
          {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {testResult.success ? 'OK' : 'Failed'}
        </div>
      )}

      <div className="flex gap-2 shrink-0">
        <button onClick={handleTest} disabled={testing} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
          {testing ? <Loader2 size={12} className="animate-spin" /> : <TestTube2 size={12} />}
          Test
        </button>
        <button onClick={handleDelete} className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export default function ConnectionsPage() {
  const { connections, fetchConnections } = useStore()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { fetchConnections() }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Connections</h1>
          <p className="text-sm text-gray-500 mt-0.5">{connections.length} configured databases</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus size={15} /> Add connection
        </button>
      </div>

      {showForm && (
        <ConnectionForm
          onSave={() => { setShowForm(false); fetchConnections() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {connections.length === 0 && !showForm ? (
        <div className="card text-center py-12">
          <Database size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No connections yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map(c => <ConnectionRow key={c.id} conn={c} />)}
        </div>
      )}
    </div>
  )
}
