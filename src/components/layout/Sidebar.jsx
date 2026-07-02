import { NavLink } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard, ArrowLeftRight, FileText, CreditCard, Settings, LogOut, Building2
} from 'lucide-react'

const NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'Transaksi' },
  { to: '/documents',    icon: FileText,         label: 'Invois & Resit' },
  { to: '/panel',        icon: CreditCard,       label: 'Panel & Klaim' },
  { to: '/settings',     icon: Settings,         label: 'Tetapan' },
]

export default function Sidebar({ onClose }) {
  const { user, clinicName } = useStore()

  async function handleLogout() {
    await supabase.auth.signOut()
    useStore.setState({ user: null, clinicId: null, income: [], expense: [], panel: [], documents: [] })
  }

  return (
    <aside className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white w-64">
      {/* Clinic Header */}
      <div className="px-5 py-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{clinicName}</p>
            <p className="text-slate-400 text-xs truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`
            }>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-slate-700 pt-3">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-red-600/20 transition-all">
          <LogOut size={18} />
          Log Keluar
        </button>
      </div>
    </aside>
  )
}
