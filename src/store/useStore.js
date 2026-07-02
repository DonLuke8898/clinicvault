import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useStore = create((set, get) => ({
  // ── Auth ────────────────────────────────────────────────
  user: null,
  clinicId: null,
  clinicName: 'ClinicVault',
  userRole: null,       // 'admin' | 'doctor' | 'staff' | null
  userClinics: [],      // all clinics this user belongs to
  isSuperAdmin: false,
  allClinics: [],       // SA: all clinics in the system
  activeClinicId: null, // SA: clinic being drilled into (null = overview)
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

  // ── Fetch all data ───────────────────────────────────────
  fetchAll: async () => {
    const { clinicId, isSuperAdmin, activeClinicId } = get()

    if (isSuperAdmin && !activeClinicId) {
      // SA overview: fetch ALL data across all clinics (no clinic_id filter)
      const [inc, exp, pan, doc] = await Promise.all([
        supabase.from('income').select('*').order('date', { ascending: false }),
        supabase.from('expense').select('*').order('date', { ascending: false }),
        supabase.from('panel').select('*').order('bill_date', { ascending: false }),
        supabase.from('documents').select('*').order('created_at', { ascending: false }),
      ])
      if (inc.data)  set({ income:    inc.data })
      if (exp.data)  set({ expense:   exp.data })
      if (pan.data)  set({ panel:     pan.data })
      if (doc.data)  set({ documents: doc.data })
      return
    }

    const targetClinic = activeClinicId || clinicId
    if (!targetClinic) return

    const [inc, exp, pan, doc] = await Promise.all([
      supabase.from('income').select('*').eq('clinic_id', targetClinic).order('date', { ascending: false }),
      supabase.from('expense').select('*').eq('clinic_id', targetClinic).order('date', { ascending: false }),
      supabase.from('panel').select('*').eq('clinic_id', targetClinic).order('bill_date', { ascending: false }),
      supabase.from('documents').select('*').eq('clinic_id', targetClinic).order('created_at', { ascending: false }),
    ])

    if (inc.data)  set({ income:    inc.data })
    if (exp.data)  set({ expense:   exp.data })
    if (pan.data)  set({ panel:     pan.data })
    if (doc.data)  set({ documents: doc.data })
  },

  // ── SA: Load all clinics ─────────────────────────────────
  loadAllClinics: async () => {
    const { data } = await supabase
      .from('clinics')
      .select('id, name, address, phone, email')
      .order('name')
    if (data) set({ allClinics: data })
  },

  // ── Switch clinic for multi-clinic users ────────────────
  switchClinic: async (clinicId) => {
    const { userClinics } = get()
    const target = userClinics.find(c => c.id === clinicId)
    if (!target) return
    set({ clinicId: target.id, clinicName: target.name, userRole: target.role })
    await get().fetchAll()
  },

  // ── SA: Switch active clinic (null = back to overview) ───
  setActiveClinic: async (clinicId) => {
    if (!clinicId) {
      set({ activeClinicId: null, clinicId: null, clinicName: 'Super Admin' })
      await get().fetchAll()
      return
    }
    const { allClinics } = get()
    const clinic = allClinics.find(c => c.id === clinicId)
    set({
      activeClinicId: clinicId,
      clinicId:       clinicId,
      clinicName:     clinic?.name || 'Klinik',
    })
    await get().fetchAll()
  },

  // ── Ensure clinic exists for user ───────────────────────
  ensureClinic: async (userId) => {
    // 1. Check super admin
    const { data: saCheck } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (saCheck) {
      set({ isSuperAdmin: true, userRole: 'super_admin', clinicName: 'Super Admin' })
      await get().loadAllClinics()
      return null
    }

    // 2. Check if user already has a clinic
    const { data: memberships } = await supabase
      .from('clinic_members')
      .select('clinic_id, role, clinics(id, name)')
      .eq('user_id', userId)
      .limit(1)

    if (memberships?.length) {
      const userClinics = memberships.map(m => ({
        id:   m.clinic_id,
        name: m.clinics?.name || 'ClinicVault',
        role: m.role || 'staff',
      }))
      const primary = memberships[0]
      set({
        clinicId:    primary.clinic_id,
        clinicName:  primary.clinics?.name || 'ClinicVault',
        userRole:    primary.role || 'staff',
        userClinics,
      })
      return primary.clinic_id
    }

    // 3. First time — create new clinic
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

    const { userClinics } = get()
    const newClinic = {
      id:   invite.clinic_id,
      name: invite.clinics?.name || 'ClinicVault',
      role: invite.role,
    }
    set({
      clinicId:    invite.clinic_id,
      clinicName:  invite.clinics?.name || 'ClinicVault',
      userRole:    invite.role,
      userClinics: [...userClinics.filter(c => c.id !== invite.clinic_id), newClinic],
    })

    return { clinicId: invite.clinic_id }
  },
}))
