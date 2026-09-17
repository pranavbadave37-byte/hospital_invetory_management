/* ==========================================================================
   MediCore — shared "Start Consultation" wizard.
   Captures Symptoms -> Vitals -> Diagnosis -> Doctor Notes -> Prescription
   -> Lab Test? -> Follow-up?, then saves a consultation record (and any
   linked lab requests / follow-ups) and marks the source appointment done.
   ========================================================================== */

(function (global) {
  const { openModal, closeModal, toast, escapeHtml } = MediCoreUI;

  let rxRowCount = 0;

  function medicineOptions() {
    return MediCoreDB.get("medicines").map((m) => `<option value="${m.medicine_id}">${escapeHtml(m.medicine_name)}</option>`).join("");
  }

  function labTestChecklist() {
    return MediCoreDB.get("labTestCatalog").map((t) => `
      <label style="display:flex; align-items:center; gap:8px; padding:6px 0; font-size:13px;">
        <input type="checkbox" class="lab-test-check" value="${t.lab_test_id}" />
        ${escapeHtml(t.test_name)} <span class="cell-muted">(₹${t.cost})</span>
      </label>
    `).join("");
  }

  function rxRowHtml(idx) {
    return `
      <div class="rx-row" data-rx-row="${idx}">
        <select class="rx-medicine">${medicineOptions()}</select>
        <input class="rx-dosage" placeholder="Dosage (e.g. 500mg)" />
        <input class="rx-frequency" placeholder="Frequency (e.g. TDS)" />
        <input class="rx-duration" placeholder="Duration (e.g. 5 days)" />
        <button type="button" class="btn btn-ghost btn-sm rx-remove" data-idx="${idx}">✕</button>
      </div>
    `;
  }

  function bodyHtml(patient) {
    return `
      <div class="section-title">Patient</div>
      <p class="cell-muted" style="margin-top:-6px;">${escapeHtml(patient.first_name + " " + (patient.last_name || ""))} · ${patient.age || "—"} yrs · ${escapeHtml(patient.gender || "")} · ${escapeHtml(patient.blood_group || "")}</p>

      <div class="section-title">Symptoms</div>
      <textarea id="w_symptoms" rows="2" placeholder="Describe presenting symptoms..."></textarea>

      <div class="section-title">Vitals</div>
      <div class="form-grid">
        <div class="field"><label>Temperature (°F)</label><input id="w_temp" type="number" step="0.1" /></div>
        <div class="field"><label>Blood Pressure</label><input id="w_bp" placeholder="120/80" /></div>
        <div class="field"><label>Heart Rate (bpm)</label><input id="w_hr" type="number" /></div>
        <div class="field"><label>Respiratory Rate</label><input id="w_rr" type="number" /></div>
        <div class="field"><label>Weight (kg)</label><input id="w_weight" type="number" step="0.1" /></div>
        <div class="field"><label>Height (cm)</label><input id="w_height" type="number" step="0.1" /></div>
      </div>

      <div class="section-title">Diagnosis</div>
      <input id="w_diagnosis" placeholder="Diagnosis summary" />

      <div class="section-title">Doctor Notes</div>
      <textarea id="w_notes" rows="2" placeholder="Clinical notes, advice..."></textarea>

      <div class="section-title">Prescription</div>
      <div id="w_rxRows">${rxRowHtml(0)}</div>
      <button type="button" class="btn btn-outline btn-sm" id="w_addRx" style="margin-top:4px;">+ Add Medicine</button>

      <div class="section-title">Lab Test Required?</div>
      <label style="display:flex; align-items:center; gap:8px; font-size:13px;">
        <input type="checkbox" id="w_labRequired" /> Yes, order lab test(s)
      </label>
      <div id="w_labTests" style="display:none; margin-top:8px; padding:10px 12px; background:var(--color-neutral-bg); border-radius:8px;">${labTestChecklist()}</div>

      <div class="section-title">Follow-up Required?</div>
      <label style="display:flex; align-items:center; gap:8px; font-size:13px;">
        <input type="checkbox" id="w_followRequired" /> Yes, schedule a follow-up
      </label>
      <div id="w_followFields" style="display:none; margin-top:10px;" class="form-grid">
        <div class="field"><label>Follow-up Date</label><input type="date" id="w_followDate" /></div>
        <div class="field full"><label>Reason</label><input id="w_followReason" placeholder="Reason for follow-up" /></div>
      </div>
    `;
  }

  function open({ patientId, appointmentId, doctorId, onSaved }) {
    const patient = MediCoreDB.get("patients").find((p) => String(p.patient_id) === String(patientId));
    if (!patient) { toast("Patient not found", "danger"); return; }
    rxRowCount = 0;

    openModal({
      title: "New Consultation",
      wide: true,
      bodyHtml: bodyHtml(patient),
      footerHtml: `<button class="btn btn-outline" id="w_cancel">Cancel</button><button class="btn btn-primary" id="w_save">Save Consultation</button>`,
      onMount: (box) => {
        const addRxBtn = box.querySelector("#w_addRx");
        const rxRows = box.querySelector("#w_rxRows");
        addRxBtn.addEventListener("click", () => {
          rxRowCount += 1;
          rxRows.insertAdjacentHTML("beforeend", rxRowHtml(rxRowCount));
        });
        rxRows.addEventListener("click", (e) => {
          const btn = e.target.closest(".rx-remove");
          if (!btn) return;
          const row = btn.closest("[data-rx-row]");
          if (rxRows.querySelectorAll("[data-rx-row]").length > 1) row.remove();
        });

        const labCheckbox = box.querySelector("#w_labRequired");
        const labPanel = box.querySelector("#w_labTests");
        labCheckbox.addEventListener("change", () => { labPanel.style.display = labCheckbox.checked ? "block" : "none"; });

        const followCheckbox = box.querySelector("#w_followRequired");
        const followPanel = box.querySelector("#w_followFields");
        followCheckbox.addEventListener("change", () => { followPanel.style.display = followCheckbox.checked ? "grid" : "none"; });

        box.querySelector("#w_cancel").addEventListener("click", closeModal);
        box.querySelector("#w_save").addEventListener("click", () => {
          const diagnosis = box.querySelector("#w_diagnosis").value.trim();
          if (!diagnosis) { toast("Diagnosis is required", "danger"); return; }

          const prescriptionItems = [...rxRows.querySelectorAll("[data-rx-row]")]
            .map((row) => ({
              medicine_id: Number(row.querySelector(".rx-medicine").value),
              dosage: row.querySelector(".rx-dosage").value.trim(),
              frequency: row.querySelector(".rx-frequency").value.trim(),
              duration: row.querySelector(".rx-duration").value.trim(),
            }))
            .filter((item) => item.dosage || item.frequency || item.duration);

          const labRequired = labCheckbox.checked;
          const followRequired = followCheckbox.checked;

          const consultationId = MediCoreDB.nextId("consultations", "consultation_id");
          const consultation = {
            consultation_id: consultationId,
            appointment_id: appointmentId || null,
            patient_id: Number(patientId),
            doctor_id: Number(doctorId),
            consultation_date: new Date().toISOString().slice(0, 16).replace("T", " "),
            symptoms: box.querySelector("#w_symptoms").value.trim(),
            vitals: {
              temperature: Number(box.querySelector("#w_temp").value) || null,
              blood_pressure: box.querySelector("#w_bp").value.trim(),
              heart_rate: Number(box.querySelector("#w_hr").value) || null,
              respiratory_rate: Number(box.querySelector("#w_rr").value) || null,
              weight: Number(box.querySelector("#w_weight").value) || null,
              height: Number(box.querySelector("#w_height").value) || null,
            },
            diagnosis,
            doctor_notes: box.querySelector("#w_notes").value.trim(),
            prescription_items: prescriptionItems,
            lab_test_required: labRequired,
            follow_up_required: followRequired,
            status: "Completed",
          };
          MediCoreDB.insert("consultations", consultation);

          if (labRequired) {
            box.querySelectorAll(".lab-test-check:checked").forEach((cb) => {
              MediCoreDB.insert("labRequests", {
                request_id: MediCoreDB.nextId("labRequests", "request_id"),
                consultation_id: consultationId,
                patient_id: Number(patientId),
                lab_test_id: Number(cb.value),
                request_date: new Date().toISOString().slice(0, 10),
                status: "Requested",
                result: "",
              });
            });
          }

          if (followRequired) {
            const followDate = box.querySelector("#w_followDate").value;
            MediCoreDB.insert("followUps", {
              followup_id: MediCoreDB.nextId("followUps", "followup_id"),
              consultation_id: consultationId,
              patient_id: Number(patientId),
              doctor_id: Number(doctorId),
              followup_date: followDate,
              reason: box.querySelector("#w_followReason").value.trim(),
              status: "Scheduled",
            });
          }

          if (appointmentId) {
            MediCoreDB.update("appointments", "appointment_id", appointmentId, { status: "Completed" });
          }

          toast("Consultation saved and patient record updated", "success");
          closeModal();
          if (onSaved) onSaved(consultation);
        });
      },
    });
  }

  global.MediCoreConsult = { open };
})(window);
