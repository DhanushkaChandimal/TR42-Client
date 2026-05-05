import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { workOrderService } from "../../../services/workOrderService";
import { statusClass } from "../widgetUtils";

export default function WorkOrdersByStatusWidget() {
    const [state, setState] = useState({
        loading: true,
        error: null,
        rows: [],
    });

    useEffect(() => {
        let cancelled = false;
        workOrderService
            .getAll()
            .then((rows) => {
                if (cancelled) return;
                setState({ loading: false, error: null, rows: rows || [] });
            })
            .catch((err) => {
                if (cancelled) return;
                setState({
                    loading: false,
                    error: err.message || "Failed to load",
                    rows: [],
                });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const buckets = useMemo(() => {
        const counts = {};
        state.rows.forEach((wo) => {
            const key = (wo.current_status || "unknown").toLowerCase();
            counts[key] = (counts[key] || 0) + 1;
        });
        const total = state.rows.length || 1;
        return Object.entries(counts)
            .map(([status, count]) => ({
                status,
                count,
                pct: Math.round((count / total) * 100),
            }))
            .sort((a, b) => b.count - a.count);
    }, [state.rows]);

    if (state.loading) return <div className="widget__placeholder">Loading…</div>;
    if (state.error) return <div className="widget__error">{state.error}</div>;
    if (!buckets.length)
        return <div className="widget__empty">No work orders yet.</div>;

    return (
        <div className="status-breakdown">
            <div className="status-breakdown__total">
                <span className="status-breakdown__total-num">
                    {state.rows.length}
                </span>
                <span className="status-breakdown__total-label">total</span>
            </div>
            <ul className="status-breakdown__list">
                {buckets.map((b) => (
                    <li key={b.status} className="status-breakdown__row">
                        <div className="status-breakdown__row-head">
                            <span
                                className={`status-pill ${statusClass(b.status)}`}
                            >
                                {b.status}
                            </span>
                            <span className="status-breakdown__count">
                                {b.count}
                            </span>
                        </div>
                        <div className="status-breakdown__bar">
                            <div
                                className={`status-breakdown__bar-fill ${statusClass(
                                    b.status,
                                )}`}
                                style={{ width: `${b.pct}%` }}
                            />
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
