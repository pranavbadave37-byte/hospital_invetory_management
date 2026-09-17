(function () {
  const session = MediCoreAuth.requireRole(["pharmacy"]);
  if (!session) return;

  const { initLayout, badge, formatDate, formatCurrency, escapeHtml } = MediCoreUI;
  initLayout({ activeKey: "pharmacy-dashboard", title: `Hi, ${escapeHtml(session.name)}`, breadcrumb: "Welcome back to your dashboard." });

  const TODAY = new Date("2026-09-17");
  const medicines = MediCoreDB.get("medicines");
  const medicineMap = MediCoreDB.lookup("medicines", "medicine_id");

  function daysUntil(dateStr) { return Math.round((new Date(dateStr) - TODAY) / 86400000); }

  const lowStock = medicines.filter((m) => m.quantity > 0 && m.quantity < 30);
  const outOfStock = medicines.filter((m) => m.quantity === 0);
  const expiring = medicines.filter((m) => daysUntil(m.expiry_date) >= 0 && daysUntil(m.expiry_date) <= 30);
  const expired = medicines.filter((m) => daysUntil(m.expiry_date) < 0);

  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card"><div class="stat-info"><span class="label">Total Medicines</span><strong>${medicines.length}</strong></div><div class="stat-icon teal">💊</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Low Stock</span><strong>${lowStock.length}</strong></div><div class="stat-icon amber">⚠️</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Expiring ≤30 days</span><strong>${expiring.length}</strong></div><div class="stat-icon blue">⏳</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Expired</span><strong>${expired.length}</strong></div><div class="stat-icon rose">✕</div></div>
  `;

  const attentionRows = [...outOfStock, ...lowStock, ...expired].slice(0, 8).map((m) => {
    const status = daysUntil(m.expiry_date) < 0 ? "Expired" : m.quantity === 0 ? "Out of Stock" : "Low Stock";
    return `<tr><td class="cell-primary">${escapeHtml(m.medicine_name)}</td><td>${m.quantity}</td><td>${formatDate(m.expiry_date)}</td><td>${badge(status)}</td></tr>`;
  }).join("");
  document.getElementById("alertTable").innerHTML = attentionRows
    ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Medicine</th><th>Qty</th><th>Expiry</th><th>Status</th></tr></thead><tbody>${attentionRows}</tbody></table></div>`
    : `<div class="empty-state"><div class="icon">🗂️</div><div>No medicines need attention right now.</div></div>`;

  const tx = MediCoreDB.get("stockTransactions").slice(-8).reverse();
  const txRows = tx.map((t) => `
    <tr><td class="cell-primary">${escapeHtml(medicineMap[t.medicine_id] ? medicineMap[t.medicine_id].medicine_name : "Unknown")}</td><td>${badge(t.transaction_type === "IN" ? "Stock In" : "Stock Out")}</td><td>${t.quantity}</td><td>${formatDate(t.transaction_date)}</td></tr>
  `).join("");
  document.getElementById("txTable").innerHTML = txRows
    ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Medicine</th><th>Type</th><th>Qty</th><th>Date</th></tr></thead><tbody>${txRows}</tbody></table></div>`
    : `<div class="empty-state"><div class="icon">🗂️</div><div>No stock transactions recorded.</div></div>`;
})();
