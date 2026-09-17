(function () {
  const session = MediCoreAuth.requireRole(["doctor"]);
  if (!session) return;
  const doctorId = session.doctor_id;
  const TODAY = "2026-09-17";

  const { initLayout, toast, badge, escapeHtml, formatDate, renderDataTable, openModal, closeModal, confirmAction, icon } = MediCoreUI;

  initLayout({ activeKey: "doctor-appointments", title: "Appointments", breadcrumb: "Doctor / Appointments" });
  document.getElementById("searchIconSlot").innerHTML = icon("search");

  function patientOptions(selectedId) {
    return MediCoreDB.get("patients").map((p) => `<option value="${p.patient_id}" ${String(p.patient_id) === String(selectedId) ? "selected" : ""}>${escapeHtml(p.first_name + " " + p.last_name)}</option>`).join("");
  }

  function loadStats(appts) {
    const scheduled = appts.filter((a) => a.status === "Scheduled").length;
    const completed = appts.filter((a) => a.status === "Completed").length;
    const today = appts.filter((a) => a.appointment_date === TODAY).length;
    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">Total Appointments</span><strong>${appts.length}</strong></div><div class="stat-icon teal">📅</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Today</span><strong>${today}</strong></div><div class="stat-icon blue">🕒</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Scheduled</span><strong>${scheduled}</strong></div><div class="stat-icon slate">📌</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Completed</span><strong>${completed}</strong></div><div class="stat-icon amber">✅</div></div>
    `;
  }

  function apptForm(appt) {
    const a = appt || {};
    return `
      <div class="form-grid">
        <div class="field full"><label>Patient</label><select id="f_patient">${patientOptions(a.patient_id)}</select></div>
        <div class="field"><label>Date</label><input type="date" id="f_date" value="${a.appointment_date || ""}" /></div>
        <div class="field"><label>Time</label><input type="time" id="f_time" value="${a.appointment_time || ""}" /></div>
        <div class="field full">
          <label>Status</label>
          <select id="f_status">
            ${["Scheduled", "In Progress", "Completed", "Cancelled"].map((s) => `<option ${a.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
    `;
  }

  function openForm(appt) {
    const isEdit = !!appt;
    openModal({
      title: isEdit ? "Edit Appointment" : "New Appointment",
      bodyHtml: apptForm(appt),
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">${isEdit ? "Save Changes" : "Schedule"}</button>`,
      onMount: () => {
        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const record = {
            patient_id: Number(document.getElementById("f_patient").value),
            doctor_id: doctorId,
            appointment_date: document.getElementById("f_date").value,
            appointment_time: document.getElementById("f_time").value,
            status: document.getElementById("f_status").value,
          };
          if (!record.appointment_date || !record.appointment_time) { toast("Date and time are required", "danger"); return; }
          if (isEdit) {
            MediCoreDB.update("appointments", "appointment_id", appt.appointment_id, record);
            toast("Appointment updated", "success");
          } else {
            record.appointment_id = MediCoreDB.nextId("appointments", "appointment_id");
            MediCoreDB.insert("appointments", record);
            toast("Appointment scheduled", "success");
          }
          closeModal();
          refresh();
        });
      },
    });
  }

  function refresh() {
    const patientMap = MediCoreDB.lookup("patients", "patient_id");
    const myAppts = MediCoreDB.get("appointments").filter((a) => a.doctor_id === doctorId);
    loadStats(myAppts);

    const rows = myAppts.map((a) => Object.assign({ __id: a.appointment_id }, a, {
      patient_name: patientMap[a.patient_id] ? patientMap[a.patient_id].first_name + " " + patientMap[a.patient_id].last_name : "Unknown",
    }));
    const whenFilter = document.getElementById("whenFilter");
    const statusFilter = document.getElementById("statusFilter");

    renderDataTable(document.getElementById("tableContainer"), {
      columns: [
        { label: "Patient", field: "patient_name", render: (r) => `<span class="cell-primary">${escapeHtml(r.patient_name)}</span>` },
        { label: "Date", field: "appointment_date", render: (r) => formatDate(r.appointment_date) },
        { label: "Time", field: "appointment_time" },
        { label: "Status", field: "status", render: (r) => badge(r.status) },
      ],
      data: rows,
      searchInput: document.getElementById("searchInput"),
      filterFn: (row) => {
        if (statusFilter.value && row.status !== statusFilter.value) return false;
        if (whenFilter.value === "today" && row.appointment_date !== TODAY) return false;
        if (whenFilter.value === "upcoming" && row.appointment_date <= TODAY) return false;
        return true;
      },
      emptyMessage: "No appointments match your search.",
      rowActions: (row) => `
        ${row.status === "Scheduled" || row.status === "In Progress" ? `<button class="btn btn-outline btn-sm" data-act="consult" data-id="${row.appointment_id}">Start Consultation</button>` : ""}
        <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${row.appointment_id}">${icon("edit")}</button>
        <button class="btn btn-ghost btn-sm" data-act="del" data-id="${row.appointment_id}">${icon("trash")}</button>
      `,
      onAction: (act, id, row) => {
        if (act === "edit") {
          openForm(MediCoreDB.get("appointments").find((a) => String(a.appointment_id) === id));
        } else if (act === "del") {
          confirmAction("Cancel and remove this appointment?", () => {
            MediCoreDB.remove("appointments", "appointment_id", id);
            toast("Appointment removed", "info");
            refresh();
          });
        } else if (act === "consult") {
          MediCoreConsult.open({
            patientId: row.patient_id,
            appointmentId: row.appointment_id,
            doctorId,
            onSaved: refresh,
          });
        }
      },
    });
  }

  document.getElementById("addBtn").addEventListener("click", () => openForm(null));
  document.getElementById("statusFilter").addEventListener("change", refresh);
  document.getElementById("whenFilter").addEventListener("change", refresh);

  refresh();
})();
