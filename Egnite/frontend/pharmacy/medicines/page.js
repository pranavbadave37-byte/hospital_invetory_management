(function () {
  const session = MediCoreAuth.requireRole(["pharmacy"]);
  if (!session) return;

  const { toast, badge, escapeHtml, formatDate, formatCurrency, renderDataTable, renderTabs, openModal, closeModal, confirmAction, icon } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "pharmacy-medicines", title: "Medicines", breadcrumb: "Pharmacy / Medicines" });
  document.getElementById("searchIconSlot").innerHTML = icon("search");

  function stockStatus(m) {
    if (m.quantity === 0) return "Out of Stock";
    if (m.quantity < 30) return "Low Stock";
    return "In Stock";
  }

  function isNearExpiry(dateStr) {
    const diffDays = (new Date(dateStr) - new Date("2026-09-17")) / 86400000;
    return diffDays >= 0 && diffDays <= 30;
  }

  function populateCategoryFilter() {
    const select = document.getElementById("categoryFilter");
    const categories = [...new Set(MediCoreDB.get("medicines").map((m) => m.category).filter(Boolean))];
    select.innerHTML = `<option value="">All categories</option>` + categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  }

  function loadStats() {
    const medicines = MediCoreDB.get("medicines");
    const low = medicines.filter((m) => stockStatus(m) === "Low Stock").length;
    const out = medicines.filter((m) => stockStatus(m) === "Out of Stock").length;
    const expiring = medicines.filter((m) => isNearExpiry(m.expiry_date)).length;
    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">Total Medicines</span><strong>${medicines.length}</strong></div><div class="stat-icon teal">💊</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Low Stock</span><strong>${low}</strong></div><div class="stat-icon amber">⚠️</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Out of Stock</span><strong>${out}</strong></div><div class="stat-icon rose">✕</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Expiring ≤30 days</span><strong>${expiring}</strong></div><div class="stat-icon slate">⏳</div></div>
    `;
  }

  function form(record) {
    const m = record || {};
    return `
      <div class="form-grid">
        <div class="field full"><label>Medicine Name</label><input id="f_name" value="${escapeHtml(m.medicine_name || "")}" /></div>
        <div class="field"><label>Category</label><input id="f_category" value="${escapeHtml(m.category || "")}" /></div>
        <div class="field"><label>Manufacturer</label><input id="f_manufacturer" value="${escapeHtml(m.manufacturer || "")}" /></div>
        <div class="field"><label>Quantity</label><input id="f_quantity" type="number" min="0" value="${m.quantity ?? 0}" /></div>
        <div class="field"><label>Price (₹)</label><input id="f_price" type="number" min="0" step="0.01" value="${m.price ?? 0}" /></div>
        <div class="field"><label>Expiry Date</label><input type="date" id="f_expiry" value="${m.expiry_date || ""}" /></div>
      </div>
    `;
  }

  function openForm(record) {
    const isEdit = !!record;
    openModal({
      title: isEdit ? "Edit Medicine" : "Add Medicine",
      bodyHtml: form(record),
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">${isEdit ? "Save Changes" : "Add Medicine"}</button>`,
      onMount: () => {
        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const name = document.getElementById("f_name").value.trim();
          if (!name) { toast("Medicine name is required", "danger"); return; }
          const patch = {
            medicine_name: name,
            category: document.getElementById("f_category").value.trim(),
            manufacturer: document.getElementById("f_manufacturer").value.trim(),
            quantity: Number(document.getElementById("f_quantity").value) || 0,
            price: Number(document.getElementById("f_price").value) || 0,
            expiry_date: document.getElementById("f_expiry").value,
          };
          if (isEdit) {
            MediCoreDB.update("medicines", "medicine_id", record.medicine_id, patch);
            toast("Medicine updated", "success");
          } else {
            patch.medicine_id = MediCoreDB.nextId("medicines", "medicine_id");
            MediCoreDB.insert("medicines", patch);
            toast("Medicine added", "success");
          }
          closeModal();
          populateCategoryFilter();
          refresh();
        });
      },
    });
  }

  function openDetails(medicine) {
    openModal({
      title: medicine.medicine_name,
      wide: true,
      bodyHtml: `<div id="detailsTabs"></div>`,
      onMount: () => {
        renderTabs(document.getElementById("detailsTabs"), [
          {
            key: "info", label: "Basic Info", render: (panel) => {
              panel.innerHTML = `
                <div class="detail-grid">
                  <div class="detail-item"><span class="label">Category</span><strong>${escapeHtml(medicine.category || "—")}</strong></div>
                  <div class="detail-item"><span class="label">Manufacturer</span><strong>${escapeHtml(medicine.manufacturer || "—")}</strong></div>
                  <div class="detail-item"><span class="label">Price</span><strong>${formatCurrency(medicine.price)}</strong></div>
                  <div class="detail-item"><span class="label">Expiry</span><strong>${formatDate(medicine.expiry_date)}</strong></div>
                </div>
              `;
            },
          },
          {
            key: "stock", label: "Stock", render: (panel) => {
              panel.innerHTML = `
                <div class="detail-grid">
                  <div class="detail-item"><span class="label">Current Quantity</span><strong>${medicine.quantity}</strong></div>
                  <div class="detail-item"><span class="label">Status</span><strong>${badge(stockStatus(medicine))}</strong></div>
                </div>
              `;
            },
          },
          {
            key: "batches", label: "Batches", render: (panel) => {
              const batches = MediCoreDB.get("medicineBatches").filter((b) => b.medicine_id === medicine.medicine_id);
              if (!batches.length) { panel.innerHTML = `<div class="empty-state"><div class="icon">🗂️</div><div>No batches recorded for this medicine.</div></div>`; return; }
              const rows = batches.map((b) => `<tr><td class="cell-primary">${escapeHtml(b.batch_number)}</td><td>${b.quantity}</td><td>${formatDate(b.manufacturing_date)}</td><td>${formatDate(b.expiry_date)}</td><td>${escapeHtml(b.storage_location || "—")}</td></tr>`).join("");
              panel.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Batch #</th><th>Qty</th><th>Mfg Date</th><th>Expiry</th><th>Location</th></tr></thead><tbody>${rows}</tbody></table></div>`;
            },
          },
        ]);
      },
    });
  }

  function refresh() {
    loadStats();
    const medicines = MediCoreDB.get("medicines").map((m) => Object.assign({ __id: m.medicine_id }, m, { status: stockStatus(m) }));
    const categoryFilter = document.getElementById("categoryFilter");

    renderDataTable(document.getElementById("tableContainer"), {
      columns: [
        { label: "Medicine", field: "medicine_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.medicine_name)}</span>` },
        { label: "Category", field: "category" },
        { label: "Manufacturer", field: "manufacturer", className: "cell-muted" },
        { label: "Quantity", field: "quantity" },
        { label: "Price", field: "price", render: (r) => formatCurrency(r.price) },
        { label: "Expiry", field: "expiry_date", render: (r) => formatDate(r.expiry_date) },
        { label: "Status", field: "status", render: (r) => badge(r.status) },
      ],
      data: medicines,
      searchInput: document.getElementById("searchInput"),
      filterFn: (row) => !categoryFilter.value || row.category === categoryFilter.value,
      emptyMessage: "No medicines match your search.",
      rowActions: (row) => `
        <button class="btn btn-ghost btn-sm" data-act="view" data-id="${row.medicine_id}">${icon("eye")}</button>
        <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${row.medicine_id}">${icon("edit")}</button>
        <button class="btn btn-ghost btn-sm" data-act="del" data-id="${row.medicine_id}">${icon("trash")}</button>
      `,
      onAction: (act, id) => {
        const medicine = MediCoreDB.get("medicines").find((m) => String(m.medicine_id) === id);
        if (act === "view") {
          openDetails(medicine);
        } else if (act === "edit") {
          openForm(medicine);
        } else if (act === "del") {
          confirmAction("Remove this medicine from inventory?", () => {
            MediCoreDB.remove("medicines", "medicine_id", id);
            toast("Medicine removed", "info");
            populateCategoryFilter();
            refresh();
          });
        }
      },
    });
  }

  document.getElementById("addBtn").addEventListener("click", () => openForm(null));
  document.getElementById("categoryFilter").addEventListener("change", refresh);

  populateCategoryFilter();
  refresh();
})();
