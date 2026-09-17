/* ==========================================================================
   MediCore — frontend auth simulation (sessionStorage-backed).
   Real authentication/authorization will be provided by the backend later;
   this only gates page access in the browser for the demo.
   ========================================================================== */

(function (global) {
  const SESSION_KEY = "medicore_session_v1";

  const ROLE_HOME = {
    admin: "/admin/index.html",
    doctor: "/doctor/index.html",
    pharmacy: "/pharmacy/index.html",
    instrument: "/instruments/index.html",
  };

  const ROLE_LABEL = {
    admin: "Admin",
    doctor: "Doctor",
    pharmacy: "Pharmacy Head",
    instrument: "Instrument Head",
  };

  function nowStr() {
    return new Date().toLocaleString("en-IN", { hour12: false }).replace(",", "");
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(session) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) { /* storage unavailable */ }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }

  function fakeIp() {
    return "192.168.1." + (10 + Math.floor(Math.random() * 200));
  }

  // expectedRole is optional: pass it from a role-specific login page (e.g.
  // doctor-login.html passes "doctor") so an otherwise-valid account for a
  // different workspace is rejected there instead of silently logging in.
  function login(username, password, expectedRole) {
    const users = global.MediCoreDB.get("users");
    const user = users.find((u) => u.username.toLowerCase() === String(username || "").toLowerCase());

    if (!user || user.password !== password || user.status !== "Active") {
      global.MediCoreDB.insert("failedLogins", {
        attempt_id: global.MediCoreDB.nextId("failedLogins", "attempt_id"),
        username: username || "(blank)",
        attempt_time: nowStr(),
        ip_address: fakeIp(),
        reason: !user ? "Unknown username" : user.status !== "Active" ? "Account inactive" : "Incorrect password",
      });
      return { ok: false, reason: !user ? "No account with that username." : user.status !== "Active" ? "This account is inactive." : "Incorrect password." };
    }

    if (expectedRole && user.role !== expectedRole) {
      global.MediCoreDB.insert("failedLogins", {
        attempt_id: global.MediCoreDB.nextId("failedLogins", "attempt_id"),
        username: username,
        attempt_time: nowStr(),
        ip_address: fakeIp(),
        reason: `Wrong workspace (account is ${ROLE_LABEL[user.role] || user.role})`,
      });
      return { ok: false, reason: `This account is not registered for the ${ROLE_LABEL[expectedRole] || expectedRole} workspace.` };
    }

    const session = {
      user_id: user.user_id,
      username: user.username,
      name: user.name,
      role: user.role,
      doctor_id: user.doctor_id || null,
      loggedInAt: nowStr(),
    };
    setSession(session);
    global.MediCoreDB.update("users", "user_id", user.user_id, { last_login: nowStr() });
    global.MediCoreDB.insert("accessLogs", {
      log_id: global.MediCoreDB.nextId("accessLogs", "log_id"),
      user_id: user.user_id,
      user: user.name,
      action: "Login",
      login_time: nowStr(),
      ip_address: fakeIp(),
      status: "Success",
    });
    return { ok: true, session };
  }

  function logout() {
    const session = getSession();
    if (session) {
      global.MediCoreDB.insert("accessLogs", {
        log_id: global.MediCoreDB.nextId("accessLogs", "log_id"),
        user_id: session.user_id,
        user: session.name,
        action: "Logout",
        login_time: nowStr(),
        ip_address: fakeIp(),
        status: "Success",
      });
    }
    clearSession();
    global.location.href = "/login.html";
  }

  function homeFor(role) {
    return ROLE_HOME[role] || "/login.html";
  }

  // Call at the very top of every protected page. Redirects to login if not
  // authenticated, or to the caller's own home if authenticated with the
  // wrong role (also logging the attempt as unauthorized).
  function requireRole(allowedRoles) {
    const session = getSession();
    if (!session) {
      global.location.href = "/login.html";
      return null;
    }
    if (allowedRoles && allowedRoles.length && !allowedRoles.includes(session.role)) {
      global.MediCoreDB.insert("unauthorizedAttempts", {
        attempt_id: global.MediCoreDB.nextId("unauthorizedAttempts", "attempt_id"),
        user: session.name,
        role: session.role,
        attempted_path: global.location.pathname,
        time: nowStr(),
      });
      global.location.href = homeFor(session.role);
      return null;
    }
    return session;
  }

  global.MediCoreAuth = {
    getSession,
    login,
    logout,
    requireRole,
    homeFor,
    roleLabel: (role) => ROLE_LABEL[role] || role,
  };
})(window);
