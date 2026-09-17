/* MediCore real authentication: Flask JWT + Oracle APP_USER. */
(function (global) {
  const SESSION_KEY = 'medicore_session_v1';
  const TOKEN_KEY = 'medicore_token';

  const ROLE_HOME = {
    admin: '/admin/index.html',
    doctor: '/doctor/index.html',
    pharmacy: '/pharmacy/index.html',
    instrument: '/instruments/index.html',
  };

  const ROLE_LABEL = {
    admin: 'Admin', doctor: 'Doctor', pharmacy: 'Pharmacy Head', instrument: 'Instrument Head'
  };

  function nowStr() {
    return new Date().toLocaleString('en-IN', { hour12: false }).replace(',', '');
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  function login(username, password, expectedRole) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/auth/login', false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    try {
      xhr.send(JSON.stringify({ username, password, role: expectedRole }));
    } catch (e) {
      return { ok: false, reason: 'Cannot connect to the backend. Start the Flask server first.' };
    }

    let data = {};
    try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch (e) {}
    if (xhr.status < 200 || xhr.status >= 300 || data.success === false) {
      return { ok: false, reason: data.message || 'Login failed.' };
    }

    sessionStorage.setItem(TOKEN_KEY, data.token);
    const user = data.user || {};
    const session = {
      user_id: user.user_id,
      username: user.username,
      name: user.name,
      role: user.role,
      doctor_id: user.doctor_id || null,
      department: user.department || null,
      loggedInAt: nowStr(),
    };
    setSession(session);
    return { ok: true, session };
  }

  function logout() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/auth/logout', false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.send();
      } catch (e) { /* local logout still happens */ }
    }
    clearSession();
    global.location.href = '/login.html';
  }

  function homeFor(role) { return ROLE_HOME[role] || '/login.html'; }

  function requireRole(allowedRoles) {
    const session = getSession();
    if (!session || !sessionStorage.getItem(TOKEN_KEY)) {
      global.location.href = '/login.html';
      return null;
    }
    if (allowedRoles && allowedRoles.length && !allowedRoles.includes(session.role)) {
      global.location.href = homeFor(session.role);
      return null;
    }
    return session;
  }

  global.MediCoreAuth = {
    getSession, login, logout, requireRole, homeFor,
    roleLabel: (role) => ROLE_LABEL[role] || role,
  };
})(window);
