import { useState, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import { formatRM, formatDate, today } from '../../lib/utils'
import { Plus, Search, Trash2, X } from 'lucide-react'

const INCOME_PAY_METHODS = [
  { value: 'cash',     label: 'TUNAI' },
  { value: 'transfer', label: 'ONLINE TRANSFER / TNG / QR PAY' },
  { value: 'bnpl',     label: 'ATOME / SPAY LATER' },
  { value: 'card',     label: 'DEBIT / CREDIT CARD' },
  { value: 'panel',    label: 'PANEL' },
]

const EXPENSE_CATS_OPTIONS = [
  { value: 'medicine',   label: 'MEDICINE / CONSUMABLES' },
  { value: 'clinic',     label: 'CLINIC ITEMS' },
  { value: 'locum',      label: 'LOCUM AND INCENTIVE' },
  { value: 'stationery', label: 'STATIONERY' },
  { value: 'printing',   label: 'PRINTING' },
  { value: 'delivery',   label: 'LALAMOVE / GRABEXPRESS' },
  { value: 'other',      label: 'LAIN-LAIN' },
]

const EXPENSE_PAY_METHODS = [
  { value: 'cash',     label: 'CASH / COD' },
  { value: 'transfer', label: 'ONLINE TRANSFER / TNG / QR PAY' },
  { value: 'bnpl',     label: 'ATOME / SPAY LATER' },
  { value: 'card',     label: 'DEBIT / CREDIT CARD' },
]

const CAT_LABELS = {
  consultation: 'Konsultasi', medication: 'Ubat', procedure: 'Prosedur',
  panel: 'Panel', lab: 'Makmal', other: 'Lain-lain',
  daily: 'Operasi Harian', hr: 'HR/Gaji', supplies: 'Bekalan',
  utility: 'Utiliti', rent: 'Sewa', equipment: 'Peralatan',
  medicine: 'Medicine/Consumables', clinic: 'Clinic Items',
  locum: 'Locum & Incentive', stationery: 'Stationery',
  printing: 'Printing', delivery: 'Lalamove/GrabExpress',
  serah: 'Serah Tunai → Bank',
}

const EMPTY_FORM = {
  type: 'income', date: today(), amt: '',
  cat: '', pay_type: 'cash', ref: '', notes: '', tax_deduct: 'no'
}

export default function TransactionsPage() {
  const { income, expense, clinicId, user, fetchAll, userRole, isSuperAdmin } = useStore()
  const canAmend = userRole === 'admin' || isSuperAdmin
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterMonth, setFilterMonth] = useState(today().slice(0, 7))
  const [deleting, setDeleting] = useState(null)

  const allTx = useMemo(() => {
    const all = [
      ...income.map(r => ({ ...r, _type: 'income' })),
      ...expense.map(r => ({ ...r, _type: 'expense', _isSerah: r.cat === 'serah' })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at))

    return all.filter(r => {
      if (filterType === 'income'  && r._type !== 'income') return false
      if (filterType === 'expense' && (r._type !== 'expense' || r.cat === 'serah')) return false
      if (filterType === 'serah'   && r.cat !== 'serah') return false
      if (filterMonth && !r.date?.startsWith(filterMonth)) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          r.description?.toLowerCase().includes(q) ||
          r.cat?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [income, expense, filterType, filterMonth, search])

  // Running balance — compute ascending, display descending
  const allTxWithBalance = useMemo(() => {
    const sorted = [...allTx].sort(
      (a, b) => new Date(a.date) - new Date(b.date) || new Date(a.created_at) - new Date(b.created_at)
    )
    let bal = 0
    const withBal = sorted.map(tx => {
      if (tx._type === 'income') bal += +tx.amt
      else if (tx.cat !== 'serah') bal -= +tx.amt  // serah tidak terlibat dalam baki
      return { ...tx, _balance: bal }
    })
    return withBal.reverse()
  }, [allTx])

  const totals = useMemo(() => {
    const inc   = allTx.filter(r => r._type === 'income').reduce((s, r) => s + +r.amt, 0)
    const serah = allTx.filter(r => r.cat === 'serah').reduce((s, r) => s + +r.amt, 0)
    const exp   = allTx.filter(r => r._type === 'expense' && r.cat !== 'serah').reduce((s, r) => s + +r.amt, 0)
    return { income: inc, expense: exp, serah, balance: inc - exp }
  }, [allTx])

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.amt || !form.date) return
    setSaving(true)
    try {
      if (form.type === 'income') {
        const label = INCOME_PAY_METHODS.find(m => m.value === form.pay_type)?.label || form.pay_type
        const { error } = await supabase.from('income').insert({
          clinic_id: clinicId, created_by: user?.id,
          date: form.date, description: label, amt: +form.amt,
          cat: 'other', pay_type: form.pay_type,
          ref: null, notes: form.notes || null,
        })
        if (error) throw error

      } else if (form.type === 'serah') {
        const { error } = await supabase.from('expense').insert({
          clinic_id: clinicId, created_by: user?.id,
          date: form.date,
          description: `TRANSFER IN BANK RM${(+form.amt).toFixed(2)}`,
          amt: +form.amt, cat: 'serah',
          ref: form.ref || null, notes: form.notes || null,
          tax_deduct: 'no', pay_method: 'cash',
        })
        if (error) throw error

      } else {
        const catLabel = EXPENSE_CATS_OPTIONS.find(c => c.value === form.cat)?.label || form.cat || 'Perbelanjaan'
        const { error } = await supabase.from('expense').insert({
          clinic_id: clinicId, created_by: user?.id,
          date: form.date, description: catLabel, amt: +form.amt,
          cat: form.cat || 'other',
          ref: form.ref || null, notes: form.notes || null,
          tax_deduct: form.tax_deduct, pay_method: form.pay_type,
        })
        if (error) throw error
      }

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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lajer Tunai</h1>
          {filterMonth && (
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(filterMonth + '-01').toLocaleString('ms-MY', { month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
        {canAmend && (
          <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM) }} className="btn-primary">
            <Plus size={16} /> Tambah Rekod
          </button>
        )}
      </div>

      {/* Summary — 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Cash In',      value: totals.income,  color: 'text-emerald-600' },
          { label: 'Cash Out',     value: totals.expense, color: 'text-red-500' },
          { label: 'Serah → Bank', value: totals.serah,   color: 'text-blue-600' },
          { label: 'Baki Tunai',   value: totals.balance,
            color: totals.balance >= 0 ? 'text-slate-800' : 'text-orange-500' },
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
          <input className="input pl-9" placeholder="Cari penerangan / nota..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[
            { v: 'all',     l: 'Semua' },
            { v: 'income',  l: 'Cash In' },
            { v: 'expense', l: 'Cash Out' },
            { v: 'serah',   l: 'Serah' },
          ].map(({ v, l }) => (
            <button key={v} onClick={() => setFilterType(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filterType === v ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {l}
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

      {/* Ledger table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Tarikh</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Butiran</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide w-28">Cash In</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-red-500 uppercase tracking-wide w-28">Cash Out</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-blue-600 uppercase tracking-wide w-28 hidden md:table-cell">Serah</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide w-28">Baki</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allTxWithBalance.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-400 text-sm">
                  Tiada rekod{filterMonth ? ' untuk bulan ini' : ''}.
                </td>
              </tr>
            ) : allTxWithBalance.map(tx => {
              const isSerah  = tx.cat === 'serah'
              const isIncome = tx._type === 'income'
              const rowBg    = isSerah ? 'bg-blue-50/50' : isIncome ? 'bg-emerald-50/30' : ''
              return (
                <tr key={tx.id} className={`hover:bg-slate-50 transition-colors ${rowBg}`}>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3">
                    <p className={`font-medium line-clamp-1 ${
                      isSerah ? 'text-blue-700' : isIncome ? 'text-emerald-700' : 'text-slate-700'
                    }`}>
                      {tx.description}
                    </p>
                    {tx.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{tx.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                    {isIncome ? formatRM(tx.amt) : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-500">
                    {!isIncome && !isSerah ? formatRM(tx.amt) : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600 hidden md:table-cell">
                    {isSerah ? formatRM(tx.amt) : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                    {formatRM(tx._balance)}
                  </td>
                  <td className="px-4 py-3">
                    {canAmend && (
                      <button onClick={() => handleDelete(tx)} disabled={deleting === tx.id}
                        className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add Record Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Tambah Rekod</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* 3-way type toggle */}
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {[
                  { v: 'income',  l: '↑ Cash In',          cls: 'bg-emerald-500 text-white shadow' },
                  { v: 'expense', l: '↓ Cash Out',         cls: 'bg-red-500 text-white shadow' },
                  { v: 'serah',   l: '→ Transfer In Bank', cls: 'bg-blue-500 text-white shadow' },
                ].map(({ v, l, cls }) => (
                  <button type="button" key={v} onClick={() => set('type', v)}
                    className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
                      form.type === v ? cls : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tarikh *</label>
                  <input type="date" className="input" value={form.date}
                    onChange={e => set('date', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Amaun (RM) *</label>
                  <input type="number" className="input" placeholder="0.00" min="0.01" step="0.01"
                    value={form.amt} onChange={e => set('amt', e.target.value)} required />
                </div>
              </div>

              {/* INCOME */}
              {form.type === 'income' && (
                <div>
                  <label className="label">Kaedah Bayaran</label>
                  <select className="input" value={form.pay_type} onChange={e => set('pay_type', e.target.value)}>
                    {INCOME_PAY_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* EXPENSE */}
              {form.type === 'expense' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Kategori</label>
                      <select className="input" value={form.cat} onChange={e => set('cat', e.target.value)}>
                        <option value="">Pilih...</option>
                        {EXPENSE_CATS_OPTIONS.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Kaedah Bayar</label>
                      <select className="input" value={form.pay_type} onChange={e => set('pay_type', e.target.value)}>
                        {EXPENSE_PAY_METHODS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Potongan Cukai</label>
                      <select className="input" value={form.tax_deduct} onChange={e => set('tax_deduct', e.target.value)}>
                        <option value="yes">Ya</option>
                        <option value="no">Tidak</option>
                        <option value="partial">Sebahagian</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">No. Rujukan</label>
                      <input type="text" className="input" placeholder="No. resit / invois"
                        value={form.ref} onChange={e => set('ref', e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {/* TRANSFER IN BANK: ref field */}
              {form.type === 'serah' && (
                <div>
                  <label className="label">No. Rujukan / Slip Bank</label>
                  <input type="text" className="input" placeholder="cth: slip bank, no. resit"
                    value={form.ref} onChange={e => set('ref', e.target.value)} />
                </div>
              )}

              {/* Notes / Remarks */}
              <div>
                <label className="label">
                  {form.type === 'expense' ? 'Butiran / Remarks' : 'Nota'}
                </label>
                <textarea className="input resize-none" rows={2}
                  placeholder={form.type === 'expense'
                    ? 'Senarai item (cth: grab RM5, tealive RM8, ubat RM20...)'
                    : 'Nota tambahan (optional)'}
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
