// renders either the "Jobs in progress" or "Upcoming jobs" card
// we reuse this one component for both by passing different props
import React from "react";
import "../../styles/JobsList.css";

function JobsList({ title, jobs, type }) {
  return (
    <div className="jobs-card">
      {/* header row with title and "View all" link */}
      <div className="jobs-header">
        <h3 className="jobs-title">{title}</h3>
        <a href="#" className="jobs-view-all">View all &rarr;</a>
      </div>

      {/* list of job rows */}
      <ul className="jobs-list">
        {jobs.map((job) => (
          <li key={job.name} className="jobs-row">
            {/* colored dot - filled for active, hollow for upcoming */}
            <span
              className={`jobs-dot ${type === "active" ? "dot-filled" : "dot-hollow"}`}
            ></span>

            {/* job name and client info */}
            <div className="jobs-info">
              <p className="jobs-name">{job.name}</p>
              <p className="jobs-detail">{job.client} &middot; {job.location}</p>
            </div>

            {/* badge on the right - shows status or date depending on type */}
            <span className={`jobs-badge ${type === "active" ? "badge-active" : "badge-upcoming"}`}>
              {type === "active" ? job.status : job.date}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default JobsList;
