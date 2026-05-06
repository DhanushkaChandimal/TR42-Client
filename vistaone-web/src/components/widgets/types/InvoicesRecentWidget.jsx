import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { invoiceService } from "../../../services/invoiceService";
import { formatCurrency, formatDate, statusClass } from "../widgetUtils";

export default function InvoicesRecentWidget() {
    const [state, setState] = useState({
        loading: true,
        error: null,
        items: [],
    });

    useEffect(() => {
        let cancelled = false;
        invoiceService
            .search({ per_page: 6, sort_by: "invoice_date", order: "desc" })
            .then((res) => {
                if (cancelled) return;
                setState({ loading: false, error: null, items: res?.data || [] });
            })
            .catch((err) => {
                if (cancelled) return;
                setState({
                    loading: false,
                    error: err.message || "Failed to load",
                    items: [],
                });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (state.loading) return <div className="widget__placeholder">Loading…</div>;
    if (state.error) return <div className="widget__error">{state.error}</div>;
    if (!state.items.length)
        return <div className="widget__empty">No invoices yet.</div>;

    return (
        <div className="widget-list">
            <ul className="widget-list__items">
                {state.items.map((inv) => (
                    <li key={inv.id} className="widget-list__row">
                        <div className="widget-list__primary">
                            <span className="widget-list__name">
                                {inv.vendor?.company_name || inv.vendor?.name || "Vendor"}
                            </span>
                            <span className="widget-list__meta">
                                {formatDate(inv.invoice_date)}
                            </span>
                        </div>
                        <div className="widget-list__secondary">
                            <span className="widget-list__amount">
                                {formatCurrency(inv.total_amount)}
                            </span>
                            <span
                                className={`status-pill ${statusClass(
                                    inv.invoice_status,
                                )}`}
                            >
                                {inv.invoice_status || "—"}
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
            <Link to="/invoices" className="widget__footer-link">
                View all →
            </Link>
        </div>
    );
}
