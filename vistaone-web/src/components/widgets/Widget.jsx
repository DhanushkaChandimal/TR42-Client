import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WIDGET_REGISTRY, WIDGET_SIZES, widgetTypeOptions } from "./registry";

const SIZE_LABELS = { small: "Small", medium: "Medium", large: "Large" };

export default function Widget({
    instance,
    isFirst,
    isLast,
    onRemove,
    onReplace,
    onResize,
    onMove,
}) {
    const def = WIDGET_REGISTRY[instance.type];
    const [menuOpen, setMenuOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [menuOpen]);

    if (!def) {
        return (
            <article className={`widget widget--${instance.size} widget--error`}>
                <header className="widget__header">
                    <h3 className="widget__title">Unknown widget</h3>
                    <button
                        type="button"
                        className="widget__menu-btn"
                        onClick={() => onRemove(instance.id)}
                        aria-label="Remove widget"
                    >
                        ×
                    </button>
                </header>
            </article>
        );
    }

    const Body = def.Component;

    return (
        <article className={`widget widget--${instance.size}`}>
            <header className="widget__header">
                <div className="widget__title-group">
                    <span className="widget__category">{def.category}</span>
                    <h3 className="widget__title">{def.name}</h3>
                </div>
                <div className="widget__menu-wrap" ref={menuRef}>
                    <button
                        type="button"
                        className="widget__menu-btn"
                        onClick={() => setMenuOpen((v) => !v)}
                        aria-haspopup="true"
                        aria-expanded={menuOpen}
                        aria-label="Widget options"
                    >
                        ⋯
                    </button>
                    {menuOpen && (
                        <div className="widget__menu" role="menu">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setPickerOpen(true);
                                    setMenuOpen(false);
                                }}
                            >
                                Change widget…
                            </button>
                            <div className="widget__menu-section">
                                <span className="widget__menu-label">Size</span>
                                <div className="widget__size-row">
                                    {WIDGET_SIZES.map((size) => (
                                        <button
                                            key={size}
                                            type="button"
                                            className={
                                                instance.size === size
                                                    ? "widget__size-btn is-active"
                                                    : "widget__size-btn"
                                            }
                                            onClick={() => {
                                                onResize(instance.id, size);
                                                setMenuOpen(false);
                                            }}
                                        >
                                            {SIZE_LABELS[size]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                type="button"
                                role="menuitem"
                                disabled={isFirst}
                                onClick={() => {
                                    onMove(instance.id, "up");
                                    setMenuOpen(false);
                                }}
                            >
                                Move up
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                disabled={isLast}
                                onClick={() => {
                                    onMove(instance.id, "down");
                                    setMenuOpen(false);
                                }}
                            >
                                Move down
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                className="widget__menu-danger"
                                onClick={() => {
                                    onRemove(instance.id);
                                    setMenuOpen(false);
                                }}
                            >
                                Remove
                            </button>
                        </div>
                    )}
                </div>
            </header>
            <div className="widget__body">
                <Body />
            </div>

            {pickerOpen && (
                <WidgetPickerModal
                    currentType={instance.type}
                    onPick={(type) => {
                        onReplace(instance.id, type);
                        setPickerOpen(false);
                    }}
                    onClose={() => setPickerOpen(false)}
                    title="Change widget"
                />
            )}
        </article>
    );
}

export function WidgetPickerModal({
    currentType,
    onPick,
    onClose,
    title = "Add widget",
}) {
    const options = widgetTypeOptions();
    const grouped = options.reduce((acc, opt) => {
        (acc[opt.category] = acc[opt.category] || []).push(opt);
        return acc;
    }, {});

    return createPortal(
        <div
            className="widget-picker__backdrop"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="widget-picker__modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={title}
            >
                <header className="widget-picker__header">
                    <h2>{title}</h2>
                    <button
                        type="button"
                        className="widget-picker__close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </header>
                <div className="widget-picker__body">
                    {Object.entries(grouped).map(([category, items]) => (
                        <section
                            key={category}
                            className="widget-picker__group"
                        >
                            <h3 className="widget-picker__group-title">
                                {category}
                            </h3>
                            <div className="widget-picker__grid">
                                {items.map((opt) => (
                                    <button
                                        key={opt.type}
                                        type="button"
                                        className={
                                            opt.type === currentType
                                                ? "widget-picker__card is-current"
                                                : "widget-picker__card"
                                        }
                                        onClick={() => onPick(opt.type)}
                                    >
                                        <span className="widget-picker__card-name">
                                            {opt.name}
                                        </span>
                                        <span className="widget-picker__card-desc">
                                            {opt.description}
                                        </span>
                                        {opt.type === currentType && (
                                            <span className="widget-picker__current-badge">
                                                Current
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
