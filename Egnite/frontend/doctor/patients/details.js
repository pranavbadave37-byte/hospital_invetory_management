(function () {
  const session = MediCoreAuth.requireRole(["doctor"]);
  if (!session) return;
  const doctorId = session.doctor_id;

  const { initLayout, badge, escapeHtml, formatDate, renderTabs } = MediCoreUI;
  const pageContent = initLayout({ activeKey: "doctor-patients", title: "Patient Details", breadcrumb: "Doctor / Patients / Details" });

  const params = new URLSearchParams(window.location.search);
  const patientId = Number(params.get("id"));
  const patient = MediCoreDB.get("patients").find((p) => p.patient_id === patientId);

  if (!patient) {
    document.getElementById("notFoundPanel").style.display = "";
    return;
  }

  document.getElementById("patientContent").style.display = "";
  document.getElementById("patientName").textContent = `${patient.first_name} ${patient.last_name || ""}`;
  document.getElementById("patientSub").textContent = `${patient.age || "—"} yrs · ${patient.gender || "—"} · ${patient.blood_group || "—"}`;

  const doctorMap = MediCoreDB.lookup("doctors", "doctor_id");
  const labTestMap = MediCoreDB.lookup("labTestCatalog", "lab_test_id");
  const medicineMap = MediCoreDB.lookup("medicines", "medicine_id");

  function consultationsForPatient() {
    return MediCoreDB.get("consultations").filter((c) => c.patient_id === patientId).sort((a, b) => (a.consultation_date < b.consultation_date ? 1 : -1));
  }

  function renderBasic(panel) {
    panel.innerHTML = `
      <div class="detail-grid">
        <div class="detail-item"><span class="label">Full Name</span><strong>${escapeHtml(patient.first_name + " " + (patient.last_name || ""))}</strong></div>
        <div class="detail-item"><span class="label">Age</span><strong>${patient.age || "—"}</strong></div>
        <div class="detail-item"><span class="label">Gender</span><strong>${escapeHtml(patient.gender || "—")}</strong></div>
        <div class="detail-item"><span class="label">Blood Group</span><strong>${escapeHtml(patient.blood_group || "—")}</strong></div>
        <div class="detail-item"><span class="label">Phone</span><strong>${escapeHtml(patient.phone || "—")}</strong></div>
        <div class="detail-item"><span class="label">Address</span><strong>${escapeHtml(patient.address || "—")}</strong></div>
      </div>
    `;
  }

  function renderHistory(panel) {
    const h = patient.medical_history || { diseases: [], allergies: [], surgeries: [], conditions: [] };
    function chips(list) {
      return list.length ? list.map((x) => `<span class="tag-chip">${escapeHtml(x)}</span>`).join("") : `<span class="cell-muted">None recorded</span>`;
    }
    panel.innerHTML = `
      <div class="section-title">Diseases</div><div>${chips(h.diseases)}</div>
      <div class="section-title">Allergies</div><div>${chips(h.allergies)}</div>
      <div class="section-title">Past Surgeries</div><div>${chips(h.surgeries)}</div>
      <div class="section-title">Ongoing Conditions</div><div>${chips(h.conditions)}</div>
    `;
  }

  function renderVisits(panel) {
    const consultations = consultationsForPatient();
    if (!consultations.length) { panel.innerHTML = `<div class="empty-state"><div class="icon">🗂️</div><div>No previous visits recorded.</div></div>`; return; }
    const rows = consultations.map((c) => {
      const doc = doctorMap[c.doctor_id];
      return `<tr><td>${c.consultation_date}</td><td class="cell-primary">${doc ? escapeHtml(doc.doctor_name) : "—"}</td><td>${escapeHtml(c.diagnosis)}</td><td class="cell-muted">${escapeHtml(c.doctor_notes || "—")}</td></tr>`;
    }).join("");
    panel.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Doctor</th><th>Diagnosis</th><th>Treatment / Notes</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderLabReports(panel) {
    const consultIds = new Set(consultationsForPatient().map((c) => c.consultation_id));
    const requests = MediCoreDB.get("labRequests").filter((r) => consultIds.has(r.consultation_id) || r.patient_id === patientId);
    if (!requests.length) { panel.innerHTML = `<div class="empty-state"><div class="icon">🗂️</div><div>No lab reports on file.</div></div>`; return; }
    const rows = requests.map((r) => {
      const test = labTestMap[r.lab_test_id];
      return `<tr><td class="cell-primary">${test ? escapeHtml(test.test_name) : "—"}</td><td>${formatDate(r.request_date)}</td><td>${badge(r.status)}</td><td class="cell-muted">${escapeHtml(r.result || "Pending")}</td></tr>`;
    }).join("");
    panel.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Test</th><th>Requested</th><th>Status</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderPrescriptions(panel) {
    const consultations = consultationsForPatient().filter((c) => c.prescription_items && c.prescription_items.length);
    if (!consultations.length) { panel.innerHTML = `<div class="empty-state"><div class="icon">🗂️</div><div>No prescriptions on file.</div></div>`; return; }
    panel.innerHTML = consultations.map((c) => {
      const doc = doctorMap[c.doctor_id];
      const items = c.prescription_items.map((item) => `<li><span>${escapeHtml(medicineMap[item.medicine_id] ? medicineMap[item.medicine_id].medicine_name : "Medicine")} — ${escapeHtml(item.dosage)} ${escapeHtml(item.frequency)}</span><span class="cell-muted">${escapeHtml(item.duration)}</span></li>`).join("");
      return `
        <div class="section-title">${c.consultation_date} · ${doc ? escapeHtml(doc.doctor_name) : "—"}</div>
        <ul class="list-simple">${items}</ul>
      `;
    }).join("");
  }

  function renderConsultations(panel) {
    const consultations = consultationsForPatient();
    if (!consultations.length) { panel.innerHTML = `<div class="empty-state"><div class="icon">🗂️</div><div>No consultations recorded yet.</div></div>`; return; }
    panel.innerHTML = consultations.map((c) => {
      const doc = doctorMap[c.doctor_id];
      const v = c.vitals || {};
      return `
        <div class="panel" style="box-shadow:none; border:1px solid var(--color-border);">
          <div class="panel-header">
            <div><h2 style="font-size:14px;">${c.consultation_date}</h2><p>${doc ? escapeHtml(doc.doctor_name) : "—"}</p></div>
            <div>${badge(c.status)} ${c.lab_test_required ? badge("Lab Requested") : ""} ${c.follow_up_required ? badge("Follow-up Scheduled") : ""}</div>
          </div>
          <div class="panel-body">
            <p><strong>Symptoms:</strong> ${escapeHtml(c.symptoms || "—")}</p>
            <p><strong>Vitals:</strong> Temp ${v.temperature ?? "—"}°F · BP ${escapeHtml(v.blood_pressure || "—")} · HR ${v.heart_rate ?? "—"} bpm · RR ${v.respiratory_rate ?? "—"} · Wt ${v.weight ?? "—"}kg · Ht ${v.height ?? "—"}cm</p>
            <p><strong>Diagnosis:</strong> ${escapeHtml(c.diagnosis)}</p>
            <p><strong>Doctor Notes:</strong> ${escapeHtml(c.doctor_notes || "—")}</p>
          </div>
        </div>
      `;
    }).join("");
  }

  renderTabs(document.getElementById("tabs"), [
    { key: "basic", label: "Basic Details", render: renderBasic },
    { key: "history", label: "Medical History", render: renderHistory },
    { key: "visits", label: "Previous Visits", render: renderVisits },
    { key: "labs", label: "Lab Reports", render: renderLabReports },
    { key: "rx", label: "Previous Prescriptions", render: renderPrescriptions },
    { key: "consultation", label: "Consultation", render: renderConsultations },
  ]);

  document.getElementById("startConsultBtn").addEventListener("click", () => {
    MediCoreConsult.open({
      patientId,
      appointmentId: null,
      doctorId,
      onSaved: () => window.location.reload(),
    });
  });
})();
