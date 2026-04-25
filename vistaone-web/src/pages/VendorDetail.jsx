import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import CreateWorkOrderModal from "../components/CreateWorkOrderModal";
import { vendorService } from "../services/vendorService";
import "../styles/vendors.css";

export default function VendorDetail() {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateWO, setShowCreateWO] = useState(false);

  useEffect(() => {
    const loadVendor = async () => {
      try {
        const data = await vendorService.getById(vendorId);
        setVendor(data);
      } catch (err) {
        setError("Failed to load vendor details");
      } finally {
        setLoading(false);
      }
    };
    loadVendor();
  }, [vendorId]);

  if (error) {
    return (
      <AppShell title="Vendor Detail" subtitle="">
        <div className="vendors-error">{error}</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={vendor?.company_name || vendor?.name || "Vendor Detail"}
      subtitle={vendor?.company_code || ""}
      loading={loading}
      loadingText="Loading vendor..."
    >
      {vendor && (
        <div className="vendor-detail">
          <div className="vendor-detail-actions">
            <button
              className="vendor-detail-back"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
            {vendor.status === "active" &&
              vendor.compliance_status === "complete" && (
                <button
                  className="vendor-detail-create-wo"
                  onClick={() => setShowCreateWO(true)}
                >
                  + Create Work Order
                </button>
              )}
          </div>

          <div className="vendor-detail-grid">
            <div className="vendor-detail-card">
              <h3>Contact Information</h3>
              <p><strong>Contact:</strong> {vendor.primary_contact_name || "-"}</p>
              <p><strong>Email:</strong> {vendor.company_email || "-"}</p>
              <p><strong>Phone:</strong> {vendor.company_phone || "-"}</p>
            </div>

            <div className="vendor-detail-card">
              <h3>Status</h3>
              <p>
                <strong>Status:</strong>{" "}
                <span className={`status-badge status-${vendor.status}`}>
                  {vendor.status}
                </span>
              </p>
              <p>
                <strong>Compliance:</strong>{" "}
                <span className={`status-badge compliance-${vendor.compliance_status}`}>
                  {vendor.compliance_status}
                </span>
              </p>
              <p><strong>Onboarding:</strong> {vendor.onboarding ? "Yes" : "No"}</p>
            </div>

            <div className="vendor-detail-card vendor-detail-card-full">
              <h3>Description</h3>
              <p>{vendor.description || "No description provided"}</p>
            </div>
          </div>
        </div>
      )}

      {showCreateWO && (
        <CreateWorkOrderModal
          setShowModal={setShowCreateWO}
          prefilledVendorId={vendorId}
        />
      )}
    </AppShell>
  );
}
