import { useState, useRef, useEffect } from 'react'
import { User, ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react'
import './ProfileMenu.css'

function ProfileMenu() {
	const [open, setOpen] = useState(false)
	const menuRef = useRef(null)

	useEffect(() => {
		function handleClickOutside(event) {
			if (menuRef.current && !menuRef.current.contains(event.target)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	return (
		<div className="profile-menu" ref={menuRef}>
			<button className="profile-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
				<User size={20} />
				<span className="profile-name">Profile</span>
				<ChevronDown size={16} />
			</button>
			{open && (
				<ul className="profile-dropdown" role="menu">
					<li role="menuitem"><SettingsIcon size={16} /> Settings</li>
					<li role="menuitem"><LogOut size={16} /> Logout</li>
				</ul>
			)}
		</div>
	)
}

export default ProfileMenu
