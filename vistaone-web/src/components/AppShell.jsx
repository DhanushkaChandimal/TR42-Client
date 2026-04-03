import NavBar from './NavBar'
import TopBar from './TopBar'

function AppShell({ title, subtitle, eyebrow = 'Welcome back', controls, children }) {
	return (
		<div className="app-shell-page">
			<div className="app-shell-layout">
				<NavBar />

				<section className="app-shell-main">
					<TopBar title={title} subtitle={subtitle} eyebrow={eyebrow} controls={controls} />

					<div className="app-shell-content">{children}</div>
				</section>
			</div>
		</div>
	)
}

export default AppShell
