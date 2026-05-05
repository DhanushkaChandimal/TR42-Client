import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { workOrderService } from "../../../services/workOrderService";
import { formatDate, statusClass } from "../widgetUtils";

export default function WorkOrdersRecentWidget() {
    const [state, setState] = useState({
        loading: true,
        error: null,
        items: [],
    });

    useEffect(() => {
        let cancelled = false;
        workOrderService
            .getAll()
            .then((rows) => {
                if (cancelled) return;
                const recent = (rows || [])
                    .slice()
                    .sort(
                        (a, b) =>
                            new Date(b.created_at || 0) -
                            new Date(a.created_at || 0),
                    )
                    .slice(0, 6);
                setState({ loading: false, error: null, items: recent });
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
        return <div className="widget__empty">No work orders yet.</div>;

    return (
        <div className="widget-list">
            <ul className="widget-list__items">
                {state.items.map((wo) => (
                    <li
                        key={wo.work_order_code || wo.id}
                        className="widget-list__row"
                    >
                        <div className="widget-list__primary">
                            <span className="widget-list__name">
                                {wo.description || wo.work_order_code || "Work order"}
                            </span>
                            <span className="widget-list__meta">
                                {wo.vendor?.name || "—"} ·{" "}
                                {formatDate(wo.created_at)}
                            </span>
                        </div>
                        <div className="widget-list__secondary">
                            <span
                                className={`status-pill ${statusClass(wo.current_status)}`}
                            >
                                {wo.current_status || "—"}
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
            <Link to="/workorders" className="widget__footer-link">
                View all →
            </Link>
        </div>
    );
}
