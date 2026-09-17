(function () {
  const session = MediCoreAuth.requireRole(["admin"]);
  if (!session) return;

  const { toast, badge, escapeHtml, renderTabs } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "admin-system", title: "System", breadcrumb: "Admin / System" });

  function renderStats(panel) {
    const patients = MediCoreDB.get("patients");
    const doctors = MediCoreDB.get("doctors");
    const appointments = MediCoreDB.get("appointments");
    const consultations = MediCoreDB.get("consultations");
    const medicines = MediCoreDB.get("medicines");
    const instruments = MediCoreDB.get("instruments");

    panel.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-info"><span class="label">Patients</span><strong>${patients.length}</strong></div><div class="stat-icon teal">👤</div></div>
        <div class="stat-card"><div class="stat-info"><span class="label">Doctors</span><strong>${doctors.length}</strong></div><div class="stat-icon blue">🩺</div></div>
        <div class="stat-card"><div class="stat-info"><span class="label">Appointments</span><strong>${appointments.length}</strong></div><div class="stat-icon slate">📅</div></div>
        <div class="stat-card"><div class="stat-info"><span class="label">Consultations</span><strong>${consultations.length}</strong></div><div class="stat-icon amber">📋</div></div>
        <div class="stat-card"><div class="stat-info"><span class="label">Medicines Tracked</span><strong>${medicines.length}</strong></div><div class="stat-icon teal">💊</div></div>
        <div class="stat-card"><div class="stat-info"><span class="label">Instruments Tracked</span><strong>${instruments.length}</strong></div><div class="stat-icon blue">🧰</div></div>
      </div>
    `;
  }

  function renderAlerts(panel) {
    const medicines = MediCoreDB.get("medicines");
    const instruments = MediCoreDB.get("instruments");
    const failedLogins = MediCoreDB.get("failedLogins");
    const items = [];
    const outOfStock = medicines.filter((m) => m.quantity === 0).length;
    const lowStock = medicines.filter((m) => m.quantity > 0 && m.quantity < 30).length;
    const needsService = instruments.filter((i) => i.condition_status !== "Good").length;
    if (outOfStock) items.push(`<li><span>${outOfStock} medicine(s) out of stock</span>${badge("Out of Stock")}</li>`);
    if (lowStock) items.push(`<li><span>${lowStock} medicine(s) running low</span>${badge("Low Stock")}</li>`);
    if (needsService) items.push(`<li><span>${needsService} instrument(s) need attention</span>${badge("Needs Service")}</li>`);
    if (failedLogins.length) items.push(`<li><span>${failedLogins.length} failed login attempt(s) this session</span>${badge("Failed")}</li>`);
    panel.innerHTML = `<ul class="list-simple">${items.join("") || `<li><span>No active system alerts.</span>${badge("Good")}</li>`}</ul>`;
  }

  function renderReports(panel) {
    const appointments = MediCoreDB.get("appointments");
    const consultations = MediCoreDB.get("consultations");
    const byStatus = {};
    appointments.forEach((a) => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });
    const stockTx = MediCoreDB.get("stockTransactions");
    const stockIn = stockTx.filter((t) => t.transaction_type === "IN").reduce((s, t) => s + t.quantity, 0);
    const stockOut = stockTx.filter((t) => t.transaction_type === "OUT").reduce((s, t) => s + t.quantity, 0);

    panel.innerHTML = `
      <div class="section-title">Appointments by Status</div>
      <ul class="list-simple">${Object.entries(byStatus).map(([k, v]) => `<li><span>${escapeHtml(k)}</span><strong>${v}</strong></li>`).join("") || "<li><span>No appointment data.</span></li>"}</ul>
      <div class="section-title">Consultations Recorded</div>
      <ul class="list-simple"><li><span>Total</span><strong>${consultations.length}</strong></li><li><span>With Lab Test Ordered</span><strong>${consultations.filter((c) => c.lab_test_required).length}</strong></li><li><span>With Follow-up Scheduled</span><strong>${consultations.filter((c) => c.follow_up_required).length}</strong></li></ul>
      <div class="section-title">Pharmacy Stock Movement</div>
      <ul class="list-simple"><li><span>Total Units Stocked In</span><strong>${stockIn}</strong></li><li><span>Total Units Stocked Out</span><strong>${stockOut}</strong></li></ul>
    `;
  }

  function renderSettings(panel) {
    const s = MediCoreDB.settings();
    panel.innerHTML = `
      <div class="form-grid">
        <div class="field full"><label>Hospital Name</label><input id="f_hospitalName" value="${escapeHtml(s.hospitalName || "")}" /></div>
        <div class="field"><label>Timezone</label><input id="f_timezone" value="${escapeHtml(s.timezone || "")}" /></div>
        <div class="field"><label>Date Format</label><input id="f_dateFormat" value="${escapeHtml(s.dateFormat || "")}" /></div>
        <div class="field"><label>Currency</label><input id="f_currency" value="${escapeHtml(s.currency || "")}" /></div>
        <div class="field"><label>Low Stock Threshold</label><input id="f_lowStock" type="number" min="0" value="${s.lowStockThreshold ?? 30}" /></div>
      </div>
      <div style="margin-top:16px;"><button class="btn btn-primary btn-sm" id="saveSettingsBtn">Save Settings</button></div>
    `;
    panel.querySelector("#saveSettingsBtn").addEventListener("click", () => {
      MediCoreDB.updateSettings({
        hospitalName: panel.querySelector("#f_hospitalName").value.trim(),
        timezone: panel.querySelector("#f_timezone").value.trim(),
        dateFormat: panel.querySelector("#f_dateFormat").value.trim(),
        currency: panel.querySelector("#f_currency").value.trim(),
        lowStockThreshold: Number(panel.querySelector("#f_lowStock").value) || 0,
      });
      toast("Settings saved", "success");
    });
  }

  renderTabs(document.getElementById("viewTabs"), [
    { key: "stats", label: "Stats", render: renderStats },
    { key: "alerts", label: "Alerts", render: renderAlerts },
    { key: "reports", label: "Reports", render: renderReports },
    { key: "settings", label: "Settings", render: renderSettings },
  ]);
})();
