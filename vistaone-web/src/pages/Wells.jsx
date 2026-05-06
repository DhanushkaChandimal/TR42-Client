import { useCallback, useState } from "react";
import AppShell from "../components/AppShell";
import CreateOrEditWellModal from "../components/CreateOrEditWellModal";
import Pagination from "../components/Pagination";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { searchWells, createWell, updateWell } from "../services/wellService";
import "../styles/workorder.css";

export default function Wells() {
  const [showModal, setShowModal] = useState(false);
  const [editWell, setEditWell] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetcher = useCallback(
    (page, perPage) => searchWells({ q: searchTerm.trim(), page, per_page: perPage }),
    [searchTerm],
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
      <section className="workorders-table-wrap">
        {loading && wells.length === 0 ? (
          <div className="workorders-state">Loading wells...</div>
        ) : wells.length === 0 ? (
          <div className="workorders-state">No wells found</div>
        ) : (
          <table className="workorders-table">
            <thead>
              <tr>
                <th>Well Number</th>
                <th>Name</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {wells.map((well) => (
                <tr
                  key={well.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setEditWell(well);
                    setShowModal(true);
                  }}
                >
                  <td>{well.api_number}</td>
                  <td>{well.well_name}</td>
                  <td>{well.location?.surface_latitude}</td>
                  <td>{well.location?.surface_longitude}</td>
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
