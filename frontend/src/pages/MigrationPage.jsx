import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import api from '../utils/api'
import {
  ArrowLeftRight, Database, Loader2, CheckCircle2, XCircle,
  AlertTriangle, ChevronRight, Info
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const SUPPORTED = [
  { source: 'postgresql', dest: 'mysql', label: 'PostgreSQL → MySQL' },
  { source: 'mysql', dest: 'postgresql', label: 'MySQL → PostgreSQL' },
]

function ConnCard({ conn, label, side }) {
  const sideColor = side === 'source' ? 'border-blue-800/60' : 'border-green-800/60'
  const badge = { postgresql: 'badge-pg', mysql: 'badge-mysql', clickhouse: 'badge-ch' }[conn?.db_type] || 'badge-pg'
  return (
    <div className={clsx('flex-1 border rounded-xl p-4 bg-gray-900', conn ? sideColor : 'border-gray-800')}>
      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">{label}</p>
      {conn ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-gray-400" />
            <span className="text-sm font-medium text-white">{conn.name}</span>
            <span className={badge}>{conn.db_type}</span>
          </div>
          <p className="text-xs text-gray-500 font-mono pl-5">
            {conn.username}@{conn.host}:{conn.port}/{conn.database}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-600">Not selected</p>
      )}
    </div>
  )
}

export default function MigrationPage() {
  const { connections } = useStore()
  const [sourceId, setSourceId] = useState('')
  const [destId, setDestId] = useState('')
  const [migrateSchema, setMigrateSchema] = useState(true)
  const [migrateData, setMigrateData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [job, setJob] = useState(null)
  const [polling, setPolling] = useState(false)
  const [warnings, setWarnings] = useState([])

  const sourceConn = connections.find(c => c.id === Number(sourceId))
  const destConn = connections.find(c => c.id === Number(destId))

  const isSupported = sourceConn && destConn && SUPPORTED.some(
    s => s.source === sourceConn.db_type && s.dest === destConn.db_type
  )

  const isCompatible = sourceId && destId && Number(sourceId) !== Number(destId)

  const handleStart = async () => {
    if (!isSupported) return toast.error('This migration pair is not supported')
    setSubmitting(true)
    setWarnings([])
    try {
      const { data } = await api.post('/migration/', {
        source_connection_id: Number(sourceId),
        dest_connection_id: Number(destId),
        migrate_schema: migrateSchema,
        migrate_data: migrateData,
      })
      setJob({ task_id: data.task_id, status: 'PENDING', info: {} })
      setPolling(true)
      toast.success('Migration started')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to start migration')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!polling || !job?.task_id) return
    const id = setInterval(async () => {
      try {
        const { data } = await api.get(`/migration/job/${job.task_id}`)
        setJob(data)
        if (data.info?.warnings?.length) setWarnings(data.info.warnings)
        if (['SUCCESS', 'FAILURE'].includes(data.status)) {
          setPolling(false)
          if (data.status === 'SUCCESS') toast.success('Migration complete!')
          else toast.error('Migration failed')
        }
      } catch { setPolling(false) }
    }, 2000)
    return () => clearInterval(id)
  }, [polling, job?.task_id])

  const progress = job?.info?.progress || 0

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Database Migration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Migrate schema and data between different database systems.</p>
      </div>

      {/* Supported pairs */}
      <div className="flex flex-wrap gap-2">
        {SUPPORTED.map(s => (
          <span key={s.label} className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full border border-gray-700">
            {s.label}
          </span>
        ))}
      </div>

      {/* Source / Dest */}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Source database</label>
            <select className="input" value={sourceId} onChange={e => setSourceId(e.target.value)}>
              <option value="">Select source…</option>
              {connections.map(c => (
                <option key={c.id} value={c.id} disabled={c.id === Number(destId)}>
                  {c.name} ({c.db_type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Destination database</label>
            <select className="input" value={destId} onChange={e => setDestId(e.target.value)}>
              <option value="">Select destination…</option>
              {connections.map(c => (
                <option key={c.id} value={c.id} disabled={c.id === Number(sourceId)}>
                  {c.name} ({c.db_type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Visual preview */}
        {(sourceConn || destConn) && (
          <div className="flex items-center gap-3">
            <ConnCard conn={sourceConn} label="Source" side="source" />
            <div className="shrink-0 p-2 rounded-full bg-gray-800">
              <ArrowLeftRight size={14} className="text-gray-400" />
            </div>
            <ConnCard conn={destConn} label="Destination" side="dest" />
          </div>
        )}

        {/* Compatibility warning */}
        {isCompatible && !isSupported && (
          <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2.5">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              Migration from <strong>{sourceConn?.db_type}</strong> to <strong>{destConn?.db_type}</strong> is not yet supported.
              Supported pairs: PostgreSQL ↔ MySQL.
            </span>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="card space-y-3">
        <p className="text-sm font-medium text-gray-300">Migration options</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={migrateSchema} onChange={e => setMigrateSchema(e.target.checked)} className="rounded" />
          <div>
            <p className="text-sm text-gray-200">Migrate schema</p>
            <p className="text-xs text-gray-500">Creates tables, indexes, and constraints in the destination</p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={migrateData} onChange={e => setMigrateData(e.target.checked)} className="rounded" />
          <div>
            <p className="text-sm text-gray-200">Migrate data</p>
            <p className="text-xs text-gray-500">Copies all rows from source to destination</p>
          </div>
        </label>
        <div className="flex items-start gap-2 text-xs text-blue-300 bg-blue-900/15 border border-blue-800/30 rounded-lg px-3 py-2.5">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>Data types are automatically mapped. Incompatible types are converted with a warning.</span>
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={submitting || !isSupported || polling || (!migrateSchema && !migrateData)}
        className="btn-primary flex items-center gap-2"
      >
        {submitting || polling
          ? <Loader2 size={15} className="animate-spin" />
          : <ArrowLeftRight size={15} />
        }
        {submitting ? 'Starting…' : polling ? 'Migrating…' : 'Start migration'}
      </button>

      {/* Job progress */}
      {job && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            {job.status === 'SUCCESS' && <CheckCircle2 size={16} className="text-green-400" />}
            {job.status === 'FAILURE' && <XCircle size={16} className="text-red-400" />}
            {['PENDING', 'PROGRESS'].includes(job.status) && <Loader2 size={16} className="text-indigo-400 animate-spin" />}
            <span className={clsx('text-sm font-medium', {
              SUCCESS: 'text-green-400', FAILURE: 'text-red-400',
              PROGRESS: 'text-indigo-400', PENDING: 'text-gray-400',
            }[job.status])}>
              {job.status === 'PROGRESS' ? (job.info?.step || 'Processing…') : job.status}
            </span>
          </div>

          {['PENDING', 'PROGRESS'].includes(job.status) && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{job.info?.step || 'Initializing…'}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {job.status === 'SUCCESS' && (
            <div className="text-xs text-green-300 bg-green-900/20 px-3 py-2 rounded space-y-1">
              <p>Migrated {job.info?.migrated_tables} of {job.info?.total_tables} tables successfully.</p>
            </div>
          )}

          {job.status === 'FAILURE' && (
            <pre className="text-xs text-red-300 bg-red-900/20 px-3 py-2 rounded whitespace-pre-wrap">
              {job.info?.error || 'Unknown error'}
            </pre>
          )}

          {warnings.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                <AlertTriangle size={12} /> {warnings.length} warnings
              </p>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-300/70 font-mono bg-amber-900/10 px-2 py-1 rounded">{w}</p>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-600 font-mono">Task: {job.task_id}</p>
        </div>
      )}
    </div>
  )
}
