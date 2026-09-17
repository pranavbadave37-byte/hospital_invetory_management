(function () {
  const session = MediCoreAuth.requireRole(["doctor"]);
  if (!session) return;
  const doctorId = session.doctor_id;

  const { toast, badge, escapeHtml, renderDataTable, openModal, closeModal, confirmAction, icon } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "doctor-patients", title: "Patients", breadcrumb: "Doctor / Patients" });
  document.getElementById("searchIconSlot").innerHTML = icon("search");

  function myPatientIds() {
    const fromAppts = MediCoreDB.get("appointments").filter((a) => a.doctor_id === doctorId).map((a) => a.patient_id);
    const fromConsults = MediCoreDB.get("consultations").filter((c) => c.doctor_id === doctorId).map((c) => c.patient_id);
    return new Set([...fromAppts, ...fromConsults]);
  }

  function loadStats(patients) {
    const male = patients.filter((p) => p.gender === "Male").length;
    const female = patients.filter((p) => p.gender === "Female").length;
    const avgAge = patients.length ? Math.round(patients.reduce((s, p) => s + Number(p.age || 0), 0) / patients.length) : 0;
    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">My Patients</span><strong>${patients.length}</strong></div><div class="stat-icon teal">👤</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Male</span><strong>${male}</strong></div><div class="stat-icon blue">♂</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Female</span><strong>${female}</strong></div><div class="stat-icon rose">♀</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Average Age</span><strong>${avgAge}</strong></div><div class="stat-icon slate">📊</div></div>
    `;
  }

  function patientForm(patient) {
    const p = patient || {};
    return `
      <div class="form-grid">
        <div class="field"><label>First Name</label><input id="f_first" value="${escapeHtml(p.first_name || "")}" /></div>
        <div class="field"><label>Last Name</label><input id="f_last" value="${escapeHtml(p.last_name || "")}" /></div>
        <div class="field"><label>Age</label><input id="f_age" type="number" min="0" value="${p.age || ""}" /></div>
        <div class="field">
          <label>Gender</label>
          <select id="f_gender">
            <option ${p.gender === "Male" ? "selected" : ""}>Male</option>
            <option ${p.gender === "Female" ? "selected" : ""}>Female</option>
            <option ${p.gender === "Other" ? "selected" : ""}>Other</option>
          </select>
        </div>
        <div class="field"><label>Blood Group</label><input id="f_blood" value="${escapeHtml(p.blood_group || "")}" placeholder="e.g. O+" /></div>
        <div class="field"><label>Phone</label><input id="f_phone" value="${escapeHtml(p.phone || "")}" /></div>
        <div class="field full"><label>Address</label><textarea id="f_address" rows="2">${escapeHtml(p.address || "")}</textarea></div>
      </div>
    `;
  }

  function openForm(patient) {
    const isEdit = !!patient;
    openModal({
      title: isEdit ? "Edit Patient" : "New Patient",
      bodyHtml: patientForm(patient),
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">${isEdit ? "Save Changes" : "Add Patient"}</button>`,
      onMount: () => {
        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const first = document.getElementById("f_first").value.trim();
          if (!first) { toast("First name is required", "danger"); return; }
          const record = {
            first_name: first,
            last_name: document.getElementById("f_last").value.trim(),
            age: Number(document.getElementById("f_age").value) || null,
            gender: document.getElementById("f_gender").value,
            blood_group: document.getElementById("f_blood").value.trim(),
            phone: document.getElementById("f_phone").value.trim(),
            address: document.getElementById("f_address").value.trim(),
          };
          if (isEdit) {
            MediCoreDB.update("patients", "patient_id", patient.patient_id, record);
            toast("Patient updated", "success");
          } else {
            record.patient_id = MediCoreDB.nextId("patients", "patient_id");
            record.medical_history = { diseases: [], allergies: [], surgeries: [], conditions: [] };
            MediCoreDB.insert("patients", record);
            // Register the patient under this doctor so they show up in "My Patients".
            MediCoreDB.insert("appointments", {
              appointment_id: MediCoreDB.nextId("appointments", "appointment_id"),
              patient_id: record.patient_id,
              doctor_id: doctorId,
              appointment_date: "2026-09-17",
              appointment_time: "00:00",
              status: "Completed",
            });
            toast("Patient added to your list", "success");
          }
          closeModal();
          refresh();
        });
      },
    });
  }

  function refresh() {
    const ids = myPatientIds();
    const patients = MediCoreDB.get("patients").filter((p) => ids.has(p.patient_id)).map((p) => Object.assign({ __id: p.patient_id }, p));
    loadStats(patients);
    const genderFilter = document.getElementById("genderFilter");

    renderDataTable(document.getElementById("tableContainer"), {
      columns: [
        { label: "Name", field: "first_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.first_name + " " + (r.last_name || ""))}</span>` },
        { label: "Age", field: "age" },
        { label: "Gender", field: "gender" },
        { label: "Blood Group", field: "blood_group", render: (r) => badge(r.blood_group || "—") },
        { label: "Phone", field: "phone" },
        { label: "Address", field: "address", className: "cell-muted" },
      ],
      data: patients,
      searchInput: document.getElementById("searchInput"),
      filterFn: (row) => !genderFilter.value || row.gender === genderFilter.value,
      emptyMessage: "No patients match your search.",
      rowActions: (row) => `
        <a class="btn btn-ghost btn-sm" href="/doctor/patients/details.html?id=${row.patient_id}">${icon("eye")}</a>
        <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${row.patient_id}">${icon("edit")}</button>
      `,
      onAction: (act, id) => {
        if (act === "edit") {
          openForm(MediCoreDB.get("patients").find((p) => String(p.patient_id) === id));
        }
      },
    });
  }

  document.getElementById("addBtn").addEventListener("click", () => openForm(null));
  document.getElementById("genderFilter").addEventListener("change", refresh);

  refresh();
})();
