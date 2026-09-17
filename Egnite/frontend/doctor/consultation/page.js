(function () {
  const session = MediCoreAuth.requireRole(["doctor"]);
  if (!session) return;
  const doctorId = session.doctor_id;

  const { toast, badge, escapeHtml, renderDataTable, openModal, closeModal, icon } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "doctor-consultation", title: "Consultations", breadcrumb: "Doctor / Consultations" });
  document.getElementById("searchIconSlot").innerHTML = icon("search");

  function myPatientOptions() {
    const fromAppts = MediCoreDB.get("appointments").filter((a) => a.doctor_id === doctorId).map((a) => a.patient_id);
    const fromConsults = MediCoreDB.get("consultations").filter((c) => c.doctor_id === doctorId).map((c) => c.patient_id);
    const ids = new Set([...fromAppts, ...fromConsults]);
    return MediCoreDB.get("patients").filter((p) => ids.has(p.patient_id));
  }

  function loadStats(consultations) {
    const labCount = consultations.filter((c) => c.lab_test_required).length;
    const followCount = consultations.filter((c) => c.follow_up_required).length;
    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">Total Consultations</span><strong>${consultations.length}</strong></div><div class="stat-icon teal">📋</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Lab Tests Ordered</span><strong>${labCount}</strong></div><div class="stat-icon blue">🧪</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Follow-ups Scheduled</span><strong>${followCount}</strong></div><div class="stat-icon slate">🔁</div></div>
    `;
  }

  function openPatientPicker() {
    const patients = myPatientOptions();
    if (!patients.length) { toast("Add a patient first from the Patients page", "danger"); return; }
    openModal({
      title: "Start Consultation",
      bodyHtml: `
        <div class="field full">
          <label>Select Patient</label>
          <select id="pickPatient">${patients.map((p) => `<option value="${p.patient_id}">${escapeHtml(p.first_name + " " + p.last_name)}</option>`).join("")}</select>
        </div>
      `,
      footerHtml: `<button class="btn btn-outline" id="cancelPick">Cancel</button><button class="btn btn-primary" id="continuePick">Continue</button>`,
      onMount: () => {
        document.getElementById("cancelPick").addEventListener("click", closeModal);
        document.getElementById("continuePick").addEventListener("click", () => {
          const patientId = Number(document.getElementById("pickPatient").value);
          closeModal();
          MediCoreConsult.open({ patientId, appointmentId: null, doctorId, onSaved: refresh });
        });
      },
    });
  }

  function refresh() {
    const patientMap = MediCoreDB.lookup("patients", "patient_id");
    const consultations = MediCoreDB.get("consultations").filter((c) => c.doctor_id === doctorId);
    loadStats(consultations);

    const rows = consultations.map((c) => Object.assign({ __id: c.consultation_id }, c, {
      patient_name: patientMap[c.patient_id] ? patientMap[c.patient_id].first_name + " " + patientMap[c.patient_id].last_name : "Unknown",
    })).sort((a, b) => (a.consultation_date < b.consultation_date ? 1 : -1));

    renderDataTable(document.getElementById("tableContainer"), {
      columns: [
        { label: "Patient", field: "patient_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.patient_name)}</span>` },
        { label: "Date", field: "consultation_date" },
        { label: "Diagnosis", field: "diagnosis" },
        { label: "Lab Test", field: "lab_test_required", render: (r) => (r.lab_test_required ? badge("Requested") : "—") },
        { label: "Follow-up", field: "follow_up_required", render: (r) => (r.follow_up_required ? badge("Scheduled") : "—") },
        { label: "Status", field: "status", render: (r) => badge(r.status) },
      ],
      data: rows,
      searchInput: document.getElementById("searchInput"),
      emptyMessage: "No consultations recorded yet.",
      rowActions: (row) => `<a class="btn btn-ghost btn-sm" href="/doctor/patients/details.html?id=${row.patient_id}">${icon("eye")}</a>`,
    });
  }

  document.getElementById("addBtn").addEventListener("click", openPatientPicker);
  refresh();
})();
