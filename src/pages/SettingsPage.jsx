import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'
import {
  Save, Building2, Users, UserPlus, Trash2,
  Copy, Check, X, ShieldCheck, Stethoscope, UserRound, LogIn, ShieldAlert
} from 'lucide-react'

const ROLES = [
  { value: 'admin',  label: 'Admin',   icon: ShieldCheck,   color: 'badge-purple' },
  { value: 'doctor', label: 'Doktor',  icon: Stethoscope,   color: 'badge-blue'   },
  { value: 'staff',  label: 'Staff',   icon: UserRound,     color: 'badge-slate'  },
]

function RoleBadge({ role }) {
  const r = ROLES.find(x => x.value === role) || ROLES[2]
  return <span className={`badge ${r.color}`}>{r.label}</span>
}

// ─── Pending Invitations sub-component ────────────────────────────────────────
function PendingInvitations({ clinicId }) {
  const [invites, setInvites] = useState([])

  useEffect(() => {
    if (!clinicId) return
    supabase.from('invitations')
      .select('id, email, role, code, created_at')
      .eq('clinic_id', clinicId)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => setInvites(data || []))
  }, [clinicId])

  async function cancel(id) {
    await supabase.from('invitations').delete().eq('id', id)
    setInvites(prev => prev.filter(i => i.id !== id))
  }

  if (!invites.length) return null

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-slate-700 mb-1">Jemputan Belum Digunakan</h2>
      <p className="text-xs text-slate-400 mb-4">Kod ini belum digunakan oleh mana-mana pengguna</p>
      <div className="space-y-2">
        {invites.map(inv => (
          <div key={inv.id}
            className="flex items-center justify-between px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
            <div>
              <p className="text-sm font-medium text-slate-700">{inv.email}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Kod: <span className="font-mono font-bold text-amber-700 tracking-widest">{inv.code}</span>
                {' · '}<RoleBadge role={inv.role} />
              </p>
            </div>
            <button onClick={() => cancel(inv.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main SettingsPage ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { clinicName, clinicId, userRole, user, setClinic, joinClinic, fetchAll,
          isSuperAdmin, allClinics } = useStore()
  const isAdmin = userRole === 'admin' || isSuperAdmin

  // SA: pick which clinic to view/edit (independent of sidebar switcher)
  const [saEditClinicId, setSaEditClinicId] = useState(null)
  const effectiveClinicId = isSuperAdmin ? (saEditClinicId || clinicId) : clinicId

  const [tab, setTab] = useState('clinic')

  // ── Clinic form
  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '', kkm_no: '', ssm_no: ''
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  // ── Members
  const [members,        setMembers]        = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // ── Join another clinic
  const [joinCode,    setJoinCode]    = useState('')
  const [joining,     setJoining]     = useState(false)
  const [joinMsg,     setJoinMsg]     = useState(null) // { type: 'ok'|'err', text }

  async function handleJoinClinic(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinMsg(null)
    const result = await joinClinic(user?.id, joinCode.trim())
    if (result?.error) {
      setJoinMsg({ type: 'err', text: result.error })
    } else {
      await fetchAll()
      setJoinMsg({ type: 'ok', text: 'Berjaya! Anda kini boleh akses klinik baru melalui Sidebar.' })
      setJoinCode('')
    }
    setJoining(false)
  }

  // ── Invite modal
  const [showModal,   setShowModal]   = useState(false)
  const [invite,      setInvite]      = useState({ email: '', role: 'staff' })
  const [inviting,    setInviting]    = useState(false)
  const [genCode,     setGenCode]     = useState(null)
  const [copied,      setCopied]      = useState(false)

  // Load clinic details when effectiveClinicId changes
  useEffect(() => {
    if (!effectiveClinicId) { setForm({ name: '', address: '', phone: '', email: '', kkm_no: '', ssm_no: '' }); return }
    supabase.from('clinics').select('*').eq('id', effectiveClinicId).single()
      .then(({ data }) => {
        if (data) setForm({
          name:    data.name    || '',
          address: data.address || '',
          phone:   data.phone   || '',
          email:   data.email   || '',
          kkm_no:  data.kkm_no  || '',
          ssm_no:  data.ssm_no  || '',
        })
      })
  }, [effectiveClinicId])

  // Load members when switching to users tab
  useEffect(() => {
    if (tab === 'users' && effectiveClinicId) fetchMembers()
  }, [tab, effectiveClinicId])

  async function fetchMembers() {
    setLoadingMembers(true)
    const { data } = await supabase
      .from('clinic_members')
      .select('user_id, role, profiles(full_name, email)')
      .eq('clinic_id', effectiveClinicId)
    setMembers(data || [])
    setLoadingMembers(false)
  }

  async function handleSaveClinic(e) {
    e.preventDefault()
    if (!effectiveClinicId || !form.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('clinics').update({
      name:    form.name.trim(),
      address: form.address,
      phone:   form.phone,
      email:   form.email,
      kkm_no:  form.kkm_no,
      ssm_no:  form.ssm_no,
    }).eq('id', effectiveClinicId)
    setSaving(false)
    if (!error) {
      if (!isSuperAdmin) setClinic(effectiveClinicId, form.name.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true)
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        clinic_id:  effectiveClinicId,
        email:      invite.email.trim().toLowerCase(),
        role:       invite.role,
        created_by: user?.id,
      })
      .select('code')
      .single()
    setInviting(false)
    if (error) { alert('Ralat: ' + error.message); return }
    setGenCode(data.code)
  }

  function closeModal() {
    setShowModal(false)
    setInvite({ email: '', role: 'staff' })
    setGenCode(null)
    setCopied(false)
  }

  async function copyCode() {
    await navigator.clipboard.writeText(genCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function removeMember(uid) {
    if (!isSuperAdmin && uid === user?.id) { alert('Anda tidak boleh memadam diri sendiri.'); return }
    if (!confirm('Padam pengguna ini dari klinik?')) return
    await supabase.from('clinic_members')
      .delete()
      .eq('clinic_id', effectiveClinicId)
      .eq('user_id', uid)
    fetchMembers()
  }

  const TABS = [
    { id: 'clinic', label: 'Maklumat Klinik',     icon: Building2 },
    ...(isAdmin ? [{ id: 'users', label: 'Pengurusan Pengguna', icon: Users }] : []),
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Tetapan</h1>

      {/* SA: clinic picker */}
      {isSuperAdmin && (
        <div className="card p-4 flex items-center gap-3 border-l-4 border-amber-400">
          <ShieldAlert size={18} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-700 mb-1">Super Admin — Pilih Klinik untuk Dikemaskini</p>
            <select
              value={saEditClinicId || clinicId || ''}
              onChange={e => setSaEditClinicId(e.target.value || null)}
              className="input text-sm"
            >
              <option value="">— Pilih klinik —</option>
              {allClinics.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-white shadow text-blue-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Maklumat Klinik ─────────────────────────────────────────── */}
      {tab === 'clinic' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-700">Maklumat Klinik</h2>
              <p className="text-xs text-slate-400">Kemaskini profil klinik anda</p>
            </div>
          </div>

          <form onSubmit={handleSaveClinic} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Nama Klinik *</label>
                <input type="text" className="input" required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Alamat</label>
                <textarea className="input" rows={2}
                  placeholder="No. 1, Jalan Contoh, 50000 Kuala Lumpur"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="label">No. Telefon</label>
                <input type="tel" className="input"
                  placeholder="03-1234 5678"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">E-mel Klinik</label>
                <input type="email" className="input"
                  placeholder="klinik@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">No. Pendaftaran KKM</label>
                <input type="text" className="input"
                  placeholder="KKM/00000/01"
                  value={form.kkm_no}
                  onChange={e => setForm(f => ({ ...f, kkm_no: e.target.value }))} />
              </div>
              <div>
                <label className="label">No. Pendaftaran SSM</label>
                <input type="text" className="input"
                  placeholder="1234567-X"
                  value={form.ssm_no}
                  onChange={e => setForm(f => ({ ...f, ssm_no: e.target.value }))} />
              </div>
            </div>

            {!isAdmin && (
              <p className="text-xs text-slate-400 italic">Hanya Admin boleh mengemaskini maklumat klinik.</p>
            )}

            <button type="submit" disabled={saving || !isAdmin} className="btn-primary">
              <Save size={16} />
              {saving ? 'Menyimpan...' : saved ? '✓ Disimpan!' : 'Simpan Perubahan'}
            </button>
          </form>
        </div>
      )}

      {/* ── Sertai Klinik Lain (hanya untuk pengguna biasa) ──────────────── */}
      {tab === 'clinic' && !isSuperAdmin && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <LogIn size={20} className="text-teal-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-700">Sertai Klinik Lain</h2>
              <p className="text-xs text-slate-400">Masukkan kod jemputan untuk akses lebih dari satu klinik</p>
            </div>
          </div>

          <form onSubmit={handleJoinClinic} className="flex gap-2">
            <input
              type="text"
              className="input font-mono tracking-widest uppercase flex-1"
              placeholder="cth: A1B2C3D4"
              maxLength={8}
              autoComplete="off"
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinMsg(null) }}
            />
            <button type="submit" disabled={joining || !joinCode.trim()} className="btn-primary whitespace-nowrap">
              {joining ? 'Menyertai...' : 'Sertai'}
            </button>
          </form>

          {joinMsg && (
            <div className={`text-sm rounded-lg px-4 py-3 ${
              joinMsg.type === 'ok'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {joinMsg.text}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Pengurusan Pengguna ─────────────────────────────────────── */}
      {tab === 'users' && isAdmin && (
        <div className="space-y-4">
          {/* Members list */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-700">Senarai Pengguna</h2>
                <p className="text-xs text-slate-400">Pengguna yang mempunyai akses ke klinik ini</p>
              </div>
              <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
                <UserPlus size={15} />
                Tambah Pengguna
              </button>
            </div>

            {loadingMembers ? (
              <p className="text-sm text-slate-400 py-6 text-center">Memuatkan...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">Tiada pengguna lain.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {members.map(m => {
                  const displayName = m.profiles?.full_name || m.profiles?.email || 'Pengguna'
                  const initial = displayName[0].toUpperCase()
                  const isSelf = m.user_id === user?.id

                  return (
                    <div key={m.user_id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600
                          flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {initial}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {displayName}
                            {isSelf && <span className="ml-2 text-xs text-slate-400">(Anda)</span>}
                          </p>
                          <p className="text-xs text-slate-400">{m.profiles?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={m.role} />
                        {!isSelf && (
                          <button onClick={() => removeMember(m.user_id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pending invitations */}
          <PendingInvitations clinicId={effectiveClinicId} />

          {/* Role legend */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Penerangan Peranan</p>
            <div className="space-y-2">
              {[
                { role: 'admin',  desc: 'Akses penuh — boleh urus pengguna, tetapan klinik, dan semua data.' },
                { role: 'doctor', desc: 'Boleh lihat dan tambah data transaksi, invois, dan panel.' },
                { role: 'staff',  desc: 'Boleh lihat dan tambah data sahaja. Tiada akses tetapan.' },
              ].map(({ role, desc }) => (
                <div key={role} className="flex items-start gap-3">
                  <RoleBadge role={role} />
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

            {!genCode ? (
              /* Step 1: Fill in details */
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-slate-800 text-lg">Tambah Pengguna Baru</h3>
                  <button onClick={closeModal}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleInvite} className="space-y-4">
                  <div>
                    <label className="label">E-mel Pengguna *</label>
                    <input type="email" className="input" required
                      placeholder="staff@klinik.com"
                      value={invite.email}
                      onChange={e => setInvite(i => ({ ...i, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Peranan</label>
                    <select className="input" value={invite.role}
                      onChange={e => setInvite(i => ({ ...i, role: e.target.value }))}>
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
                    Sistem akan jana <strong>Kod Jemputan</strong>. Kongsi kod ini kepada pengguna. Mereka perlu masukkan kod semasa mendaftar akaun baru di ClinicVault.
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 btn-secondary">
                      Batal
                    </button>
                    <button type="submit" disabled={inviting} className="flex-1 btn-primary">
                      {inviting ? 'Menjana...' : 'Jana Kod Jemputan'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* Step 2: Show generated code */
              <div className="text-center space-y-5">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check size={28} className="text-green-600" />
                </div>

                <div>
                  <h3 className="font-semibold text-slate-800 text-lg">Kod Jemputan Dijana!</h3>
                  <p className="text-sm text-slate-400 mt-1">Kongsi kod ini dengan pengguna baru</p>
                </div>

                <div className="bg-slate-100 rounded-2xl p-5">
                  <p className="text-4xl font-mono font-bold text-slate-800 tracking-[0.3em]">{genCode}</p>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-slate-600 text-left leading-relaxed">
                  <p className="font-semibold text-amber-700 mb-1">Arahan kepada pengguna:</p>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>Buka ClinicVault dan klik <strong>Daftar Akaun</strong></li>
                    <li>Isi nama, e-mel dan kata laluan</li>
                    <li>Masukkan Kod Jemputan: <span className="font-mono font-bold text-amber-700">{genCode}</span></li>
                    <li>Klik <strong>Cipta Akaun</strong></li>
                  </ol>
                </div>

                <div className="flex gap-3">
                  <button onClick={copyCode} className="flex-1 btn-secondary">
                    {copied ? <><Check size={14} /> Disalin!</> : <><Copy size={14} /> Salin Kod</>}
                  </button>
                  <button onClick={() => { closeModal(); fetchMembers() }} className="flex-1 btn-primary">
                    Selesai
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
