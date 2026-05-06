import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardService } from "../../../services/dashboardService";
import { formatCurrency } from "../widgetUtils";

export default function InvoiceOutstandingKpiWidget() {
    const [state, setState] = useState({
        loading: true,
        error: null,
        total: 0,
        count: 0,
    });

    useEffect(() => {
        let cancelled = false;
        dashboardService
            .getSummary()
            .then((s) => {
                if (cancelled) return;
                const inv = s?.invoices || {};
                setState({
                    loading: false,
                    error: null,
                    total: inv.outstanding_total || 0,
                    count: inv.outstanding_count || 0,
                });
            })
            .catch((err) => {
                if (cancelled) return;
                setState({
                    loading: false,
                    error: err.message || "Failed to load",
                    total: 0,
                    count: 0,
                });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (state.loading) {
        return <div className="widget__placeholder">Loading…</div>;
    }
    if (state.error) {
        return <div className="widget__error">{state.error}</div>;
    }

    return (
        <div className="kpi">
            <div className="kpi__value">{formatCurrency(state.total)}</div>
            <div className="kpi__sub">
                {state.count} {state.count === 1 ? "invoice" : "invoices"}{" "}
                outstanding
            </div>
            <Link to="/invoices" className="widget__footer-link">
                View invoices →
            </Link>
        </div>
    );
}
