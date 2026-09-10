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
    "overview",
    "dashboard",
    "crime-analytics",
    "e-blotter",
    "case-management",
    "modus-management",
    "type-of-operation-management",
    "mobile-unit-management",
    
    "crime-mapping",
    "user-management",
    "audit-log",
    "profile-settings",
  ],

  "Administrator": [
    "overview",
    "dashboard",
    "crime-analytics",
    "e-blotter",
    "case-management",
    "modus-management",
    "type-of-operation-management",
    "mobile-unit-management",
    "crime-mapping",
    "audit-log",
    "profile-settings",
  ],

  "Investigator": [
    "overview",
    "dashboard",
    "crime-analytics",
    "e-blotter",
    "case-management",
    "modus-management",
    "type-of-operation-management",
    "mobile-unit-management",
    "crime-mapping",
    "audit-log",
    "profile-settings",
  ],

  "Patrol": [
    "overview",
    "dashboard",
    "crime-mapping",
    "e-blotter",
    "audit-log",
  ],


};