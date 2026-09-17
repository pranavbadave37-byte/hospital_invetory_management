(function () {
  const session = MediCoreAuth.requireRole(["admin"]);
  if (!session) return;

  const { initLayout, badge, formatDate, escapeHtml } = MediCoreUI;
  initLayout({ activeKey: "admin-dashboard", title: `Hi, ${escapeHtml(session.name)}`, breadcrumb: "Welcome back to your dashboard." });

  const users = MediCoreDB.get("users");
  const doctors = MediCoreDB.get("doctors");
  const medicines = MediCoreDB.get("medicines");
  const instruments = MediCoreDB.get("instruments");
  const failedLogins = MediCoreDB.get("failedLogins");
  const unauthorized = MediCoreDB.get("unauthorizedAttempts");
  const accessLogs = MediCoreDB.get("accessLogs");

  const activeUsers = users.filter((u) => u.status === "Active").length;
  const lowStock = medicines.filter((m) => m.quantity > 0 && m.quantity < 30).length;
  const outOfStock = medicines.filter((m) => m.quantity === 0).length;
  const maintenanceCount = instruments.filter((i) => i.condition_status !== "Good").length;

  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card"><div class="stat-info"><span class="label">Active Users</span><strong>${activeUsers}</strong><span class="trend">of ${users.length} total accounts</span></div><div class="stat-icon teal">👥</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Doctors</span><strong>${doctors.length}</strong></div><div class="stat-icon blue">🩺</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Pharmacy Alerts</span><strong>${lowStock + outOfStock}</strong><span class="trend">${lowStock} low · ${outOfStock} out</span></div><div class="stat-icon amber">💊</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Instruments Needing Attention</span><strong>${maintenanceCount}</strong></div><div class="stat-icon rose">🧰</div></div>
  `;

  const alerts = [];
  if (failedLogins.length) alerts.push(`<li><span>${failedLogins.length} failed login attempt(s) this session</span>${badge("Failed")}</li>`);
  if (unauthorized.length) alerts.push(`<li><span>${unauthorized.length} unauthorized page access attempt(s)</span>${badge("Overdue")}</li>`);
  if (outOfStock) alerts.push(`<li><span>${outOfStock} medicine(s) out of stock</span>${badge("Out of Stock")}</li>`);
  if (maintenanceCount) alerts.push(`<li><span>${maintenanceCount} instrument(s) need service or repair</span>${badge("Needs Service")}</li>`);
  document.getElementById("alertList").innerHTML = alerts.join("") || `<li><span>No active alerts.</span>${badge("Good")}</li>`;

  document.getElementById("reportList").innerHTML = `
    <li><span>Total Patients</span><strong>${MediCoreDB.get("patients").length}</strong></li>
    <li><span>Total Appointments</span><strong>${MediCoreDB.get("appointments").length}</strong></li>
    <li><span>Consultations Recorded</span><strong>${MediCoreDB.get("consultations").length}</strong></li>
    <li><span>Medicines Tracked</span><strong>${medicines.length}</strong></li>
    <li><span>Instruments Tracked</span><strong>${instruments.length}</strong></li>
  `;

  const rows = accessLogs.slice(-8).reverse().map((l) => `
    <tr><td class="cell-primary">${escapeHtml(l.user)}</td><td>${escapeHtml(l.action)}</td><td>${l.ip_address}</td><td>${l.login_time}</td><td>${badge(l.status)}</td></tr>
  `).join("");
  document.getElementById("activityTable").innerHTML = rows
    ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Action</th><th>IP</th><th>Time</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="empty-state"><div class="icon">🗂️</div><div>No access activity recorded yet this session.</div></div>`;
})();
