// frontend\src\components\views\EBlotter.jsx

import React, { useState, useEffect, useRef, useCallback } from "react";

import "./EBlotter.css";
import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  CURRENT_BARANGAYS,
  LEGACY_BARANGAY_OPTIONS,
} from "../../utils/barangayOptions";
import ImportBlotterModal from "../modals/ImportBlotterModal";
import LoadingModal from "../modals/LoadingModal";
import ExportBlotterModal from "../modals/ExportBlotterModal";
import PdfPreviewModal from "../modals/PdfPreviewModal";


// ─── FEATURE FLAGS ────────────────────────────────────────────────────────
const SHOW_IMPORT_BUTTON = true; // Set to false to hide Import button + disable the import modal

const OFFENSE_TO_CRIME_TYPE = {
  Murder: "MURDER",
  Homicide: "HOMICIDE",
  "Physical Injury": "PHYSICAL INJURIES",
  Rape: "RAPE",
  Robbery: "ROBBERY",
  Theft: "THEFT",
  "Carnapping - MC": "CARNAPPING - MC",
  "Carnapping - MV": "CARNAPPING - MV",
  "Special Complex Crime": "SPECIAL COMPLEX CRIME",
};
const formatBarangayLabel = (name) => {
  const ROMAN = new Set([
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ]);
  return name.toLowerCase().replace(/\b\w+/g, (word) => {
    const upper = word.toUpperCase();
    if (ROMAN.has(upper)) return upper;
    // Handle P.F. — keep dots
    if (upper === "P" || upper === "F") return upper;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
};
const BARANGAY_MIGRATION_MAP = {
  // Roman numeral variants → GeoJSON exact names
  "ANIBAN 1": "ANIBAN I",
  "ANIBAN 2": "ANIBAN II",
  "HABAY 1": "HABAY I",
  "HABAY 2": "HABAY II",
  "LIGAS 1": "LIGAS I",
  "LIGAS 2": "LIGAS II",
  "MABOLO 1": "MABOLO",
  "MABOLO 2": "MABOLO",
  "MABOLO 3": "MABOLO",
  "MALIKSI 1": "MALIKSI I",
  "MALIKSI 2": "MALIKSI II",
  "MALIKSI 3": "MALIKSI II",
  "MAMBOG 1": "MAMBOG I",
  "MAMBOG 2": "MAMBOG II",
  "MAMBOG 3": "MAMBOG III",
  "MAMBOG 4": "MAMBOG IV",
  "MAMBOG 5": "MAMBOG II",
  "MOLINO 1": "MOLINO I",
  "MOLINO 2": "MOLINO II",
  "MOLINO 3": "MOLINO III",
  "MOLINO 4": "MOLINO IV",
  "MOLINO 5": "MOLINO V",
  "MOLINO 6": "MOLINO VI",
  "MOLINO 7": "MOLINO VII",
  "NIOG 1": "NIOG",
  "NIOG 2": "NIOG",
  "NIOG 3": "NIOG",
  "REAL 1": "REAL",
  "REAL 2": "REAL",
  "SALINAS 1": "SALINAS I",
  "SALINAS 2": "SALINAS II",
  "SALINAS 3": "SALINAS II",
  "SALINAS 4": "SALINAS II",
  "SAN NICOLAS 1": "SAN NICOLAS I",
  "SAN NICOLAS 2": "SAN NICOLAS II",
  "SAN NICOLAS 3": "SAN NICOLAS III",
  "TALABA 1": "TALABA I",
  "TALABA 2": "TALABA II",
  "TALABA 3": "TALABA III",
  "TALABA 4": "TALABA III",
  "TALABA 5": "TALABA III",
  "TALABA 6": "TALABA III",
  "TALABA 7": "TALABA I",
  "ZAPOTE 1": "ZAPOTE I",
  "ZAPOTE 2": "ZAPOTE II",
  "ZAPOTE 3": "ZAPOTE III",
  "ZAPOTE 4": "ZAPOTE II",
  "QUEENS ROW CENTRAL": "QUEENS ROW CENTRAL",
  "QUEENS ROW EAST": "QUEENS ROW EAST",
  "QUEENS ROW WEST": "QUEENS ROW WEST",
  // Old names that were merged/renamed
  BANALO: "SINBANALI",
  ALIMA: "SINBANALI",
  SINEGUELASAN: "SINBANALI",
  CAMPOSANTO: "POBLACION",
  "DAANG BUKID": "POBLACION",
  "TABING DAGAT": "POBLACION",
  "KAINGIN (POB.)": "POBLACION",
  DIGMAN: "KAINGIN DIGMAN",
  KAINGIN: "KAINGIN DIGMAN",
  "KAINGIN DIGMAN": "KAINGIN DIGMAN",
  PANAPAAN: "P.F. ESPIRITU I (PANAPAAN)",
  "PANAPAAN 1": "P.F. ESPIRITU I (PANAPAAN)",
  "PANAPAAN 2": "P.F. ESPIRITU II",
  "PANAPAAN 3": "P.F. ESPIRITU II",
  "PANAPAAN 4": "P.F. ESPIRITU IV",
  "PANAPAAN 5": "P.F. ESPIRITU V",
  "PANAPAAN 6": "P.F. ESPIRITU VI",
  "P.F. ESPIRITU 1 (PANAPAAN)": "P.F. ESPIRITU I (PANAPAAN)",
  "P.F. ESPIRITU 2": "P.F. ESPIRITU II",
  "P.F. ESPIRITU 3": "P.F. ESPIRITU III",
  "P.F. ESPIRITU 4": "P.F. ESPIRITU IV",
  "P.F. ESPIRITU 5": "P.F. ESPIRITU V",
  "P.F. ESPIRITU 6": "P.F. ESPIRITU VI",
};
const toLocalDateTimeString = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
const FieldError = ({ error }) => {
  if (!error) return null;
  return <span className="eb-field-error">{error}</span>;
};

const ViewIcon = () => (
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
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

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

function EBlotter() {
  const [showModal, setShowModal] = useState(false);

  const [blotters, setBlotters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeReportTab, setActiveReportTab] = useState("reports");
  const ITEMS_PER_PAGE = 15;
  const [originalData, setOriginalData] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [deletedBlotters, setDeletedBlotters] = useState([]);
  
  const [trashLoading, setTrashLoading] = useState(false);

  const [offenseModus, setOffenseModus] = useState({});
  const [offenseSelectedModus, setOffenseSelectedModus] = useState({});
  const [typeOfPlace, setTypeOfPlace] = useState("");
  const [streetSuggestions, setStreetSuggestions] = useState([]);
  const [showStreetDropdown, setShowStreetDropdown] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deletedPage, setDeletedPage] = useState(1);
  const DELETED_PER_PAGE = 15;
  const [reactToast, setReactToast] = useState({
    show: false,
    message: "",
    type: "success",
  });
  
  const [pendingExport, setPendingExport] = useState(null);
  
  const fetchControllerRef = useRef(null);
  const activeReportTabRef = useRef("reports"); // ADD THIS
          
  
  const showReactToast = (message, type = "success") => {
    setReactToast({ show: true, message, type });
    setTimeout(
      () => setReactToast({ show: false, message: "", type: "success" }),
      3000,
    );
  };

      
    
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExportLoading, setIsExportLoading] = useState(false);
  const [pdfPreview, setPdfPreview] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    incident_type: "",
    date_from: "",
    date_to: "",
    barangay: "",
    data_source: "",
  });
  const [editMode, setEditMode] = useState(false);
  const [editingBlotterId, setEditingBlotterId] = useState(null);
  const [fetchingEdit, setFetchingEdit] = useState(false);
  const [fetchingView, setFetchingView] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    type: "",
    id: null,
    message: "",
  });
  



  const [caseProvinces, setCaseProvinces] = useState([]);
  const [caseCities, setCaseCities] = useState([]);
  const [bacoorBarangays, setBacoorBarangays] = useState([]);
  const [loadingBacoorBrgy, setLoadingBacoorBrgy] = useState(false);
  const [barangayGeoJSON, setBarangayGeoJSON] = useState(null);
  const [selectedBrgyFeature, setSelectedBrgyFeature] = useState(null);
  const mapRef = React.useRef(null);

  

  const [offenses, setOffenses] = useState([
    {
      is_principal_offense: true,
      offense_type: "",
      offense_name: "",
      stage_of_felony: "",
      index_type: "Non-Index",
      investigator_on_case: "",
      most_investigator: "",
    },
  ]);
  const offensesRef = useRef(offenses);
  useEffect(() => {
    offensesRef.current = offenses;
  });

  const [caseDetail, setCaseDetail] = useState({
    incident_type: "", // mapped to crime_type at submission
    date_time_commission: "",
    date_time_reported: "",
    place_region: "Region IV-A (CALABARZON)",
    place_district_province: "Cavite",
    place_city_municipality: "Bacoor City",
    place_barangay: "",
    place_barangay_other: "",
    report_number: "",
    lat: "",
    lng: "",
  });

  const [currentUserId, setCurrentUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

      

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setCurrentUserId(payload.user_id);
        setUserRole(payload.role);
      }
    } catch {}
  }, []);


  const API_URL = `${import.meta.env.VITE_API_URL}/blotters`;

  const handleExport = async (dateFrom, dateTo) => {
    setShowExportModal(false);
    setIsExportLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/blotters?date_from=${dateFrom}&date_to=${dateTo}&referred=false`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json = await res.json();
      const records = json.data ?? [];

      if (records.length === 0) {
        setIsExportLoading(false);
        showReactToast("No records found for this date range.", "error");
        return;
      }
      if (records.length > 10000) {
        setIsExportLoading(false);
        showReactToast(
          "Too many records (10,000+). Please narrow your date range.",
          "error",
        );
        return;
      }

      // Show confirmation instead of exporting immediately
      setIsExportLoading(false);
      setPendingExport({ dateFrom, dateTo, records });
    } catch (err) {
      setIsExportLoading(false);
      showReactToast(err.message || "Export failed", "error");
    }
  };

  const confirmExport = async () => {
    const { dateFrom, dateTo, records } = pendingExport;
    setPendingExport(null);
    setIsExportLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min client-side cap

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/blotters/export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ records, meta: { dateFrom, dateTo } }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        let msg = `Export failed (status ${response.status})`;
        try {
          const errData = await response.json();
          if (errData.message) msg = errData.message;
        } catch {
          // response wasn't JSON — keep status-based message
        }
        throw new Error(msg);
      }

      const filename = `blotter_${dateFrom}_to_${dateTo}.pdf`;
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPdfPreview({
        blobUrl,
        download: () => {
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
        },
        revoke: () => URL.revokeObjectURL(blobUrl),
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        showReactToast(
          "Export is taking too long (2+ min). The server may be overloaded — try a smaller date range or check server logs.",
          "error",
        );
      } else if (err.message === "Failed to fetch") {
        showReactToast(
          "Could not reach the server. Check your connection or that the API is reachable.",
          "error",
        );
      } else {
        showReactToast(err.message || "Export failed", "error");
      }
    } finally {
      setIsExportLoading(false);
    }
  };

  useEffect(() => {
    activeReportTabRef.current = activeReportTab;
    fetchBlotters(activeReportTab);

    const targetId = sessionStorage.getItem("openBlotterId");
    if (targetId) {
      sessionStorage.removeItem("openBlotterId");
      setTimeout(() => handleView(targetId), 800);
    }

    const CALABARZON_CODE = "040000000";
    const CAVITE_CODE = "042100000";



    fetch("/bacoor_barangays.geojson")
      .then((r) => r.json())
      .then((data) => {
        setBarangayGeoJSON(data);
        const brgyList = data.features
          .map((f) => f.properties.name_db)
          .filter(Boolean)
          .filter((name, index, self) => self.indexOf(name) === index)
          .sort();
        setBacoorBarangays(brgyList);
      })
      .catch((err) => console.error("Failed to load barangay GeoJSON:", err));

  }, [activeReportTab]);

  // AFTER
  // AFTER
  const fetchBlotters = async (
    tabOverride,
    silent = false,
    filtersOverride = null,
  ) => {
    const currentTab =
      tabOverride !== undefined ? tabOverride : activeReportTabRef.current;
    const f = filtersOverride || filters;

    try {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }
      const controller = new AbortController();
      fetchControllerRef.current = controller;

      if (!silent) {
        setLoading(true);
        setBlotters([]);
      }

      const queryParams = new URLSearchParams();
      if (f.search) queryParams.append("search", f.search);
      if (f.status) queryParams.append("status", f.status);
      if (f.incident_type) queryParams.append("crime_type", f.incident_type);
      if (f.date_from) queryParams.append("date_from", f.date_from);
      if (f.date_to) queryParams.append("date_to", f.date_to);
      if (f.barangay) queryParams.append("barangay", f.barangay);



      const rawResponse = await fetch(`${API_URL}?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        signal: controller.signal,
      });

      const response = handleApiResponse(rawResponse);
      if (!response) {
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success) {
        let results = data.data;

        if (f.incident_type) {
          results = results.filter(
            (b) =>
              (b.crime_type || "").toLowerCase() ===
              f.incident_type.toLowerCase(),
          );
        }

        if (f.data_source === "brgy_referral") {
          results = results.filter((b) =>
            (b.blotter_entry_number || "").toUpperCase().startsWith("BRGY"),
          );
        } else if (f.data_source === "bantay_import") {
          results = results.filter((b) =>
            (b.blotter_entry_number || "").toUpperCase().startsWith("BLT"),
          );
        } else if (f.data_source === "manual") {
          results = results.filter((b) =>
            /^\d{4}/.test(b.blotter_entry_number || ""),
          );
        }

        setBlotters(results);
        setCurrentPage(1);
        setLoading(false);
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Error:", error);
      setLoading(false);
    }
  };
  const fetchDeletedBlotters = async () => {
    try {
      setTrashLoading(true);
      const response = await fetch(`${API_URL}/deleted/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await response.json();
      if (data.success) setDeletedBlotters(data.data);
    } catch (error) {
      console.error("Error fetching deleted reports:", error);
    } finally {
      setTrashLoading(false);
    }
  };

  const handleRestore = (blotterId) => {
    showConfirm(
      "restore",
      blotterId,
      "Restore this report entry? It will be moved back to active records.",
    );
  };
  const showConfirm = (type, id, message) => {
    setConfirmModal({ show: true, type, id, message });
  };

  const handleConfirmAction = async () => {
    const { type, id } = confirmModal;
    setConfirmModal({ show: false, type: "", id: null, message: "" });

    if (type === "delete") {
      setActionMessage("Deleting record...");
      setActionLoading(true);
      try {
        const response = await fetch(`${API_URL}/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await response.json();
        if (data.success) {
          showReactToast("Report deleted successfully.");
          await fetchBlotters(activeReportTab, true);
        }
      } catch {
        alert("Error deleting report.");
      } finally {
        setActionLoading(false);
        setActionMessage("");
      }
    }

    if (type === "restore") {
      setActionMessage("Restoring record...");
      setActionLoading(true);
      try {
        const response = await fetch(`${API_URL}/${id}/restore`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await response.json();
        if (data.success) {
          showReactToast("Report restored successfully.");
          await fetchDeletedBlotters();
          await fetchBlotters(activeReportTab, true);
        }
      } catch {
        alert("Error restoring report.");
      } finally {
        setActionLoading(false);
        setActionMessage("");
      }
    }
  };
  const fetchModusForIncidentType = async (
    incidentType,
    preserveSelection = false,
  ) => {
    const crimeType = OFFENSE_TO_CRIME_TYPE[incidentType];
    if (!crimeType) {
      setOffenseModus((prev) => ({ ...prev, [0]: [] }));
      if (!preserveSelection) {
        setOffenseSelectedModus((prev) => ({ ...prev, [0]: [] }));
      }
      return;
    }
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/blotters/modus/${encodeURIComponent(crimeType)}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      const data = await res.json();
      if (data.success) {
        setOffenseModus((prev) => ({ ...prev, [0]: data.data }));
        if (!preserveSelection) {
          setOffenseSelectedModus((prev) => ({ ...prev, [0]: [] }));
        }
      }
    } catch (err) {
      console.error("Modus fetch error:", err);
    }
  };
  const fetchStreetSuggestions = async (query) => {
    if (!query || query.trim().length < 2) {
      setStreetSuggestions([]);
      setShowStreetDropdown(false);
      return;
    }

    try {
      const centroid_lat =
        selectedBrgyFeature?.properties?.centroid_lat ?? 14.4341;
      const centroid_lng =
        selectedBrgyFeature?.properties?.centroid_lng ?? 120.9647;

      // Compute tight bbox from the selected barangay polygon
      let bbox = "120.9200,14.3900,121.0100,14.5000";
      if (selectedBrgyFeature) {
        const coords =
          selectedBrgyFeature.geometry.type === "Polygon"
            ? selectedBrgyFeature.geometry.coordinates[0]
            : selectedBrgyFeature.geometry.coordinates.flat(2);
        const lngs = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        bbox = `${Math.min(...lngs) - 0.003},${Math.min(...lats) - 0.003},${Math.max(...lngs) + 0.003},${Math.max(...lats) + 0.003}`;
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query,
      )}.json?access_token=${
        import.meta.env.VITE_MAPBOX_TOKEN
      }&country=PH&proximity=${centroid_lng},${centroid_lat}&bbox=${bbox}&types=address,poi&limit=5&language=en`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.features && data.features.length > 0) {
        // Filter suggestions to only those whose coordinates fall inside the selected barangay polygon
        const filtered = data.features.filter((feature) => {
          if (!selectedBrgyFeature) return true;
          const [lng, lat] = feature.center;
          const rings =
            selectedBrgyFeature.geometry.type === "Polygon"
              ? selectedBrgyFeature.geometry.coordinates
              : selectedBrgyFeature.geometry.coordinates.flat(1);
          let inside = false;
          for (const ring of rings) {
            const n = ring.length;
            let j = n - 1;
            for (let i = 0; i < n; i++) {
              const xi = ring[i][0],
                yi = ring[i][1];
              const xj = ring[j][0],
                yj = ring[j][1];
              const intersect =
                yi > lat !== yj > lat &&
                lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
              if (intersect) inside = !inside;
              j = i;
            }
          }
          return inside;
        });

        if (filtered.length > 0) {
          setStreetSuggestions(filtered);
          setShowStreetDropdown(true);
        } else {
          setStreetSuggestions([]);
          setShowStreetDropdown(false);
        }
      } else {
        setStreetSuggestions([]);
        setShowStreetDropdown(false);
      }
    } catch (err) {
      console.error("Street geocoding error:", err);
      setStreetSuggestions([]);
      setShowStreetDropdown(false);
    }
  };

  useEffect(() => {
    
      if (caseDetail.incident_type) {
        // Always sync offense_name
        setOffenses((prev) => {
          const updated = [...prev];
          if (!updated[0]) return prev;
          updated[0] = {
            ...updated[0],
            offense_name: caseDetail.incident_type,
            index_type: "Index",
          };
          return updated;
        });
        // Always fetch modus if not already loaded for this crime type
        if (!offenseModus[0] || offenseModus[0].length === 0) {
          fetchModusForIncidentType(caseDetail.incident_type, true);
        }
      }
    
  }, [caseDetail.incident_type]);

  

  useEffect(() => {
    activeReportTabRef.current = activeReportTab;
  }, [activeReportTab]);

    const handleEdit = async (blotterId) => {
    setFetchingEdit(true);
    try {
      const response = await fetch(`${API_URL}/${blotterId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();

      if (data.success) {
        // v2 has no complainants/suspects storage yet — keep these empty


        // v2 stores one flat offense on the report row, not an offenses array
        const normalizedOffenses = data.data.offenses
          ? data.data.offenses.map((o) => ({
              ...o,
              stage_of_felony: o.stage_of_felony || "",
              index_type: o.index_type || "Non-Index",
            }))
          : [
              {
                is_principal_offense: true,
                offense_type: "",
                offense_name: data.data.crime_type || "",
                stage_of_felony: data.data.stage_of_felony || "",
                index_type: data.data.index_type || "Non-Index",
                investigator_on_case: "",
                most_investigator: "",
              },
            ];
        setOffenses(normalizedOffenses);
        setTypeOfPlace(data.data.type_of_place || "");

        const newOffenseModus = {};
        const newOffenseSelectedModus = {};
        const crimeType = OFFENSE_TO_CRIME_TYPE[data.data.crime_type];
        if (crimeType) {
          try {
            const modusRes = await fetch(
              `${import.meta.env.VITE_API_URL}/blotters/modus/${encodeURIComponent(crimeType)}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              },
            );
            const modusData = await modusRes.json();
            if (modusData.success) {
              newOffenseModus[0] = modusData.data;
              newOffenseSelectedModus[0] = data.data.modus_reference_id
                ? [data.data.modus_reference_id]
                : [];
            }
          } catch (e) {
            console.error(e);
          }
        } else {
          newOffenseModus[0] = [];
          newOffenseSelectedModus[0] = [];
        }
        setOffenseModus(newOffenseModus);
        setOffenseSelectedModus(newOffenseSelectedModus);

        const rawBrgy = data.data.place_barangay || "";
        const resolvedBrgy =
          BARANGAY_MIGRATION_MAP[rawBrgy.toUpperCase()] || rawBrgy;
        setCaseDetail({
          incident_type: data.data.crime_type,
          date_time_commission: data.data.date_time_commission || "",
          date_time_reported: data.data.date_time_reported || "",
          place_region: "Region IV-A (CALABARZON)",
          place_district_province: "Cavite",
          place_city_municipality: "Bacoor City",
          place_barangay: resolvedBrgy,
          place_barangay_other: "",
          report_number: data.data.report_number || "",
          lat: data.data.lat != null ? String(data.data.lat) : "",
          lng: data.data.lng != null ? String(data.data.lng) : "",
        });

        if (resolvedBrgy && barangayGeoJSON) {
          const feature = barangayGeoJSON.features.find(
            (f) => f.properties.name_db === resolvedBrgy,
          );
          setSelectedBrgyFeature(feature || null);
        }

        setOriginalData({
          complainants: [],
          suspects: [],
          offenses: normalizedOffenses,
          caseDetail: {
            incident_type: data.data.crime_type,
            date_time_commission: data.data.date_time_commission || "",
            date_time_reported: data.data.date_time_reported || "",
            place_barangay: resolvedBrgy,
            place_barangay_other: "",
            lat: data.data.lat != null ? String(data.data.lat) : "",
            lng: data.data.lng != null ? String(data.data.lng) : "",
          },
        });

        setEditMode(true);
        setViewMode(false);
        setEditingBlotterId(blotterId);
        setShowModal(true);

        
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to load blotter data");
    } finally {
      setFetchingEdit(false);
    }
  };
  const handleView = async (blotterId) => {
    setFetchingView(true);
    try {
      const response = await fetch(`${API_URL}/${blotterId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();

      if (data.success) {


        // v2 stores one flat offense on the report row, not an offenses array —
        // synthesize a single-item array so the rest of the form (built for offenses[0]) still works.
        const normalizedOffenses = data.data.offenses
          ? data.data.offenses.map((o) => ({
              ...o,
              stage_of_felony: o.stage_of_felony || "",
              index_type: o.index_type || "Non-Index",
            }))
          : [
              {
                is_principal_offense: true,
                offense_type: "",
                offense_name: data.data.crime_type || "",
                stage_of_felony: data.data.stage_of_felony || "",
                index_type: data.data.index_type || "Non-Index",
                investigator_on_case: "",
                most_investigator: "",
              },
            ];
        setOffenses(normalizedOffenses);
        setTypeOfPlace(data.data.type_of_place || "");

        // Load per-offense modus
        const newOffenseModus = {};
        const newOffenseSelectedModus = {};
        const crimeType = OFFENSE_TO_CRIME_TYPE[data.data.crime_type];
        if (crimeType) {
          try {
            const modusRes = await fetch(
              `${import.meta.env.VITE_API_URL}/blotters/modus/${encodeURIComponent(crimeType)}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              },
            );
            const modusData = await modusRes.json();
            if (modusData.success) {
              newOffenseModus[0] = modusData.data;
              newOffenseSelectedModus[0] = data.data.modus_reference_id
                ? [data.data.modus_reference_id]
                : [];
            }
          } catch (e) {
            console.error(e);
          }
        } else {
          newOffenseModus[0] = [];
          newOffenseSelectedModus[0] = [];
        }
        setOffenseModus(newOffenseModus);
        setOffenseSelectedModus(newOffenseSelectedModus);
        const isCustomBarangay = false;
        const rawBrgy = data.data.place_barangay || "";
        const resolvedBrgy =
          BARANGAY_MIGRATION_MAP[rawBrgy.toUpperCase()] || rawBrgy;

        setCaseDetail({
          incident_type: data.data.crime_type,
          date_time_commission: data.data.date_time_commission || "",
          date_time_reported: data.data.date_time_reported || "",
          place_region: "Region IV-A (CALABARZON)",
          place_district_province: "Cavite",
          place_city_municipality: "Bacoor City",
          place_barangay: resolvedBrgy,
          place_barangay_other: "",
          report_number: data.data.report_number || "",
          lat: data.data.lat != null ? String(data.data.lat) : "",
          lng: data.data.lng != null ? String(data.data.lng) : "",
        });
        if (resolvedBrgy && barangayGeoJSON) {
          const feature = barangayGeoJSON.features.find(
            (f) => f.properties.name_db === resolvedBrgy,
          );
          setSelectedBrgyFeature(feature || null);
        }
        setViewMode(true);
        setEditMode(false);
        setEditingBlotterId(blotterId);
        setShowModal(true);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to load blotter data");
    } finally {
      setFetchingView(false);
    }
  };
  
  const handleApiResponse = (response) => {
    if (response.status === 401) {
      alert("Your session has expired. Please log in again.");
      localStorage.removeItem("token");
      window.location.href = "/login";
      return null;
    }
    return response;
  };

  const handleDelete = (blotterId) => {
    showConfirm(
      "delete",
      blotterId,
      "Are you sure you want to delete this report entry? This will move it to Deleted Records.",
    );
  };

  const handleFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const clearFilters = () => {
    const empty = {
      search: "",
      status: "",
      incident_type: "",
      date_from: "",
      date_to: "",
      barangay: "",
      data_source: "",
    };
    setFilters(empty);
    fetchBlotters(activeReportTab, false, empty);
  };

  
  const validateCurrentStep = (currentOffenses = offensesRef.current) => {
    const errors = {};

    

    
      // Incident Type
      if (!caseDetail.incident_type || caseDetail.incident_type === "") {
        errors.incident_type = "Required";
      }

      // Date & Time of Commission
      if (!caseDetail.date_time_commission) {
        errors.date_time_commission = "Required";
      } else {
        const commission = new Date(caseDetail.date_time_commission);
        const now = new Date();

        if (commission > now) {
          errors.date_time_commission = "Cannot be future date";
        }

        if (caseDetail.date_time_reported) {
          const reported = new Date(caseDetail.date_time_reported);
          if (commission > reported) {
            errors.date_time_commission = "Must be before report date";
          }
        }
      }

      // Date & Time Reported
      if (!caseDetail.date_time_reported) {
        errors.date_time_reported = "Required";
      } else {
        const reported = new Date(caseDetail.date_time_reported);
        const now = new Date();

        if (reported > now) {
          errors.date_time_reported = "Cannot be future date";
        }

        if (caseDetail.date_time_commission) {
          const commission = new Date(caseDetail.date_time_commission);
          if (reported < commission) {
            errors.date_time_reported = "Cannot be before commission";
          }
        }
      }

      // Place - Region
      if (!caseDetail.place_region || caseDetail.place_region === "") {
        errors.place_region = "Required";
      }

      // District/Province
      if (
        !caseDetail.place_district_province ||
        caseDetail.place_district_province.trim().length === 0
      ) {
        errors.place_district_province = "Required";
      } else if (caseDetail.place_district_province.trim().length < 3) {
        errors.place_district_province = "At least 3 characters";
      } else if (caseDetail.place_district_province.trim().length > 100) {
        errors.place_district_province = "Maximum 100 characters";
      }

      // City/Municipality
      if (
        !caseDetail.place_city_municipality ||
        caseDetail.place_city_municipality.trim().length === 0
      ) {
        errors.place_city_municipality = "Required";
      } else if (caseDetail.place_city_municipality.trim().length < 3) {
        errors.place_city_municipality = "At least 3 characters";
      } else if (caseDetail.place_city_municipality.trim().length > 100) {
        errors.place_city_municipality = "Maximum 100 characters";
      }

      // Barangay
      if (
        !caseDetail.place_barangay ||
        caseDetail.place_barangay.trim().length === 0
      ) {
        errors.place_barangay = "Required";
      } else if (
        caseDetail.place_barangay === "Other" &&
        (!caseDetail.place_barangay_other ||
          caseDetail.place_barangay_other.trim().length === 0)
      ) {
        errors.place_barangay_other = "Please specify location";
      }

      if (!caseDetail.lat || !caseDetail.lng) {
        errors.pin_location =
          "Please drop a pin on the map to mark the exact location";
      }

      // Offense validations (merged into case detail)
      // Offense validations (merged into case detail)
      if (!typeOfPlace || typeOfPlace === "") {
        errors.type_of_place = "Type of Place is required";
      }
      const hasModus = offenseModus[0] && offenseModus[0].length > 0;
      // const noOffense =
      //   !offenses[0] ||
      //   !offenses[0].offense_name ||
      //   offenses[0].offense_name === "";
      // if (noOffense) {
      //   errors.modus = "Please select an Incident Type first";
      // } else if (
      //   hasModus &&
      //   (!offenseSelectedModus[0] || offenseSelectedModus[0].length === 0)
      // ) {
      //   errors.modus = "At least one modus is required";
      // }
    

    return errors;
  };
  const showWarningToast = (message) => {
    const toast = document.createElement("div");
    toast.className = "eb-toast-success";
    toast.textContent = message;
    toast.style.borderLeftColor = "#f59e0b";
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  const mapBackendErrorsToFields = (errors, message) => {
  const mapped = {};
  const all = errors && errors.length ? errors : message ? [message] : [];

  all.forEach((msg) => {
    const m = msg.toLowerCase();
    if (m.includes("crime type")) mapped.incident_type = msg;
    else if (m.includes("commission")) mapped.date_time_commission = msg;
    else if (m.includes("reported") && m.includes("date")) mapped.date_time_reported = msg;
    else if (m.includes("barangay")) mapped.place_barangay = msg;
    else if (m.includes("report number")) mapped.report_number = msg;
    else mapped.general = msg; // fallback bucket
  });

  return mapped;
};


  const addOffense = () => {
    const newIndex = offenses.length;
    setOffenses([
      ...offenses,
      {
        is_principal_offense: false,
        offense_type: "",
        offense_name: "",
        stage_of_felony: "",
        index_type: "Non-Index",
        investigator_on_case: "",
        most_investigator: "",
        // NO modus field
      },
    ]);
    setOffenseModus((prev) => ({ ...prev, [newIndex]: [] }));
    setOffenseSelectedModus((prev) => ({ ...prev, [newIndex]: [] }));
  };

  const removeOffense = (i) => {
    if (offenses.length > 1) {
      setOffenses(offenses.filter((_, idx) => idx !== i));
      // Re-index modus state
      const newModus = {},
        newSelected = {};
      offenses.forEach((_, idx) => {
        if (idx !== i) {
          const newIdx = idx > i ? idx - 1 : idx;
          newModus[newIdx] = offenseModus[idx] || [];
          newSelected[newIdx] = offenseSelectedModus[idx] || [];
        }
      });
      setOffenseModus(newModus);
      setOffenseSelectedModus(newSelected);
    }
  };

  const updateOffense = (i, field, value) => {
    setOffenses((prev) => {
      const updated = [...prev];
      if (!updated[i]) return prev;
      updated[i] = { ...updated[i], [field]: value };
      return updated;
    });
  };

  const updateCaseDetail = (field, value) =>
    setCaseDetail((prev) => ({ ...prev, [field]: value }));
  const resetForm = () => {
    

    setOffenses([
      {
        is_principal_offense: true,
        offense_type: "",
        offense_name: "",
        stage_of_felony: "",
        index_type: "Non-Index",
        investigator_on_case: "",
        most_investigator: "",
      },
    ]);
    setOffenseModus({});
    setOffenseSelectedModus({});
    setTypeOfPlace("");

    setCaseDetail({
      incident_type: "",
      date_time_commission: "",
      date_time_reported: "",
      place_region: "Region IV-A (CALABARZON)",
      place_district_province: "Cavite",
      place_city_municipality: "Bacoor City",
      place_barangay: "",
      place_barangay_other: "",
      lat: "",
      lng: "",
    });
    setSelectedBrgyFeature(null);
  };
  const handleModalClose = () => {
    if (editMode && originalData) {
      // Deep comparison for actual changes
      const hasChanges =
  JSON.stringify(offenses) !== JSON.stringify(originalData.offenses) ||
  caseDetail.incident_type !== originalData.caseDetail.incident_type ||
  caseDetail.date_time_commission !==
    originalData.caseDetail.date_time_commission ||
  caseDetail.date_time_reported !==
    originalData.caseDetail.date_time_reported ||
  caseDetail.place_barangay !== originalData.caseDetail.place_barangay ||
  caseDetail.place_barangay_other !==
    originalData.caseDetail.place_barangay_other;

      if (hasChanges) {
        setShowConfirmClose(true);
        return;
      } else {
        closeModal();
        return;
      }
    }

    if (viewMode) {
      closeModal();
      return;
    }

    const hasData =
      (caseDetail.incident_type && caseDetail.incident_type !== "Theft") ||
      caseDetail.date_time_commission ||
      caseDetail.place_barangay ||
      offenses.some(
        (o) =>
          (o.offense_type && o.offense_type !== "PROPERTY") ||
          (o.offense_name && o.offense_name !== "ESTAFA") ||
          (o.stage_of_felony && o.stage_of_felony !== "COMPLETED") ||
          o.investigator_on_case ||
          o.most_investigator,
      );

    if (hasData) {
      setShowConfirmClose(true);
    } else {
      closeModal();
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setShowConfirmClose(false);
    setFieldErrors({});
    setEditMode(false);
    setViewMode(false);
    setFetchingEdit(false);
    setFetchingView(false);
    setEditingBlotterId(null);
    setOriginalData(null);
    resetForm();

    setSelectedBrgyFeature(null);
    
  };

  const cancelClose = () => {
    setShowConfirmClose(false);
  };

  const handleSubmit = async () => {
    // Validate Step 3 before submitting
    const errors = validateCurrentStep(offenses);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTimeout(() => {
        const firstError = document.querySelector(
          ".eb-modal-input.error, .eb-gender-buttons + .eb-field-error, .eb-pin-location-error",
        );
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return;
    }

    try {
      setIsSubmitting(true);

     

      // NORMAL EDIT/CREATE MODE
      const finalCaseDetail = { ...caseDetail };
      if (
        finalCaseDetail.place_barangay === "Other" &&
        finalCaseDetail.place_barangay_other
      ) {
        finalCaseDetail.place_barangay = finalCaseDetail.place_barangay_other;
      }
      delete finalCaseDetail.place_barangay_other;

      finalCaseDetail.lat = caseDetail.lat ? parseFloat(caseDetail.lat) : null;
      finalCaseDetail.lng = caseDetail.lng ? parseFloat(caseDetail.lng) : null;

      finalCaseDetail.type_of_place = typeOfPlace;

      // crime_reports_v2 field renames
      finalCaseDetail.crime_type = finalCaseDetail.incident_type;
      delete finalCaseDetail.incident_type;
      finalCaseDetail.stage_of_felony = offenses[0]?.stage_of_felony || "";
      finalCaseDetail.index_type = offenses[0]?.index_type || "Non-Index";
      finalCaseDetail.modus_reference_id =
        offenseSelectedModus[0]?.[0] ?? null;

      const offensesWithModus = offenses.map((o, i) => ({
        ...o,
        modus_reference_id: offenseSelectedModus[i]?.[0] ?? null,
      }));

      

      const payload = {
  ...finalCaseDetail,
  offenses: offensesWithModus,
};

      const url = editMode ? `${API_URL}/${editingBlotterId}` : API_URL;
      const method = editMode ? "PUT" : "POST";

      const rawResponse = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });
      const response = handleApiResponse(rawResponse);
      if (!response) return;
      const data = await response.json();
      if (data.success) {
        const targetBlotterId = editMode
          ? editingBlotterId
          : data.data?.blotter_id;
        
        const message = editMode
          ? "Report updated successfully!"
          : `Report created successfully!`;
        showReactToast(message);
        setOriginalData(null);
        closeModal();
        fetchBlotters();
      } else {
        const mapped = mapBackendErrorsToFields(data.errors, data.message || data.error);
        setFieldErrors((prev) => ({ ...prev, ...mapped }));
        setTimeout(() => {
          const firstError = document.querySelector(".eb-modal-input.error");
          if (firstError) {
            firstError.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    // Strip Z/timezone so it's treated as local time, not UTC
    const cleaned = String(dateString)
      .replace("Z", "")
      .replace(/\+\d{2}:\d{2}$/, "");
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) return String(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
  };

  const getStatusClass = (status) => {
    const map = {
      Pending: "eb-status-pending",
      "Under Investigation": "eb-status-investigating",
      Resolved: "eb-status-resolved",
      Solved: "eb-status-resolved",
      Cleared: "eb-status-cleared",
      "Referred to Case": "eb-status-pending",
      Urgent: "eb-status-urgent",
    };
    return map[status] || "eb-status-pending";
  };
  const isPinOutsideBoundary = () => {
    if (!caseDetail.lat || !caseDetail.lng || !selectedBrgyFeature)
      return false;
    const lat = parseFloat(caseDetail.lat);
    const lng = parseFloat(caseDetail.lng);
    const rings =
      selectedBrgyFeature.geometry.type === "Polygon"
        ? selectedBrgyFeature.geometry.coordinates
        : selectedBrgyFeature.geometry.coordinates.flat(1);
    let inside = false;
    for (const ring of rings) {
      const n = ring.length;
      let j = n - 1;
      for (let i = 0; i < n; i++) {
        const xi = ring[i][0],
          yi = ring[i][1];
        const xj = ring[j][0],
          yj = ring[j][1];
        const intersect =
          yi > lat !== yj > lat &&
          lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
        j = i;
      }
    }
    return !inside;
  };
  const totalDeletedPages = Math.ceil(
    deletedBlotters.length / DELETED_PER_PAGE,
  );
  const paginatedDeleted = deletedBlotters.slice(
    (deletedPage - 1) * DELETED_PER_PAGE,
    deletedPage * DELETED_PER_PAGE,
  );
  const totalPages = Math.ceil(blotters.length / ITEMS_PER_PAGE);
  const paginatedBlotters = blotters.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  

  

  return (
    <div className="eb-content-area">
      <LoadingModal isOpen={isExportLoading} message="Preparing export..." />

      {pendingExport && (
        <div
          className="eb-modal"
          style={{ zIndex: 10002, alignItems: "center" }}
        >
          <div
            className="eb-modal-content"
            style={{ maxWidth: 400, padding: 24 }}
          >
            <h3>Confirm Export</h3>
            <p>
              You are about to export <b>{pendingExport.records.length}</b>{" "}
              record(s) as PDF.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                className="eb-btn eb-btn-secondary"
                onClick={() => setPendingExport(null)}
              >
                Cancel
              </button>
              <button className="eb-btn eb-btn-primary" onClick={confirmExport}>
                Export
              </button>
            </div>
          </div>
        </div>
      )}
      {showExportModal && (
        <ExportBlotterModal
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          isExporting={isExportLoading}
        />
      )}
      {pdfPreview && (
        <PdfPreviewModal
          blobUrl={pdfPreview.blobUrl}
          onDownload={() => {
            pdfPreview.download();
          }}
          onClose={() => {
            pdfPreview.revoke();
            setPdfPreview(null);
          }}
        />
      )}
      <LoadingModal isOpen={loading} message="Loading records..." />
      <LoadingModal isOpen={fetchingEdit} message="Loading blotter data..." />
      <LoadingModal isOpen={fetchingView} message="Loading blotter data..." />
      <LoadingModal isOpen={actionLoading} message={actionMessage} />
      <LoadingModal
        isOpen={isSubmitting}
        message={editMode ? "Updating report..." : "Submitting report..."}
      />
      <div className="eb-page-header">
        <div className="eb-page-header-left">
          <h1>Reporting Records</h1>
          <p>Digital incident and reporting system</p>
        </div>
        <div className="eb-page-header-right">
          <button
            className="eb-btn eb-btn-deleted"
            onClick={() => {
              setShowTrash(true);
              setDeletedPage(1);
              fetchDeletedBlotters();
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: "8px", verticalAlign: "middle" }}
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Deleted Records
          </button>
          <button
            className="eb-btn eb-btn-secondary"
            onClick={() => setShowExportModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>

          {SHOW_IMPORT_BUTTON && (
            <button
              className="eb-btn eb-btn-secondary"
              onClick={() => setShowImport(true)}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import
            </button>
          )}
          <button
            className="eb-btn eb-btn-primary"
            onClick={() => setShowModal(true)}
          >
            + New Report
          </button>
        </div>
      </div>

      {showModal && (
        <div className="eb-modal">
          <div className="eb-modal-content">
            <div className="eb-modal-header">
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
                    {viewMode ? (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : editMode ? (
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
                    {viewMode
                      ? "View Crime Report"
                      : editMode
                        ? "Edit Crime Report"
                        : "New Crime Report"}
                  </h2>
                  {editingBlotterId && (viewMode || editMode) && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "6px",
                        padding: "2px 8px",
                        marginTop: "4px",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.85)",
                        letterSpacing: "0.5px",
                      }}
                    >
                          #{" "}
    {caseDetail.report_number || editingBlotterId}
                    </span>
                  )}
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.6)",
                      marginTop: "3px",
                    }}
                  >
                    {viewMode
                      ? "Read-only view of incident record"
                      : editMode
                        ? "Modify existing blotter entry details"
                        : "Record a new incident report entry"}
                  </p>
                </div>
              </div>
              <span className="eb-modal-close" onClick={handleModalClose}>
                &times;
              </span>
            </div>

            {viewMode ? (
              // ========== VIEW MODE - READ ONLY DISPLAY ==========
              <div className="eb-view-content">
                

                {/* Case Details */}
                <div className="eb-view-section">
                  <h3 className="eb-view-section-title">Case Details</h3>
                  <div className="eb-view-section-body">
                    <div className="eb-view-card">
                      <div className="eb-view-grid">
                        {/* ROW 1: Crime Type, Index Type, Modus Operandi */}
                        <div className="eb-view-item">
                          <span className="eb-view-label">Crime Type:</span>
                          <span className="eb-view-value">
                            {caseDetail.incident_type}
                          </span>
                        </div>
                        <div className="eb-view-item">
                          <span className="eb-view-label">Report Number:</span>
                          <span className="eb-view-value">
                            {caseDetail.report_number || "—"}
                          </span>
                        </div>
                        <div className="eb-view-item">
                          <span className="eb-view-label">Modus Operandi:</span>
                          <span className="eb-view-value">
                            {(() => {
                              const ids = offenseSelectedModus[0] || [];
                              const names = (offenseModus[0] || [])
                                .filter((m) => ids.includes(m.id))
                                .map((m) => m.modus_name);
                              if (names.length > 0) return names.join(", ");
                              if (caseDetail.modus) return caseDetail.modus;
                              return "—";
                            })()}
                          </span>
                        </div>

                        {/* ROW 2: Stage of Felony, Date Commission, Date Reported */}
                        <div className="eb-view-item">
                          <span className="eb-view-label">
                            Stage of Felony:
                          </span>
                          <span className="eb-view-value">
                            {offenses[0]?.stage_of_felony || "—"}
                          </span>
                        </div>
                        <div className="eb-view-item">
                          <span className="eb-view-label">
                            Date & Time of Commission:
                          </span>
                          <span className="eb-view-value">
                            {formatDate(caseDetail.date_time_commission)}
                          </span>
                        </div>
                        <div className="eb-view-item">
                          <span className="eb-view-label">
                            Date & Time Reported:
                          </span>
                          <span className="eb-view-value">
                            {formatDate(caseDetail.date_time_reported)}
                          </span>
                        </div>

                        {/* ROW 4: Place of Commission (2-col) + Type of Place */}
                        <div
                          className="eb-view-item"
                          style={{ gridColumn: "span 2" }}
                        >
                          <span className="eb-view-label">
                            Place of Commission:
                          </span>
                          <span className="eb-view-value">{`${caseDetail.place_barangay === "Other" && caseDetail.place_barangay_other ? caseDetail.place_barangay_other : caseDetail.place_barangay}, ${caseDetail.place_city_municipality}, ${caseDetail.place_district_province}, ${caseDetail.place_region}`}</span>
                        </div>
                        <div className="eb-view-item">
                          <span className="eb-view-label">Type of Place:</span>
                          <span className="eb-view-value">
                            {typeOfPlace || "—"}
                          </span>
                        </div>

                        <div className="eb-view-item">
                          <span className="eb-view-label">Coordinates:</span>
                          <span className="eb-view-value">
                            {caseDetail.lat && caseDetail.lng
                              ? `${caseDetail.lat}, ${caseDetail.lng}`
                              : "—"}
                          </span>
                        </div>
                        {/* ROW 6: Map full width */}
                        {caseDetail.lat && caseDetail.lng && (
                          <div className="eb-view-item eb-view-full">
                            <span className="eb-view-label">Pin Location:</span>
                            <div
                              style={{
                                height: "250px",
                                borderRadius: "8px",
                                overflow: "hidden",
                                marginTop: "6px",
                                border: "1px solid #e5e7eb",
                              }}
                            >
                              <Map
                                mapboxAccessToken={
                                  import.meta.env.VITE_MAPBOX_TOKEN
                                }
                                initialViewState={{
                                  longitude: parseFloat(caseDetail.lng),
                                  latitude: parseFloat(caseDetail.lat),
                                  zoom: 15,
                                }}
                                style={{ width: "100%", height: "100%" }}
                                mapStyle="mapbox://styles/mapbox/streets-v12"
                                interactive={false}
                              >
                                <Marker
                                  longitude={parseFloat(caseDetail.lng)}
                                  latitude={parseFloat(caseDetail.lat)}
                                  anchor="bottom"
                                >
                                  <div
                                    style={{
                                      width: "20px",
                                      height: "20px",
                                      borderRadius: "50% 50% 50% 0",
                                      background: "#c1272d",
                                      border: "2px solid white",
                                      transform: "rotate(-45deg)",
                                      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                                    }}
                                  />
                                </Marker>
                              </Map>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                
              </div>
            ) : (
              // ========== EDIT/CREATE MODE - ORIGINAL FORM ==========
              <>


                

                
                  <div className="eb-step-content">
                    <h3 className="eb-section-title">Case Detail</h3>
                    <div className="eb-modal-form-grid">
                      {/* ── ROW 1: OFFENSE CLASSIFICATION ── */}
                      <div className="eb-modal-form-group">
                        <label className="eb-modal-label">Crime Type *</label>
                        <select
                          className={`eb-modal-input ${fieldErrors.incident_type ? "error" : ""}`}
                          value={caseDetail.incident_type}
                          onChange={(e) => {
                            updateCaseDetail("incident_type", e.target.value);
                            updateOffense(0, "offense_name", e.target.value);
                            updateOffense(0, "index_type", "Index");
                            fetchModusForIncidentType(e.target.value);
                            if (e.target.value && fieldErrors.incident_type) {
                              const newErrors = { ...fieldErrors };
                              delete newErrors.incident_type;
                              setFieldErrors(newErrors);
                            }
                          }}
                        >
                          <option value="">Select Crime Type</option>
                          <option value="Carnapping - MC">
                            Carnapping - MC
                          </option>
                          <option value="Carnapping - MV">
                            Carnapping - MV
                          </option>
                          <option>Homicide</option>
                          <option>Murder</option>
                          <option>Physical Injury</option>
                          <option>Rape</option>
                          <option>Robbery</option>
                          <option>Special Complex Crime</option>
                          <option>Theft</option>
                        </select>
                        <FieldError error={fieldErrors.incident_type} />
                      </div>

                      <div className="eb-modal-form-group">
                        <label className="eb-modal-label">
                          Stage of Felony
                        </label>
                        <select
                          className="eb-modal-input"
                          value={offenses[0]?.stage_of_felony || ""}
                          onChange={(e) => {
                            updateOffense(0, "stage_of_felony", e.target.value);
                          }}
                        >
                          <option value="">Select Stage</option>
                          <option>CONSUMMATED</option>
                          <option>ATTEMPTED</option>
                          <option>FRUSTRATED</option>
                        </select>
                      </div>

                      <div className="eb-modal-form-group">
                        <label className="eb-modal-label">
                          Report Number (optional)
                        </label>
                        <input
                          type="text"
                          className={`eb-modal-input ${fieldErrors.report_number ? "error" : ""}`}
                          placeholder="Auto-generated if left blank"
                          value={caseDetail.report_number || ""}
                          maxLength="50"
                          onChange={(e) => {
                            updateCaseDetail("report_number", e.target.value);
                            if (fieldErrors.report_number) {
                              const n = { ...fieldErrors };
                              delete n.report_number;
                              setFieldErrors(n);
                            }
                          }}
                        />
                        <FieldError error={fieldErrors.report_number} />
                      </div>

                      <div className="eb-modal-form-group">
                        <label className="eb-modal-label">Modus Operandi</label>
                        {offenseModus[0] && offenseModus[0].length > 0 ? (
                          <>
                            <select
                              className={`eb-modal-input ${fieldErrors.modus ? "error" : ""}`}
                              value={String(offenseSelectedModus[0]?.[0] || "")}
                              onChange={(e) => {
                                const val = e.target.value;
                                setOffenseSelectedModus((prev) => ({
                                  ...prev,
                                  [0]: val ? [parseInt(val)] : [],
                                }));
                                if (fieldErrors.modus) {
                                  const n = { ...fieldErrors };
                                  delete n.modus;
                                  setFieldErrors(n);
                                }
                              }}
                            >
                              <option value="">Select Modus</option>
                              {offenseModus[0].map((m) => (
                                <option key={m.id} value={String(m.id)}>
                                  {m.modus_name}
                                </option>
                              ))}
                            </select>
                            <FieldError error={fieldErrors.modus} />
                          </>
                        ) : (
                          <input
                            type="text"
                            className="eb-modal-input"
                            value="Select Crime Type first"
                            disabled
                            style={{
                              background: "#f3f4f6",
                              cursor: "not-allowed",
                              color: "#9ca3af",
                            }}
                          />
                        )}
                      </div>

                      {/* ── ROW 2: CASE ADMIN ── */}
                      <div className="eb-modal-form-group">
                        <label className="eb-modal-label">
                          Date & Time of Commission *
                        </label>
                        <input
                          type="datetime-local"
                          className={`eb-modal-input ${fieldErrors.date_time_commission ? "error" : ""}`}
                          value={caseDetail.date_time_commission}
                          max={toLocalDateTimeString()}
                          onKeyDown={(e) => e.preventDefault()}
                          onChange={(e) => {
                            updateCaseDetail(
                              "date_time_commission",
                              e.target.value,
                            );
                            if (
                              e.target.value &&
                              fieldErrors.date_time_commission
                            ) {
                              const newErrors = { ...fieldErrors };
                              delete newErrors.date_time_commission;
                              setFieldErrors(newErrors);
                            }
                          }}
                        />
                        <FieldError error={fieldErrors.date_time_commission} />
                      </div>

                      <div className="eb-modal-form-group">
                        <label className="eb-modal-label">
                          Date & Time Reported *
                        </label>
                        <input
                          type="datetime-local"
                          className={`eb-modal-input ${fieldErrors.date_time_reported ? "error" : ""}`}
                          value={caseDetail.date_time_reported}
                          max={toLocalDateTimeString()}
                          onKeyDown={(e) => e.preventDefault()}
                          onChange={(e) => {
                            updateCaseDetail(
                              "date_time_reported",
                              e.target.value,
                            );
                            if (
                              e.target.value &&
                              fieldErrors.date_time_reported
                            ) {
                              const newErrors = { ...fieldErrors };
                              delete newErrors.date_time_reported;
                              setFieldErrors(newErrors);
                            }
                          }}
                        />
                        <FieldError error={fieldErrors.date_time_reported} />
                      </div>

                      <div className="eb-modal-form-group"></div>

                      {/* ── LOCATION DIVIDER ── */}
                      <div
                        className="eb-group-divider"
                        style={{ margin: "4px 0 8px 0" }}
                      >
                        Place of Commission
                      </div>

                      {/* ── ROW 3: LOCATION ── */}
                      <div className="eb-modal-form-group">
                        <label className="eb-modal-label">Region *</label>
                        <select
                          className="eb-modal-input"
                          value="040000000"
                          disabled
                          style={{
                            background: "#f3f4f6",
                            cursor: "not-allowed",
                            color: "#6b7280",
                          }}
                        >
                          <option value="040000000">CALABARZON</option>
                        </select>
                      </div>

                      <div className="eb-modal-form-group">
                        <label className="eb-modal-label">
                          District/Province *
                        </label>
                        <select
                          className="eb-modal-input"
                          value="042100000"
                          disabled
                          style={{
                            background: "#f3f4f6",
                            cursor: "not-allowed",
                            color: "#6b7280",
                          }}
                        >
                          <option value="042100000">Cavite</option>
                        </select>
                      </div>

                      <div className="eb-modal-form-group">
                        <label className="eb-modal-label">
                          City/Municipality *
                        </label>
                        <select
                          className="eb-modal-input"
                          value="042103000"
                          disabled
                          style={{
                            background: "#f3f4f6",
                            cursor: "not-allowed",
                            color: "#6b7280",
                          }}
                        >
                          <option value="042103000">City of Bacoor</option>
                        </select>
                      </div>

                      <div className="eb-modal-form-group">
                        <label className="eb-modal-label">Barangay *</label>
                        <select
                          className={`eb-modal-input ${fieldErrors.place_barangay ? "error" : ""}`}
                          value={caseDetail.place_barangay}
                          disabled={loadingBacoorBrgy}
                          onChange={(e) => {
                            const selectedName = e.target.value;
                            updateCaseDetail("place_barangay", selectedName);
                            updateCaseDetail("lat", "");
                            updateCaseDetail("lng", "");
                            updateCaseDetail("place_street", "");
                            setStreetSuggestions([]);
                            if (selectedName && fieldErrors.place_barangay) {
                              const newErrors = { ...fieldErrors };
                              delete newErrors.place_barangay;
                              setFieldErrors(newErrors);
                            }
                            if (selectedName && barangayGeoJSON) {
                              const feature = barangayGeoJSON.features.find(
                                (f) => f.properties.name_db === selectedName,
                              );
                              if (feature) {
                                setSelectedBrgyFeature(feature);
                                const { centroid_lat, centroid_lng } =
                                  feature.properties;
                                if (
                                  mapRef.current &&
                                  centroid_lat &&
                                  centroid_lng
                                ) {
                                  mapRef.current.flyTo({
                                    center: [
                                      parseFloat(centroid_lng),
                                      parseFloat(centroid_lat),
                                    ],
                                    zoom: 15,
                                    duration: 1000,
                                  });
                                }
                              } else {
                                setSelectedBrgyFeature(null);
                              }
                            } else {
                              setSelectedBrgyFeature(null);
                            }
                          }}
                        >
                          <option value="">
                            {loadingBacoorBrgy
                              ? "Loading..."
                              : "Select Barangay"}
                          </option>
                          {CURRENT_BARANGAYS.map((b) => (
                            <option key={b} value={b}>
                              {formatBarangayLabel(b)}
                            </option>
                          ))}
                          <optgroup label="── Pre-2023 Names (Auto-resolved) ──">
                            {LEGACY_BARANGAY_OPTIONS.map((b, idx) => (
                              <option key={`legacy-${idx}`} value={b.value}>
                                {b.label}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        <FieldError error={fieldErrors.place_barangay} />
                      </div>

                                            <div className="eb-modal-form-group">
                        <label className="eb-modal-label">
                          Type of Place *
                        </label>
                        <select
                          className={`eb-modal-input ${fieldErrors.type_of_place ? "error" : ""}`}
                          value={typeOfPlace}
                          onChange={(e) => {
                            setTypeOfPlace(e.target.value);
                            if (fieldErrors.type_of_place) {
                              const newErrors = { ...fieldErrors };
                              delete newErrors.type_of_place;
                              setFieldErrors(newErrors);
                            }
                          }}
                        >
                          <option value="">Select Type of Place</option>
                          <option>
                            Abandoned Structure (house, bldg, apartment/condo)
                          </option>
                          <option>Along the street</option>
                          <option>Commercial/Business Establishment</option>
                          <option>Construction/Industrial Barracks</option>
                          <option>Farm/Ricefield</option>
                          <option>Government Office/Establishment</option>
                          <option>Onboard a vehicle (riding in/on)</option>
                          <option>
                            Parking Area (vacant lot, in bldg/structure, open
                            parking)
                          </option>
                          <option>Recreational Place (resorts/parks)</option>
                          <option>Residential (house/condo)</option>
                          <option>River/Lake</option>
                          <option>
                            School (Grade/High School/College/University)
                          </option>
                          <option>
                            Transportation Terminals (Tricycle, Jeep, FX, Bus,
                            Train Station)
                          </option>
                          <option>
                            Vacant Lot (unused/unoccupied open area)
                          </option>
                        </select>
                        <FieldError error={fieldErrors.type_of_place} />
                      </div>

                      {/* ── ROW 6: MAP ── */}
                      <div
                        className="eb-modal-form-group"
                        style={{ gridColumn: "span 4" }}
                      >
                        <div
                          style={{
                            background:
                              "linear-gradient(135deg, var(--navy-dark), var(--navy-primary))",
                            padding: "10px 16px",
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "12px",
                          }}
                        >
                          <span
                            style={{
                              color: "white",
                              fontWeight: 700,
                              fontSize: "12px",
                              textTransform: "uppercase",
                              letterSpacing: "0.8px",
                            }}
                          >
                            Crime Location Pin
                          </span>
                          <span
                            style={{
                              color: "rgba(255,255,255,0.6)",
                              fontSize: "11px",
                            }}
                          >
                            {caseDetail.place_barangay
                              ? `Restricted to ${caseDetail.place_barangay} boundary`
                              : "Select a barangay first"}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            marginBottom: "10px",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <label
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                display: "block",
                                marginBottom: "3px",
                              }}
                            >
                              Latitude
                            </label>
                            <input
                              type="text"
                              className="eb-modal-input"
                              placeholder="Set by clicking the map"
                              value={caseDetail.lat}
                              disabled
                              style={{
                                background: "#f3f4f6",
                                cursor: "not-allowed",
                                color: "#6b7280",
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                display: "block",
                                marginBottom: "3px",
                              }}
                            >
                              Longitude
                            </label>
                            <input
                              type="text"
                              className="eb-modal-input"
                              placeholder="Set by clicking the map"
                              value={caseDetail.lng}
                              disabled
                              style={{
                                background: "#f3f4f6",
                                cursor: "not-allowed",
                                color: "#6b7280",
                              }}
                            />
                          </div>
                          {(caseDetail.lat || caseDetail.lng) && (
                            <button
                              type="button"
                              style={{
                                alignSelf: "flex-end",
                                padding: "8px 14px",
                                background: "#fee2e2",
                                color: "#dc2626",
                                border: "1px solid #fca5a5",
                                borderRadius: "6px",
                                fontSize: "12px",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                              onClick={() => {
                                updateCaseDetail("lat", "");
                                updateCaseDetail("lng", "");
                              }}
                            >
                              Clear Pin
                            </button>
                          )}
                        </div>

                        <div
                          style={{
                            position: "relative",
                            height: "600px",
                            borderRadius: "8px",
                            overflow: "hidden",
                            border: "1px solid #d1d5db",
                          }}
                        >
                          {!caseDetail.place_barangay && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                zIndex: 10,
                                background: "rgba(243,244,246,0.85)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "10px",
                                pointerEvents: "all",
                                cursor: "not-allowed",
                                borderRadius: "8px",
                              }}
                            >
                              <div
                                style={{
                                  width: "48px",
                                  height: "48px",
                                  borderRadius: "50%",
                                  background: "#e5e7eb",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="22"
                                  height="22"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#9ca3af"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                              </div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#6b7280",
                                }}
                              >
                                Select a barangay to enable the map
                              </p>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "12px",
                                  color: "#9ca3af",
                                }}
                              >
                                The pin will be restricted to the selected
                                barangay boundary
                              </p>
                            </div>
                          )}

                          <Map
                            ref={mapRef}
                            mapboxAccessToken={
                              import.meta.env.VITE_MAPBOX_TOKEN
                            }
                            key={`map-${editingBlotterId || "new"}`}
                            initialViewState={{
                              longitude: caseDetail.lng
                                ? parseFloat(caseDetail.lng)
                                : 120.964,
                              latitude: caseDetail.lat
                                ? parseFloat(caseDetail.lat)
                                : 14.4341,
                              zoom: caseDetail.lat ? 15 : 12,
                            }}
                            style={{ width: "100%", height: "100%" }}
                            mapStyle="mapbox://styles/mapbox/streets-v12"
                            onClick={(e) => {
                              if (viewMode || !caseDetail.place_barangay)
                                return;
                              const { lng, lat } = e.lngLat;
                              if (selectedBrgyFeature) {
                                const rings =
                                  selectedBrgyFeature.geometry.type ===
                                  "Polygon"
                                    ? selectedBrgyFeature.geometry.coordinates
                                    : selectedBrgyFeature.geometry.coordinates.flat(
                                        1,
                                      );
                                let inside = false;
                                for (const ring of rings) {
                                  const n = ring.length;
                                  let j = n - 1;
                                  for (let i = 0; i < n; i++) {
                                    const xi = ring[i][0],
                                      yi = ring[i][1];
                                    const xj = ring[j][0],
                                      yj = ring[j][1];
                                    const intersect =
                                      yi > lat !== yj > lat &&
                                      lng <
                                        ((xj - xi) * (lat - yi)) / (yj - yi) +
                                          xi;
                                    if (intersect) inside = !inside;
                                    j = i;
                                  }
                                }
                                if (!inside) {
                                  showWarningToast(
                                    `Pin must be placed inside ${caseDetail.place_barangay}`,
                                  );
                                  return;
                                }
                              }
                              updateCaseDetail("lat", lat.toFixed(6));
                              updateCaseDetail("lng", lng.toFixed(6));
                              if (fieldErrors.pin_location) {
                                const newErrors = { ...fieldErrors };
                                delete newErrors.pin_location;
                                setFieldErrors(newErrors);
                              }

                              // Reverse geocode → auto-fill street field
                              fetch(
                                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng.toFixed(6)},${lat.toFixed(6)}.json?access_token=${
                                  import.meta.env.VITE_MAPBOX_TOKEN
                                }&country=PH&types=address,poi&language=en&limit=1`,
                              )
                                .then((r) => r.json())
                                .then((data) => {
                                  if (
                                    data.features &&
                                    data.features.length > 0
                                  ) {
                                    const street =
                                      data.features[0].place_text ||
                                      data.features[0].place_name.split(",")[0];
                                    if (street) {
                                      updateCaseDetail("place_street", street);
                                      setFieldErrors((prev) => {
                                        const n = { ...prev };
                                        delete n.place_street;
                                        return n;
                                      });
                                    }
                                  }
                                })
                                .catch((err) =>
                                  console.error("Reverse geocode error:", err),
                                );
                            }}
                            cursor={
                              !caseDetail.place_barangay || viewMode
                                ? "default"
                                : "crosshair"
                            }
                          >
                            {selectedBrgyFeature && (
                              <Source
                                id="brgy-boundary"
                                type="geojson"
                                data={selectedBrgyFeature}
                              >
                                <Layer
                                  id="brgy-fill"
                                  type="fill"
                                  paint={{
                                    "fill-color": "#1e3a5f",
                                    "fill-opacity": 0.08,
                                  }}
                                />
                                <Layer
                                  id="brgy-outline"
                                  type="line"
                                  paint={{
                                    "line-color": "#1e3a5f",
                                    "line-width": 2.5,
                                    "line-dasharray": [2, 1],
                                  }}
                                />
                              </Source>
                            )}
                            {caseDetail.lat && caseDetail.lng && (
                              <Marker
                                longitude={parseFloat(caseDetail.lng)}
                                latitude={parseFloat(caseDetail.lat)}
                                anchor="bottom"
                              >
                                <div
                                  style={{
                                    width: "26px",
                                    height: "26px",
                                    borderRadius: "50% 50% 50% 0",
                                    background: (() => {
                                      const colors = {
                                        Murder: "#7c3aed",
                                        Homicide: "#8b5cf6",
                                        Rape: "#ec4899",
                                        Robbery: "#ef4444",
                                        Theft: "#f97316",
                                        "Physical Injury": "#eab308",
                                        "Carnapping - MC": "#3b82f6",
                                        "Carnapping - MV": "#0ea5e9",
                                        "Special Complex Crime": "#14b8a6",
                                      };
                                      return (
                                        colors[caseDetail.incident_type] ||
                                        "#c1272d"
                                      );
                                    })(),
                                    border: "2px solid white",
                                    transform: "rotate(-45deg)",
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                                  }}
                                />
                              </Marker>
                            )}
                          </Map>
                        </div>

                        <small
                          style={{
                            color: "#6b7280",
                            fontSize: "11px",
                            display: "block",
                            marginTop: "5px",
                          }}
                        >
                          {caseDetail.place_barangay
                            ? `Pinning inside ${caseDetail.place_barangay}. Click the map to drop a pin.`
                            : "Select a barangay above to activate the map."}
                        </small>
                        {fieldErrors.pin_location && (
                          <span
                            className="eb-field-error eb-pin-location-error"
                            style={{ marginTop: "6px", display: "block" }}
                          >
                            {fieldErrors.pin_location}
                          </span>
                        )}
                        {caseDetail.lat &&
                          caseDetail.lng &&
                          isPinOutsideBoundary() && (
                            <div
                              style={{
                                marginTop: "8px",
                                padding: "10px 14px",
                                background: "#fef3c7",
                                border: "1px solid #f59e0b",
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "8px",
                              }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#d97706"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ flexShrink: 0, marginTop: "1px" }}
                              >
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                              <div>
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    color: "#92400e",
                                  }}
                                >
                                  Pin Location Warning
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#b45309",
                                    marginTop: "2px",
                                  }}
                                >
                                  The pinned location appears to be outside the
                                  selected barangay boundary (
                                  {caseDetail.place_barangay}). This may be due
                                  to an imported record with inaccurate
                                  coordinates. Please verify and re-pin on the
                                  map if needed.
                                </div>
                              </div>
                            </div>
                          )}
                      </div>

                      {caseDetail.place_barangay === "Other" && (
                        <div
                          className="eb-modal-form-group"
                          style={{ gridColumn: "span 4" }}
                        >
                          <label className="eb-modal-label">
                            Specify Location *
                          </label>
                          <input
                            type="text"
                            className={`eb-modal-input ${fieldErrors.place_barangay_other ? "error" : ""}`}
                            placeholder="e.g., Highway, Open Area"
                            value={caseDetail.place_barangay_other || ""}
                            maxLength="100"
                            onChange={(e) => {
                              updateCaseDetail(
                                "place_barangay_other",
                                e.target.value,
                              );
                              if (
                                e.target.value.trim().length > 0 &&
                                fieldErrors.place_barangay_other
                              ) {
                                const newErrors = { ...fieldErrors };
                                delete newErrors.place_barangay_other;
                                setFieldErrors(newErrors);
                              }
                            }}
                          />
                          <FieldError
                            error={fieldErrors.place_barangay_other}
                          />
                        </div>
                      )}
                    </div>
                    
                    
                  </div>
                

                <div className="eb-modal-footer">
                  {!viewMode && (
                    <button
                      type="button"
                      className="eb-btn eb-btn-primary"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Submitting..."
                        : editMode
                          ? "Update Report Entry"
                          : "Submit Report Entry"}
                    </button>
                  )}
                  {viewMode && (
                    <button
                      type="button"
                      className="eb-btn eb-btn-secondary"
                      onClick={closeModal}
                    >
                      Close
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showTrash && (
        <div
          className="eb-modal"
          style={{ zIndex: 10001, alignItems: "flex-start" }}
        >
          <div
            className="eb-modal-content"
            style={{
              maxWidth: "95vw",
              width: "95vw",
              margin: "20px auto",
              maxHeight: "95vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 32px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background:
                  "linear-gradient(135deg, var(--navy-dark) 0%, var(--navy-primary) 100%)",
                borderBottom: "3px solid var(--red-primary)",
                borderRadius: "8px 8px 0 0",
                flexShrink: 0,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
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
                  }}
                >
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
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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
                    Deleted Records
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.7)",
                      marginTop: "2px",
                    }}
                  >
                    Soft-deleted report entries — restore to recover
                  </p>
                </div>
              </div>
              <span
                onClick={() => setShowTrash(false)}
                style={{
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

            {/* Modal Body */}
            <div
              style={{
                padding: "28px 32px",
                background: "var(--gray-50)",
                minHeight: "200px",
                flex: 1,
                overflowY: "auto",
              }}
            >
              {trashLoading ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <div style={{ color: "var(--gray-400)", fontSize: "14px" }}>
                    Loading deleted records...
                  </div>
                </div>
              ) : deletedBlotters.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: "var(--gray-100)",
                      margin: "0 auto 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--gray-400)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </div>
                  <p
                    style={{
                      color: "var(--gray-400)",
                      fontSize: "14px",
                      margin: 0,
                    }}
                  >
                    No deleted records found
                  </p>
                  <p
                    style={{
                      color: "var(--gray-300)",
                      fontSize: "12px",
                      marginTop: "4px",
                    }}
                  >
                    Deleted report entries will appear here
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    background: "white",
                    borderRadius: "8px",
                    border: "1px solid var(--gray-200)",
                    overflow: "hidden",
                  }}
                >
                  <table className="eb-data-table eb-table-reports">
                    <thead>
                      <tr style={{ background: "var(--gray-50)" }}>
                        <th>Report Number</th>
                        <th>Crime Type</th>
                        <th>Location</th>
                        <th>Date of Incident</th>
                        <th>Date Deleted</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDeleted.map((b) => (
                        <tr key={b.report_id}>
                          <td>
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontWeight: 600,
                                color: "var(--navy-primary)",
                                fontSize: "13px",
                              }}
                            >
                              {b.report_number}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: "14px",
                                color: "#374151",
                                fontWeight: 500,
                              }}
                            >
                              {b.crime_type}
                            </span>
                          </td>
                          <td
                            style={{
                              color: "var(--gray-600)",
                              fontSize: "13px",
                            }}
                          >
                            {`${b.place_barangay}`}
                          </td>
                          <td
                            style={{
                              color: "var(--gray-600)",
                              fontSize: "13px",
                            }}
                          >
                            {formatDate(b.date_time_reported)}
                          </td>
                          <td
                            style={{
                              color: "var(--gray-600)",
                              fontSize: "13px",
                            }}
                          >
                            {formatDate(b.deleted_at)}
                          </td>
                          <td>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleRestore(b.report_id);
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                color: "white",
                                background: "#16a34a",
                                border: "none",
                                borderRadius: "6px",
                                padding: "7px 14px",
                                fontWeight: 600,
                                fontSize: "13px",
                                cursor: "pointer",
                                fontFamily: "DM Sans, sans-serif",
                              }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                              </svg>
                              Restore
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 32px",
                borderTop: "1px solid var(--gray-200)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "white",
                borderRadius: "0 0 8px 8px",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--gray-400)" }}>
                {deletedBlotters.length} deleted{" "}
                {deletedBlotters.length === 1 ? "record" : "records"}
              </span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <button
                  className="eb-pagination-btn"
                  disabled={deletedPage === 1}
                  onClick={() => setDeletedPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--navy-primary)",
                    padding: "0 8px",
                  }}
                >
                  Page {deletedPage} of{" "}
                  {Math.ceil(deletedBlotters.length / DELETED_PER_PAGE) || 1}
                </span>
                <button
                  className="eb-pagination-btn"
                  disabled={
                    deletedPage >=
                    Math.ceil(deletedBlotters.length / DELETED_PER_PAGE)
                  }
                  onClick={() => setDeletedPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal.show && (
        <div
          className="eb-modal"
          style={{ zIndex: 10002, alignItems: "center" }}
        >
          <div
            className="eb-modal-content"
            style={{ maxWidth: "420px", padding: 0 }}
          >
            <div
              style={{
                padding: "20px 24px",
                background:
                  confirmModal.type === "delete"
                    ? "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)"
                    : "linear-gradient(135deg, var(--navy-dark) 0%, var(--navy-primary) 100%)",
                borderBottom: "3px solid rgba(255,255,255,0.2)",
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
                {confirmModal.type === "delete" ? (
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
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
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
                  {confirmModal.type === "delete"
                    ? "Delete Record"
                    : "Restore Record"}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.7)",
                    marginTop: "2px",
                  }}
                >
                  {confirmModal.type === "delete"
                    ? "This action cannot be undone"
                    : "Record will be moved to active"}
                </p>
              </div>
              <span
                onClick={() =>
                  setConfirmModal({
                    show: false,
                    type: "",
                    id: null,
                    message: "",
                  })
                }
                style={{
                  marginLeft: "auto",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "22px",
                  cursor: "pointer",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                &times;
              </span>
            </div>

            <div style={{ padding: "24px" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "var(--gray-700)",
                  lineHeight: "1.6",
                }}
              >
                {confirmModal.message}
              </p>
            </div>

            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--gray-200)",
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                background: "var(--gray-50)",
                borderRadius: "0 0 8px 8px",
              }}
            >
              <button
                className="eb-btn eb-btn-secondary"
                onClick={() =>
                  setConfirmModal({
                    show: false,
                    type: "",
                    id: null,
                    message: "",
                  })
                }
              >
                Cancel
              </button>
              <button
                className="eb-btn"
                style={{
                  background:
                    confirmModal.type === "delete"
                      ? "#dc2626"
                      : "var(--navy-primary)",
                  color: "white",
                }}
                onClick={handleConfirmAction}
              >
                {confirmModal.type === "delete"
                  ? "Yes, Delete"
                  : "Yes, Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmClose && (
        <div
          className="eb-modal"
          style={{ zIndex: 10001, alignItems: "center" }}
        >
          <div
            className="eb-modal-content"
            style={{ maxWidth: "420px", padding: 0 }}
          >
            <div
              style={{
                padding: "20px 24px",
                background:
                  "linear-gradient(135deg, var(--navy-dark) 0%, var(--navy-primary) 100%)",
                borderBottom: "3px solid var(--red-primary)",
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
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  Confirm Close
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.6)",
                    marginTop: "2px",
                  }}
                >
                  Unsaved changes will be lost
                </p>
              </div>
              <span
                onClick={cancelClose}
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "22px",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                &times;
              </span>
            </div>
            <div style={{ padding: "24px" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#374151",
                  lineHeight: "1.6",
                }}
              >
                Are you sure you want to close? All unsaved data will be lost
                and cannot be recovered.
              </p>
            </div>
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                background: "var(--gray-50)",
                borderRadius: "0 0 8px 8px",
              }}
            >
              <button className="eb-btn eb-btn-secondary" onClick={cancelClose}>
                Cancel
              </button>
              <button
                className="eb-btn eb-btn-primary"
                onClick={closeModal}
                style={{ background: "#dc2626" }}
              >
                Yes, Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="eb-filter-bar">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
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
            Filter Records
          </span>
        </div>
        <div className="eb-filter-single-row">
          <div className="eb-filter-group">
            <label className="eb-filter-label">Search</label>
            <input
              type="text"
              className="eb-filter-input"
              placeholder="Search by Report Number"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
            />
          </div>
          {activeReportTab !== "referred" && (
            <div className="eb-filter-group">
              <label className="eb-filter-label">Status</label>
              <select
                className="eb-filter-input"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">All Status</option>
                <option>Under Investigation</option>
                <option>Cleared</option>
                <option>Solved</option>
              </select>
            </div>
          )}
          <div className="eb-filter-group">
            <label className="eb-filter-label">Crime Type</label>
            <select
              className="eb-filter-input"
              name="incident_type"
              value={filters.incident_type}
              onChange={handleFilterChange}
            >
              <option value="">All Crime Types</option>
              <option value="Carnapping - MC">Carnapping - MC</option>
              <option value="Carnapping - MV">Carnapping - MV</option>
              <option>Homicide</option>
              <option>Murder</option>
              <option>Physical Injury</option>
              <option>Rape</option>
              <option>Robbery</option>
              <option>Special Complex Crime</option>
              <option>Theft</option>
            </select>
          </div>
          <div className="eb-filter-group">
            <label className="eb-filter-label">Barangay</label>
            <select
              className="eb-filter-input"
              name="barangay"
              value={filters.barangay}
              onChange={handleFilterChange}
            >
              <option value="">All Barangays</option>
              {CURRENT_BARANGAYS.map((b) => (
                <option key={b} value={b}>
                  {formatBarangayLabel(b)}
                </option>
              ))}
              <optgroup label="── Pre-2023 Names (Auto-resolved) ──">
                {LEGACY_BARANGAY_OPTIONS.map((b, idx) => (
                  <option key={`legacy-${idx}`} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          
          <div className="eb-filter-group">
            <label className="eb-filter-label">Date From</label>
            <input
              type="date"
              className="eb-filter-input"
              name="date_from"
              value={filters.date_from}
              max={filters.date_to || new Date().toISOString().split("T")[0]}
              onChange={handleFilterChange}
              onKeyDown={(e) => e.preventDefault()}
            />
          </div>
          <div className="eb-filter-group">
            <label className="eb-filter-label">Date To</label>
            <input
              type="date"
              className="eb-filter-input"
              name="date_to"
              value={filters.date_to}
              min={filters.date_from || undefined}
              max={new Date().toISOString().split("T")[0]}
              onChange={handleFilterChange}
              onKeyDown={(e) => e.preventDefault()}
            />
          </div>
          <div
            className="eb-filter-group"
            style={{ justifyContent: "flex-end" }}
          >
            <label className="eb-filter-label">&nbsp;</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="eb-btn eb-btn-primary eb-filter-apply-btn"
                onClick={() => fetchBlotters(activeReportTab)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Apply
              </button>
              <button
                className="eb-btn eb-btn-clear"
                onClick={clearFilters}
                title="Clear filters"
              >
                <span className="eb-restart-icon">↻</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="eb-report-tabs">
        <button
          className={`eb-report-tab ${activeReportTab === "reports" ? "active" : ""}`}
          onClick={() => {
            if (activeReportTab === "reports") return;
            activeReportTabRef.current = "reports"; // ADD THIS
            setBlotters([]);
            setCurrentPage(1);
            setActiveReportTab("reports");
            fetchBlotters("reports");
          }}
        >
          Reports
        </button>
      </div>

      <div className="eb-table-card">
        <div className="eb-table-container">
          <table
            className={`eb-data-table ${activeReportTab === "referred" ? "eb-table-referred" : "eb-table-reports"}`}
          >
            <thead>
              <tr>
  <th>Report Number</th>
  <th>Crime Type</th>
  <th>Location</th>
  <th>Date Reported</th>
  <th>Status</th>
  <th>Actions</th>
</tr>
            </thead>
            <tbody>
              {loading ? null : blotters.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeReportTab === "referred" ? 5 : 6}
                    style={{
                      textAlign: "center",
                      padding: "32px",
                      color: "#9ca3af",
                    }}
                  >
                    No records found
                  </td>
                </tr>
              ) : (
                paginatedBlotters.map((b) => (
                  <tr key={b.report_id}>
                    {activeReportTab !== "referred" && (
                      <td>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: "700",
                            color: "var(--navy-primary)",
                            fontSize: "13px",
                            background: "rgba(30,58,95,0.07)",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            display: "inline-block",
                          }}
                        >
                          {b.report_number}
                        </span>
                        {b.data_source === "ciras_import" && (
                          <span
                            style={{
                              marginLeft: "6px",
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "#e0f2fe",
                              color: "#0369a1",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              verticalAlign: "middle",
                            }}
                          >
                            CIRAS
                          </span>
                        )}
                      </td>
                    )}
                    <td>
                      <span
                        style={{
                          fontSize: "14px",
                          color: "#374151",
                          fontWeight: 500,
                        }}
                      >
                        {b.crime_type}
                      </span>
                    </td>
                    <td>{`${b.place_barangay}`}</td>
                    <td>{formatDate(b.date_time_reported)}</td>
                   
                    {activeReportTab !== "referred" && (
                      <td>
                        <span
                          className={`eb-status-badge ${getStatusClass(b.status)}`}
                        >
                          {b.status}
                        </span>
                      </td>
                    )}
                                       <td>
                      <div className="eb-table-actions">
                        <button
                          className="eb-action-btn eb-action-btn-view"
                          onClick={(e) => {
                            e.preventDefault();
                            handleView(b.report_id);
                          }}
                        >
                          <ViewIcon /> View
                        </button>
                        <button
                          className="eb-action-btn eb-action-btn-edit"
                          onClick={(e) => {
                            e.preventDefault();
                            handleEdit(b.report_id);
                          }}
                        >
                          <EditIcon /> Edit
                        </button>
                        <button
                          className="eb-action-btn eb-action-btn-danger"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete(b.report_id);
                          }}
                        >
                          <DeleteIcon /> Delete
                        </button>
                      </div>
                    </td>
                            
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="eb-pagination">
          <div className="eb-pagination-info">
            Showing{" "}
            {blotters.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}
            –{Math.min(currentPage * ITEMS_PER_PAGE, blotters.length)} of{" "}
            {blotters.length} records
          </div>
          <div className="eb-pagination-controls">
            <button
              className="eb-pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="eb-pagination-current">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              className="eb-pagination-btn"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {SHOW_IMPORT_BUTTON && showImport && (
        <ImportBlotterModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            fetchBlotters(activeReportTab);
          }}
        />
      )}

      {reactToast.show && (
        <div
          className={`um-toast ${reactToast.type === "success" ? "um-toast-success" : "um-toast-error"}`}
          style={{ zIndex: 99999 }}
        >
          <div className="um-toast-content">
            <svg
              className="um-toast-icon"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              {reactToast.type === "success" ? (
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
            <span>{reactToast.message}</span>
          </div>
        </div>
      )}
      
      

      
    </div>
  );
}

export default EBlotter;