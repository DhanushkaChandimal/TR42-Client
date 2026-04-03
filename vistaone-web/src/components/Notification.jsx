import { Bell } from 'lucide-react'
import './Notification.css'

function Notification() {
	return (
		<button className="notification-btn" aria-label="Notifications">
			<Bell size={20} />
			<span className="notification-dot" />
		</button>
	)
}

export default Notification
