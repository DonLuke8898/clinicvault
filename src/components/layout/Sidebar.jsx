import { NavLink } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard, ArrowLeftRight, FileText, CreditCard, Settings, LogOut
} from 'lucide-react'
import logo from '../../assets/logo.png'

const NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'Transaksi' },
  { to: '/documents',    icon: FileText,         label: 'Invois & Resit' },
  { to: '/panel',        icon: CreditCard,       label: 'Panel & Klaim' },
  { to: '/settings',     icon: Settings,         label: 'Tetapan' },
]

const ROLE_LABEL = { admin: 'Admin', doctor: 'Doktor', staff: 'Staff' }
const ROLE_COLOR = {
  admin:  'bg-purple-500/20 text-purple-300',
  doctor: 'bg-blue-500/20 text-blue-300',
  staff:  'bg-slate-500/20 text-slate-300',
}

export default function Sidebar({ onClose }) {
  const { user, clinicName, userRole } = useStore()

  async function handleLogout() {
    await supabase.auth.signOut()
    useStore.setState({ user: null, clinicId: null, userRole: null, income: [], expense: [], panel: [], documents: [] })
  }

  return (
    <aside className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white w-64">
      {/* Clinic Header */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <img src={logo} alt="ClinicVault" className="w-10 h-10 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm truncate text-white">{clinicName}</p>
            <p className="text-slate-400 text-xs truncate">{user?.email}</p>
            {userRole && (
              <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLOR[userRole] || ROLE_COLOR.staff}`}>
                {ROLE_LABEL[userRole] || userRole}
              </span>
            )}
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
