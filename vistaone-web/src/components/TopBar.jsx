import ProfileMenu from "./ProfileMenu"
import Notification from "./Notification"

function TopBar({ title, subtitle, eyebrow = 'Welcome back', controls }) {
	return (
		<header className="app-shell-topbar">
			<div>
				<p className="app-shell-topbar-eyebrow">{eyebrow}</p>
				<h1 className="app-shell-title">{title}</h1>
				{subtitle ? <p className="app-shell-subtitle">{subtitle}</p> : null}
			</div>
            <div className="app-shell-topbar-controls">
                <Notification />
                <ProfileMenu />
            </div>
		</header>
	)
}

export default TopBar
