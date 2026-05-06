import "../styles/pagination.css";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function Pagination({
    page,
    pages,
    total,
    perPage,
    onPageChange,
    onPerPageChange,
    disabled = false,
}) {
    if (!total) return null;
    const safePages = Math.max(pages, 1);
    const canPrev = page > 1 && !disabled;
    const canNext = page < safePages && !disabled;

    return (
        <nav className="pagination" aria-label="Page navigation">
            <div className="pagination-info">
                Page {page} of {safePages} · {total.toLocaleString()} total
            </div>
            <div className="pagination-controls">
                <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => onPageChange(1)}
                    disabled={!canPrev}
                    aria-label="First page"
                >
                    «
                </button>
                <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => onPageChange(page - 1)}
                    disabled={!canPrev}
                    aria-label="Previous page"
                >
                    ‹ Prev
                </button>
                <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => onPageChange(page + 1)}
                    disabled={!canNext}
                    aria-label="Next page"
                >
                    Next ›
                </button>
                <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => onPageChange(safePages)}
                    disabled={!canNext}
                    aria-label="Last page"
                >
                    »
                </button>
                {onPerPageChange && (
                    <label className="pagination-pp">
                        <span>Rows</span>
                        <select
                            value={perPage}
                            onChange={(e) => onPerPageChange(Number(e.target.value))}
                            disabled={disabled}
                        >
                            {PER_PAGE_OPTIONS.map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
        </nav>
    );
}
