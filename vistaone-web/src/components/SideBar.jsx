import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/sidebar.css";
import {
    FiGrid,
    FiList,
    FiClipboard,
    FiFileText,
    FiUsers,
    FiFolder,
    FiLogOut,
    FiSettings,
    FiShield,
    FiMenu,
    FiX,
    FiMessageCircle,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

function SideBar({ navData }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    const handleLogout = () => {
        logout();
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        navigate("/login");
    };

    const isActive = (to) => to && location.pathname.startsWith(to);

    const initials = navData.userName
        ? navData.userName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
        : "??";

    const handleNavigate = (to) => {
        if (to) {
            navigate(to);
            setIsOpen(false);
        }
    };

    return (
        <>
            {!isOpen && (
                <button className="sidebar-hamburger" onClick={() => setIsOpen(true)} aria-label="Open menu">
                    <FiMenu size={22} />
                </button>
            )}

            {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

        <aside className={`sidebar${isOpen ? " open" : ""}`}>
            <div className="sidebar-brand">
                <h2 className="sidebar-title">FieldPortal</h2>
                <p className="sidebar-subtitle">
                    {navData.clientName ? `${navData.clientName} Operations` : "Operations"}
                </p>
                <button className="sidebar-close" onClick={() => setIsOpen(false)} aria-label="Close menu">
                    <FiX size={20} />
                </button>
            </div>

            <nav className="sidebar-nav">
                <p className="sidebar-section-label">MAIN</p>
                <ul className="sidebar-list">
                    {navData.main.map((item) => (
                        <li
                            key={item.label}
                            className={`sidebar-item ${isActive(item.to) ? "active" : ""}`}
                            onClick={() => handleNavigate(item.to)}
                            style={{ cursor: item.to ? "pointer" : "default" }}
                        >
                            <span className="sidebar-icon">
                                {getIcon(item.icon)}
                            </span>
                            <span>{item.label}</span>
                            {item.badge ? (
                                <span className="sidebar-badge">
                                    {item.badge > 9 ? "9+" : item.badge}
                                </span>
                            ) : null}
                        </li>
                    ))}
                </ul>

                <p className="sidebar-section-label">ACCOUNT</p>
                <ul className="sidebar-list">
                    {navData.account.map((item) => (
                        <li
                            key={item.label}
                            className={`sidebar-item ${isActive(item.to) ? "active" : ""}`}
                            onClick={() => handleNavigate(item.to)}
                            style={{ cursor: item.to ? "pointer" : "default" }}
                        >
                            <span className="sidebar-icon">
                                {getIcon(item.icon)}
                            </span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>

                {navData.admin && navData.admin.length > 0 && (
                    <>
                        <p className="sidebar-section-label">ADMIN</p>
                        <ul className="sidebar-list">
                            {navData.admin.map((item) => (
                                <li
                                    key={item.label}
                                    className={`sidebar-item ${isActive(item.to) ? "active" : ""}`}
                                    onClick={() => handleNavigate(item.to)}
                                    style={{
                                        cursor: item.to ? "pointer" : "default",
                                    }}
                                >
                                    <span className="sidebar-icon">
                                        {getIcon(item.icon)}
                                    </span>
                                    <span>{item.label}</span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </nav>

            <div className="sidebar-bottom">
                <div className="sidebar-user">
                    <div className="sidebar-avatar">{initials}</div>
                    <div>
                        <p className="sidebar-user-name">
                            {navData.userName || "User"}
                        </p>
                        <p className="sidebar-user-role">
                            {navData.userRole || "Member"}
                        </p>
                    </div>
                </div>

                <button className="sidebar-logout" onClick={handleLogout}>
                    <FiLogOut />
                    <span>Sign out</span>
                </button>
            </div>
        </aside>
        </>
    );
}

function getIcon(iconName) {
    const icons = {
        grid: <FiGrid />,
        list: <FiList />,
        clipboard: <FiClipboard />,
        file: <FiFileText />,
        users: <FiUsers />,
        folder: <FiFolder />,
        settings: <FiSettings />,
        shield: <FiShield />,
        message: <FiMessageCircle />,
    };
    return icons[iconName] || null;
}

export default SideBar;
