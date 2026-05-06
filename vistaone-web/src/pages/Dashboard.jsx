import { useState } from "react";
import AppShell from "../components/AppShell";
import Widget, { WidgetPickerModal } from "../components/widgets/Widget";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import { WIDGET_REGISTRY } from "../components/widgets/registry";
import "../styles/dashboard.css";

const MAX_WIDGETS = 12;

export default function Dashboard() {
    const {
        layout,
        addWidget,
        removeWidget,
        replaceWidget,
        setWidgetSize,
        moveWidget,
        resetLayout,
    } = useDashboardLayout();

    const [pickerOpen, setPickerOpen] = useState(false);
    const atCapacity = layout.length >= MAX_WIDGETS;

    return (
        <AppShell
            title="Dashboard"
            subtitle="Customize your view — every tile is a widget you can swap or resize"
            eyebrow="Welcome back"
        >
            <section className="dashboard-toolbar">
                <div className="dashboard-toolbar__meta">
                    {layout.length} {layout.length === 1 ? "widget" : "widgets"}
                </div>
                <div className="dashboard-toolbar__actions">
                    <button
                        type="button"
                        className="dashboard-toolbar__btn dashboard-toolbar__btn--ghost"
                        onClick={() => {
                            if (
                                window.confirm(
                                    "Reset your dashboard to the default layout?",
                                )
                            ) {
                                resetLayout();
                            }
                        }}
                    >
                        Reset layout
                    </button>
                    <button
                        type="button"
                        className="dashboard-toolbar__btn"
                        disabled={atCapacity}
                        onClick={() => setPickerOpen(true)}
                    >
                        + Add widget
                    </button>
                </div>
            </section>

            {layout.length === 0 ? (
                <div className="dashboard-empty">
                    <h2>Your dashboard is empty</h2>
                    <p>Add a widget to get started.</p>
                    <button
                        type="button"
                        className="dashboard-toolbar__btn"
                        onClick={() => setPickerOpen(true)}
                    >
                        + Add widget
                    </button>
                </div>
            ) : (
                <div className="dashboard-grid">
                    {layout.map((instance, idx) => (
                        <Widget
                            key={instance.id}
                            instance={instance}
                            isFirst={idx === 0}
                            isLast={idx === layout.length - 1}
                            onRemove={removeWidget}
                            onReplace={replaceWidget}
                            onResize={setWidgetSize}
                            onMove={moveWidget}
                        />
                    ))}
                    {!atCapacity && (
                        <button
                            type="button"
                            className="dashboard-add-tile"
                            onClick={() => setPickerOpen(true)}
                        >
                            <span className="dashboard-add-tile__plus">+</span>
                            <span>Add widget</span>
                        </button>
                    )}
                </div>
            )}

            {pickerOpen && (
                <WidgetPickerModal
                    usedTypes={layout.map((i) => i.type)}
                    onPick={(type) => {
                        addWidget(
                            type,
                            WIDGET_REGISTRY[type]?.defaultSize || "medium",
                        );
                        setPickerOpen(false);
                    }}
                    onClose={() => setPickerOpen(false)}
                    title="Add a widget"
                />
            )}
        </AppShell>
    );
}
