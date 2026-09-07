import React, { useState, useEffect } from "react";
import "./MobileUnitManagement.css";
import LoadingModal from "../modals/LoadingModal";

const API_URL = `${import.meta.env.VITE_API_URL}/mobile-units`;
const ITEMS_PER_PAGE = 15;

const emptyForm = { unit_name: "" };

const EditIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const RemoveIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const RestoreIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-3.24" />
  </svg>
);

function MobileUnitManagement() {
  const [unitList, setUnitList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  // ── Applied filters (drive fetch + table filtering) ──
  const [filterStatus, setFilterStatus] = useState("active");
  const [sortBy, setSortBy] = useState("");

  // ── Draft filters (what the user is editing in the UI) ──
  const [draftStatus, setDraftStatus] = useState("active");
  const [draftSort, setDraftSort] = useState("");

  const isDirty = draftStatus !== filterStatus || draftSort !== sortBy;

  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    id: null,
    name: "",
    action: null,
  });
  const [currentPage, setCurrentPage] = useState(1);

  const token = () => localStorage.getItem("token");

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async (sortOverride) => {
    try {
      setLoading(true);
      const effectiveSort = sortOverride !== undefined ? sortOverride : sortBy;
      const url = effectiveSort ? `${API_URL}?sort_by=${effectiveSort}` : API_URL;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (data.success) setUnitList(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setForm(emptyForm);
    setErrors({});
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setForm({ unit_name: u.unit_name });
    setErrors({});
    setEditingId(u.id);
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.unit_name || form.unit_name.trim().length === 0)
      e.unit_name = "Required";
    else if (form.unit_name.trim().length < 2)
      e.unit_name = "At least 2 characters";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          editingId
            ? "Mobile unit updated successfully!"
            : "Mobile unit added successfully!",
        );
        setShowModal(false);
        fetchUnits();
      } else {
        showToast(data.message || "Error", "error");
      }
    } catch (err) {
      showToast("Request failed", "error");
    }
  };

  const handleRemove = (u) => {
    setConfirmModal({
      show: true,
      id: u.id,
      name: u.unit_name,
      action: "remove",
    });
  };

  const handleRestore = (u) => {
    setConfirmModal({
      show: true,
      id: u.id,
      name: u.unit_name,
      action: "restore",
    });
  };

  const confirmAction = async () => {
    const { id, action } = confirmModal;
    setConfirmModal({ show: false, id: null, name: "", action: null });
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ is_active: action === "restore" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          action === "restore"
            ? "Mobile unit restored successfully!"
            : "Mobile unit removed successfully!",
        );
        fetchUnits();
      } else {
        showToast(data.message || "Error", "error");
      }
    } catch (err) {
      showToast("Request failed", "error");
    }
  };

  // ── Apply filters ──
  const handleApplyFilters = () => {
    setFilterStatus(draftStatus);
    setSortBy(draftSort);
    setCurrentPage(1);
    fetchUnits(draftSort);
  };

  // ── Reset filters ──
  const handleResetFilters = () => {
    setDraftStatus("active");
    setDraftSort("");
    setFilterStatus("active");
    setSortBy("");
    setCurrentPage(1);
    fetchUnits("");
  };

  const filtered = unitList.filter((u) => {
    const statusMatch =
      filterStatus === "active"
        ? u.is_active
        : filterStatus === "removed"
          ? !u.is_active
          : true;
    return statusMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <div className="mu-container">
      {/* TOAST */}
      {toast && (
        <div
          className={`um-toast ${toast.type === "success" ? "um-toast-success" : "um-toast-error"}`}
          style={{ zIndex: 99999 }}
        >
          <div className="um-toast-content">
            <svg
              className="um-toast-icon"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              {toast.type === "success" ? (
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              ) : (
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              )}
            </svg>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      <LoadingModal isOpen={loading} message="Loading mobile units..." />

      <div className="mu-header">
        <div>
          <h1>Mobile Unit Management</h1>
          <p>Manage mobile patrol units available for report assignment</p>
        </div>
        <button className="mu-btn-primary" onClick={openAdd}>
          + Add Mobile Unit
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mu-filter-bar">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginRight: "4px",
            whiteSpace: "nowrap",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            fill="none"
            stroke="var(--navy-primary)"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "var(--navy-primary)",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Filter
          </span>
        </div>

        <select
          className="mu-filter-select"
          value={draftSort}
          onChange={(e) => setDraftSort(e.target.value)}
        >
          <option value="">Sort: Default</option>
          <option value="created_at">Sort: Newest First</option>
          <option value="created_at_asc">Sort: Oldest First</option>
        </select>

        <select
          className="mu-filter-select"
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value)}
        >
          <option value="active">Status: Active</option>
          <option value="removed">Status: Removed</option>
          <option value="all">Status: All</option>
        </select>

        <button
          className={`mu-apply-btn${isDirty ? " mu-apply-btn-dirty" : ""}`}
          onClick={handleApplyFilters}
        >
          Apply Filters
        </button>
        <button
          className="mu-reset-btn"
          title="Reset to defaults"
          onClick={handleResetFilters}
        >
          ↺
        </button>
      </div>

      <div className="mu-table-card">
        <div className="mu-table-wrapper">
          <table className="mu-table">
            <thead>
              <tr>
                <th>Unit Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="4" className="mu-center">
                    {loading ? "Loading..." : "No records found"}
                  </td>
                </tr>
              ) : (
                paginated.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.unit_name}</strong>
                    </td>
                    <td>
                      <span
                        className={`mu-status ${u.is_active ? "active" : "inactive"}`}
                      >
                        {u.is_active ? "Active" : "Removed"}
                      </span>
                    </td>
                    <td>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            timeZone: "Asia/Manila",
                          })
                        : "—"}
                    </td>
                    <td>
                      <div className="mu-actions">
                        <button
                          className="mu-action-btn mu-action-btn-edit"
                          onClick={() => openEdit(u)}
                        >
                          <EditIcon /> Edit
                        </button>
                        {u.is_active ? (
                          <button
                            className="mu-action-btn mu-action-btn-remove"
                            onClick={() => handleRemove(u)}
                          >
                            <RemoveIcon /> Remove
                          </button>
                        ) : (
                          <button
                            className="mu-action-btn mu-action-btn-restore"
                            onClick={() => handleRestore(u)}
                          >
                            <RestoreIcon /> Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="mu-pagination">
            <div className="mu-pagination-info">
              Showing{" "}
              {Math.min((safePage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–
              {Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of{" "}
              {filtered.length} record(s)
            </div>
            <div className="mu-pagination-controls">
              <button
                className="mu-pagination-btn"
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage === 1}
              >
                Previous
              </button>
              <span className="mu-pagination-current">
                Page {safePage} of {totalPages || 1}
              </span>
              <button
                className="mu-pagination-btn"
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="mu-modal-overlay">
          <div
            className="mu-modal"
            style={{ maxWidth: "520px", width: "92vw" }}
          >
            <div className="mu-modal-header">
              <div
                style={{ display: "flex", alignItems: "center", gap: "14px" }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {editingId ? (
                      <>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </>
                    ) : (
                      <>
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </>
                    )}
                  </svg>
                </div>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    {editingId ? "Edit Mobile Unit" : "Add New Mobile Unit"}
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.6)",
                      marginTop: "3px",
                    }}
                  >
                    {editingId
                      ? "Modify existing mobile unit record"
                      : "Register a new mobile patrol unit"}
                  </p>
                </div>
              </div>
              <span
                className="mu-modal-close"
                onClick={() => setShowModal(false)}
              >
                &times;
              </span>
            </div>
            <div
              className="mu-modal-body"
              style={{ padding: "28px 32px", gap: "24px" }}
            >
              {/* Unit Name */}
              <div className="mu-form-group">
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                  }}
                >
                  Unit Name{" "}
                  <span style={{ color: "var(--red-primary)" }}>*</span>
                </label>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "12px",
                    color: "#9ca3af",
                  }}
                >
                  Identifier for this mobile patrol unit (e.g., Mobile 1, Alpha
                  Team)
                </p>
                <input
                  type="text"
                  className={`mu-input ${errors.unit_name ? "error" : ""}`}
                  placeholder="e.g., Mobile 1"
                  value={form.unit_name}
                  maxLength="150"
                  style={{ height: "44px", fontSize: "14px" }}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, unit_name: e.target.value }));
                    setErrors((p) => ({ ...p, unit_name: "" }));
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "5px",
                  }}
                >
                  {errors.unit_name ? (
                    <span className="mu-error">{errors.unit_name}</span>
                  ) : (
                    <span />
                  )}
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    {form.unit_name.length}/150
                  </span>
                </div>
              </div>
            </div>
            <div className="mu-modal-footer">
              <button
                className="mu-btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button className="mu-btn-primary" onClick={handleSubmit}>
                {editingId ? "Update" : "Add Mobile Unit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove / Restore Confirm Modal */}
      {confirmModal.show && (
        <div className="mu-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="mu-modal" style={{ maxWidth: "440px", padding: 0 }}>
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                background:
                  confirmModal.action === "remove"
                    ? "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)"
                    : "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
                borderRadius: "8px 8px 0 0",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {confirmModal.action === "remove" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 .49-3.24" />
                  </svg>
                )}
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  {confirmModal.action === "remove"
                    ? "Remove Mobile Unit"
                    : "Restore Mobile Unit"}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.7)",
                    marginTop: "2px",
                  }}
                >
                  {confirmModal.action === "remove"
                    ? "This will disable the unit from assignment"
                    : "This will re-enable the unit for assignment"}
                </p>
              </div>
              <span
                onClick={() =>
                  setConfirmModal({
                    show: false,
                    id: null,
                    name: "",
                    action: null,
                  })
                }
                style={{
                  marginLeft: "auto",
                  color: "white",
                  fontSize: "24px",
                  cursor: "pointer",
                  opacity: 0.8,
                  lineHeight: 1,
                }}
              >
                &times;
              </span>
            </div>

            {/* Body */}
            <div style={{ padding: "24px" }}>
              {confirmModal.action === "remove" ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "#374151",
                    lineHeight: "1.7",
                  }}
                >
                  Are you sure you want to remove{" "}
                  <strong style={{ color: "#b91c1c" }}>
                    {confirmModal.name}
                  </strong>
                  ?<br />
                  <span style={{ color: "#6b7280", fontSize: "13px" }}>
                    It will be marked as <em>Removed</em> and hidden from the
                    assignment dropdown. You can restore it anytime.
                  </span>
                </p>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "#374151",
                    lineHeight: "1.7",
                  }}
                >
                  Are you sure you want to restore{" "}
                  <strong style={{ color: "#047857" }}>
                    {confirmModal.name}
                  </strong>
                  ?<br />
                  <span style={{ color: "#6b7280", fontSize: "13px" }}>
                    It will be marked as <em>Active</em> and available for
                    assignment on reports.
                  </span>
                </p>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                background: "#f9fafb",
                borderRadius: "0 0 8px 8px",
              }}
            >
              <button
                className="mu-btn-secondary"
                onClick={() =>
                  setConfirmModal({
                    show: false,
                    id: null,
                    name: "",
                    action: null,
                  })
                }
              >
                Cancel
              </button>
              <button
                className={
                  confirmModal.action === "remove"
                    ? "mu-btn-danger"
                    : "mu-btn-success"
                }
                onClick={confirmAction}
              >
                {confirmModal.action === "remove"
                  ? "Yes, Remove"
                  : "Yes, Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileUnitManagement;