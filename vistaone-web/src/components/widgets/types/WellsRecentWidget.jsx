import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { searchWells } from "../../../services/wellService";
import { statusClass } from "../widgetUtils";

export default function WellsRecentWidget() {
    const [state, setState] = useState({
        loading: true,
        error: null,
        items: [],
    });

    useEffect(() => {
        let cancelled = false;
        searchWells({ per_page: 6, sort_by: "created_at", order: "desc" })
            .then((res) => {
                if (cancelled) return;
                setState({
                    loading: false,
                    error: null,
                    items: res?.data || [],
                });
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
        return <div className="widget__empty">No wells yet.</div>;

    return (
        <div className="widget-list">
            <ul className="widget-list__items">
                {state.items.map((w) => (
                    <li key={w.id} className="widget-list__row">
                        <div className="widget-list__primary">
                            <span className="widget-list__name">
                                {w.well_name || `Well #${w.api_number || w.id}`}
                            </span>
                            <span className="widget-list__meta">
                                {w.api_number ? `#${w.api_number}` : ""}
                            </span>
                        </div>
                        <div className="widget-list__secondary">
                            <span
                                className={`status-pill ${statusClass(w.status)}`}
                            >
                                {w.status || "—"}
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
            <Link to="/wells" className="widget__footer-link">
                View all →
            </Link>
        </div>
    );
}
