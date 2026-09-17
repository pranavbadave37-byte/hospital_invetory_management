(function () {
  const session = MediCoreAuth.requireRole(["doctor"]);
  if (!session) return;

  const { initLayout, badge, formatDate, escapeHtml } = MediCoreUI;
  initLayout({ activeKey: "doctor-dashboard", title: `Hi, ${escapeHtml(session.name)}`, breadcrumb: "Welcome back to your dashboard." });

  const TODAY = "2026-09-17";
  const doctorId = session.doctor_id;

  const patientMap = MediCoreDB.lookup("patients", "patient_id");
  const appointments = MediCoreDB.get("appointments").filter((a) => a.doctor_id === doctorId);
  const consultations = MediCoreDB.get("consultations").filter((c) => c.doctor_id === doctorId);
  const followUps = MediCoreDB.get("followUps").filter((f) => f.doctor_id === doctorId && f.status === "Scheduled");
  const myPatientIds = new Set(appointments.map((a) => a.patient_id).concat(consultations.map((c) => c.patient_id)));

  const todays = appointments.filter((a) => a.appointment_date === TODAY);
  const upcoming = appointments.filter((a) => a.appointment_date > TODAY && a.status === "Scheduled");

  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card"><div class="stat-info"><span class="label">My Patients</span><strong>${myPatientIds.size}</strong></div><div class="stat-icon teal">👤</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Today's Appointments</span><strong>${todays.length}</strong></div><div class="stat-icon blue">📅</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Upcoming</span><strong>${upcoming.length}</strong></div><div class="stat-icon slate">🕒</div></div>
    <div class="stat-card"><div class="stat-info"><span class="label">Consultations Recorded</span><strong>${consultations.length}</strong></div><div class="stat-icon amber">📋</div></div>
  `;

  const rows = todays.map((a) => {
    const p = patientMap[a.patient_id];
    return `<tr><td class="cell-primary">${p ? escapeHtml(p.first_name + " " + p.last_name) : "—"}</td><td>${a.appointment_time}</td><td>${badge(a.status)}</td></tr>`;
  }).join("");
  document.getElementById("todayTable").innerHTML = rows
    ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Patient</th><th>Time</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="empty-state"><div class="icon">🗂️</div><div>No appointments scheduled for today.</div></div>`;

  const followRows = followUps.map((f) => {
    const p = patientMap[f.patient_id];
    return `<tr><td class="cell-primary">${p ? escapeHtml(p.first_name + " " + p.last_name) : "—"}</td><td>${formatDate(f.followup_date)}</td><td>${escapeHtml(f.reason)}</td></tr>`;
  }).join("");
  document.getElementById("followTable").innerHTML = followRows
    ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Patient</th><th>Date</th><th>Reason</th></tr></thead><tbody>${followRows}</tbody></table></div>`
    : `<div class="empty-state"><div class="icon">🗂️</div><div>No follow-ups scheduled.</div></div>`;
})();
