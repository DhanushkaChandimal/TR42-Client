import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import '../styles/topBar.css';

function TopBar({ title, subtitle, controls }) {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef(null);

    useEffect(() => {
        function handleOutsideClick(event) {
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
                    <div className="position-relative" ref={profileRef}>
                        <button
                            type="button"
                            className="btn btn-light d-flex align-items-center border topbar-btn"
                            onClick={() => setIsProfileOpen((prev) => !prev)}
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
