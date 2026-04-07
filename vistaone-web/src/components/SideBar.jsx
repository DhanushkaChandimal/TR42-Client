// sidebar component - the left nav panel with links and user info
import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/sidebar.css";

// importing icons from react-icons (fi = Feather Icons set)
import { FiGrid, FiList, FiClipboard, FiFileText, FiUsers, FiFolder, FiLogOut } from "react-icons/fi";

// navData gets passed in from the parent component
function Sidebar({ navData }) {
  const navigate = useNavigate();

  // clears both auth tokens and sends user back to login
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    navigate("/login");
  };

  return (
    <aside className="sidebar">

      {/* brand section at the top */}
      <div className="sidebar-brand">
        <h2 className="sidebar-title">FieldPortal</h2>
        <p className="sidebar-subtitle">Permian Basin Operations</p>
      </div>

      {/* navigation links */}
      <nav className="sidebar-nav">
        <p className="sidebar-section-label">MAIN</p>

        {/* map through each main nav item */}
        <ul className="sidebar-list">
          {navData.main.map((item) => (
            <li
              key={item.label}
              className={`sidebar-item ${item.active ? "active" : ""}`}
            >
              <span className="sidebar-icon">{getIcon(item.icon)}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>

        <p className="sidebar-section-label">ACCOUNT</p>

        {/* account section */}
        <ul className="sidebar-list">
          {navData.account.map((item) => (
            <li
              key={item.label}
              className={`sidebar-item ${item.active ? "active" : ""}`}
            >
              <span className="sidebar-icon">{getIcon(item.icon)}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </nav>

      {/* user profile and sign out at the bottom */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar">RC</div>
          <div>
            <p className="sidebar-user-name">R. Chavez</p>
            <p className="sidebar-user-role">Company Rep</p>
          </div>
        </div>

        {/* logout button */}
        <button className="sidebar-logout" onClick={handleLogout}>
          <FiLogOut />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

// maps icon names to react-icons components
function getIcon(iconName) {
  const icons = {
    grid: <FiGrid />,
    list: <FiList />,
    clipboard: <FiClipboard />,
    file: <FiFileText />,
    users: <FiUsers />,
    folder: <FiFolder />,
  };
  return icons[iconName] || null;
}

export default Sidebar;
