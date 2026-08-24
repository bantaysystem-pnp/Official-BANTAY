// =====================================================
// ROLE-BASED ACCESS CONTROL
// =====================================================
// Defines which pages each role can access
// Maps role_name from database to allowed page keys

export const roleAccess = {
  // ============================================
  // POLICE ROLES
  // ============================================

  "Technical Administrator": [
    "dashboard",
    "crime-analytics",
    "e-blotter",
    "case-management",
    "modus-management",
    "crime-mapping",
    "user-management",
    "audit-log",
    "profile-settings",
  ],
  
  "Administrator": [
    "dashboard",
    "crime-analytics",
    "e-blotter",
    "case-management",
    "modus-management",
    "crime-mapping",
    "audit-log",
    "profile-settings",
  ],

  "Investigator": [
    "dashboard",
    "crime-analytics",
    "e-blotter",
    "case-management",
    "modus-management",
    "crime-mapping",
    "audit-log",
    "profile-settings",
  ],

  "Patrol": [
    "dashboard",
    "crime-mapping",
    "e-blotter",
    "audit-log",
  ],


};