// Pure functions that derive analytics + fraud signals from already-fetched data.
// No new endpoints — these compute on the client from /tickets, /vendors, /invoices, /workorders, /msa.

const REJECTION_RATE_THRESHOLD = 0.3; // 30%+ rejection = HIGH

export function vendorMap(vendors) {
  const m = new Map();
  vendors.forEach((v) => m.set(v.id, v));
  return m;
}

export function ticketsByVendor(tickets) {
  const m = new Map();
  tickets.forEach((t) => {
    if (!m.has(t.vendor_id)) m.set(t.vendor_id, []);
    m.get(t.vendor_id).push(t);
  });
  return m;
}

export function vendorTicketStats(tickets, vendors) {
  const groups = ticketsByVendor(tickets);
  const lookup = vendorMap(vendors);
  const rows = [];
  groups.forEach((list, vendorId) => {
    const total = list.length;
    const approved = list.filter((t) => t.status === "APPROVED").length;
    const rejected = list.filter((t) => t.status === "REJECTED").length;
    const pending = list.filter((t) => t.status === "PENDING_APPROVAL").length;
    const reviewed = approved + rejected;
    const rejectionRate = reviewed > 0 ? rejected / reviewed : 0;
    const v = lookup.get(vendorId);

    let avgApprovalHours = null;
    const approvedTickets = list.filter(
      (t) => t.status === "APPROVED" && t.created_at && t.approved_at,
    );
    if (approvedTickets.length > 0) {
      const totalMs = approvedTickets.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const approved = new Date(t.approved_at).getTime();
        return sum + (approved - created);
      }, 0);
      avgApprovalHours = totalMs / approvedTickets.length / (1000 * 60 * 60);
    }

    rows.push({
      vendorId,
      vendorName: v?.company_name || v?.name || vendorId.slice(0, 8),
      total,
      approved,
      rejected,
      pending,
      rejectionRate,
      avgApprovalHours,
    });
  });
  rows.sort((a, b) => b.rejectionRate - a.rejectionRate || b.rejected - a.rejected);
  return rows;
}

export function vendorsBySharedService(vendors) {
  const serviceMap = new Map();
  vendors.forEach((v) => {
    const services = v.vendor_services || v.services || [];
    services.forEach((vs) => {
      const serviceName =
        vs.service_type?.service || vs.service?.service || vs.service_name;
      if (!serviceName) return;
      if (!serviceMap.has(serviceName)) serviceMap.set(serviceName, []);
      serviceMap.get(serviceName).push(v.company_name || v.name);
    });
  });
  const rows = [];
  serviceMap.forEach((vendorNames, service) => {
    if (vendorNames.length >= 2) {
      rows.push({ service, vendors: vendorNames });
    }
  });
  rows.sort((a, b) => b.vendors.length - a.vendors.length);
  return rows;
}

