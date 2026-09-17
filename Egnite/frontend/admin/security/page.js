(function () {
  const session = MediCoreAuth.requireRole(["admin"]);
  if (!session) return;

  const { badge, escapeHtml, renderDataTable } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "admin-security", title: "Security", breadcrumb: "Admin / Security" });

  function refresh() {
    const accessLogs = MediCoreDB.get("accessLogs").map((l, idx) => Object.assign({ __id: l.log_id || idx }, l)).reverse();
    const failedLogins = MediCoreDB.get("failedLogins").map((l, idx) => Object.assign({ __id: l.attempt_id || idx }, l)).reverse();
    const unauthorized = MediCoreDB.get("unauthorizedAttempts").map((l, idx) => Object.assign({ __id: l.attempt_id || idx }, l)).reverse();

    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">Access Log Entries</span><strong>${accessLogs.length}</strong></div><div class="stat-icon teal">🔐</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Failed Logins</span><strong>${failedLogins.length}</strong></div><div class="stat-icon rose">⚠️</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Unauthorized Attempts</span><strong>${unauthorized.length}</strong></div><div class="stat-icon amber">🚫</div></div>
    `;

    renderDataTable(document.getElementById("accessTable"), {
      columns: [
        { label: "User", field: "user", render: (r) => `<span class="cell-primary">${escapeHtml(r.user)}</span>` },
        { label: "Action", field: "action" },
        { label: "IP Address", field: "ip_address" },
        { label: "Time", field: "login_time" },
        { label: "Status", field: "status", render: (r) => badge(r.status) },
      ],
      data: accessLogs,
      emptyMessage: "No access activity recorded yet this session. Sign in as different demo roles to populate this log.",
    });

    renderDataTable(document.getElementById("failedTable"), {
      columns: [
        { label: "Username Tried", field: "username", render: (r) => `<span class="cell-primary">${escapeHtml(r.username)}</span>` },
        { label: "IP Address", field: "ip_address" },
        { label: "Time", field: "attempt_time" },
        { label: "Reason", field: "reason", render: (r) => badge("Failed") + ` <span class="cell-muted">${escapeHtml(r.reason)}</span>` },
      ],
      data: failedLogins,
      emptyMessage: "No failed login attempts recorded.",
    });

    renderDataTable(document.getElementById("unauthorizedTable"), {
      columns: [
        { label: "User", field: "user", render: (r) => `<span class="cell-primary">${escapeHtml(r.user)}</span>` },
        { label: "Role", field: "role" },
        { label: "Attempted Path", field: "attempted_path", className: "cell-muted" },
        { label: "Time", field: "time" },
      ],
      data: unauthorized,
      emptyMessage: "No unauthorized access attempts recorded.",
    });
  }

  refresh();
})();
