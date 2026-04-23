import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { msaService } from "../services/msaService";
import { vendorService } from "../services/vendorService";
import "../styles/contracts.css";

/** Allowed file types for MSA upload */
const ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE_MB = 25;

export default function Contracts() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    // MSA records and vendor list loaded from API
    const [msaRecords, setMsaRecords] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Search and filter state
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    // Upload form state
    const [showUpload, setShowUpload] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadError, setUploadError] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        vendor_id: "",
        version: "",
        effective_date: "",
        expiration_date: "",
    });

    // Load MSA records and vendor list on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const [msaData, vendorData] = await Promise.all([
                    msaService.getAll(),
                    vendorService.getAll(),
                ]);
                setMsaRecords(msaData);
                setVendors(vendorData);
            } catch (err) {
                setError("Failed to load contract data");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Filter MSA records by search term and status
    const filteredRecords = msaRecords.filter((msa) => {
        const matchesSearch =
            (msa.vendor_name || "")
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
            (msa.id || "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus =
            statusFilter === "ALL" || msa.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Validate selected file type and size
    const validateFile = (file) => {
        if (!file) return "No file selected";
        if (!ALLOWED_TYPES.includes(file.type))
            return "Only PDF and Word documents are allowed";
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024)
            return `File must be under ${MAX_FILE_SIZE_MB}MB`;
        return null;
    };

    // Handle file selection from input or drag-drop
    const handleFileSelect = (file) => {
        setUploadError("");
        const err = validateFile(file);
        if (err) {
            setUploadError(err);
            setUploadFile(null);
            return;
        }
        setUploadFile(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleFileSelect(e.dataTransfer.files[0]);
    };

    const handleFormChange = (e) => {
        setUploadForm({ ...uploadForm, [e.target.name]: e.target.value });
    };

    // Reset the upload form to its initial state
    const resetUpload = () => {
        setUploadFile(null);
        setUploadError("");
        setUploadForm({
            vendor_id: "",
            version: "",
            effective_date: "",
            expiration_date: "",
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Submit the upload form to the API
    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        setUploadError("");

        if (!uploadFile) {
            setUploadError("Please select a file to upload");
            return;
        }
        if (!uploadForm.vendor_id) {
            setUploadError("Please select a vendor");
            return;
        }
        if (!uploadForm.version) {
            setUploadError("Please enter a version number");
            return;
        }

        // Build FormData for multipart upload - do not set Content-Type manually
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("vendor_id", uploadForm.vendor_id);
        formData.append("version", uploadForm.version);
        if (uploadForm.effective_date)
            formData.append("effective_date", uploadForm.effective_date);
        if (uploadForm.expiration_date)
            formData.append("expiration_date", uploadForm.expiration_date);

        try {
            setUploading(true);
            const newMsa = await msaService.upload(formData);
            // Add new record to the top of the list without reloading the page
            setMsaRecords((prev) => [newMsa, ...prev]);
            setShowUpload(false);
            resetUpload();
        } catch (err) {
            setUploadError(err.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    return (
        <AppShell
            title="Contracts / MSA"
            subtitle="Manage master service agreements and upload documents"
            loading={loading}
            loadingText="Loading contracts..."
        >
            {error && <div className="contracts-error">{error}</div>}

            <section className="contracts-controls">
                <input
                    type="search"
                    className="contracts-search"
                    placeholder="Search by vendor or MSA ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                    className="contracts-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="ALL">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="incomplete">Incomplete</option>
                    <option value="expired">Expired</option>
                </select>
                <button
                    className="contracts-upload-btn"
                    onClick={() => {
                        setShowUpload(!showUpload);
                        resetUpload();
                    }}
                >
                    {showUpload ? "Cancel" : "Upload MSA"}
                </button>
            </section>

            {showUpload && (
                <section className="contracts-upload-panel">
                    <h3>Upload MSA Document</h3>
                    <p className="contracts-upload-note">
                        PDF or Word documents, max {MAX_FILE_SIZE_MB}MB
                    </p>
                    <form onSubmit={handleUploadSubmit}>
                        <div
                            className={`contracts-dropzone ${uploadFile ? "has-file" : ""}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx"
                                onChange={(e) =>
                                    handleFileSelect(e.target.files[0])
                                }
                                style={{ display: "none" }}
                            />
                            {uploadFile ? (
                                <div className="contracts-file-info">
                                    <p className="contracts-file-name">
                                        {uploadFile.name}
                                    </p>
                                    <p className="contracts-file-size">
                                        {(
                                            uploadFile.size /
                                            1024 /
                                            1024
                                        ).toFixed(2)}{" "}
                                        MB
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <p>Drag and drop your file here</p>
                                    <p className="contracts-dropzone-hint">
                                        or click to browse
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="contracts-form-grid">
                            <div className="contracts-form-field">
                                <label>Vendor *</label>
                                <select
                                    name="vendor_id"
                                    value={uploadForm.vendor_id}
                                    onChange={handleFormChange}
                                >
                                    <option value="">Select vendor</option>
                                    {vendors.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.company_name || v.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="contracts-form-field">
                                <label>Version *</label>
                                <input
                                    type="text"
                                    name="version"
                                    placeholder="e.g. 1.0"
                                    maxLength={10}
                                    value={uploadForm.version}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="contracts-form-field">
                                <label>Effective Date</label>
                                <input
                                    type="date"
                                    name="effective_date"
                                    value={uploadForm.effective_date}
                                    onChange={handleFormChange}
                                />
                            </div>
                            <div className="contracts-form-field">
                                <label>Expiration Date</label>
                                <input
                                    type="date"
                                    name="expiration_date"
                                    value={uploadForm.expiration_date}
                                    onChange={handleFormChange}
                                />
                            </div>
                        </div>
                        {uploadError && (
                            <div className="contracts-upload-error">
                                {uploadError}
                            </div>
                        )}
                        <div className="contracts-form-actions">
                            <button
                                type="button"
                                className="contracts-btn-cancel"
                                onClick={() => {
                                    setShowUpload(false);
                                    resetUpload();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="contracts-btn-submit"
                                disabled={uploading}
                            >
                                {uploading ? "Uploading..." : "Upload Document"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <p className="contracts-count">
                {filteredRecords.length} contract
                {filteredRecords.length !== 1 ? "s" : ""} found
            </p>

            <section className="contracts-table-wrap">
                {!loading && filteredRecords.length === 0 ? (
                    <div className="contracts-state">No contracts found</div>
                ) : (
                    <table className="contracts-table">
                        <thead>
                            <tr>
                                <th>Vendor</th>
                                <th>Version</th>
                                <th>Status</th>
                                <th>Effective</th>
                                <th>Expiration</th>
                                <th>Document</th>
                                <th>Uploaded By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.map((msa) => (
                                <tr key={msa.id}>
                                    <td>
                                        <button
                                            className="contracts-vendor-link"
                                            onClick={() =>
                                                navigate(
                                                    `/vendors/${msa.vendor_id}`,
                                                )
                                            }
                                        >
                                            {msa.vendor_name || "-"}
                                        </button>
                                    </td>
                                    <td>v{msa.version}</td>
                                    <td>
                                        <span
                                            className={`status-badge status-${msa.status}`}
                                        >
                                            {msa.status}
                                        </span>
                                    </td>
                                    <td>{msa.effective_date || "-"}</td>
                                    <td>{msa.expiration_date || "-"}</td>
                                    <td>
                                        {msa.file_name ? (
                                            <button
                                                type="button"
                                                className="contracts-file-link"
                                                onClick={async () => {
                                                    try {
                                                        await msaService.download(
                                                            msa.id,
                                                            msa.file_name,
                                                        );
                                                    } catch (err) {
                                                        alert(
                                                            err.message ||
                                                                "Failed to download document",
                                                        );
                                                    }
                                                }}
                                            >
                                                Download
                                            </button>
                                        ) : (
                                            <span className="contracts-no-file">
                                                No document
                                            </span>
                                        )}
                                    </td>
                                    <td>{msa.uploaded_by_name || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </AppShell>
    );
}
