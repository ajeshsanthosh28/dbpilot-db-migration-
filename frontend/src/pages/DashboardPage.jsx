import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { RefreshCw, Cpu, HardDrive, MemoryStick, Database, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import api from '../utils/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'

function MetricCard({ label, value, sub, icon: Icon, color = 'indigo' }) {
  const colors = {
    indigo: 'text-indigo-400 bg-indigo-500/10',
    green: 'text-green-400 bg-green-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  }
  return (
    <div className="card flex items-start gap-4">
      <div className={clsx('p-2 rounded-lg', colors[color])}>
        <Icon size={18} className={colors[color].split(' ')[0]} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-semibold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function ProgressBar({ value, color = 'indigo' }) {
  const colors = { indigo: 'bg-indigo-500', green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500' }
  const barColor = value > 85 ? 'red' : value > 65 ? 'amber' : color
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5">
      <div className={clsx('h-1.5 rounded-full transition-all', colors[barColor])} style={{ width: `${value}%` }} />
    </div>
  )
}

const MAX_HISTORY = 30

export default function DashboardPage() {
  const { activeConnection, connections } = useStore()
  const [system, setSystem] = useState(null)
  const [dbMetrics, setDbMetrics] = useState(null)
  const [cpuHistory, setCpuHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    try {
      const sysRes = await api.get('/monitor/system')
      setSystem(sysRes.data)
      setCpuHistory(prev => {
        const next = [...prev, { t: new Date().toLocaleTimeString(), cpu: sysRes.data.cpu_percent, mem: sysRes.data.memory_percent }]
        return next.slice(-MAX_HISTORY)
      })

      if (activeConnection) {
        const dbRes = await api.get(`/monitor/${activeConnection.id}`)
        setDbMetrics(dbRes.data)
      }
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (e) {
      toast.error('Failed to fetch metrics')
    } finally {
      setLoading(false)
    }
  }, [activeConnection])

  useEffect(() => {
    fetchMetrics()
    const id = setInterval(fetchMetrics, 10000)
    return () => clearInterval(id)
  }, [fetchMetrics])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastUpdated ? `Last updated ${lastUpdated} · auto-refreshes every 10s` : 'Loading metrics…'}
          </p>
        </div>
        <button onClick={fetchMetrics} disabled={loading} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* System metrics */}
      {system && (
        <>
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">System</h2>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="CPU Usage" value={`${system.cpu_percent}%`} icon={Cpu}
              color={system.cpu_percent > 85 ? 'red' : system.cpu_percent > 65 ? 'amber' : 'green'} />
            <MetricCard label="Memory" value={`${system.memory_used_gb} GB`}
              sub={`${system.memory_percent}% of ${system.memory_total_gb} GB`} icon={MemoryStick}
              color={system.memory_percent > 85 ? 'red' : 'indigo'} />
            <MetricCard label="Disk Used" value={`${system.disk_used_gb} GB`}
              sub={`${system.disk_percent}% of ${system.disk_total_gb} GB`} icon={HardDrive}
              color={system.disk_percent > 85 ? 'red' : 'blue'} />
            <MetricCard label="Connections" value={connections.length} sub="configured databases"
              icon={Database} color="indigo" />
          </div>

          {/* CPU / Memory chart */}
          <div className="card">
            <p className="text-sm font-medium text-gray-300 mb-4">CPU & Memory over time</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cpuHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="t" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={1.5} name="CPU %" dot={false} />
                  <Area type="monotone" dataKey="mem" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.10} strokeWidth={1.5} name="Mem %" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />CPU %</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />Memory %</span>
            </div>
          </div>

          {/* Resource bars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'CPU', value: system.cpu_percent },
              { label: 'Memory', value: system.memory_percent },
              { label: 'Disk', value: system.disk_percent },
            ].map(({ label, value }) => (
              <div key={label} className="card">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">{label}</span>
                  <span className={clsx('text-sm font-medium', value > 85 ? 'text-red-400' : value > 65 ? 'text-amber-400' : 'text-green-400')}>{value}%</span>
                </div>
                <ProgressBar value={value} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* DB metrics */}
      {activeConnection ? (
        dbMetrics ? (
          <div className="space-y-4">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Database size={12} /> {activeConnection.name} ({activeConnection.db_type})
            </h2>
            {dbMetrics.error ? (
              <div className="card flex items-center gap-3 text-red-400">
                <AlertCircle size={16} /> {dbMetrics.error}
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {dbMetrics.active_connections !== undefined && (
                  <MetricCard label="Active connections" value={dbMetrics.active_connections} icon={Database} color="green" />
                )}
                {dbMetrics.idle_connections !== undefined && (
                  <MetricCard label="Idle connections" value={dbMetrics.idle_connections} icon={Clock} color="amber" />
                )}
                {dbMetrics.db_size && (
                  <MetricCard label="Database size" value={dbMetrics.db_size} icon={HardDrive} color="blue" />
                )}
                {dbMetrics.active_queries !== undefined && (
                  <MetricCard label="Running queries" value={dbMetrics.active_queries} icon={Cpu} color="indigo" />
                )}
              </div>
            )}

            {/* Slow queries table (PostgreSQL) */}
            {dbMetrics.slow_queries?.length > 0 && (
              <div className="card">
                <p className="text-sm font-medium text-gray-300 mb-3">Slowest queries</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left text-gray-500 font-medium pb-2 pr-4">Query</th>
                        <th className="text-right text-gray-500 font-medium pb-2 pr-4">Calls</th>
                        <th className="text-right text-gray-500 font-medium pb-2">Avg ms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbMetrics.slow_queries.map((q, i) => (
                        <tr key={i} className="border-b border-gray-800/50">
                          <td className="py-2 pr-4 text-gray-400 font-mono truncate max-w-xs">{q.query?.slice(0, 80)}…</td>
                          <td className="py-2 pr-4 text-right text-gray-300">{q.calls}</td>
                          <td className="py-2 text-right text-amber-400">{q.avg_ms}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card text-gray-500 text-sm">Loading database metrics…</div>
        )
      ) : (
        <div className="card flex items-center gap-3 text-gray-500 text-sm">
          <Database size={16} />
          Select a connection from the sidebar to view database metrics.
        </div>
      )}
    </div>
  )
}
