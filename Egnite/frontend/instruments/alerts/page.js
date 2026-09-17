(function () {
  const session = MediCoreAuth.requireRole(["instrument"]);
  if (!session) return;

  const { badge, escapeHtml, formatDate, formatCurrency, renderDataTable } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "instruments-alerts", title: "Alerts", breadcrumb: "Instrument Management / Alerts" });

  const TODAY = "2026-09-17";

  function refresh() {
    const instrumentMap = MediCoreDB.lookup("instruments", "instrument_id");

    const maintenance = MediCoreDB.get("instrumentMaintenance")
      .filter((m) => m.status !== "Completed")
      .map((m) => Object.assign({ __id: m.maintenance_id }, m, {
        instrument_name: instrumentMap[m.instrument_id] ? instrumentMap[m.instrument_id].instrument_name : "Unknown",
      }));

    const overdue = MediCoreDB.get("instrumentIssues")
      .filter((i) => i.status === "Issued" && i.expected_return_date && i.expected_return_date < TODAY)
      .map((i) => Object.assign({ __id: i.issue_id }, i, {
        instrument_name: instrumentMap[i.instrument_id] ? instrumentMap[i.instrument_id].instrument_name : "Unknown",
      }));

    const damagedInstruments = MediCoreDB.get("instruments").filter((i) => i.condition_status === "Damaged");
    const damagedReturns = MediCoreDB.get("instrumentIssues").filter((i) => i.condition_after_return === "Damaged");

    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">Maintenance Due</span><strong>${maintenance.length}</strong></div><div class="stat-icon amber">🛠️</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Overdue Returns</span><strong>${overdue.length}</strong></div><div class="stat-icon rose">⏰</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Damaged</span><strong>${damagedInstruments.length}</strong></div><div class="stat-icon rose">💥</div></div>
    `;

    renderDataTable(document.getElementById("maintenanceTable"), {
      columns: [
        { label: "Instrument", field: "instrument_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.instrument_name)}</span>` },
        { label: "Issue", field: "issue_description", className: "cell-muted" },
        { label: "Reported", field: "maintenance_date", render: (r) => formatDate(r.maintenance_date) },
        { label: "Cost", field: "maintenance_cost", render: (r) => formatCurrency(r.maintenance_cost) },
        { label: "Status", field: "status", render: (r) => badge(r.status) },
      ],
      data: maintenance,
      emptyMessage: "No instruments currently need maintenance.",
    });

    renderDataTable(document.getElementById("overdueTable"), {
      columns: [
        { label: "Instrument", field: "instrument_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.instrument_name)}</span>` },
        { label: "Issued To", field: "issued_to" },
        { label: "Department", field: "department" },
        { label: "Expected Return", field: "expected_return_date", render: (r) => formatDate(r.expected_return_date) },
        { label: "Status", field: "expected_return_date", render: () => badge("Overdue") },
      ],
      data: overdue,
      emptyMessage: "No overdue returns.",
    });

    const damagedRows = damagedInstruments.map((i) => ({ __id: "inst-" + i.instrument_id, instrument_name: i.instrument_name, source: "Inventory flag", note: i.category }));
    damagedReturns.forEach((r) => {
      const inst = instrumentMap[r.instrument_id];
      damagedRows.push({ __id: "ret-" + r.issue_id, instrument_name: inst ? inst.instrument_name : "Unknown", source: "Returned damaged", note: r.remarks || "—" });
    });

    renderDataTable(document.getElementById("damagedTable"), {
      columns: [
        { label: "Instrument", field: "instrument_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.instrument_name)}</span>` },
        { label: "Source", field: "source", render: (r) => badge(r.source === "Inventory flag" ? "Damaged" : "Damaged") },
        { label: "Notes", field: "note", className: "cell-muted" },
      ],
      data: damagedRows,
      emptyMessage: "No damaged instruments on record.",
    });
  }

  refresh();
})();
