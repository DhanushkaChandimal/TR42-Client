import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { aiService } from "../services/aiService";
import { API_BASE } from "../config/api";
import "../styles/msaAnalysisModal.css";

const DISCLAIMER =
    "This summary is for informational purposes only and does not constitute legal advice.";

const fileExt = (name) => {
    if (!name) return "";
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
};

export default function MsaAnalysisModal({ msa, onClose }) {
    const [analysis, setAnalysis] = useState(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeStartedAt, setAnalyzeStartedAt] = useState(null);
    const [elapsedSec, setElapsedSec] = useState(0);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [pdfUrl, setPdfUrl] = useState("");
    const [textPages, setTextPages] = useState(null);
    const [sourceTables, setSourceTables] = useState([]);
    const [activePage, setActivePage] = useState(1);
    const [leftPct, setLeftPct] = useState(50);
    const objectUrlRef = useRef(null);
    const bodyRef = useRef(null);
    const draggingRef = useRef(false);
    const textPaneRef = useRef(null);

    // Tick a 1s elapsed counter while an analysis is in flight so the user
    // sees activity instead of a static "Analyzing..." button.
    useEffect(() => {
        if (!analyzing || !analyzeStartedAt) {
            setElapsedSec(0);
            return undefined;
        }
        const id = setInterval(() => {
            setElapsedSec(Math.floor((Date.now() - analyzeStartedAt) / 1000));
        }, 1000);
        return () => clearInterval(id);
    }, [analyzing, analyzeStartedAt]);

    const ext = fileExt(msa?.file_name);
    const isPdf = ext === "pdf";
    const isWord = ext === "doc" || ext === "docx";

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    // PDFs: fetch as blob and render in iframe (auth headers can't be set on iframe src).
    // Word docs: fetch extracted text from the AI text endpoint and render inline.
    useEffect(() => {
        if (!msa?.id || !msa?.file_name) return;
        let cancelled = false;

        if (isPdf) {
            (async () => {
                try {
                    const token = localStorage.getItem("authToken");
                    const res = await fetch(
                        `${API_BASE}/msa/${msa.id}/download`,
                        { headers: { Authorization: `Bearer ${token}` } },
                    );
                    if (!res.ok) return;
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    if (cancelled) {
                        URL.revokeObjectURL(url);
                        return;
                    }
                    objectUrlRef.current = url;
                    setPdfUrl(`${url}#page=1`);
                } catch {
                    /* preview is best-effort */
                }
            })();
        } else if (isWord) {
            (async () => {
                try {
                    const data = await aiService.getText(msa.id);
                    if (!cancelled) setTextPages(data.pages || []);
                } catch {
                    if (!cancelled) setTextPages([]);
                }
            })();
        }

        // Always fetch tables (regardless of file type) so we can render them
        // as structured tables in the analysis pane for verification.
        (async () => {
            try {
                const data = await aiService.getText(msa.id);
                if (!cancelled) setSourceTables(data.tables || []);
            } catch {
                if (!cancelled) setSourceTables([]);
            }
        })();

        return () => {
            cancelled = true;
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [msa?.id, msa?.file_name, isPdf, isWord]);

    // Load any existing analysis on open
    useEffect(() => {
        if (!msa?.id) return;
        let cancelled = false;
        (async () => {
            setLoadingAnalysis(true);
            setError("");
            try {
                const data = await aiService.getAnalysis(msa.id);
                if (!cancelled) setAnalysis(data);
            } catch (err) {
                if (!cancelled) setError(err.message || "Failed to load analysis");
            } finally {
                if (!cancelled) setLoadingAnalysis(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [msa?.id]);

    const jumpToPage = (page) => {
        if (!page) return;
        setActivePage(page);
        if (isPdf && objectUrlRef.current) {
            // The #page fragment makes most browsers' native PDF viewer scroll.
            setPdfUrl(`${objectUrlRef.current}#page=${page}`);
        } else if (isWord) {
            const target = textPaneRef.current?.querySelector(`#text-page-${page}`);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    // Drag-to-resize the divider between the document pane and the analysis pane.
    const startDrag = (e) => {
        e.preventDefault();
        draggingRef.current = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
    };

    useEffect(() => {
        const onMove = (e) => {
            if (!draggingRef.current || !bodyRef.current) return;
            const rect = bodyRef.current.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            // Clamp so neither pane collapses.
            setLeftPct(Math.max(20, Math.min(80, pct)));
        };
        const onUp = () => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        return () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
    }, []);

    const handleAnalyze = async () => {
        if (!msa?.id) return;
        setError("");
        setInfo("");
        setAnalyzing(true);
        setAnalyzeStartedAt(Date.now());
        try {
            const result = await aiService.analyze(msa.id);
            setInfo(
                `Analysis complete in ${elapsedSec}s: ${result.row_count} extracted facts (run ${result.run_id?.slice(0, 8) || ""}).`,
            );
            const data = await aiService.getAnalysis(msa.id);
            setAnalysis(data);
        } catch (err) {
            setError(err.message || "Analysis failed");
        } finally {
            setAnalyzing(false);
            setAnalyzeStartedAt(null);
        }
    };

    const isEmpty = useMemo(() => {
        const a = analysis;
        return (
            !a ||
            (!a.executive_summary &&
                !a.key_terms?.length &&
                !a.risks?.length &&
                !a.red_flags?.length &&
                !a.action_items?.length &&
                !a.pricing?.length)
        );
    }, [analysis]);

    if (!msa) return null;

    return createPortal(
        <div className="ai-modal-overlay" onClick={onClose}>
            <div
                className="ai-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="AI Contract Analysis"
            >
                <header className="ai-modal-header">
                    <div>
                        <h2 className="ai-modal-title">AI Contract Analysis</h2>
                        <p className="ai-modal-subtitle">
                            {msa.vendor_name || "Unknown vendor"} · v{msa.version || "-"}
                            {" · "}
                            {msa.status}
                        </p>
                    </div>
                    <div className="ai-modal-actions">
                        <button
                            className="ai-modal-analyze"
                            onClick={handleAnalyze}
                            disabled={analyzing || !msa.file_name}
                            title={
                                msa.file_name
                                    ? "Run AI analysis on this MSA (60-90 seconds)"
                                    : "Upload a document first"
                            }
                        >
                            {analyzing
                                ? `Analyzing... ${elapsedSec}s`
                                : "Run AI Analysis"}
                        </button>
                        <button
                            className="ai-modal-close"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>
                </header>

                <div className="ai-modal-body" ref={bodyRef}>
                    <section
                        className="ai-modal-pdf"
                        style={{ flexBasis: `${leftPct}%` }}
                    >
                        {!msa.file_name ? (
                            <div className="ai-modal-pdf-empty">
                                No document attached to this MSA.
                            </div>
                        ) : isPdf ? (
                            pdfUrl ? (
                                <iframe
                                    title="Contract document"
                                    src={pdfUrl}
                                    className="ai-modal-pdf-frame"
                                />
                            ) : (
                                <div className="ai-modal-pdf-empty">
                                    Loading document...
                                </div>
                            )
                        ) : isWord ? (
                            textPages == null ? (
                                <div className="ai-modal-pdf-empty">
                                    Loading document text...
                                </div>
                            ) : textPages.length === 0 ? (
                                <div className="ai-modal-pdf-empty">
                                    Document text could not be extracted.
                                </div>
                            ) : (
                                <div
                                    className="ai-modal-text-pane"
                                    ref={textPaneRef}
                                >
                                    {textPages.map((p) => (
                                        <article
                                            key={p.page}
                                            id={`text-page-${p.page}`}
                                            className={`ai-modal-text-page ${activePage === p.page ? "active" : ""}`}
                                        >
                                            <header className="ai-modal-text-page-head">
                                                Page {p.page}
                                            </header>
                                            <pre className="ai-modal-text-page-body">
                                                {p.text}
                                            </pre>
                                        </article>
                                    ))}
                                </div>
                            )
                        ) : (
                            <div className="ai-modal-pdf-empty">
                                Preview not available for this file type. Use the
                                Download button on the contracts list to open it.
                            </div>
                        )}
                        {activePage > 1 && (
                            <div className="ai-modal-page-indicator">
                                Showing page {activePage}
                            </div>
                        )}
                    </section>

                    <div
                        className="ai-modal-divider"
                        onMouseDown={startDrag}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Resize panels"
                        title="Drag to resize"
                    />

                    <section
                        className="ai-modal-analysis"
                        style={{ flexBasis: `${100 - leftPct}%` }}
                    >
                        {error && (
                            <div className="ai-modal-banner ai-modal-banner-error">
                                {error}
                            </div>
                        )}
                        {analyzing && (
                            <div className="ai-modal-banner ai-modal-banner-progress">
                                <span className="ai-modal-spinner" aria-hidden="true" />
                                Analyzing contract... {elapsedSec}s elapsed.
                                Local model usually takes 60-90 seconds. Don't close
                                the tab; results will appear here when done.
                            </div>
                        )}
                        {info && !analyzing && (
                            <div className="ai-modal-banner ai-modal-banner-info">
                                {info}
                            </div>
                        )}

                        {loadingAnalysis ? (
                            <div className="ai-modal-state">Loading analysis...</div>
                        ) : isEmpty ? (
                            <div className="ai-modal-state">
                                No analysis yet. Click <b>Run AI Analysis</b> at the top
                                to generate one. Expect 60 to 90 seconds on a local model.
                            </div>
                        ) : (
                            <div className="ai-modal-sections">
                                {analysis.executive_summary && (
                                    <Section title="Executive Summary">
                                        <ExecutiveSummary
                                            summary={analysis.executive_summary}
                                        />
                                    </Section>
                                )}
                                {analysis.key_terms?.length > 0 && (
                                    <Section title="Key Terms">
                                        <RowList
                                            rows={analysis.key_terms}
                                            onCite={jumpToPage}
                                        />
                                    </Section>
                                )}
                                {analysis.risks?.length > 0 && (
                                    <Section title="Risk & Obligation Analysis">
                                        <RowList
                                            rows={analysis.risks}
                                            onCite={jumpToPage}
                                        />
                                    </Section>
                                )}
                                {analysis.red_flags?.length > 0 && (
                                    <Section title="Red Flags">
                                        <RowList
                                            rows={analysis.red_flags}
                                            onCite={jumpToPage}
                                        />
                                    </Section>
                                )}
                                {analysis.action_items?.length > 0 && (
                                    <Section title="Action Items">
                                        <RowList
                                            rows={analysis.action_items}
                                            onCite={jumpToPage}
                                        />
                                    </Section>
                                )}
                                {analysis.pricing?.length > 0 && (
                                    <Section title="Pricing by Service">
                                        <PricingTable
                                            rows={analysis.pricing}
                                            onCite={jumpToPage}
                                        />
                                    </Section>
                                )}
                            </div>
                        )}

                        {sourceTables.length > 0 && (
                            <Section title="Source Tables (verbatim from contract)">
                                <p className="ai-modal-tables-hint">
                                    Tables found in the document, rendered as-is. Use
                                    these to verify what the AI extracted above.
                                </p>
                                {sourceTables.map((tbl, i) => (
                                    <SourceTable key={i} table={tbl} index={i + 1} />
                                ))}
                            </Section>
                        )}

                        <footer className="ai-modal-disclaimer">
                            {analysis?.disclaimer || DISCLAIMER}
                        </footer>
                    </section>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function Section({ title, children }) {
    return (
        <section className="ai-modal-section">
            <h3>{title}</h3>
            {children}
        </section>
    );
}

function ExecutiveSummary({ summary }) {
    const md = summary.metadata || {};
    const parties = Array.isArray(md.parties) ? md.parties : [];
    return (
        <div className="ai-modal-exec">
            <p className="ai-modal-exec-prose">{summary.description}</p>
            <dl className="ai-modal-exec-facts">
                {parties.length > 0 && (
                    <>
                        <dt>Parties</dt>
                        <dd>
                            <ul className="ai-modal-parties">
                                {parties.map((p, i) => (
                                    <li key={i}>
                                        <div>
                                            <span className="ai-modal-party-role">
                                                {p.role}:
                                            </span>{" "}
                                            {p.name}
                                        </div>
                                        {p.address && (
                                            <div className="ai-modal-party-address">
                                                {p.address}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </dd>
                    </>
                )}
                {md.effective_date && (
                    <>
                        <dt>Effective date</dt>
                        <dd>{md.effective_date}</dd>
                    </>
                )}
                {md.term_length && (
                    <>
                        <dt>Term length</dt>
                        <dd>{md.term_length}</dd>
                    </>
                )}
                {md.term_end_or_renewal && (
                    <>
                        <dt>End / renewal</dt>
                        <dd>{md.term_end_or_renewal}</dd>
                    </>
                )}
            </dl>
        </div>
    );
}

function RowList({ rows, onCite }) {
    return (
        <ul className="ai-modal-row-list">
            {rows.map((row) => (
                <li key={row.id} className="ai-modal-row">
                    <div className="ai-modal-row-head">
                        {row.rule_type && (
                            <span className="ai-modal-tag">{row.rule_type}</span>
                        )}
                        <span className="ai-modal-row-text">
                            {row.description}
                        </span>
                        {row.page_number != null && (
                            <button
                                type="button"
                                className="ai-modal-cite"
                                onClick={() => onCite(row.page_number)}
                                title="Jump to source page"
                            >
                                p.{row.page_number}
                            </button>
                        )}
                    </div>
                    {row.value && (
                        <div className="ai-modal-row-value">{row.value}</div>
                    )}
                    {row.extracted_text && (
                        <blockquote className="ai-modal-row-quote">
                            {row.extracted_text}
                        </blockquote>
                    )}
                </li>
            ))}
        </ul>
    );
}

function SourceTable({ table, index }) {
    const [head, ...body] = table.rows;
    return (
        <div className="ai-modal-source-table-wrap">
            <header className="ai-modal-source-table-head">
                Table {index}
                {table.page ? ` · page ${table.page}` : ""}
            </header>
            <div className="ai-modal-source-table-scroll">
                <table className="ai-modal-source-table">
                    {head && (
                        <thead>
                            <tr>
                                {head.map((cell, i) => (
                                    <th key={i}>{cell}</th>
                                ))}
                            </tr>
                        </thead>
                    )}
                    <tbody>
                        {body.map((row, r) => (
                            <tr key={r}>
                                {row.map((cell, c) => (
                                    <td key={c}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PricingTable({ rows, onCite }) {
    return (
        <table className="ai-modal-pricing-table">
            <thead>
                <tr>
                    <th>Service</th>
                    <th>Rate</th>
                    <th>Unit</th>
                    <th>Page</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.id}>
                        <td>{row.description || "-"}</td>
                        <td>
                            {row.metadata?.currency ? `${row.metadata.currency} ` : ""}
                            {row.value || "-"}
                        </td>
                        <td>{row.unit || "-"}</td>
                        <td>
                            {row.page_number != null ? (
                                <button
                                    type="button"
                                    className="ai-modal-cite"
                                    onClick={() => onCite(row.page_number)}
                                >
                                    p.{row.page_number}
                                </button>
                            ) : (
                                "-"
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
