(function () {
  const session = MediCoreAuth.requireRole(["instrument"]);
  if (!session) return;

  const { toast, badge, escapeHtml, formatDate, formatCurrency, renderDataTable, renderTabs, openModal, closeModal, confirmAction, icon } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "instruments-instruments", title: "Instruments", breadcrumb: "Instrument Management / Instruments" });

  function loadStats() {
    const instruments = MediCoreDB.get("instruments");
    const totalUnits = instruments.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const inUse = instruments.reduce((s, i) => s + (Number(i.quantity || 0) - Number(i.available_quantity || 0)), 0);
    const needsService = instruments.filter((i) => i.condition_status !== "Good").length;
    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">Instrument Types</span><strong>${instruments.length}</strong></div><div class="stat-icon teal">🧰</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Total Units</span><strong>${totalUnits}</strong></div><div class="stat-icon blue">📦</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Currently In Use</span><strong>${inUse}</strong></div><div class="stat-icon slate">🔄</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Needs Attention</span><strong>${needsService}</strong></div><div class="stat-icon amber">⚠️</div></div>
    `;
  }

  /* ---------------- Inventory tab ---------------- */
  function instrumentForm(record) {
    const i = record || {};
    return `
      <div class="form-grid">
        <div class="field full"><label>Instrument Name</label><input id="f_name" value="${escapeHtml(i.instrument_name || "")}" /></div>
        <div class="field"><label>Category</label><input id="f_category" value="${escapeHtml(i.category || "")}" /></div>
        <div class="field"><label>Manufacturer</label><input id="f_manufacturer" value="${escapeHtml(i.manufacturer || "")}" /></div>
        <div class="field"><label>Total Quantity</label><input id="f_quantity" type="number" min="0" value="${i.quantity ?? 0}" /></div>
        <div class="field"><label>Available Quantity</label><input id="f_available" type="number" min="0" value="${i.available_quantity ?? 0}" /></div>
        <div class="field">
          <label>Condition</label>
          <select id="f_condition">
            ${["Good", "Needs Service", "Under Maintenance", "Damaged"].map((s) => `<option ${i.condition_status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
    `;
  }

  function openInstrumentForm(record) {
    const isEdit = !!record;
    openModal({
      title: isEdit ? "Edit Instrument" : "Add Instrument",
      bodyHtml: instrumentForm(record),
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">${isEdit ? "Save Changes" : "Add Instrument"}</button>`,
      onMount: () => {
        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const name = document.getElementById("f_name").value.trim();
          if (!name) { toast("Instrument name is required", "danger"); return; }
          const patch = {
            instrument_name: name,
            category: document.getElementById("f_category").value.trim(),
            manufacturer: document.getElementById("f_manufacturer").value.trim(),
            quantity: Number(document.getElementById("f_quantity").value) || 0,
            available_quantity: Number(document.getElementById("f_available").value) || 0,
            condition_status: document.getElementById("f_condition").value,
          };
          if (isEdit) {
            MediCoreDB.update("instruments", "instrument_id", record.instrument_id, patch);
            toast("Instrument updated", "success");
          } else {
            patch.instrument_id = MediCoreDB.nextId("instruments", "instrument_id");
            MediCoreDB.insert("instruments", patch);
            toast("Instrument added", "success");
          }
          closeModal();
          loadStats();
          tabs.setActive("inventory");
        });
      },
    });
  }

  function openInstrumentDetails(instrument) {
    openModal({
      title: instrument.instrument_name,
      wide: true,
      bodyHtml: `<div id="detailsTabs"></div>`,
      onMount: () => {
        renderTabs(document.getElementById("detailsTabs"), [
          { key: "info", label: "Basic Info", render: (panel) => {
            panel.innerHTML = `
              <div class="detail-grid">
                <div class="detail-item"><span class="label">Category</span><strong>${escapeHtml(instrument.category || "—")}</strong></div>
                <div class="detail-item"><span class="label">Manufacturer</span><strong>${escapeHtml(instrument.manufacturer || "—")}</strong></div>
                <div class="detail-item"><span class="label">Total Quantity</span><strong>${instrument.quantity}</strong></div>
                <div class="detail-item"><span class="label">Available</span><strong>${instrument.available_quantity}</strong></div>
              </div>
            `;
          }},
          { key: "status", label: "Status & Condition", render: (panel) => {
            panel.innerHTML = `
              <div class="detail-grid">
                <div class="detail-item"><span class="label">Condition</span><strong>${badge(instrument.condition_status)}</strong></div>
                <div class="detail-item"><span class="label">In Use</span><strong>${instrument.quantity - instrument.available_quantity}</strong></div>
              </div>
            `;
          }},
          { key: "maintenance", label: "Maintenance History", render: (panel) => {
            const records = MediCoreDB.get("instrumentMaintenance").filter((m) => m.instrument_id === instrument.instrument_id);
            if (!records.length) { panel.innerHTML = `<div class="empty-state"><div class="icon">🗂️</div><div>No maintenance history for this instrument.</div></div>`; return; }
            const rows = records.map((m) => `<tr><td>${formatDate(m.maintenance_date)}</td><td class="cell-muted">${escapeHtml(m.issue_description)}</td><td>${formatCurrency(m.maintenance_cost)}</td><td>${badge(m.status)}</td></tr>`).join("");
            panel.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Issue</th><th>Cost</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
          }},
        ]);
      },
    });
  }

  function renderInventory(panel) {
    panel.innerHTML = `
      <div class="panel-header">
        <div><h2>Inventory</h2><p>Surgical &amp; diagnostic equipment stock</p></div>
        <div class="toolbar">
          <div class="search-box"><span id="searchIconSlot"></span><input type="text" id="searchInput" placeholder="Search instrument, category..." /></div>
          <select class="select-filter" id="conditionFilter">
            <option value="">All conditions</option>
            <option>Good</option><option>Needs Service</option><option>Under Maintenance</option><option>Damaged</option>
          </select>
          <button class="btn btn-primary btn-sm" id="addBtn">＋ Add Instrument</button>
        </div>
      </div>
      <div class="panel-body no-pad" id="tableContainer"></div>
    `;
    panel.querySelector("#searchIconSlot").innerHTML = icon("search");

    function refresh() {
      const instruments = MediCoreDB.get("instruments").map((i) => Object.assign({ __id: i.instrument_id }, i));
      const conditionFilter = panel.querySelector("#conditionFilter");

      renderDataTable(panel.querySelector("#tableContainer"), {
        columns: [
          { label: "Instrument", field: "instrument_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.instrument_name)}</span>` },
          { label: "Category", field: "category" },
          { label: "Manufacturer", field: "manufacturer", className: "cell-muted" },
          { label: "Total Qty", field: "quantity" },
          { label: "Available", field: "available_quantity" },
          { label: "Condition", field: "condition_status", render: (r) => badge(r.condition_status) },
        ],
        data: instruments,
        searchInput: panel.querySelector("#searchInput"),
        filterFn: (row) => !conditionFilter.value || row.condition_status === conditionFilter.value,
        emptyMessage: "No instruments match your search.",
        rowActions: (row) => `
          <button class="btn btn-ghost btn-sm" data-act="view" data-id="${row.instrument_id}">${icon("eye")}</button>
          <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${row.instrument_id}">${icon("edit")}</button>
          <button class="btn btn-ghost btn-sm" data-act="del" data-id="${row.instrument_id}">${icon("trash")}</button>
        `,
        onAction: (act, id) => {
          const instrument = MediCoreDB.get("instruments").find((i) => String(i.instrument_id) === id);
          if (act === "view") {
            openInstrumentDetails(instrument);
          } else if (act === "edit") {
            openInstrumentForm(instrument);
          } else if (act === "del") {
            confirmAction("Remove this instrument from inventory?", () => {
              MediCoreDB.remove("instruments", "instrument_id", id);
              toast("Instrument removed", "info");
              loadStats();
              refresh();
            });
          }
        },
      });
      loadStats();
    }

    panel.querySelector("#addBtn").addEventListener("click", () => openInstrumentForm(null));
    panel.querySelector("#conditionFilter").addEventListener("change", refresh);
    refresh();
  }

  /* ---------------- Maintenance tab ---------------- */
  function instrumentOptions(selectedId) {
    return MediCoreDB.get("instruments").map((i) => `<option value="${i.instrument_id}" ${String(i.instrument_id) === String(selectedId) ? "selected" : ""}>${escapeHtml(i.instrument_name)}</option>`).join("");
  }

  function maintenanceForm(record) {
    const m = record || {};
    return `
      <div class="form-grid">
        <div class="field full"><label>Instrument</label><select id="f_instrument">${instrumentOptions(m.instrument_id)}</select></div>
        <div class="field full"><label>Issue Description</label><input id="f_issue" value="${escapeHtml(m.issue_description || "")}" /></div>
        <div class="field"><label>Reported Date</label><input type="date" id="f_date" value="${m.maintenance_date || "2026-09-17"}" /></div>
        <div class="field"><label>Estimated Cost (₹)</label><input id="f_cost" type="number" min="0" value="${m.maintenance_cost ?? 0}" /></div>
        <div class="field"><label>Next Service Date</label><input type="date" id="f_next" value="${m.next_maintenance_date || ""}" /></div>
        <div class="field">
          <label>Status</label>
          <select id="f_status">
            ${["Scheduled", "In Progress", "Completed"].map((s) => `<option ${m.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
    `;
  }

  function openMaintenanceForm(record, onDone) {
    const isEdit = !!record;
    openModal({
      title: isEdit ? "Edit Maintenance Record" : "Schedule Maintenance",
      bodyHtml: maintenanceForm(record),
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">${isEdit ? "Save Changes" : "Schedule"}</button>`,
      onMount: () => {
        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const instrumentId = Number(document.getElementById("f_instrument").value);
          const status = document.getElementById("f_status").value;
          const patch = {
            instrument_id: instrumentId,
            issue_description: document.getElementById("f_issue").value.trim(),
            maintenance_date: document.getElementById("f_date").value,
            maintenance_cost: Number(document.getElementById("f_cost").value) || 0,
            next_maintenance_date: document.getElementById("f_next").value,
            status,
          };
          if (isEdit) {
            MediCoreDB.update("instrumentMaintenance", "maintenance_id", record.maintenance_id, patch);
            toast("Maintenance record updated", "success");
          } else {
            patch.maintenance_id = MediCoreDB.nextId("instrumentMaintenance", "maintenance_id");
            MediCoreDB.insert("instrumentMaintenance", patch);
            MediCoreDB.update("instruments", "instrument_id", instrumentId, { condition_status: status === "Completed" ? "Good" : "Under Maintenance" });
            toast("Maintenance scheduled", "success");
          }
          closeModal();
          onDone();
        });
      },
    });
  }

  function renderMaintenance(panel) {
    panel.innerHTML = `
      <div class="panel-header">
        <div><h2>Maintenance</h2><p>Due, scheduled, in progress &amp; history</p></div>
        <div class="toolbar">
          <select class="select-filter" id="maintStatusFilter">
            <option value="">All statuses</option>
            <option>Scheduled</option><option>In Progress</option><option>Completed</option>
          </select>
          <button class="btn btn-primary btn-sm" id="scheduleBtn">＋ Schedule Maintenance</button>
        </div>
      </div>
      <div class="panel-body no-pad" id="maintTableContainer"></div>
    `;
    const instrumentMap = MediCoreDB.lookup("instruments", "instrument_id");

    function refresh() {
      const statusFilter = panel.querySelector("#maintStatusFilter");
      const records = MediCoreDB.get("instrumentMaintenance").map((m) => Object.assign({ __id: m.maintenance_id }, m, {
        instrument_name: instrumentMap[m.instrument_id] ? instrumentMap[m.instrument_id].instrument_name : "Unknown",
      }));

      renderDataTable(panel.querySelector("#maintTableContainer"), {
        columns: [
          { label: "Instrument", field: "instrument_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.instrument_name)}</span>` },
          { label: "Issue", field: "issue_description", className: "cell-muted" },
          { label: "Reported", field: "maintenance_date", render: (r) => formatDate(r.maintenance_date) },
          { label: "Cost", field: "maintenance_cost", render: (r) => formatCurrency(r.maintenance_cost) },
          { label: "Next Service", field: "next_maintenance_date", render: (r) => formatDate(r.next_maintenance_date) },
          { label: "Status", field: "status", render: (r) => badge(r.status) },
        ],
        data: records,
        filterFn: (row) => !statusFilter.value || row.status === statusFilter.value,
        emptyMessage: "No maintenance records found.",
        rowActions: (row) => `
          ${row.status !== "Completed" ? `<button class="btn btn-outline btn-sm" data-act="complete" data-id="${row.maintenance_id}">Mark Complete</button>` : ""}
          <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${row.maintenance_id}">${icon("edit")}</button>
        `,
        onAction: (act, id) => {
          const record = MediCoreDB.get("instrumentMaintenance").find((m) => String(m.maintenance_id) === id);
          if (act === "edit") {
            openMaintenanceForm(record, refresh);
          } else if (act === "complete") {
            MediCoreDB.update("instrumentMaintenance", "maintenance_id", id, { status: "Completed" });
            MediCoreDB.update("instruments", "instrument_id", record.instrument_id, { condition_status: "Good" });
            toast("Marked as completed", "success");
            loadStats();
            refresh();
          }
        },
      });
    }

    panel.querySelector("#scheduleBtn").addEventListener("click", () => openMaintenanceForm(null, refresh));
    panel.querySelector("#maintStatusFilter").addEventListener("change", refresh);
    refresh();
  }

  loadStats();
  const tabs = renderTabs(document.getElementById("viewTabs"), [
    { key: "inventory", label: "Inventory", render: renderInventory },
    { key: "maintenance", label: "Maintenance", render: renderMaintenance },
  ]);
})();
