import { useState, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import { formatRM, formatDate, today, daysBetween } from '../../lib/utils'
import { Plus, Upload, FileText, Trash2, X, AlertTriangle } from 'lucide-react'

const STATUS_MAP = {
  paid:    { label: 'Dibayar',         cls: 'badge-green' },
  partial: { label: 'Bayar Sebahagian', cls: 'badge-yellow' },
  unpaid:  { label: 'Belum Bayar',      cls: 'badge-red' },
  overdue: { label: 'Tertunggak',       cls: 'badge-red' },
}

const EMPTY_FORM = {
  name: '', type: 'invois', date: today(), amt: '',
  due_date: '', status: 'unpaid', notes: '',
  file_name: '', file_type: '', file_data: '',
}

export default function DocumentsPage() {
  const { documents, clinicId, user, fetchAll } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  function setF(field, val) { setForm(f => ({ ...f, [field]: val })) }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setF('file_name', file.name)
      setF('file_type', file.type)
      setF('file_data', ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function computeStatus(doc) {
    if (doc.status === 'paid') return 'paid'
    if (doc.status === 'partial') return 'partial'
    if (doc.due_date) {
      const days = daysBetween(doc.due_date)
      if (days > 0) return 'overdue'
    }
    return doc.status || 'unpaid'
  }

  const filtered = useMemo(() => {
    return documents.filter(d => {
      const status = computeStatus(d)
      if (filterStatus !== 'all' && status !== filterStatus) return false
      if (search && !d.name?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [documents, filterStatus, search])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const row = {
        clinic_id: clinicId, created_by: user?.id,
        name: form.name, type: form.type, date: form.date || null,
        amt: form.amt ? +form.amt : null,
        due_date: form.due_date || null,
        status: form.status, notes: form.notes || null,
        file_name: form.file_name || null, file_type: form.file_type || null,
        file_data: form.file_data || null,
      }
      const { error } = await supabase.from('documents').insert(row)
      if (error) throw error
      await fetchAll()
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (err) {
      alert('Ralat: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateStatus(doc, newStatus) {
    await supabase.from('documents').update({ status: newStatus }).eq('id', doc.id)
    await fetchAll()
  }

  async function handleDelete(doc) {
    if (!confirm(`Padam dokumen "${doc.name}"?`)) return
    await supabase.from('documents').delete().eq('id', doc.id)
    await fetchAll()
  }

  const overdueCnt = documents.filter(d => computeStatus(d) === 'overdue').length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dokumen & Invois</h1>
          {overdueCnt > 0 && (
            <p className="text-red-500 text-sm flex items-center gap-1 mt-0.5">
              <AlertTriangle size={14} /> {overdueCnt} invois tertunggak
            </p>
          )}
        </div>
        <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM) }} className="btn-primary">
          <Plus size={16} /> Tambah Dokumen
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <FileText size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Cari nama dokumen..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {['all','unpaid','partial','paid','overdue'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filterStatus === s ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {s === 'all' ? 'Semua' : STATUS_MAP[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Document Grid */}
      {filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <FileText size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Tiada dokumen ditemui</p>
          <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM) }} className="btn-primary mt-4 inline-flex">
            <Upload size={15} /> Upload Dokumen
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => {
            const status = computeStatus(doc)
            const { label, cls } = STATUS_MAP[status] || STATUS_MAP.unpaid
            const daysOverdue = status === 'overdue' && doc.due_date ? daysBetween(doc.due_date) : null
            return (
              <div key={doc.id} className={`card p-5 space-y-3 ${status === 'overdue' ? 'border-red-200' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={18} className="text-blue-600" />
                    </div>
                    <p className="font-semibold text-slate-800 text-sm line-clamp-2">{doc.name}</p>
                  </div>
                  <button onClick={() => handleDelete(doc)} className="text-slate-200 hover:text-red-400 flex-shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className={cls}>{label}</span>
                  {doc.amt && <span className="font-bold text-slate-700">{formatRM(doc.amt)}</span>}
                </div>

                <div className="text-xs text-slate-400 space-y-0.5">
                  <p>Tarikh: {formatDate(doc.date)}</p>
                  {doc.due_date && <p className={status === 'overdue' ? 'text-red-500 font-semibold' : ''}>
                    Tarikh Akhir: {formatDate(doc.due_date)}
                    {daysOverdue && ` (${daysOverdue} hari tertunggak)`}
                  </p>}
                  {doc.type && <p>Jenis: {doc.type}</p>}
                </div>

                {doc.notes && <p className="text-xs text-slate-500 line-clamp-2">{doc.notes}</p>}

                {doc.file_name && (
                  <a href={doc.file_data} download={doc.file_name}
                    className="text-blue-600 text-xs hover:underline flex items-center gap-1">
                    <FileText size={12} /> {doc.file_name}
                  </a>
                )}

                {/* Status update */}
                {status !== 'paid' && (
                  <div className="flex gap-2 pt-1">
                    {status !== 'partial' && (
                      <button onClick={() => handleUpdateStatus(doc, 'partial')}
                        className="btn-secondary text-xs py-1.5 flex-1 justify-center">
                        Bayar Sebahagian
                      </button>
                    )}
                    <button onClick={() => handleUpdateStatus(doc, 'paid')}
                      className="btn-primary text-xs py-1.5 flex-1 justify-center">
                      Tandakan Dibayar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Tambah Dokumen</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Nama Dokumen *</label>
                <input type="text" className="input" placeholder="Cth: Invois Bekalan Ubat Jan 2026"
                  value={form.name} onChange={e => setF('name', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Jenis</label>
                  <select className="input" value={form.type} onChange={e => setF('type', e.target.value)}>
                    <option value="invois">Invois</option>
                    <option value="resit">Resit</option>
                    <option value="kontrak">Kontrak</option>
                    <option value="lain">Lain-lain</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setF('status', e.target.value)}>
                    <option value="unpaid">Belum Bayar</option>
                    <option value="partial">Bayar Sebahagian</option>
                    <option value="paid">Dibayar</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tarikh Dokumen</label>
                  <input type="date" className="input" value={form.date} onChange={e => setF('date', e.target.value)} />
                </div>
                <div>
                  <label className="label">Tarikh Akhir Bayar</label>
                  <input type="date" className="input" value={form.due_date} onChange={e => setF('due_date', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Amaun (RM)</label>
                <input type="number" className="input" placeholder="0.00" min="0" step="0.01"
                  value={form.amt} onChange={e => setF('amt', e.target.value)} />
              </div>
              <div>
                <label className="label">Upload Fail (PDF / Imej)</label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                  <Upload size={22} className="text-slate-400 mb-2" />
                  <span className="text-sm text-slate-500">{form.file_name || 'Klik untuk pilih fail'}</span>
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFile} />
                </label>
              </div>
              <div>
                <label className="label">Nota</label>
                <textarea className="input resize-none" rows={2} value={form.notes}
                  onChange={e => setF('notes', e.target.value)} placeholder="Nota tambahan..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Batal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
