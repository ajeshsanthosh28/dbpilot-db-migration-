import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { useStore } from '../store/useStore'
import { Play, Download, ChevronRight, Table, Database, Loader2, AlertCircle } from 'lucide-react'
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, createColumnHelper,
} from '@tanstack/react-table'
import toast from 'react-hot-toast'
import clsx from 'clsx'

function ResultTable({ columns, rows }) {
  const colHelper = createColumnHelper()
  const tableCols = columns.map(col =>
    colHelper.accessor(col, { header: col, cell: info => {
      const v = info.getValue()
      if (v === null) return <span className="text-gray-600 italic">NULL</span>
      if (typeof v === 'object') return <span className="font-mono text-xs text-amber-300">{JSON.stringify(v)}</span>
      return <span className="font-mono text-xs">{String(v)}</span>
    }})
  )
  const data = rows.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])))
  const table = useReactTable({ data, columns: tableCols, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() })

  const downloadCSV = () => {
    const header = columns.join(',')
    const body = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'query_result.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
        <span className="text-xs text-gray-500">{rows.length} rows · {columns.length} columns</span>
        <button onClick={downloadCSV} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5">
          <Download size={12} /> Export CSV
        </button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="bg-gray-900">
                {hg.headers.map(h => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className="text-left px-3 py-2 font-medium text-gray-400 border-b border-gray-800 whitespace-nowrap cursor-pointer hover:text-gray-200 select-none"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr key={row.id} className={clsx('border-b border-gray-800/50 hover:bg-gray-800/30', i % 2 === 0 ? '' : 'bg-gray-900/30')}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-1.5 text-gray-300 whitespace-nowrap max-w-xs truncate">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SchemaTree({ schema }) {
  const [expanded, setExpanded] = useState({})
  if (!schema?.length) return <p className="text-xs text-gray-600 p-3">No schema loaded</p>
  return (
    <div className="text-xs overflow-y-auto h-full">
      {schema.map(t => (
        <div key={t.table}>
          <button
            onClick={() => setExpanded(e => ({ ...e, [t.table]: !e[t.table] }))}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-800 text-left text-gray-300"
          >
            <ChevronRight size={12} className={clsx('transition-transform shrink-0', expanded[t.table] && 'rotate-90')} />
            <Table size={12} className="text-gray-500 shrink-0" />
            <span className="font-mono truncate">{t.table}</span>
          </button>
          {expanded[t.table] && t.columns?.map(col => (
            <div key={col.column_name} className="flex items-center gap-2 pl-8 pr-3 py-1 text-gray-500 hover:bg-gray-800/50">
              <span className="font-mono text-gray-400">{col.column_name}</span>
              <span className="text-gray-600 truncate">{col.data_type}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function QueryPage() {
  const { activeConnection, queryResult, queryLoading, queryError, runQuery, schema, fetchSchema } = useStore()
  const [sql, setSql] = useState('SELECT * FROM ')
  const [schemaLoading, setSchemaLoading] = useState(false)

  useEffect(() => {
    if (activeConnection) {
      setSchemaLoading(true)
      fetchSchema(activeConnection.id).finally(() => setSchemaLoading(false))
    }
  }, [activeConnection?.id])

  const handleRun = async () => {
    if (!activeConnection) return toast.error('Select a connection first')
    if (!sql.trim()) return toast.error('Enter a SQL query')
    await runQuery(activeConnection.id, sql.trim())
  }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleRun()
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Database size={14} />
          {activeConnection
            ? <span className="font-medium text-gray-200">{activeConnection.name}</span>
            : <span className="text-gray-600">No connection selected</span>
          }
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-600">Ctrl+Enter to run</span>
        <button
          onClick={handleRun}
          disabled={queryLoading || !activeConnection}
          className="btn-primary flex items-center gap-2"
        >
          {queryLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Run query
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Schema sidebar */}
        <div className="w-52 border-r border-gray-800 bg-gray-900 flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-gray-800">
            <span className="text-xs font-medium text-gray-500">SCHEMA</span>
          </div>
          {schemaLoading
            ? <div className="flex items-center justify-center p-4"><Loader2 size={16} className="animate-spin text-gray-600" /></div>
            : <SchemaTree schema={schema} />
          }
        </div>

        {/* Editor + results split */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Monaco Editor */}
          <div className="h-52 border-b border-gray-800 shrink-0" onKeyDown={handleKeyDown}>
            <Editor
              height="100%"
              defaultLanguage="sql"
              theme="vs-dark"
              value={sql}
              onChange={v => setSql(v || '')}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12 },
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                renderLineHighlight: 'line',
                suggestOnTriggerCharacters: true,
              }}
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-hidden bg-gray-950">
            {queryLoading && (
              <div className="flex items-center justify-center h-full gap-2 text-gray-500">
                <Loader2 size={18} className="animate-spin" /> Running query…
              </div>
            )}
            {queryError && !queryLoading && (
              <div className="m-4 p-4 bg-red-950/40 border border-red-800 rounded-lg flex items-start gap-3">
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <pre className="text-red-300 text-xs font-mono whitespace-pre-wrap">{queryError}</pre>
              </div>
            )}
            {!queryLoading && !queryError && queryResult && (
              queryResult.columns?.length > 0
                ? <ResultTable columns={queryResult.columns} rows={queryResult.rows} />
                : <div className="flex items-center justify-center h-full text-gray-600 text-sm">Query returned no rows</div>
            )}
            {!queryLoading && !queryError && !queryResult && (
              <div className="flex items-center justify-center h-full text-gray-700 text-sm">
                Run a query to see results
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
