// frontend\src\components\views\TypeOfOperationManagement.jsx

import React, { useState, useEffect } from "react";
import "./TypeOfOperationManagement.css";
import LoadingModal from "../modals/LoadingModal";

const API_URL = `${import.meta.env.VITE_API_URL}/type-of-operation-management`;
const ITEMS_PER_PAGE = 15;

const emptyForm = { operation_name: "" };

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const RemoveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);
const RestoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-3.24" />
  </svg>
);

function TypeOfOperationManagement() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const [filterStatus, setFilterStatus] = useState("active");
  const [sortBy, setSortBy] = useState("");
  const [draftStatus, setDraftStatus] = useState("active");
  const [draftSort, setDraftSort] = useState("");
  const isDirty = draftStatus !== filterStatus || draftSort !== sortBy;

  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, id: null, name: "", action: null });
  const [currentPage, setCurrentPage] = useState(1);

  const token = () => localStorage.getItem("token");

  useEffect(() => { fetchList(); }, []);

  const fetchList = async (sortOverride) => {
    try {
      setLoading(true);
      const effectiveSort = sortOverride !== undefined ? sortOverride : sortBy;
      const url = effectiveSort ? `${API_URL}?sort_by=${effectiveSort}` : API_URL;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (data.success) setList(data.data);
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

  const openAdd = () => { setForm(emptyForm); setErrors({}); setEditingId(null); setShowModal(true); };
  const openEdit = (m) => { setForm({ operation_name: m.operation_name }); setErrors({}); setEditingId(m.id); setShowModal(true); };

  const validate = () => {
    const e = {};
    if (!form.operation_name || form.operation_name.trim().length === 0) e.operation_name = "Required";
    else if (form.operation_name.trim().length < 2) e.operation_name = "At least 2 characters";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        showToast(editingId ? "Type of Operation updated successfully!" : "Type of Operation added successfully!");
        setShowModal(false);
        fetchList();
      } else {
        showToast(data.message || "Error", "error");
      }
    } catch (err) {
      showToast("Request failed", "error");
    }
  };

  const handleRemove = (m) => setConfirmModal({ show: true, id: m.id, name: m.operation_name, action: "remove" });
  const handleRestore = (m) => setConfirmModal({ show: true, id: m.id, name: m.operation_name, action: "restore" });

  const confirmAction = async () => {
    const { id, action } = confirmModal;
    setConfirmModal({ show: false, id: null, name: "", action: null });
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ is_active: action === "restore" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(action === "restore" ? "Restored successfully!" : "Removed successfully!");
        fetchList();
      } else {
        showToast(data.message || "Error", "error");
      }
    } catch (err) {
      showToast("Request failed", "error");
    }
  };

  const handleApplyFilters = () => {
    setFilterStatus(draftStatus);
    setSortBy(draftSort);
    setCurrentPage(1);
    fetchList(draftSort);
  };

  const handleResetFilters = () => {
    setDraftStatus("active"); setDraftSort("");
    setFilterStatus("active"); setSortBy("");
    setCurrentPage(1);
    fetchList("");
  };

  const filtered = list.filter((m) =>
    filterStatus === "active" ? m.is_active : filterStatus === "removed" ? !m.is_active : true
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const handlePageChange = (page) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  return (
    <div className="too-container">
      {toast && (
        <div className={`too-toast ${toast.type === "success" ? "too-toast-success" : "too-toast-error"}`} style={{ zIndex: 99999 }}>
          <div className="too-toast-content">
            <svg className="too-toast-icon" viewBox="0 0 20 20" fill="currentColor">
              {toast.type === "success" ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              )}
            </svg>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      <LoadingModal isOpen={loading} message="Loading type of operation records..." />

      <div className="too-header">
        <div>
          <h1>Type of Operation Management</h1>
          <p>Manage the type-of-operation classifications used in blotter reports</p>
        </div>
        <button className="too-btn-primary" onClick={openAdd}>+ Add Type of Operation</button>
      </div>

      <div className="too-filter-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "4px", whiteSpace: "nowrap" }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="var(--navy-primary)" strokeWidth="2.5" viewBox="0 0 24 24">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--navy-primary)", textTransform: "uppercase", letterSpacing: "1px" }}>Filter</span>
        </div>

        <select className="too-filter-select" value={draftSort} onChange={(e) => setDraftSort(e.target.value)}>
          <option value="">Sort: Default</option>
          <option value="created_at">Sort: Newest First</option>
          <option value="created_at_asc">Sort: Oldest First</option>
        </select>

        <select className="too-filter-select" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
          <option value="active">Status: Active</option>
          <option value="removed">Status: Removed</option>
          <option value="all">Status: All</option>
        </select>

        <button className={`too-apply-btn${isDirty ? " too-apply-btn-dirty" : ""}`} onClick={handleApplyFilters}>Apply Filters</button>
        <button className="too-reset-btn" title="Reset to defaults" onClick={handleResetFilters}>↺</button>
      </div>

      <div className="too-table-card">
        <div className="too-table-wrapper">
          <table className="too-table">
            <thead>
              <tr>
                <th>Operation Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan="4" className="too-center">{loading ? "Loading..." : "No records found"}</td></tr>
              ) : (
                paginated.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.operation_name}</strong></td>
                    <td>
                      <span className={`too-status ${m.is_active ? "active" : "inactive"}`}>
                        {m.is_active ? "Active" : "Removed"}
                      </span>
                    </td>
                    <td>
                      {m.created_at
                        ? new Date(m.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" })
                        : "—"}
                    </td>
                    <td>
                      <div className="too-actions">
                        <button className="too-action-btn too-action-btn-edit" onClick={() => openEdit(m)}>
                          <EditIcon /> Edit
                        </button>
                        {m.is_active ? (
                          <button className="too-action-btn too-action-btn-remove" onClick={() => handleRemove(m)}>
                            <RemoveIcon /> Remove
                          </button>
                        ) : (
                          <button className="too-action-btn too-action-btn-restore" onClick={() => handleRestore(m)}>
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

        {filtered.length > 0 && (
          <div className="too-pagination">
            <div className="too-pagination-info">
              Showing {Math.min((safePage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} record(s)
            </div>
            <div className="too-pagination-controls">
              <button className="too-pagination-btn" onClick={() => handlePageChange(safePage - 1)} disabled={safePage === 1}>Previous</button>
              <span className="too-pagination-current">Page {safePage} of {totalPages || 1}</span>
              <button className="too-pagination-btn" onClick={() => handlePageChange(safePage + 1)} disabled={safePage === totalPages}>Next</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="too-modal-overlay">
          <div className="too-modal" style={{ maxWidth: "560px", width: "92vw" }}>
            <div className="too-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(255,255,255,0.2)" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "white" }}>
                    {editingId ? "Edit Type of Operation" : "Add New Type of Operation"}
                  </h2>
                  <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.6)", marginTop: "3px" }}>
                    {editingId ? "Modify existing type of operation record" : "Register a new type of operation classification"}
                  </p>
                </div>
              </div>
              <span className="too-modal-close" onClick={() => setShowModal(false)}>&times;</span>
            </div>
            <div className="too-modal-body" style={{ padding: "28px 32px", gap: "24px" }}>
              <div className="too-form-group">
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  Operation Name <span style={{ color: "var(--red-primary)" }}>*</span>
                </label>
                <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#9ca3af" }}>
                  e.g. Onboard a vehicle (riding in/on), Along the street
                </p>
                <input
                  type="text"
                  className={`too-input ${errors.operation_name ? "error" : ""}`}
                  placeholder="e.g., Along the street"
                  value={form.operation_name}
                  maxLength="100"
                  style={{ height: "44px", fontSize: "14px" }}
                  onChange={(e) => { setForm({ operation_name: e.target.value }); setErrors({}); }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
                  {errors.operation_name ? <span className="too-error">{errors.operation_name}</span> : <span />}
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>{form.operation_name.length}/100</span>
                </div>
              </div>
            </div>
            <div className="too-modal-footer">
              <button className="too-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="too-btn-primary" onClick={handleSubmit}>{editingId ? "Update" : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div className="too-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="too-modal" style={{ maxWidth: "440px", padding: 0 }}>
            <div style={{ padding: "20px 24px", background: confirmModal.action === "remove" ? "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)" : "linear-gradient(135deg, #064e3b 0%, #059669 100%)", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {confirmModal.action === "remove" ? <RemoveIcon /> : <RestoreIcon />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "white" }}>
                  {confirmModal.action === "remove" ? "Remove" : "Restore"}
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.7)", marginTop: "2px" }}>
                  {confirmModal.action === "remove" ? "This will disable it from use" : "This will re-enable it for use"}
                </p>
              </div>
              <span onClick={() => setConfirmModal({ show: false, id: null, name: "", action: null })} style={{ marginLeft: "auto", color: "white", fontSize: "24px", cursor: "pointer", opacity: 0.8, lineHeight: 1 }}>&times;</span>
            </div>
            <div style={{ padding: "24px" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#374151", lineHeight: "1.7" }}>
                Are you sure you want to {confirmModal.action}{" "}
                <strong style={{ color: confirmModal.action === "remove" ? "#b91c1c" : "#047857" }}>{confirmModal.name}</strong>?
              </p>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb", display: "flex", gap: "12px", justifyContent: "flex-end", background: "#f9fafb", borderRadius: "0 0 8px 8px" }}>
              <button className="too-btn-secondary" onClick={() => setConfirmModal({ show: false, id: null, name: "", action: null })}>Cancel</button>
              <button className={confirmModal.action === "remove" ? "too-btn-danger" : "too-btn-success"} onClick={confirmAction}>
                {confirmModal.action === "remove" ? "Yes, Remove" : "Yes, Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TypeOfOperationManagement;