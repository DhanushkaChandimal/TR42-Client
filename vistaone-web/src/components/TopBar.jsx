import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, UserCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { initialNotifications } from '../data/dashboardData';
import '../styles/topBar.css';

function TopBar({ title, subtitle }) {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [notifications, setNotifications] = useState(initialNotifications);
    const notificationRef = useRef(null);
    const profileRef = useRef(null);
    const unreadCount = notifications.filter((item) => !item.isRead).length;

    useEffect(() => {
        function handleOutsideClick(event) {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setIsNotificationOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        }
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, []);

    return (
        <header className="topbar">
            <div className="topbar-row">
                <div>
                    <div className="fw-bold fs-5 text-dark mb-0">{title}</div>
                    {subtitle && <div className="text-muted small">{subtitle}</div>}
                </div>
                <div className="d-flex align-items-center gap-3">
                    <div className="position-relative" ref={notificationRef}>
                        <button
                            type="button"
                            className="btn btn-light position-relative border topbar-btn"
                            onClick={() => {
                                setIsNotificationOpen((prev) => !prev);
                                setIsProfileOpen(false);
                            }}
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger topbar-badge">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        {isNotificationOpen && (
                            <div className="dropdown-menu show p-3 shadow topbar-dropdown">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="fw-semibold">Notifications</span>
                                    <button className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))}>
                                        Mark all as read
                                    </button>
                                </div>
                                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                    {notifications.length === 0 ? (
                                        <div className="text-muted small">No notifications</div>
                                    ) : notifications.map((item) => (
                                        <button
                                            key={item.id}
                                            className={`dropdown-item d-flex flex-column align-items-start border rounded mb-1 topbar-notification-item${item.isRead ? ' read' : ''}`}
                                            onClick={() => setNotifications((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)))}
                                        >
                                            <span className="fw-medium text-dark">{item.title}</span>
                                            <div className="d-flex w-100 justify-content-between align-items-center mt-1">
                                                <span className="text-muted topbar-time">{item.time}</span>
                                                {!item.isRead && <span className="badge bg-primary rounded-pill topbar-dot"></span>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="position-relative" ref={profileRef}>
                        <button
                            type="button"
                            className="btn btn-light d-flex align-items-center border topbar-btn"
                            onClick={() => {
                                setIsProfileOpen((prev) => !prev);
                                setIsNotificationOpen(false);
                            }}
                        >
                            <UserCircle2 size={22} />
                        </button>
                        {isProfileOpen && (
                            <div className="dropdown-menu show p-2 shadow topbar-dropdown topbar-dropdown-profile">
                                <button className="dropdown-item" type="button" onClick={() => { setIsProfileOpen(false); navigate('/profile'); }}>View Profile</button>
                                <button className="dropdown-item text-danger" type="button" onClick={() => { logout(); setIsProfileOpen(false); navigate('/login', { replace: true }); }}>Logout</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

export default TopBar
