(function () {
  const session = MediCoreAuth.requireRole(["pharmacy"]);
  if (!session) return;

  const { toast, badge, escapeHtml, formatDate, renderDataTable, openModal, closeModal, confirmAction, icon } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "pharmacy-stock", title: "Stock", breadcrumb: "Pharmacy / Stock" });
  document.getElementById("searchIconSlot").innerHTML = icon("search");

  function medicineOptions() {
    return MediCoreDB.get("medicines").map((m) => `<option value="${m.medicine_id}">${escapeHtml(m.medicine_name)} (${m.quantity} in stock)</option>`).join("");
  }
  function supplierOptions() {
    return MediCoreDB.get("suppliers").map((s) => `<option value="${s.supplier_id}">${escapeHtml(s.supplier_name)}</option>`).join("");
  }

  function loadStats() {
    const tx = MediCoreDB.get("stockTransactions");
    const inQty = tx.filter((t) => t.transaction_type === "IN").reduce((s, t) => s + Number(t.quantity), 0);
    const outQty = tx.filter((t) => t.transaction_type === "OUT").reduce((s, t) => s + Number(t.quantity), 0);
    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">Total Transactions</span><strong>${tx.length}</strong></div><div class="stat-icon teal">📦</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Units Stocked In</span><strong>${inQty}</strong></div><div class="stat-icon blue">⬇️</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Units Stocked Out</span><strong>${outQty}</strong></div><div class="stat-icon amber">⬆️</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Suppliers</span><strong>${MediCoreDB.get("suppliers").length}</strong></div><div class="stat-icon slate">🚚</div></div>
    `;
  }

  function openStockIn() {
    openModal({
      title: "Stock In",
      bodyHtml: `
        <div class="form-grid">
          <div class="field full"><label>Medicine</label><select id="f_medicine">${medicineOptions()}</select></div>
          <div class="field full"><label>Supplier</label><select id="f_supplier">${supplierOptions()}</select></div>
          <div class="field"><label>Batch Number</label><input id="f_batch" placeholder="e.g. BATCH-0192" /></div>
          <div class="field"><label>Quantity</label><input id="f_quantity" type="number" min="1" value="1" /></div>
          <div class="field"><label>Manufacturing Date</label><input type="date" id="f_mfg" /></div>
          <div class="field"><label>Expiry Date</label><input type="date" id="f_expiry" /></div>
        </div>
      `,
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">Add Stock</button>`,
      onMount: () => {
        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const medicineId = Number(document.getElementById("f_medicine").value);
          const quantity = Number(document.getElementById("f_quantity").value) || 0;
          if (!quantity) { toast("Quantity must be greater than 0", "danger"); return; }

          let batchId = null;
          const batchNumber = document.getElementById("f_batch").value.trim();
          if (batchNumber) {
            batchId = MediCoreDB.nextId("medicineBatches", "batch_id");
            MediCoreDB.insert("medicineBatches", {
              batch_id: batchId, medicine_id: medicineId, batch_number: batchNumber, quantity,
              manufacturing_date: document.getElementById("f_mfg").value,
              expiry_date: document.getElementById("f_expiry").value,
              storage_location: "Main Store",
            });
          }

          MediCoreDB.insert("stockTransactions", {
            transaction_id: MediCoreDB.nextId("stockTransactions", "transaction_id"),
            medicine_id: medicineId, batch_id: batchId, transaction_type: "IN", quantity,
            transaction_date: "2026-09-17", reason: "Supplier restock",
          });

          const medicine = MediCoreDB.get("medicines").find((m) => m.medicine_id === medicineId);
          if (medicine) MediCoreDB.update("medicines", "medicine_id", medicineId, { quantity: Number(medicine.quantity) + quantity });

          toast("Stock added", "success");
          closeModal();
          refresh();
        });
      },
    });
  }

  function openStockOut() {
    openModal({
      title: "Stock Out",
      bodyHtml: `
        <div class="form-grid">
          <div class="field full"><label>Medicine</label><select id="f_medicine">${medicineOptions()}</select></div>
          <div class="field"><label>Quantity</label><input id="f_quantity" type="number" min="1" value="1" /></div>
          <div class="field full"><label>Reason</label><input id="f_reason" placeholder="e.g. Dispensed to ward, expired disposal..." /></div>
        </div>
      `,
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">Remove Stock</button>`,
      onMount: () => {
        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const medicineId = Number(document.getElementById("f_medicine").value);
          const quantity = Number(document.getElementById("f_quantity").value) || 0;
          const medicine = MediCoreDB.get("medicines").find((m) => m.medicine_id === medicineId);
          if (!quantity) { toast("Quantity must be greater than 0", "danger"); return; }
          if (medicine && quantity > medicine.quantity) { toast(`Only ${medicine.quantity} unit(s) available`, "danger"); return; }

          MediCoreDB.insert("stockTransactions", {
            transaction_id: MediCoreDB.nextId("stockTransactions", "transaction_id"),
            medicine_id: medicineId, batch_id: null, transaction_type: "OUT", quantity,
            transaction_date: "2026-09-17", reason: document.getElementById("f_reason").value.trim() || "Dispensed",
          });
          if (medicine) MediCoreDB.update("medicines", "medicine_id", medicineId, { quantity: Number(medicine.quantity) - quantity });

          toast("Stock removed", "success");
          closeModal();
          refresh();
        });
      },
    });
  }

  function supplierForm(record) {
    const s = record || {};
    return `
      <div class="form-grid">
        <div class="field full"><label>Supplier Name</label><input id="f_name" value="${escapeHtml(s.supplier_name || "")}" /></div>
        <div class="field"><label>Phone</label><input id="f_phone" value="${escapeHtml(s.phone || "")}" /></div>
        <div class="field"><label>Email</label><input id="f_email" value="${escapeHtml(s.email || "")}" /></div>
        <div class="field full"><label>Address</label><textarea id="f_address" rows="2">${escapeHtml(s.address || "")}</textarea></div>
      </div>
    `;
  }

  function openSupplierForm(record) {
    const isEdit = !!record;
    openModal({
      title: isEdit ? "Edit Supplier" : "Add Supplier",
      bodyHtml: supplierForm(record),
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">${isEdit ? "Save Changes" : "Add Supplier"}</button>`,
      onMount: () => {
        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const name = document.getElementById("f_name").value.trim();
          if (!name) { toast("Supplier name is required", "danger"); return; }
          const patch = {
            supplier_name: name,
            phone: document.getElementById("f_phone").value.trim(),
            email: document.getElementById("f_email").value.trim(),
            address: document.getElementById("f_address").value.trim(),
          };
          if (isEdit) {
            MediCoreDB.update("suppliers", "supplier_id", record.supplier_id, patch);
            toast("Supplier updated", "success");
          } else {
            patch.supplier_id = MediCoreDB.nextId("suppliers", "supplier_id");
            MediCoreDB.insert("suppliers", patch);
            toast("Supplier added", "success");
          }
          closeModal();
          refresh();
        });
      },
    });
  }

  function refresh() {
    loadStats();
    const medicineMap = MediCoreDB.lookup("medicines", "medicine_id");
    const typeFilter = document.getElementById("typeFilter");
    const tx = MediCoreDB.get("stockTransactions").map((t) => Object.assign({ __id: t.transaction_id }, t, {
      medicine_name: medicineMap[t.medicine_id] ? medicineMap[t.medicine_id].medicine_name : "Unknown",
    })).sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1));

    renderDataTable(document.getElementById("tableContainer"), {
      columns: [
        { label: "Medicine", field: "medicine_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.medicine_name)}</span>` },
        { label: "Type", field: "transaction_type", render: (r) => badge(r.transaction_type === "IN" ? "Stock In" : "Stock Out") },
        { label: "Quantity", field: "quantity" },
        { label: "Date", field: "transaction_date", render: (r) => formatDate(r.transaction_date) },
        { label: "Reason", field: "reason", className: "cell-muted" },
      ],
      data: tx,
      searchInput: document.getElementById("searchInput"),
      filterFn: (row) => !typeFilter.value || row.transaction_type === typeFilter.value,
      emptyMessage: "No stock transactions recorded.",
    });

    const suppliers = MediCoreDB.get("suppliers").map((s) => Object.assign({ __id: s.supplier_id }, s));
    renderDataTable(document.getElementById("supplierTable"), {
      columns: [
        { label: "Supplier", field: "supplier_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.supplier_name)}</span>` },
        { label: "Phone", field: "phone" },
        { label: "Email", field: "email" },
        { label: "Address", field: "address", className: "cell-muted" },
      ],
      data: suppliers,
      emptyMessage: "No suppliers registered.",
      rowActions: (row) => `
        <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${row.supplier_id}">${icon("edit")}</button>
        <button class="btn btn-ghost btn-sm" data-act="del" data-id="${row.supplier_id}">${icon("trash")}</button>
      `,
      onAction: (act, id) => {
        if (act === "edit") {
          openSupplierForm(MediCoreDB.get("suppliers").find((s) => String(s.supplier_id) === id));
        } else if (act === "del") {
          confirmAction("Remove this supplier?", () => {
            MediCoreDB.remove("suppliers", "supplier_id", id);
            toast("Supplier removed", "info");
            refresh();
          });
        }
      },
    });
  }

  document.getElementById("stockInBtn").addEventListener("click", openStockIn);
  document.getElementById("stockOutBtn").addEventListener("click", openStockOut);
  document.getElementById("addSupplierBtn").addEventListener("click", () => openSupplierForm(null));
  document.getElementById("typeFilter").addEventListener("change", refresh);

  refresh();
})();
