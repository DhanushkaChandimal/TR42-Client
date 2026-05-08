import { useCallback, useState } from "react";
import AppShell from "../components/AppShell";
import CreateOrEditWellModal from "../components/CreateOrEditWellModal";
import Pagination from "../components/Pagination";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { searchWells, createWell, updateWell } from "../services/wellService";
import "../styles/workorder.css";
import "../styles/dataTable.css";

const SORT_COLUMN_MAP = {
  api_number: "api_number",
  well_name: "well_name",
  status: "status",
  created: "created_at",
};

const HEADER_SORT_DEFAULTS = {
  api_number: "asc",
  well_name: "asc",
  status: "asc",
  created: "desc",
};

function parseSort(sortBy) {
  const m = sortBy?.match(/^(.*)_(asc|desc)$/);
  if (!m) return { column: null, direction: null };
  return { column: m[1], direction: m[2] };
}

function nextSortFor(column, sortBy) {
  const current = parseSort(sortBy);
  const def = HEADER_SORT_DEFAULTS[column] || "asc";
  if (current.column !== column) return `${column}_${def}`;
  return current.direction === "asc" ? `${column}_desc` : `${column}_asc`;
}

export default function Wells() {
  const [showModal, setShowModal] = useState(false);
  const [editWell, setEditWell] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("created_desc");

  const fetcher = useCallback(
    (page, perPage) => {
      const { column, direction } = parseSort(sortBy);
      return searchWells({
        q: searchTerm.trim(),
        page,
        per_page: perPage,
        sort_by: SORT_COLUMN_MAP[column] || "created_at",
        order: direction || "desc",
      });
    },
    [searchTerm, sortBy],
  );

  const {
    items: wells,
    total,
    pages,
    page,
    perPage,
    loading,
    setPage,
    setPerPage,
    refresh,
  } = usePaginatedList(fetcher);

  const handleSubmitWell = async (wellData) => {
    if (editWell) {
      await updateWell(editWell.id, wellData);
    } else {
      await createWell(wellData);
    }
    setShowModal(false);
    setEditWell(null);
    refresh();
  };

  const activeSort = parseSort(sortBy);
  const handleHeaderSort = (column) => setSortBy(nextSortFor(column, sortBy));
  const sortIndicator = (column) => {
    if (activeSort.column !== column) return null;
    return (
      <span className="data-table-sort-arrow" aria-hidden="true">
        {activeSort.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };
  const headerProps = (column, label) => ({
    onClick: () => handleHeaderSort(column),
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleHeaderSort(column);
      }
    },
    tabIndex: 0,
    role: "button",
    className: `data-table-th-sortable ${
      activeSort.column === column ? "is-active" : ""
    }`,
    "aria-sort":
      activeSort.column === column
        ? activeSort.direction === "asc"
          ? "ascending"
          : "descending"
        : "none",
    "aria-label": `Sort by ${label}`,
  });

  return (
    <AppShell
      title="Oil Wells"
      subtitle="Manage oil well details"
      loading={loading && wells.length === 0}
      loadingText="Loading wells..."
      controls={
        <button
          className="workorders-create-btn"
          onClick={() => {
            setEditWell(null);
            setShowModal(true);
          }}
        >
          + Add Well
        </button>
      }
    >
      <section className="workorders-controls">
        <input
          type="search"
          className="workorders-search"
          placeholder="Search wells"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </section>
      <section className="data-table-wrap">
        {loading && wells.length === 0 ? (
          <div className="data-table-state">Loading wells...</div>
        ) : wells.length === 0 ? (
          <div className="data-table-state">No wells found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th {...headerProps("api_number", "well number")}>
                  Well Number {sortIndicator("api_number")}
                </th>
                <th {...headerProps("well_name", "name")}>
                  Name {sortIndicator("well_name")}
                </th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th {...headerProps("status", "status")}>
                  Status {sortIndicator("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {wells.map((well) => (
                <tr
                  key={well.id}
                  className="data-table-row-clickable"
                  onClick={() => {
                    setEditWell(well);
                    setShowModal(true);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Edit well ${well.api_number}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditWell(well);
                      setShowModal(true);
                    }
                  }}
                >
                  <td>{well.api_number}</td>
                  <td>{well.well_name}</td>
                  <td className="data-table-cell-numeric">
                    {well.location?.surface_latitude ?? "—"}
                  </td>
                  <td className="data-table-cell-numeric">
                    {well.location?.surface_longitude ?? "—"}
                  </td>
                  <td>{well.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination
          page={page}
          pages={pages}
          total={total}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={(n) => {
            setPerPage(n);
            setPage(1);
          }}
          disabled={loading}
        />
      </section>
      {showModal && (
        <CreateOrEditWellModal
          setShowModal={(open) => {
            if (!open) setEditWell(null);
            setShowModal(open);
          }}
          onSubmit={handleSubmitWell}
          initialData={editWell}
          mode={editWell ? "edit" : "create"}
        />
      )}
    </AppShell>
  );
}
