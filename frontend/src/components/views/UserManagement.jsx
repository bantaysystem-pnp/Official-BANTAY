import React, { useState, useEffect, useCallback } from "react";
import { getUserFromToken } from "../../utils/auth";
import AddUserModal from "../modals/AddUserModal";
import EditUserModal from "../modals/EditUserModal";
import DeleteUserModal from "../modals/DeleteUserModal";
import RestoreUserModal from "../modals/RestoreUserModal";
import "./UserManagement.css";
import LoadingModal from "../modals/LoadingModal";

const ITEMS_PER_PAGE = 15;
const API_URL = import.meta.env.VITE_API_URL;

const STATUS_PARAM_MAP = {
  Default: null,
  Verified: "verified",
  Unverified: "unverified",
  Locked: "locked",
  Deactivated: "deactivated",
};

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

const DeleteIcon = () => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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

const DEFAULT_FILTERS = {
  searchTerm: "",
  roleFilter: "all",
  statusFilter: "Default",
};

const UserManagement = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [user, setUser] = useState(null);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: ITEMS_PER_PAGE,
    totalPages: 1,
  });

  const [roles, setRoles] = useState([]);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [draft, setDraft] = useState({ ...DEFAULT_FILTERS });
  const [appliedFilters, setAppliedFilters] = useState({ ...DEFAULT_FILTERS });
  const [currentPage, setCurrentPage] = useState(1);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(appliedFilters);

  // ===================================================
  // FETCH FILTER OPTIONS
  // ===================================================
  const fetchFilterOptions = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/user-management/filter-options`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  useEffect(() => {
    const userData = getUserFromToken();
    setUser(userData);
    fetchFilterOptions();
  }, []);

  // ===================================================
  // FETCH USERS
  // ===================================================
  const fetchUsers = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        const params = new URLSearchParams();
        params.set("page", page);
        params.set("limit", ITEMS_PER_PAGE);

        const statusParam = STATUS_PARAM_MAP[appliedFilters.statusFilter];
        if (statusParam) params.set("status", statusParam);

        if (appliedFilters.searchTerm.trim())
          params.set("search", appliedFilters.searchTerm.trim());

        if (appliedFilters.roleFilter !== "all") {
          params.set("role", appliedFilters.roleFilter);
        }

        const res = await fetch(
          `${API_URL}/user-management/users?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
          setPagination(
            data.pagination || {
              total: 0,
              page: 1,
              limit: ITEMS_PER_PAGE,
              totalPages: 1,
            },
          );
          setError("");
        } else {
          setError("Failed to fetch users");
        }
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Error connecting to server");
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters],
  );

  useEffect(() => {
    setCurrentPage(1);
    fetchUsers(1);
  }, [appliedFilters]);

  const handleApplyFilters = () => {
    setCurrentPage(1);
    setAppliedFilters({ ...draft });
  };

  const handleResetFilters = () => {
    setDraft({ ...DEFAULT_FILTERS });
    setAppliedFilters({ ...DEFAULT_FILTERS });
    setCurrentPage(1);
  };

  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(""), 5000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(() => setErrorMessage(""), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMessage]);

  const handleUserAdded = (message) => {
    setSuccessMessage(message || "User added successfully!");
    fetchUsers(currentPage);
  };

  const handleUserUpdated = () => {
    setSuccessMessage("User updated successfully!");
    fetchUsers(currentPage);
  };

  const handleUserDeleted = (message) => {
    setSuccessMessage(message || "User deactivated successfully!");
    fetchUsers(currentPage);
  };

  const handleUserRestored = (message) => {
    setSuccessMessage(message || "User restored successfully!");
    fetchUsers(currentPage);
  };

  const handleEditUser = (userData) => {
    if (isCurrentUser(userData)) {
      setErrorMessage("You cannot edit your own account from this interface.");
      return;
    }
    setSelectedUser(userData);
    setIsEditModalOpen(true);
  };

  const handleDeleteUser = (userData) => {
    if (isCurrentUser(userData)) {
      setErrorMessage("You cannot delete your own account.");
      return;
    }
    setSelectedUser(userData);
    setIsDeleteModalOpen(true);
  };

  const handleRestoreUser = (userData) => {
    if (isCurrentUser(userData)) {
      setErrorMessage("You cannot restore your own account.");
      return;
    }
    setSelectedUser(userData);
    setIsRestoreModalOpen(true);
  };

  const handleResendSuccess = (message) => {
    setSuccessMessage(message);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchUsers(page);
  };

  const isCurrentUser = (userData) => user && userData.user_id === user.user_id;

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (firstName, lastName, username) => {
    if (firstName && lastName)
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (username) return username.substring(0, 2).toUpperCase();
    return "NA";
  };

  const formatDisplayName = (
    firstName,
    middleName,
    lastName,
    suffix,
    username,
    rankAbbreviation,
  ) => {
    if (firstName && lastName) {
      const rankPrefix = rankAbbreviation ? `${rankAbbreviation}. ` : "";
      const parts = [firstName, middleName, lastName, suffix].filter(Boolean);
      const fullName = parts.join(" ");
      const display = rankPrefix + fullName;
      if (display.length > 30) {
        return (
          rankPrefix + fullName.substring(0, 27 - rankPrefix.length) + "..."
        );
      }
      return display;
    }
    return username;
  };

  const getRoleBadgeClass = (role) => {
    if (!role) return "um-role-default";
    const r = role.toLowerCase();
    if (r.includes("administrator")) return "um-role-admin";
    if (r.includes("user")) return "um-role-user";
  };

  const getStatusText = (userData) => {
    switch (userData.status) {
      case "deactivated":
        return "Deactivated";
      case "locked":
        return "Locked";
      case "unverified":
        return "Unverified";
      case "verified":
        return "Verified";
      default:
        return "Verified";
    }
  };

  const getStatusBadgeClass = (userData) => {
    switch (userData.status) {
      case "deactivated":
        return "um-status-inactive";
      case "locked":
        return "um-status-locked";
      case "unverified":
        return "um-status-unverified";
      default:
        return "um-status-active";
    }
  };

  const isUserDeactivated = (u) => u.status === "deactivated";

  return (
    <div className="um-content-area">
      <div className="um-page-header">
        <div className="um-page-header-left">
          <h1>User Management</h1>
          <p>Manage system users and permissions</p>
        </div>
        <button
          className="um-btn um-btn-primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          + Add New User
        </button>
      </div>

      {/* Filter Bar */}
      <div className="um-filter-bar">
        <div className="um-filter-fields">
          <div className="um-filter-group">
            <label className="um-filter-label">Search</label>
            <input
              type="text"
              className="um-filter-input"
              placeholder="Name, username, or email..."
              value={draft.searchTerm}
              onChange={(e) =>
                setDraft((f) => ({ ...f, searchTerm: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplyFilters();
              }}
            />
          </div>

          <div className="um-filter-group">
            <label className="um-filter-label">Role</label>
            <select
              className="um-filter-input"
              value={draft.roleFilter}
              onChange={(e) =>
                setDraft((f) => ({ ...f, roleFilter: e.target.value }))
              }
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="um-filter-group">
            <label className="um-filter-label">Status</label>
            <select
              className={`um-filter-input${draft.statusFilter === "Default" ? " um-status-placeholder" : ""}`}
              value={draft.statusFilter}
              onChange={(e) =>
                setDraft((f) => ({ ...f, statusFilter: e.target.value }))
              }
              style={
                draft.statusFilter === "Default"
                  ? { color: "#adb5bd" }
                  : { color: "#212529" }
              }
            >
              <option value="Default" style={{ color: "#212529" }}>
                Select Status
              </option>
              <option value="Verified" style={{ color: "#212529" }}>
                Verified
              </option>
              <option value="Unverified" style={{ color: "#212529" }}>
                Unverified
              </option>
              <option value="Locked" style={{ color: "#212529" }}>
                Locked
              </option>
              <option value="Deactivated" style={{ color: "#212529" }}>
                Deactivated
              </option>
            </select>
          </div>
        </div>

        <div className="um-filter-actions">
          <button
            className={`um-apply-btn${isDirty ? " um-apply-btn-dirty" : ""}`}
            onClick={handleApplyFilters}
          >
            Apply Filters
          </button>
          <button
            className="um-reset-btn"
            onClick={handleResetFilters}
            title="Reset to defaults"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="um-table-card">
        {error && <div className="um-error-message">{error}</div>}

        {loading ? (
          <LoadingModal isOpen={true} message={"Loading users..."} />
        ) : (
          <>
            <div className="um-table-container">
              <table className="um-data-table um-table-police">
                <thead>
                  <tr>
                    <th>User</th>
                    <th className="um-col-role">Role</th>
                    <th className="um-col-status">Status</th>
                    <th className="um-col-last-login">Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "40px" }}>
                        No users found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    users.map((userData) => (
                      <tr key={userData.user_id}>
                        <td>
                          <div className="um-user-cell">
                            <div className="um-user-cell-avatar">
                              {userData.profile_picture ? (
                                <img
                                  src={userData.profile_picture}
                                  alt="Profile"
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                getInitials(
                                  userData.first_name,
                                  userData.last_name,
                                  userData.username,
                                )
                              )}
                            </div>
                            <div className="um-user-cell-info">
                              <div className="um-user-cell-name">
                                {formatDisplayName(
                                  userData.first_name,
                                  userData.middle_name,
                                  userData.last_name,
                                  userData.suffix,
                                  userData.username,
                                  userData.rank_abbreviation,
                                )}
                                {isCurrentUser(userData) && (
                                  <span className="um-you-badge">( YOU )</span>
                                )}
                              </div>
                              <div className="um-user-cell-email">
                                {userData.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="um-col-role">
                          <span
                            className={`um-role-badge ${getRoleBadgeClass(userData.role)}`}
                          >
                            {userData.role || "N/A"}
                          </span>
                        </td>

                        <td className="um-col-status">
                          <span
                            className={`um-status-badge ${getStatusBadgeClass(userData)}`}
                          >
                            {getStatusText(userData)}
                          </span>
                        </td>

                        <td className="um-col-last-login">
                          {formatDate(userData.last_login)}
                        </td>

                        <td>
                          <div className="um-action-links">
                            <button
                              onClick={() => handleEditUser(userData)}
                              className={`um-action-btn um-action-btn-edit${isCurrentUser(userData) ? " um-action-disabled" : ""}`}
                              disabled={isCurrentUser(userData)}
                              title={
                                isCurrentUser(userData)
                                  ? "You cannot edit your own account"
                                  : "Edit user"
                              }
                            >
                              <EditIcon />
                              Edit
                            </button>

                            {isUserDeactivated(userData) ? (
                              <button
                                onClick={() => handleRestoreUser(userData)}
                                className={`um-action-btn um-action-btn-success${isCurrentUser(userData) ? " um-action-disabled" : ""}`}
                                disabled={isCurrentUser(userData)}
                                title="Restore user"
                              >
                                <RestoreIcon />
                                Restore
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDeleteUser(userData)}
                                className={`um-action-btn um-action-btn-danger${isCurrentUser(userData) ? " um-action-disabled" : ""}`}
                                disabled={isCurrentUser(userData)}
                                title="Deactivate user"
                              >
                                <DeleteIcon />
                                Delete
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

            {pagination.total > 0 && (
              <div className="um-pagination">
                <div className="um-pagination-info">
                  Showing {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}{" "}
                  of {pagination.total} users
                </div>
                <div className="um-pagination-controls">
                  <button
                    className="um-pagination-btn"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span className="um-pagination-current">
                    Page {currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    className="um-pagination-btn"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === pagination.totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUserAdded={handleUserAdded}
      />
      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={selectedUser}
        onUserUpdated={handleUserUpdated}
        onResendSuccess={handleResendSuccess}
      />
      <DeleteUserModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        user={selectedUser}
        onUserDeleted={handleUserDeleted}
      />
      <RestoreUserModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        user={selectedUser}
        onUserRestored={handleUserRestored}
      />

      {successMessage && (
        <div className="um-toast um-toast-success">
          <div className="um-toast-content">
            <svg className="um-toast-icon" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="um-toast um-toast-error">
          <div className="um-toast-content">
            <svg className="um-toast-icon" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;