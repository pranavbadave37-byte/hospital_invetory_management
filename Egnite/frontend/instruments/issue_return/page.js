(function () {
  const session = MediCoreAuth.requireRole(["instrument"]);
  if (!session) return;

  const { toast, badge, escapeHtml, formatDate, renderDataTable, openModal, closeModal, confirmAction, icon } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "instruments-issue_return", title: "Issue / Return", breadcrumb: "Instrument Management / Issue & Return" });
  document.getElementById("searchIconSlot").innerHTML = icon("search");

  const TODAY = "2026-09-17";

  function instrumentOptions() {
    return MediCoreDB.get("instruments").filter((i) => i.available_quantity > 0).map((i) => `<option value="${i.instrument_id}">${escapeHtml(i.instrument_name)} (${i.available_quantity} available)</option>`).join("");
  }

  function loadStats(records) {
    const issued = records.filter((r) => r.status === "Issued").length;
    const overdue = records.filter((r) => r.status === "Issued" && r.expected_return_date < TODAY).length;
    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">Total Records</span><strong>${records.length}</strong></div><div class="stat-icon teal">🔄</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Currently Issued</span><strong>${issued}</strong></div><div class="stat-icon amber">📤</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Overdue Returns</span><strong>${overdue}</strong></div><div class="stat-icon rose">⏰</div></div>
    `;
  }

  function issueForm() {
    return `
      <div class="form-grid">
        <div class="field full"><label>Instrument</label><select id="f_instrument">${instrumentOptions()}</select></div>
        <div class="field"><label>Issued To</label><input id="f_issuedTo" placeholder="e.g. OT-2 Surgical Team" /></div>
        <div class="field"><label>Department</label><input id="f_department" placeholder="e.g. Surgery" /></div>
        <div class="field"><label>Issue Date</label><input type="date" id="f_issueDate" value="${TODAY}" /></div>
        <div class="field"><label>Expected Return</label><input type="date" id="f_expectedReturn" /></div>
      </div>
    `;
  }

  function openIssueForm() {
    if (!MediCoreDB.get("instruments").some((i) => i.available_quantity > 0)) {
      toast("No instruments currently available to issue", "danger");
      return;
    }
    openModal({
      title: "Issue Instrument",
      bodyHtml: issueForm(),
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">Issue</button>`,
      onMount: () => {
        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const instrumentId = Number(document.getElementById("f_instrument").value);
          const issuedTo = document.getElementById("f_issuedTo").value.trim();
          if (!issuedTo) { toast("Issued To is required", "danger"); return; }
          const instrument = MediCoreDB.get("instruments").find((i) => i.instrument_id === instrumentId);

          MediCoreDB.insert("instrumentIssues", {
            issue_id: MediCoreDB.nextId("instrumentIssues", "issue_id"),
            instrument_id: instrumentId,
            issued_to: issuedTo,
            department: document.getElementById("f_department").value.trim(),
            issue_date: document.getElementById("f_issueDate").value,
            expected_return_date: document.getElementById("f_expectedReturn").value,
            return_date: null,
            condition_after_return: "",
            remarks: "",
            status: "Issued",
          });
          if (instrument) MediCoreDB.update("instruments", "instrument_id", instrumentId, { available_quantity: instrument.available_quantity - 1 });

          toast("Instrument issued", "success");
          closeModal();
          refresh();
        });
      },
    });
  }

  function openReturnForm(record) {
    openModal({
      title: "Return Instrument",
      bodyHtml: `
        <div class="form-grid">
          <div class="field"><label>Return Date</label><input type="date" id="f_returnDate" value="${TODAY}" /></div>
          <div class="field">
            <label>Condition on Return</label>
            <select id="f_condition"><option>Good</option><option>Needs Service</option><option>Damaged</option></select>
          </div>
          <div class="field full"><label>Remarks</label><input id="f_remarks" placeholder="Optional notes" /></div>
        </div>
      `,
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">Confirm Return</button>`,
      onMount: () => {
        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const condition = document.getElementById("f_condition").value;
          MediCoreDB.update("instrumentIssues", "issue_id", record.issue_id, {
            status: "Returned",
            return_date: document.getElementById("f_returnDate").value,
            condition_after_return: condition,
            remarks: document.getElementById("f_remarks").value.trim(),
          });
          const instrument = MediCoreDB.get("instruments").find((i) => i.instrument_id === record.instrument_id);
          if (instrument) {
            const patch = { available_quantity: instrument.available_quantity + 1 };
            if (condition !== "Good") patch.condition_status = condition;
            MediCoreDB.update("instruments", "instrument_id", instrument.instrument_id, patch);
          }
          toast("Instrument return recorded", "success");
          closeModal();
          refresh();
        });
      },
    });
  }

  function refresh() {
    const instrumentMap = MediCoreDB.lookup("instruments", "instrument_id");
    const all = MediCoreDB.get("instrumentIssues");
    loadStats(all);

    const rows = all.map((r) => Object.assign({ __id: r.issue_id }, r, {
      instrument_name: instrumentMap[r.instrument_id] ? instrumentMap[r.instrument_id].instrument_name : "Unknown",
      overdue: r.status === "Issued" && r.expected_return_date < TODAY,
    }));
    const statusFilter = document.getElementById("statusFilter");

    renderDataTable(document.getElementById("tableContainer"), {
      columns: [
        { label: "Instrument", field: "instrument_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.instrument_name)}</span>` },
        { label: "Issued To", field: "issued_to" },
        { label: "Department", field: "department" },
        { label: "Issue Date", field: "issue_date", render: (r) => formatDate(r.issue_date) },
        { label: "Expected Return", field: "expected_return_date", render: (r) => formatDate(r.expected_return_date) },
        { label: "Status", field: "status", render: (r) => (r.overdue ? badge("Overdue") : badge(r.status)) },
      ],
      data: rows,
      searchInput: document.getElementById("searchInput"),
      filterFn: (row) => !statusFilter.value || row.status === statusFilter.value,
      emptyMessage: "No issue/return records found.",
      rowActions: (row) => row.status === "Issued"
        ? `<button class="btn btn-outline btn-sm" data-act="return" data-id="${row.issue_id}">Return</button>`
        : `<span class="cell-muted">${row.condition_after_return ? badge(row.condition_after_return) : "—"}</span>`,
      onAction: (act, id) => {
        if (act === "return") {
          openReturnForm(MediCoreDB.get("instrumentIssues").find((r) => String(r.issue_id) === id));
        }
      },
    });
  }

  document.getElementById("addBtn").addEventListener("click", openIssueForm);
  document.getElementById("statusFilter").addEventListener("change", refresh);

  refresh();
})();
