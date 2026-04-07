// a single stat card - shows a number with a label and subtitle
// used for "Jobs in progress: 7", "Upcoming jobs: 4", etc.
import React from "react";
import "../styles/statCard.css";

// destructure the props so we can use them directly
function StatCard({ label, value, subtitle, color }) {
  return (
    <div className="stat-card">
      {/* the title of the stat like "Jobs in progress" */}
      <p className="stat-label">{label}</p>

      {/* the big number */}
      <p className="stat-value">{value}</p>

      {/* subtitle with a colored dot next to it */}
      <div className="stat-subtitle">
        <span className="stat-dot" style={{ backgroundColor: color }}></span>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

export default StatCard;
