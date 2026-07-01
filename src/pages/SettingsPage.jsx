import { useState } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'
import { Save, Building2 } from 'lucide-react'

export default function SettingsPage() {
  const { clinicName, clinicId, setClinic } = useStore()
  const [name, setName] = useState(clinicName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!clinicId || !name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('clinics').update({ name: name.trim() }).eq('id', clinicId)
    setSaving(false)
    if (!error) {
      setClinic(clinicId, name.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Tetapan</h1>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-700">Maklumat Klinik</h2>
            <p className="text-xs text-slate-400">Kemaskini nama klinik anda</p>
          </div>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Nama Klinik</label>
            <input type="text" className="input" value={name}
              onChange={e => setName(e.target.value)} required />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={16} />
            {saving ? 'Menyimpan...' : saved ? '✓ Disimpan!' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-700 mb-1">Maklumat Sistem</h2>
        <p className="text-xs text-slate-400 mb-3">Butiran teknikal akaun anda</p>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-slate-500 w-28 flex-shrink-0">Clinic ID:</span>
            <span className="font-mono text-xs text-slate-600 break-all">{clinicId || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
