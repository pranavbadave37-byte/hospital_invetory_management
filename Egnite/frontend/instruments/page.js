(function () {
  const session = MediCoreAuth.requireRole(["instrument"]);
  if (!session) return;

  const { initLayout, badge, formatDate, escapeHtml } = MediCoreUI;
  initLayout({ activeKey: "instruments-dashboard", title: `Hi, ${escapeHtml(session.name)}`, breadcrumb: "Welcome back to your dashboard." });

  const instruments = MediCoreDB.get("instruments");
  const instrumentMap = MediCoreDB.lookup("instruments", "instrument_id");
  const issues = MediCoreDB.get("instrumentIssues");
  const maintenance = MediCoreDB.get("instrumentMaintenance");

  const totalUnits = instruments.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const availableUnits = instruments.reduce((s, i) => s + Number(i.available_quantity || 0), 0);
  const inUseUnits = totalUnits - availableUnits;
  const underMaintenance = instruments.filter((i) => i.condition_status === "Under Maintenance").length;
  const maintenanceDue = maintenance.filter((m) => m.status !== "Completed").length;

  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card"><div class="stat-info"><span class="label">Total Units</span><strong>${totalUnits}</strong></div><div class="stat-icon teal">🧰</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Available</span><strong>${availableUnits}</strong></div><div class="stat-icon blue">✅</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">In Use</span><strong>${inUseUnits}</strong></div><div class="stat-icon slate">🔄</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Maintenance Due</span><strong>${maintenanceDue}</strong></div><div class="stat-icon amber">🛠️</div></div>
  `;

  const issuedRows = issues.filter((i) => i.status === "Issued").slice(0, 8).map((i) => {
    const inst = instrumentMap[i.instrument_id];
    return `<tr><td class="cell-primary">${inst ? escapeHtml(inst.instrument_name) : "—"}</td><td>${escapeHtml(i.issued_to)}</td><td>${formatDate(i.expected_return_date)}</td></tr>`;
  }).join("");
  document.getElementById("issuedTable").innerHTML = issuedRows
    ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Instrument</th><th>Issued To</th><th>Expected Return</th></tr></thead><tbody>${issuedRows}</tbody></table></div>`
    : `<div class="empty-state"><div class="icon">🗂️</div><div>Nothing currently issued.</div></div>`;

  const maintRows = maintenance.filter((m) => m.status !== "Completed").slice(0, 8).map((m) => {
    const inst = instrumentMap[m.instrument_id];
    return `<tr><td class="cell-primary">${inst ? escapeHtml(inst.instrument_name) : "—"}</td><td>${escapeHtml(m.issue_description)}</td><td>${badge(m.status)}</td></tr>`;
  }).join("");
  document.getElementById("maintTable").innerHTML = maintRows
    ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Instrument</th><th>Issue</th><th>Status</th></tr></thead><tbody>${maintRows}</tbody></table></div>`
    : `<div class="empty-state"><div class="icon">🗂️</div><div>No pending maintenance.</div></div>`;
})();
