import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useStore = create((set, get) => ({
  // ── Auth ────────────────────────────────────────────────
  user: null,
  clinicId: null,
  clinicName: 'ClinicVault',
  loading: true,

  setUser: (user) => set({ user }),
  setClinic: (id, name) => set({ clinicId: id, clinicName: name || 'Klinik Saya' }),
  setLoading: (loading) => set({ loading }),

  // ── Data ────────────────────────────────────────────────
  income: [],
  expense: [],
  panel: [],
  documents: [],

  setIncome:    (data) => set({ income: data }),
  setExpense:   (data) => set({ expense: data }),
  setPanel:     (data) => set({ panel: data }),
  setDocuments: (data) => set({ documents: data }),

  // ── Fetch all data for current clinic ───────────────────
  fetchAll: async () => {
    const { clinicId } = get()
    if (!clinicId) return

    const [inc, exp, pan, doc] = await Promise.all([
      supabase.from('income').select('*').eq('clinic_id', clinicId).order('date', { ascending: false }),
      supabase.from('expense').select('*').eq('clinic_id', clinicId).order('date', { ascending: false }),
      supabase.from('panel').select('*').eq('clinic_id', clinicId).order('bill_date', { ascending: false }),
      supabase.from('documents').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    ])

    if (inc.data)  set({ income:    inc.data })
    if (exp.data)  set({ expense:   exp.data })
    if (pan.data)  set({ panel:     pan.data })
    if (doc.data)  set({ documents: doc.data })
  },

  // ── Ensure clinic exists for user ───────────────────────
  ensureClinic: async (userId) => {
    // Check if user already has a clinic
    const { data: memberships } = await supabase
      .from('clinic_members')
      .select('clinic_id, clinics(id, name)')
      .eq('user_id', userId)
      .limit(1)

    if (memberships?.length) {
      const c = memberships[0]
      set({ clinicId: c.clinic_id, clinicName: c.clinics?.name || 'Klinik Saya' })
      return c.clinic_id
    }

    // Create new clinic
    const { data: clinic, error } = await supabase
      .from('clinics')
      .insert({ name: 'Klinik Saya', tax_rate: 24, sst_enabled: false, owner_id: userId })
      .select()
      .single()

    if (error) {
      console.error('[CV] ensureClinic error:', error.message)
      return null
    }

    await supabase
      .from('clinic_members')
      .insert({ clinic_id: clinic.id, user_id: userId, role: 'admin' })

    set({ clinicId: clinic.id, clinicName: clinic.name })
    return clinic.id
  },
}))
