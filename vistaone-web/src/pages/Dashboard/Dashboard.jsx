// main dashboard page - pulls in all the smaller components
import React from "react";
import "../../styles/Dashboard.css";

// import each section component
import StatCard from "../../components/StatCard/StatCard";
import JobsList from "../../components/JobsList/JobsList";
import RecentInvoices from "../../components/RecentInvoices/RecentInvoices";

// import all the temp data
import {
  statCards,
  jobsInProgress,
  upcomingJobs,
  recentInvoices,
} from "../../data/dashboardData";

function Dashboard() {
  return (
    <main className="dashboard">
      {/* top bar with title and filter pills */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Real-time &middot; Last refreshed just now</p>
        </div>
        <div className="dashboard-filters">
          <span className="filter-pill">Q2 2025</span>
          <span className="filter-pill">Permian Basin</span>
          {/* bell icon for notifications */}
          <span className="filter-pill notification-bell">&#128276;</span>
        </div>
      </div>

      {/* row of stat cards */}
      <div className="stat-cards-row">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            subtitle={card.subtitle}
            color={card.color}
          />
        ))}
      </div>

      {/* jobs in progress and upcoming jobs side by side */}
      <div className="jobs-row">
        <JobsList title="Jobs in progress" jobs={jobsInProgress} type="active" />
        <JobsList title="Upcoming jobs" jobs={upcomingJobs} type="upcoming" />
      </div>

      {/* recent invoices at the bottom */}
      <RecentInvoices invoices={recentInvoices} />
    </main>
  );
}

export default Dashboard;
