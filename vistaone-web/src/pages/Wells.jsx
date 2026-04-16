import { useEffect, useState, useMemo } from "react";
import AppShell from "../components/AppShell";
import CreateOrEditWellModal from "../components/CreateWellModal";
import { useWell } from "../hooks/useWell";
import "../styles/workorder.css";

export default function Wells() {
  const [showModal, setShowModal] = useState(false);
  const [editWell, setEditWell] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { wells, loading, fetchWells, createWell, updateWell } = useWell();

  useEffect(() => {
    fetchWells();
  }, [fetchWells]);

  const handleSubmitWell = async (wellData) => {
    if (editWell) {
      await updateWell(editWell.id, wellData);
    } else {
      await createWell(wellData);
    }
    setShowModal(false);
    setEditWell(null);
  };

  const filteredWells = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return wells.filter(
      (well) =>
        well.well_name?.toLowerCase().includes(normalized) ||
        well.well_number?.toLowerCase().includes(normalized),
    );
  }, [wells, searchTerm]);

  return (
    <AppShell
      title="Oil Wells"
      subtitle="Manage oil well details"
      loading={loading}
      loadingText="Loading wells..."
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
      <button
        className="fab-create-workorder"
        onClick={() => {
          setEditWell(null);
          setShowModal(true);
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="12" fill="#007bff" />
          <rect x="11" y="6" width="2" height="12" rx="1" fill="#fff" />
          <rect x="6" y="11" width="12" height="2" rx="1" fill="#fff" />
        </svg>
        <span className="fab-label">Add Well</span>
      </button>
      <section className="workorders-table-wrap">
        {loading ? (
          <div className="workorders-state">Loading wells...</div>
        ) : filteredWells.length === 0 ? (
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
              {filteredWells.map((well) => (
                <tr
                  key={well.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setEditWell(well);
                    setShowModal(true);
                  }}
                >
                  <td>{well.well_number}</td>
                  <td>{well.well_name}</td>
                  <td>{well.latitude}</td>
                  <td>{well.longitude}</td>
                  <td>{well.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {showModal && (
        <CreateOrEditWellModal
          setShowModal={setShowModal}
          onSubmit={handleSubmitWell}
          initialData={editWell}
          mode={editWell ? "edit" : "create"}
        />
      )}
    </AppShell>
  );
}
