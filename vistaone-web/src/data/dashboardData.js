// all the temp data for the dashboard lives here
// later this will come from the API but for now its hardcoded 
// for visual development and testing

// the four stat cards at the top of the dashboard
export const statCards = [
  {
    label: "Jobs in progress",
    value: 7,
    subtitle: "Active now",
    color: "#1a5276", // dark blue
  },
  {
    label: "Upcoming jobs",
    value: 4,
    subtitle: "Next 14 days",
    color: "#27ae60", // green
  },
  {
    label: "Completed (30d)",
    value: 12,
    subtitle: "\u2191 3 vs prior period", // up arrow
    color: "#27ae60",
  },
  {
    label: "Invoices pending",
    value: 3,
    subtitle: "Awaiting review",
    color: "#b7950b", // amber
  },
];

// jobs that are currently active
export const jobsInProgress = [
  {
    name: "Wellbore Integrity",
    client: "Client Name",
    location: "Location Name",
    status: "Active",
  },
  {
    name: "Casing Inspection",
    client: "Client Name",
    location: "Location Name",
    status: "Active",
  },
  {
    name: "Stimulation Servi...",
    client: "Client Name",
    location: "Location Name",
    status: "Active",
  },
  {
    name: "Flowback Operati...",
    client: "Client Name",
    location: "Location Name",
    status: "Active",
  },
];

// jobs coming up soon with their scheduled dates
export const upcomingJobs = [
  {
    name: "Plug & Abandon",
    client: "Client Name",
    location: "Location Name",
    date: "Jun 3",
  },
  {
    name: "Pump Replacement",
    client: "Client Name",
    location: "Location Name",
    date: "Jun 7",
  },
  {
    name: "Pipeline Survey",
    client: "Client Name",
    location: "Location Name",
    date: "Jun 11",
  },
  {
    name: "Cementing Services",
    client: "Client Name",
    location: "Location Name",
    date: "Jun 15",
  },
];

// recent invoices with their payment status
export const recentInvoices = [
  {
    id: "INV-2025-088",
    workOrder: "WO-041",
    client: "Client Name",
    location: "L...",
    amount: "$48,250",
    status: "Pending",
  },
  {
    id: "INV-2025-085",
    workOrder: "WO-039",
    client: "Client Name",
    location: "L...",
    amount: "$31,800",
    status: "Flagged",
  },
  {
    id: "INV-2025-081",
    workOrder: "WO-037",
    client: "Client Name",
    location: "...",
    amount: "$72,400",
    status: "Approved",
  },
];

// sidebar menu items split into main and account sections
// permission: backend resource name — if set, item is hidden when user lacks can_read on that resource
export const sidebarNav = {
  main: [
    { to: '/dashboard', label: "Dashboard", icon: "grid", permission: "dashboard" },
    { to: '/wells', label: "Oil Wells", icon: "list", permission: "wells" },
    { to: '/workorders', label: "Work Orders", icon: "clipboard", permission: "workorders" },
    { to: "/tickets", label: "Tickets", icon: "clipboard", permission: "workorders" },
    { to: "/invoices", label: "Invoices", icon: "file", permission: "invoices" },
    { to: "/vendor-favorites", label: "Vendors", icon: "users", permission: "vendors" },
    { to: "/messages", label: "Messages", icon: "message", permission: "messages" },
  ],
  account: [
    { to: "/vendor-marketplace", label: "Vendor Marketplace", icon: "users", permission: "vendor_marketplace" },
    { to: "/contracts", label: "Contracts / MSA", icon: "folder", permission: "contracts" },
    { to: "/analytics", label: "Analytics", icon: "grid", permission: "analytics" },
    { to: "/fraud", label: "Fraud & Anomalies", icon: "file", permission: "fraud" },
  ],
};

// notifications will be populated from the API when the notification feature is built
export const initialNotifications = [];
