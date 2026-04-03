import {
	Fuel,
	LayoutDashboard,
	ClipboardList,
	Building2,
	ChartColumn,
	ReceiptText,
	ShieldAlert,
	Settings
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navigationItems = [
	{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
	{ to: '/workorder', label: 'Work Orders', icon: ClipboardList },
	{ to: '/vendors', label: 'Vendors', icon: Building2 },
	{ to: '/analytics', label: 'Analytics', icon: ChartColumn },
	{ to: '/invoices', label: 'Invoices', icon: ReceiptText },
	{ to: '/fraud-alerts', label: 'Fraud Alerts', icon: ShieldAlert },
	{ to: '/settings', label: 'Settings', icon: Settings }
]

function NavBar() {
	return (
		<aside className="app-shell-sidebar" aria-label="Main navigation">
			<div className="app-shell-brand">
				<div className="app-shell-brand-icon">
					<Fuel size={18} />
				</div>
				<div>
					<p className="app-shell-brand-overline">Client</p>
					<h2 className="app-shell-brand-title">Command Center</h2>
				</div>
			</div>

			<nav className="app-shell-nav">
				{navigationItems.map((item) => {
					const Icon = item.icon

					return (
						<NavLink
							key={item.to}
							to={item.to}
							className={({ isActive }) =>
								`app-shell-link ${isActive ? 'active' : ''}`
							}
						>
							<Icon size={18} />
							<span>{item.label}</span>
						</NavLink>
					)
				})}
			</nav>
		</aside>
	)
}

export default NavBar
