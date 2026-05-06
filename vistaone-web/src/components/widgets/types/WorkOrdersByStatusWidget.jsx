import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardService } from "../../../services/dashboardService";
import { statusClass } from "../widgetUtils";

export default function WorkOrdersByStatusWidget() {
    const [state, setState] = useState({
        loading: true,
        error: null,
        total: 0,
        by_status: {},
    });

    useEffect(() => {
        let cancelled = false;
        dashboardService
            .getSummary()
            .then((s) => {
                if (cancelled) return;
                const wo = s?.work_orders || {};
                setState({
                    loading: false,
                    error: null,
                    total: wo.total || 0,
                    by_status: wo.by_status || {},
                });
            })
            .catch((err) => {
                if (cancelled) return;
                setState({
                    loading: false,
                    error: err.message || "Failed to load",
                    total: 0,
                    by_status: {},
                });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const buckets = useMemo(() => {
        const total = state.total || 1;
        return Object.entries(state.by_status)
            .map(([status, count]) => ({
                status: status.toLowerCase(),
                count,
                pct: Math.round((count / total) * 100),
            }))
            .sort((a, b) => b.count - a.count);
    }, [state.by_status, state.total]);

    if (state.loading) return <div className="widget__placeholder">Loading…</div>;
    if (state.error) return <div className="widget__error">{state.error}</div>;
    if (!buckets.length)
        return <div className="widget__empty">No work orders yet.</div>;

    return (
        <div className="status-breakdown">
            <div className="status-breakdown__total">
                <span className="status-breakdown__total-num">{state.total}</span>
                <span className="status-breakdown__total-label">total</span>
            </div>
            <ul className="status-breakdown__list">
                {buckets.map((b) => (
                    <li key={b.status} className="status-breakdown__row">
                        <div className="status-breakdown__row-head">
                            <span className={`status-pill ${statusClass(b.status)}`}>
                                {b.status}
                            </span>
                            <span className="status-breakdown__count">{b.count}</span>
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