export function costByService(invoices, workOrders) {
  const woMap = new Map();
  workOrders.forEach((wo) => woMap.set(wo.id, wo));

  const m = new Map();
  invoices.forEach((inv) => {
    const wo = woMap.get(inv.work_order_id);
    const serviceName =
      wo?.service_type?.service || wo?.service_type || "Unknown";
    const amount = Number(inv.total_amount) || 0;
    if (!m.has(serviceName)) {
      m.set(serviceName, {
        service: serviceName,
        invoiceCount: 0,
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        paid: 0,
      });
    }
    const slot = m.get(serviceName);
    slot.invoiceCount += 1;
    slot.total += amount;
    if (inv.invoice_status === "APPROVED") slot.approved += amount;
    else if (inv.invoice_status === "SUBMITTED") slot.pending += amount;
    else if (inv.invoice_status === "REJECTED") slot.rejected += amount;
    else if (inv.invoice_status === "PAID") slot.paid += amount;
  });
  const rows = Array.from(m.values());
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

export function invoicePipelineStats(invoices) {
  const stats = {
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    rejected: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
    draft: { count: 0, amount: 0 },
    submitted: { count: 0, amount: 0 },
  };
  invoices.forEach((inv) => {
    const amount = Number(inv.total_amount) || 0;
    const key = (inv.invoice_status || "").toLowerCase();
    if (stats[key]) {
      stats[key].count += 1;
      stats[key].amount += amount;
    }
  });
  return stats;
}

export function invoiceApprovalByVendor(invoices, vendors) {
  const lookup = vendorMap(vendors);
  const m = new Map();
  invoices.forEach((inv) => {
    const vId = inv.vendor_id;
    if (!vId) return;
    if (!m.has(vId)) {
      m.set(vId, { approved: 0, rejected: 0, pending: 0 });
    }
    const slot = m.get(vId);
    if (inv.invoice_status === "APPROVED") slot.approved += 1;
    else if (inv.invoice_status === "REJECTED") slot.rejected += 1;
    else if (inv.invoice_status === "SUBMITTED") slot.pending += 1;
  });
  const rows = [];
  m.forEach((counts, vendorId) => {
    const v = lookup.get(vendorId);
    const reviewed = counts.approved + counts.rejected;
    rows.push({
      vendorId,
      vendorName: v?.company_name || v?.name || vendorId.slice(0, 8),
      approved: counts.approved,
      rejected: counts.rejected,
      pending: counts.pending,
      total: counts.approved + counts.rejected + counts.pending,
      approvalRate: reviewed > 0 ? counts.approved / reviewed : null,
    });
  });
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

export function invoicesOutstandingByVendor(invoices, vendors) {
  const lookup = vendorMap(vendors);
  const m = new Map();
  invoices.forEach((inv) => {
    if (inv.invoice_status === "PAID" || inv.invoice_status === "REJECTED") return;
    const vId = inv.vendor_id;
    const amount = Number(inv.total_amount) || 0;
    if (!m.has(vId)) m.set(vId, { count: 0, amount: 0 });
    const slot = m.get(vId);
    slot.count += 1;
    slot.amount += amount;
  });
  const rows = [];
  m.forEach((slot, vendorId) => {
    const v = lookup.get(vendorId);
    rows.push({
      vendorId,
      vendorName: v?.company_name || v?.name || vendorId.slice(0, 8),
      ...slot,
    });
  });
  rows.sort((a, b) => b.amount - a.amount);
  return rows;
}

export function workOrdersByStatus(workOrders) {
  const m = new Map();
  workOrders.forEach((wo) => {
    const status = wo.current_status || "UNKNOWN";
    m.set(status, (m.get(status) || 0) + 1);
  });
  return Array.from(m.entries()).map(([status, count]) => ({ status, count }));
}

export function msasExpiringSoon(msas, daysAhead = 90) {
  const now = Date.now();
  const cutoff = now + daysAhead * 24 * 60 * 60 * 1000;
  return msas
    .filter((m) => {
      if (!m.expiration_date) return false;
      const exp = new Date(m.expiration_date).getTime();
      return exp >= now && exp <= cutoff;
    })
    .sort(
      (a, b) =>
        new Date(a.expiration_date).getTime() -
        new Date(b.expiration_date).getTime(),
    );
}

export function fraudSignals({ tickets, vendors, invoices, workOrders, msas }) {
  const signals = [];
  const lookup = vendorMap(vendors);
  const ticketsByWO = new Map();
  tickets.forEach((t) => {
    if (!ticketsByWO.has(t.work_order_id)) ticketsByWO.set(t.work_order_id, []);
    ticketsByWO.get(t.work_order_id).push(t);
  });

  const stats = vendorTicketStats(tickets, vendors);
  stats.forEach((s) => {
    const reviewed = s.approved + s.rejected;
    if (reviewed >= 2 && s.rejectionRate >= REJECTION_RATE_THRESHOLD) {
      signals.push({
        severity: s.rejectionRate >= 0.5 ? "HIGH" : "MEDIUM",
        category: "High rejection rate",
        target: s.vendorName,
        description: `${(s.rejectionRate * 100).toFixed(0)}% of reviewed tickets rejected (${s.rejected}/${reviewed}).`,
      });
    }
  });

  workOrders.forEach((wo) => {
    const wt = ticketsByWO.get(wo.id) || [];
    if (wt.length === 0) return;
    const allApproved = wt.every((t) => t.status === "APPROVED");
    const hasInvoice = invoices.some((inv) => inv.work_order_id === wo.id);
    if (allApproved && !hasInvoice) {
      const v = lookup.get(wo.assigned_vendor);
      signals.push({
        severity: "LOW",
        category: "Missing invoice",
        target: v?.company_name || v?.name || "Unknown vendor",
        description: `Work order #${wo.work_order_code ?? wo.id.slice(0, 8)}: all tickets approved but no invoice has been generated.`,
      });
    }
  });

  invoices.forEach((inv) => {
    const wt = ticketsByWO.get(inv.work_order_id) || [];
    if (wt.length === 0) return;
    const unapproved = wt.filter((t) => t.status !== "APPROVED");
    if (unapproved.length > 0 && inv.invoice_status !== "DRAFT") {
      const v = lookup.get(inv.vendor_id);
      signals.push({
        severity: "CRITICAL",
        category: "Invoice without approved tickets",
        target: v?.company_name || v?.name || "Unknown vendor",
        description: `Invoice ${inv.id.slice(0, 8)} (${inv.invoice_status}) on a work order with ${unapproved.length} unapproved ticket(s).`,
      });
    }
  });

  const today = Date.now();
  const activeWOByVendor = new Map();
  workOrders.forEach((wo) => {
    if (wo.current_status === "CANCELLED" || wo.current_status === "CLOSED") return;
    if (!activeWOByVendor.has(wo.assigned_vendor)) activeWOByVendor.set(wo.assigned_vendor, 0);
    activeWOByVendor.set(wo.assigned_vendor, activeWOByVendor.get(wo.assigned_vendor) + 1);
  });
  msas.forEach((m) => {
    if (!m.expiration_date) return;
    const exp = new Date(m.expiration_date).getTime();
    if (exp >= today) return;
    const activeCount = activeWOByVendor.get(m.vendor_id) || 0;
    if (activeCount > 0) {
      const v = lookup.get(m.vendor_id);
      signals.push({
        severity: "HIGH",
        category: "Expired MSA with active work",
        target: v?.company_name || v?.name || "Unknown vendor",
        description: `MSA expired on ${new Date(m.expiration_date).toLocaleDateString()} but vendor has ${activeCount} active work order(s).`,
      });
    }
  });

  vendors.forEach((v) => {
    if (v.compliance_status === "expired" || v.compliance_status === "incomplete") {
      const activeCount = activeWOByVendor.get(v.id) || 0;
      if (activeCount > 0) {
        signals.push({
          severity: v.compliance_status === "expired" ? "HIGH" : "MEDIUM",
          category: `Compliance ${v.compliance_status}`,
          target: v.company_name || v.name,
          description: `Vendor compliance is ${v.compliance_status} with ${activeCount} active work order(s).`,
        });
      }
    }
  });

  const severityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  signals.sort(
    (a, b) =>
      (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9),
  );
  return signals;
}
