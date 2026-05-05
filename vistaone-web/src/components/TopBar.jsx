import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, UserCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationsContext';
import '../styles/topBar.css';

function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString();
}

function TopBar({ title, subtitle, controls }) {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const notificationsCtx = useNotifications();
    const notifications = notificationsCtx?.items ?? [];
    const unreadCount = notificationsCtx?.unreadCount ?? 0;
    const markAllRead = notificationsCtx?.markAllRead ?? (() => {});
    const markRead = notificationsCtx?.markRead ?? (() => {});
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const notificationRef = useRef(null);
    const profileRef = useRef(null);

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
                    {controls && <div className="topbar-controls">{controls}</div>}
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
                                    <button className="btn btn-link btn-sm p-0 text-decoration-none" onClick={markAllRead}>
                                        Mark all as read
                                    </button>
                                </div>
                                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                    {notifications.length === 0 ? (
                                        <div className="text-muted small">No notifications</div>
                                    ) : notifications.map((item) => (
                                        <button
                                            key={item.id}
                                            className="dropdown-item d-flex flex-column align-items-start border rounded mb-1 topbar-notification-item"
                                            onClick={() => markRead(item.id)}
                                        >
                                            <span className="fw-medium text-dark">{item.message}</span>
                                            <div className="d-flex w-100 justify-content-between align-items-center mt-1">
                                                <span className="text-muted topbar-time">{formatTime(item.created_at)}</span>
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
