(function () {
  const session = MediCoreAuth.requireRole(["pharmacy"]);
  if (!session) return;

  const { badge, escapeHtml, formatDate, renderDataTable } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "pharmacy-alert", title: "Alerts", breadcrumb: "Pharmacy / Alerts" });

  const TODAY = new Date("2026-09-17");

  function stockStatus(m) {
    if (m.quantity === 0) return "Out of Stock";
    if (m.quantity < 30) return "Low Stock";
    return "In Stock";
  }

  function daysUntil(dateStr) {
    return Math.round((new Date(dateStr) - TODAY) / 86400000);
  }

  function refresh() {
    const medicines = MediCoreDB.get("medicines");
    const lowOrOut = medicines.filter((m) => stockStatus(m) !== "In Stock").map((m) => Object.assign({ __id: m.medicine_id }, m, { status: stockStatus(m) }));
    const expiring = medicines.filter((m) => daysUntil(m.expiry_date) >= 0 && daysUntil(m.expiry_date) <= 60).sort((a, b) => daysUntil(a.expiry_date) - daysUntil(b.expiry_date));
    const expired = medicines.filter((m) => daysUntil(m.expiry_date) < 0);

    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">Low Stock</span><strong>${medicines.filter((m) => stockStatus(m) === "Low Stock").length}</strong></div><div class="stat-icon amber">⚠️</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Out of Stock</span><strong>${medicines.filter((m) => stockStatus(m) === "Out of Stock").length}</strong></div><div class="stat-icon rose">✕</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Expiring ≤60 days</span><strong>${expiring.length}</strong></div><div class="stat-icon blue">⏳</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Expired</span><strong>${expired.length}</strong></div><div class="stat-icon rose">🗑️</div></div>
    `;

    const stockFilter = document.getElementById("stockFilter");
    renderDataTable(document.getElementById("stockTable"), {
      columns: [
        { label: "Medicine", field: "medicine_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.medicine_name)}</span>` },
        { label: "Category", field: "category" },
        { label: "Quantity Left", field: "quantity" },
        { label: "Status", field: "status", render: (r) => badge(r.status) },
      ],
      data: lowOrOut,
      filterFn: (row) => !stockFilter.value || row.status === stockFilter.value,
      emptyMessage: "All medicines are sufficiently stocked.",
    });

    renderDataTable(document.getElementById("expiryTable"), {
      columns: [
        { label: "Medicine", field: "medicine_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.medicine_name)}</span>` },
        { label: "Quantity", field: "quantity" },
        { label: "Expiry Date", field: "expiry_date", render: (r) => formatDate(r.expiry_date) },
        { label: "Days Left", field: "expiry_date", render: (r) => `<span class="${daysUntil(r.expiry_date) <= 15 ? "text-danger" : ""}">${daysUntil(r.expiry_date)} days</span>` },
      ],
      data: expiring,
      emptyMessage: "No medicines expiring soon.",
    });

    renderDataTable(document.getElementById("expiredTable"), {
      columns: [
        { label: "Medicine", field: "medicine_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.medicine_name)}</span>` },
        { label: "Quantity", field: "quantity" },
        { label: "Expired On", field: "expiry_date", render: (r) => formatDate(r.expiry_date) },
        { label: "Status", field: "expiry_date", render: () => badge("Expired") },
      ],
      data: expired,
      emptyMessage: "No expired medicines on record.",
    });
  }

  document.getElementById("stockFilter").addEventListener("change", refresh);
  refresh();
})();
