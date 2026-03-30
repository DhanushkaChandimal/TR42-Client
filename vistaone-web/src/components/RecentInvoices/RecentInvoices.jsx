// the recent invoices section at the bottom of the dashboard
import React from "react";
import "../../styles/RecentInvoices.css";

function RecentInvoices({ invoices }) {
  return (
    <div className="invoices-card">
      {/* header with title and view all link */}
      <div className="invoices-header">
        <h3 className="invoices-title">Recent invoices</h3>
        <a href="#" className="invoices-view-all">View all &rarr;</a>
      </div>

      {/* loop through each invoice and render a row */}
      <ul className="invoices-list">
        {invoices.map((inv) => (
          <li key={inv.id} className="invoices-row">
            {/* dot color changes based on status */}
            <span
              className="invoices-dot"
              style={{ backgroundColor: getDotColor(inv.status) }}
            ></span>

            <span className="invoices-id">{inv.id}</span>

            {/* work order and client info */}
            <span className="invoices-detail">
              {inv.workOrder} &middot; {inv.client} &middot; {inv.location}
            </span>

            <span className="invoices-amount">{inv.amount}</span>

            {/* badge color depends on pending/flagged/approved */}
            <span className={`invoices-badge badge-${inv.status.toLowerCase()}`}>
              {inv.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// returns a dot color based on invoice status
function getDotColor(status) {
  if (status === "Approved") return "#27ae60";
  if (status === "Flagged") return "#c0392b";
  return "#b7950b"; // pending
}

export default RecentInvoices;
