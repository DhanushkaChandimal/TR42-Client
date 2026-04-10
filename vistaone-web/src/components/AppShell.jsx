import TopBar from './TopBar'
import '../styles/appShell.css'
import Sidebar from './Sidebar'
import { sidebarNav } from '../data/dashboardData'

function AppShell({ title, subtitle, eyebrow = 'Welcome back', controls, children }) {
	return (
		<div className="app-shell-page">
			<div className="app-shell-layout">
				<Sidebar navData={sidebarNav} />

				<section className="app-shell-main">
					<TopBar title={title} subtitle={subtitle} eyebrow={eyebrow} controls={controls} />

					<div className="app-shell-content">{children}</div>
				</section>
			</div>
		</div>
	)
}

export default AppShell
