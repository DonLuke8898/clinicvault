import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { formatRM, today } from '../../lib/utils'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, Plus,
  Building2, ArrowRight, ShieldAlert
} from 'lucide-react'

// ─── Shared Components ───────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        {trend != null && (
          <span className={`text-xs font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-sm font-medium text-slate-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function getLast6Months() {
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('ms-MY', { month: 'short' }),
    })
  }
  return months
}

// ─── Super Admin Overview ────────────────────────────────────────────────────

function SuperAdminDashboard() {
  const { income, expense, panel, allClinics, setActiveClinic } = useStore()
  const thisMonth = today().slice(0, 7)

  const aggregate = useMemo(() => {
    const totalIncome  = income.reduce((s, r) => s + +r.amt, 0)
    const totalExpense = expense.reduce((s, r) => s + +r.amt, 0)
    const mIncome      = income.filter(r => r.date?.startsWith(thisMonth)).reduce((s, r) => s + +r.amt, 0)
    const mExpense     = expense.filter(r => r.date?.startsWith(thisMonth)).reduce((s, r) => s + +r.amt, 0)
    const panelPending = panel
      .filter(r => +r.paid_amt < +r.billed_amt)
      .reduce((s, r) => s + (+r.billed_amt - +r.paid_amt), 0)
    return { totalIncome, totalExpense, mIncome, mExpense, panelPending }
  }, [income, expense, panel, thisMonth])

  const clinicRows = useMemo(() => {
    return allClinics.map(clinic => {
      const cInc = income.filter(r => r.clinic_id === clinic.id)
      const cExp = expense.filter(r => r.clinic_id === clinic.id)
      const cPan = panel.filter(r => r.clinic_id === clinic.id)
      const mInc = cInc.filter(r => r.date?.startsWith(thisMonth)).reduce((s, r) => s + +r.amt, 0)
      const mExp = cExp.filter(r => r.date?.startsWith(thisMonth)).reduce((s, r) => s + +r.amt, 0)
      const pending = cPan.filter(r => +r.paid_amt < +r.billed_amt).reduce((s, r) => s + (+r.billed_amt - +r.paid_amt), 0)
      return { ...clinic, mInc, mExp, pending, profit: mInc - mExp }
    })
  }, [allClinics, income, expense, panel, thisMonth])

  const chartData = useMemo(() => {
    const months = getLast6Months()
    return months.map(({ key, label }) => ({
      label,
      Pendapatan:   income.filter(r => r.date?.startsWith(key)).reduce((s, r) => s + +r.amt, 0),
      Perbelanjaan: expense.filter(r => r.date?.startsWith(key)).reduce((s, r) => s + +r.amt, 0),
    }))
  }, [income, expense])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
          <ShieldAlert size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Super Admin — Semua Klinik</h1>
          <p className="text-slate-500 text-sm">
            {new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Aggregate Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Jumlah Klinik" value={allClinics.length}
          icon={Building2} color="bg-violet-500" />
        <StatCard label="Pendapatan Bulan Ini" value={formatRM(aggregate.mIncome)}
          sub={`Keseluruhan: ${formatRM(aggregate.totalIncome)}`}
          icon={TrendingUp} color="bg-emerald-500" />
        <StatCard label="Perbelanjaan Bulan Ini" value={formatRM(aggregate.mExpense)}
          sub={`Keseluruhan: ${formatRM(aggregate.totalExpense)}`}
          icon={TrendingDown} color="bg-red-500" />
        <StatCard label="Tunggakan Panel (Semua)" value={formatRM(aggregate.panelPending)}
          icon={Clock} color="bg-amber-500" />
      </div>

      {/* Chart */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 mb-4">Pendapatan vs Perbelanjaan — Semua Klinik (6 Bulan)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `RM${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatRM(v)} />
            <Legend />
            <Bar dataKey="Pendapatan"   fill="#10b981" radius={[4,4,0,0]} />
            <Bar dataKey="Perbelanjaan" fill="#f43f5e" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-Clinic Table */}
      <div className="card">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Prestasi Per Klinik — Bulan Ini</h2>
        </div>
        {clinicRows.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Belum ada klinik berdaftar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Klinik</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pendapatan</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Perbelanjaan</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Untung</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tunggakan</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clinicRows.map(clinic => (
                  <tr key={clinic.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Building2 size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-700">{clinic.name}</p>
                          {clinic.address && <p className="text-xs text-slate-400 truncate max-w-[200px]">{clinic.address}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-emerald-600">{formatRM(clinic.mInc)}</td>
                    <td className="px-4 py-3.5 text-right font-medium text-red-500">{formatRM(clinic.mExp)}</td>
                    <td className={`px-4 py-3.5 text-right font-bold ${clinic.profit >= 0 ? 'text-slate-800' : 'text-orange-500'}`}>
                      {formatRM(clinic.profit)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-amber-600 font-medium">{formatRM(clinic.pending)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setActiveClinic(clinic.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Lihat <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Normal (Clinic) Dashboard ───────────────────────────────────────────────

export default function DashboardPage() {
  const { income, expense, panel, clinicName, isSuperAdmin, activeClinicId, setActiveClinic } = useStore()
  const thisMonth = today().slice(0, 7)

  // All hooks must run unconditionally before any early returns (Rules of Hooks)
  const summary = useMemo(() => {
    const mIncome  = income.filter(r => r.date?.startsWith(thisMonth)).reduce((s, r) => s + +r.amt, 0)
    const mExpense = expense.filter(r => r.date?.startsWith(thisMonth)).reduce((s, r) => s + +r.amt, 0)
    const totalIncome  = income.reduce((s, r) => s + +r.amt, 0)
    const pendingPanel = panel
      .filter(r => +r.paid_amt < +r.billed_amt)
      .reduce((s, r) => s + (+r.billed_amt - +r.paid_amt), 0)
    const overduePanel = panel.filter(r => {
      if (+r.paid_amt >= +r.billed_amt) return false
      const days = Math.floor((Date.now() - new Date(r.bill_date)) / 86400000)
      return days > (r.pay_term || 60)
    }).length
    return { mIncome, mExpense, profit: mIncome - mExpense, totalIncome, pendingPanel, overduePanel }
  }, [income, expense, panel, thisMonth])

  const chartData = useMemo(() => {
    const months = getLast6Months()
    return months.map(({ key, label }) => ({
      label,
      Pendapatan: income.filter(r => r.date?.startsWith(key)).reduce((s, r) => s + +r.amt, 0),
      Perbelanjaan: expense.filter(r => r.date?.startsWith(key)).reduce((s, r) => s + +r.amt, 0),
    }))
  }, [income, expense])

  const recentTx = useMemo(() => {
    const all = [
      ...income.map(r => ({ ...r, _type: 'income' })),
      ...expense.map(r => ({ ...r, _type: 'expense' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return all.slice(0, 8)
  }, [income, expense])

  // Show SA overview when Super Admin has no specific clinic selected
  if (isSuperAdmin && !activeClinicId) {
    return <SuperAdminDashboard />
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveClinic(null)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mb-1"
            >
              ← Semua Klinik
            </button>
          )}
          <h1 className="text-2xl font-bold text-slate-800">{clinicName}</h1>
          <p className="text-slate-500 text-sm">
            {new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/transactions" className="btn-primary">
            <Plus size={16} /> Rekod Baru
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pendapatan Bulan Ini" value={formatRM(summary.mIncome)}
          icon={TrendingUp} color="bg-emerald-500" />
        <StatCard label="Perbelanjaan Bulan Ini" value={formatRM(summary.mExpense)}
          icon={TrendingDown} color="bg-red-500" />
        <StatCard label="Untung Bersih" value={formatRM(summary.profit)}
          icon={DollarSign} color={summary.profit >= 0 ? 'bg-blue-600' : 'bg-orange-500'} />
        <StatCard label="Tunggakan Panel" value={formatRM(summary.pendingPanel)}
          sub={summary.overduePanel > 0 ? `${summary.overduePanel} overdue` : 'Semua dalam tempoh'}
          icon={Clock} color="bg-amber-500" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-700 mb-4">Pendapatan vs Perbelanjaan (6 Bulan)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `RM${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatRM(v)} />
              <Legend />
              <Bar dataKey="Pendapatan"   fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="Perbelanjaan" fill="#f43f5e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">Ringkasan Panel</h2>
          {panel.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle size={32} className="text-slate-300 mb-2" />
              <p className="text-slate-400 text-sm">Tiada rekod panel</p>
              <Link to="/panel" className="btn-secondary mt-3 text-xs">Tambah Panel</Link>
            </div>
          ) : (
            <>
              {[
                { label: 'Submitted', color: 'bg-blue-500',    count: panel.filter(p => p.status === 'submitted').length },
                { label: 'Approved',  color: 'bg-amber-500',   count: panel.filter(p => p.status === 'approved').length },
                { label: 'Paid',      color: 'bg-emerald-500', count: panel.filter(p => p.status === 'paid').length },
                { label: 'Disputed',  color: 'bg-red-500',     count: panel.filter(p => p.status === 'disputed').length },
              ].map(({ label, color, count }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className="text-sm text-slate-600">{label}</span>
                  </div>
                  <span className="font-bold text-slate-800">{count}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Transaksi Terkini</h2>
          <Link to="/transactions" className="text-blue-600 text-sm font-medium hover:underline">Lihat semua</Link>
        </div>
        {recentTx.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-400 text-sm">Belum ada transaksi</p>
            <Link to="/transactions" className="btn-primary mt-3 inline-flex">
              <Plus size={15} /> Tambah Transaksi
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentTx.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold
                    ${tx._type === 'income' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {tx._type === 'income' ? '↑' : '↓'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 line-clamp-1">{tx.description}</p>
                    <p className="text-xs text-slate-400">{tx.date} · {tx.cat}</p>
                  </div>
                </div>
                <span className={`font-semibold text-sm ${tx._type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {tx._type === 'income' ? '+' : '-'}{formatRM(tx.amt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
