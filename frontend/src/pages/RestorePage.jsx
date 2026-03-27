import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useStore } from '../store/useStore'
import api from '../utils/api'
import { UploadCloud, FileText, Database, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const STATUS_COLORS = {
  PENDING: 'text-gray-400',
  PROGRESS: 'text-indigo-400',
  SUCCESS: 'text-green-400',
  FAILURE: 'text-red-400',
}

const STATUS_ICONS = {
  PENDING: Loader2,
  PROGRESS: Loader2,
  SUCCESS: CheckCircle2,
  FAILURE: XCircle,
}

export default function RestorePage() {
  const { connections, activeConnection, setActiveConnection } = useStore()
  const [selectedConn, setSelectedConn] = useState(activeConnection?.id || '')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [job, setJob] = useState(null)
  const [polling, setPolling] = useState(false)

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/octet-stream': ['.sql', '.dump', '.pgdump', '.gz'] },
    maxSize: 500 * 1024 * 1024,
  })

  const handleRestore = async () => {
    if (!selectedConn) return toast.error('Select a connection')
    if (!file) return toast.error('Upload a backup file')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post(`/restore/${selectedConn}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setJob({ task_id: data.task_id, status: 'PENDING', info: {} })
      setPolling(true)
      toast.success('Restore job started')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (!polling || !job?.task_id) return
    const id = setInterval(async () => {
      try {
        const { data } = await api.get(`/restore/job/${job.task_id}`)
        setJob(data)
        if (['SUCCESS', 'FAILURE'].includes(data.status)) {
          setPolling(false)
          if (data.status === 'SUCCESS') toast.success('Restore completed!')
          else toast.error('Restore failed')
        }
      } catch {
        setPolling(false)
      }
    }, 2000)
    return () => clearInterval(id)
  }, [polling, job?.task_id])

  const conn = connections.find(c => c.id === Number(selectedConn))
  const badgeClass = conn ? ({ postgresql: 'badge-pg', mysql: 'badge-mysql', clickhouse: 'badge-ch' }[conn.db_type] || 'badge-pg') : ''
  const progress = job?.info?.progress || 0
  const StatusIcon = job ? (STATUS_ICONS[job.status] || Loader2) : null

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">One-click Restore</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload a .sql or .dump backup and restore to any connected database.</p>
      </div>

      {/* Connection selector */}
      <div className="card space-y-4">
        <div>
          <label className="label">Target database</label>
          <select
            className="input"
            value={selectedConn}
            onChange={e => setSelectedConn(e.target.value)}
          >
            <option value="">Select connection…</option>
            {connections.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.db_type})</option>
            ))}
          </select>
        </div>

        {conn && (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
            <Database size={12} />
            <span className={badgeClass}>{conn.db_type}</span>
            <span className="font-mono">{conn.username}@{conn.host}:{conn.port}/{conn.database}</span>
          </div>
        )}
      </div>

      {/* File dropzone */}
      <div
        {...getRootProps()}
        className={clsx(
          'card border-2 border-dashed cursor-pointer transition-colors text-center py-10',
          isDragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-gray-700 hover:border-gray-600'
        )}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="space-y-2">
            <FileText size={32} className="text-indigo-400 mx-auto" />
            <p className="text-sm font-medium text-white">{file.name}</p>
            <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p className="text-xs text-indigo-400">Click or drag to replace</p>
          </div>
        ) : (
          <div className="space-y-2">
            <UploadCloud size={32} className="text-gray-600 mx-auto" />
            <p className="text-sm text-gray-400">
              {isDragActive ? 'Drop your backup file here' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-xs text-gray-600">Supports: .sql · .dump · .pgdump · .gz — up to 500 MB</p>
          </div>
        )}
      </div>

      {/* Type detection hint */}
      {file && conn && (
        <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2.5">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            {conn.db_type === 'postgresql'
              ? '.sql files use psql, .dump/.pgdump files use pg_restore.'
              : conn.db_type === 'mysql'
              ? 'MySQL supports .sql files only.'
              : 'ClickHouse native restore not yet supported.'}
          </span>
        </div>
      )}

      {/* Start button */}
      <button
        onClick={handleRestore}
        disabled={uploading || !file || !selectedConn || polling}
        className="btn-primary flex items-center gap-2"
      >
        {uploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
        {uploading ? 'Uploading…' : 'Start restore'}
      </button>

      {/* Job progress */}
      {job && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <StatusIcon
              size={16}
              className={clsx(STATUS_COLORS[job.status], ['PENDING', 'PROGRESS'].includes(job.status) && 'animate-spin')}
            />
            <span className={clsx('text-sm font-medium', STATUS_COLORS[job.status])}>
              {job.status === 'PROGRESS' ? (job.info?.step || 'Processing…') : job.status}
            </span>
          </div>

          {['PENDING', 'PROGRESS'].includes(job.status) && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{job.info?.step || 'Waiting…'}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {job.status === 'SUCCESS' && job.info?.message && (
            <p className="text-xs text-green-300 bg-green-900/20 px-3 py-2 rounded">{job.info.message}</p>
          )}

          {job.status === 'FAILURE' && (
            <pre className="text-xs text-red-300 bg-red-900/20 px-3 py-2 rounded whitespace-pre-wrap">
              {job.info?.error || 'Unknown error'}
            </pre>
          )}

          <p className="text-xs text-gray-600 font-mono">Task: {job.task_id}</p>
        </div>
      )}
    </div>
  )
}
