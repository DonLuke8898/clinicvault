import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useStore = create((set, get) => ({
  // ── Auth ────────────────────────────────────────────────
  user: null,
  clinicId: null,
  clinicName: 'ClinicVault',
  userRole: null,   // 'admin' | 'doctor' | 'staff'
  loading: true,

  setUser: (user) => set({ user }),
  setClinic: (id, name) => set({ clinicId: id, clinicName: name || 'ClinicVault' }),
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
      .select('clinic_id, role, clinics(id, name)')
      .eq('user_id', userId)
      .limit(1)

    if (memberships?.length) {
      const c = memberships[0]
      set({
        clinicId:   c.clinic_id,
        clinicName: c.clinics?.name || 'ClinicVault',
        userRole:   c.role || 'staff',
      })
      return c.clinic_id
    }

    // First time — create new clinic for this user
    const { data: clinic, error } = await supabase
      .from('clinics')
      .insert({ name: 'ClinicVault', tax_rate: 24, sst_enabled: false, owner_id: userId })
      .select()
      .single()

    if (error) {
      console.error('[CV] ensureClinic error:', error.message)
      return null
    }

    await supabase
      .from('clinic_members')
      .insert({ clinic_id: clinic.id, user_id: userId, role: 'admin' })

    set({ clinicId: clinic.id, clinicName: clinic.name, userRole: 'admin' })
    return clinic.id
  },

  // ── Join existing clinic via invite code ─────────────────
  joinClinic: async (userId, code) => {
    const { data: invite, error } = await supabase
      .from('invitations')
      .select('*, clinics(id, name)')
      .eq('code', code.trim().toUpperCase())
      .is('used_at', null)
      .single()

    if (error || !invite) {
      return { error: 'Kod jemputan tidak sah atau telah digunakan.' }
    }

    const { error: memberErr } = await supabase
      .from('clinic_members')
      .insert({ clinic_id: invite.clinic_id, user_id: userId, role: invite.role })

    if (memberErr) {
      return { error: 'Gagal menyertai klinik: ' + memberErr.message }
    }

    await supabase
      .from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id)

    set({
      clinicId:   invite.clinic_id,
      clinicName: invite.clinics?.name || 'ClinicVault',
      userRole:   invite.role,
    })

    return { clinicId: invite.clinic_id }
  },
}))
