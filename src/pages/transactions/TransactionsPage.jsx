import { useState, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import { formatRM, formatDate, today } from '../../lib/utils'
import { Plus, Search, Trash2, Filter, X } from 'lucide-react'

const INCOME_CATS  = ['consultation', 'medication', 'procedure', 'panel', 'lab', 'other']
const EXPENSE_CATS = ['daily', 'hr', 'supplies', 'utility', 'rent', 'equipment', 'other']
const PAY_METHODS  = ['cash', 'card', 'qr', 'transfer', 'panel', 'spay', 'tng', 'atome']

const CAT_LABELS = {
  consultation: 'Konsultasi', medication: 'Ubat', procedure: 'Prosedur',
  panel: 'Panel', lab: 'Makmal', other: 'Lain-lain',
  daily: 'Operasi Harian', hr: 'HR/Gaji', supplies: 'Bekalan',
  utility: 'Utiliti', rent: 'Sewa', equipment: 'Peralatan',
}

const EMPTY_FORM = {
  type: 'income', date: today(), description: '', amt: '',
  cat: '', pay_type: 'cash', vendor: '', ref: '', notes: '', tax_deduct: 'no'
}

export default function TransactionsPage() {
  const { income, expense, clinicId, user, fetchAll } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all'|'income'|'expense'
  const [filterMonth, setFilterMonth] = useState('')
  const [deleting, setDeleting] = useState(null)

  const allTx = useMemo(() => {
    const all = [
      ...income.map(r => ({ ...r, _type: 'income' })),
      ...expense.map(r => ({ ...r, _type: 'expense' })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at))

    return all.filter(r => {
      if (filterType !== 'all' && r._type !== filterType) return false
      if (filterMonth && !r.date?.startsWith(filterMonth)) return false
      if (search) {
        const q = search.toLowerCase()
        return r.description?.toLowerCase().includes(q) || r.cat?.toLowerCase().includes(q)
      }
      return true
    })
  }, [income, expense, filterType, filterMonth, search])

  const totals = useMemo(() => ({
    income:  allTx.filter(r => r._type === 'income').reduce((s, r) => s + +r.amt, 0),
    expense: allTx.filter(r => r._type === 'expense').reduce((s, r) => s + +r.amt, 0),
  }), [allTx])

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.description || !form.amt || !form.date) return
    setSaving(true)
    try {
      const table = form.type
      const row = form.type === 'income'
        ? { clinic_id: clinicId, created_by: user?.id,
            date: form.date, description: form.description, amt: +form.amt,
            cat: form.cat || 'other', pay_type: form.pay_type,
            ref: form.ref || null, notes: form.notes || null }
        : { clinic_id: clinicId, created_by: user?.id,
            date: form.date, description: form.description, amt: +form.amt,
            cat: form.cat || 'other', vendor: form.vendor || null,
            ref: form.ref || null, notes: form.notes || null,
            tax_deduct: form.tax_deduct, pay_method: form.pay_type }

      const { error } = await supabase.from(table).insert(row)
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

  async function handleDelete(tx) {
    if (!confirm(`Padam rekod "${tx.description}"?`)) return
    setDeleting(tx.id)
    await supabase.from(tx._type).delete().eq('id', tx.id)
    await fetchAll()
    setDeleting(null)
  }

  const cats = form.type === 'income' ? INCOME_CATS : EXPENSE_CATS

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Transaksi</h1>
        <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM) }} className="btn-primary">
          <Plus size={16} /> Tambah Rekod
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendapatan (ditapis)', value: totals.income, color: 'text-emerald-600' },
          { label: 'Perbelanjaan (ditapis)', value: totals.expense, color: 'text-red-500' },
          { label: 'Bersih', value: totals.income - totals.expense, color: totals.income - totals.expense >= 0 ? 'text-blue-700' : 'text-orange-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-lg font-bold ${color}`}>{formatRM(value)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Cari penerangan..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {['all','income','expense'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filterType === t ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t === 'all' ? 'Semua' : t === 'income' ? 'Pendapatan' : 'Perbelanjaan'}
            </button>
          ))}
        </div>
        <input type="month" className="input w-auto" value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)} />
        {(search || filterMonth) && (
          <button onClick={() => { setSearch(''); setFilterMonth('') }} className="btn-ghost text-xs">
            <X size={13} /> Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tarikh</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Penerangan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Kategori</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Jenis</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amaun</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {allTx.length === 0 ? (
              <tr><td colSpan={6} className="py-16 text-center text-slate-400 text-sm">Tiada rekod ditemui</td></tr>
            ) : allTx.map(tx => (
              <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-700 line-clamp-1">{tx.description}</p>
                  {tx.notes && <p className="text-xs text-slate-400 line-clamp-1">{tx.notes}</p>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="badge-slate">{CAT_LABELS[tx.cat] || tx.cat}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={tx._type === 'income' ? 'badge-green' : 'badge-red'}>
                    {tx._type === 'income' ? 'Pendapatan' : 'Perbelanjaan'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  <span className={tx._type === 'income' ? 'text-emerald-600' : 'text-red-500'}>
                    {tx._type === 'income' ? '+' : '-'}{formatRM(tx.amt)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(tx)} disabled={deleting === tx.id}
                    className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Tambah Rekod</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Type toggle */}
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {['income','expense'].map(t => (
                  <button type="button" key={t} onClick={() => set('type', t)}
                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                      form.type === t
                        ? t === 'income' ? 'bg-emerald-500 text-white shadow' : 'bg-red-500 text-white shadow'
                        : 'text-slate-500'
                    }`}>
                    {t === 'income' ? '↑ Pendapatan' : '↓ Perbelanjaan'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tarikh *</label>
                  <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Amaun (RM) *</label>
                  <input type="number" className="input" placeholder="0.00" min="0.01" step="0.01"
                    value={form.amt} onChange={e => set('amt', e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="label">Penerangan *</label>
                <input type="text" className="input" placeholder="Cth: Yuran konsultasi pesakit"
                  value={form.description} onChange={e => set('description', e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Kategori</label>
                  <select className="input" value={form.cat} onChange={e => set('cat', e.target.value)}>
                    <option value="">Pilih...</option>
                    {cats.map(c => <option key={c} value={c}>{CAT_LABELS[c]||c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{form.type === 'income' ? 'Kaedah Bayaran' : 'Kaedah Bayar'}</label>
                  <select className="input" value={form.pay_type} onChange={e => set('pay_type', e.target.value)}>
                    {PAY_METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>

              {form.type === 'expense' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Vendor</label>
                    <input type="text" className="input" placeholder="Nama vendor/pembekal"
                      value={form.vendor} onChange={e => set('vendor', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Potongan Cukai</label>
                    <select className="input" value={form.tax_deduct} onChange={e => set('tax_deduct', e.target.value)}>
                      <option value="yes">Ya</option>
                      <option value="no">Tidak</option>
                      <option value="partial">Sebahagian</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="label">No. Rujukan</label>
                <input type="text" className="input" placeholder="No. resit / invois"
                  value={form.ref} onChange={e => set('ref', e.target.value)} />
              </div>

              <div>
                <label className="label">Nota</label>
                <textarea className="input resize-none" rows={2} placeholder="Nota tambahan (optional)"
                  value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Menyimpan...' : 'Simpan Rekod'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
