// main dashboard page - pulls in all the smaller components
import React from "react";
import "../styles/dashboard.css";

// import each section component
import StatCard from "../components/StatCard";
import JobsList from "../components/JobsList";
import RecentInvoices from "../components/RecentInvoices";

// import all the temp data
import {
  statCards,
  jobsInProgress,
  upcomingJobs,
  recentInvoices,
} from "../data/dashboardData";
import AppShell from "../components/AppShell";

function Dashboard() {
  return (
    <AppShell
        title="Dashboard"
        subtitle="Overview of operations, work orders and invoices"
        eyebrow="Welcome back"
    >
        <main className="dashboard">
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
    </AppShell>
    
  );
}

export default Dashboard;
