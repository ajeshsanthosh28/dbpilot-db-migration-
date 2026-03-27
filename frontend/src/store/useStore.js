import { create } from 'zustand'
import api from '../utils/api'

export const useStore = create((set, get) => ({
  // Auth
  user: null,
  token: localStorage.getItem('access_token'),

  login: async (email, password) => {
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)
    const { data } = await api.post('/auth/login', form)
    localStorage.setItem('access_token', data.access_token)
    set({ token: data.access_token })
    const me = await api.get('/auth/me')
    set({ user: me.data })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    set({ user: null, token: null })
  },

  // Connections
  connections: [],
  activeConnection: null,

  fetchConnections: async () => {
    const { data } = await api.get('/connections/')
    set({ connections: data })
  },

  setActiveConnection: (conn) => set({ activeConnection: conn }),

  addConnection: async (payload) => {
    const { data } = await api.post('/connections/', payload)
    await get().fetchConnections()
    return data
  },

  deleteConnection: async (id) => {
    await api.delete(`/connections/${id}`)
    await get().fetchConnections()
  },

  testConnection: async (id) => {
    const { data } = await api.post(`/connections/${id}/test`)
    return data
  },

  // Schema
  schema: [],
  fetchSchema: async (connId) => {
    const { data } = await api.get(`/connections/${connId}/schema`)
    set({ schema: data })
  },

  // Query
  queryResult: null,
  queryLoading: false,
  queryError: null,

  runQuery: async (connId, sql) => {
    set({ queryLoading: true, queryError: null })
    try {
      const { data } = await api.post(`/query/${connId}`, { sql, limit: 1000 })
      set({ queryResult: data, queryLoading: false })
    } catch (e) {
      set({ queryError: e.response?.data?.detail || e.message, queryLoading: false })
    }
  },
}))
