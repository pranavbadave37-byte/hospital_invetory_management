(function () {
  const session = MediCoreAuth.requireRole(["admin"]);
  if (!session) return;

  const { toast, badge, escapeHtml, initials, renderDataTable, openModal, closeModal, confirmAction, icon } = MediCoreUI;

  MediCoreUI.initLayout({ activeKey: "admin-user", title: "Users", breadcrumb: "Admin / Users" });
  document.getElementById("searchIconSlot").innerHTML = icon("search");

  const ROLE_LABEL = { admin: "Admin", doctor: "Doctor", pharmacy: "Pharmacy Head", instrument: "Instrument Head" };

  function populateRoleFilter() {} // static options in the HTML already

  function doctorOptions(selectedId) {
    return MediCoreDB.get("doctors").map((d) => `<option value="${d.doctor_id}" ${String(d.doctor_id) === String(selectedId) ? "selected" : ""}>${escapeHtml(d.doctor_name)}</option>`).join("");
  }

  function loadStats() {
    const users = MediCoreDB.get("users");
    const active = users.filter((u) => u.status === "Active").length;
    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-info"><span class="label">Total Users</span><strong>${users.length}</strong></div><div class="stat-icon teal">👥</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Active</span><strong>${active}</strong></div><div class="stat-icon blue">✅</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Inactive</span><strong>${users.length - active}</strong></div><div class="stat-icon rose">✕</div></div>
      <div class="stat-card"><div class="stat-info"><span class="label">Doctors</span><strong>${users.filter((u) => u.role === "doctor").length}</strong></div><div class="stat-icon slate">🩺</div></div>
    `;
  }

  function form(record) {
    const u = record || {};
    return `
      <div class="form-grid">
        <div class="field full"><label>Full Name</label><input id="f_name" value="${escapeHtml(u.name || "")}" /></div>
        <div class="field"><label>Username</label><input id="f_username" value="${escapeHtml(u.username || "")}" ${record ? "readonly" : ""} /></div>
        <div class="field"><label>Password</label><input id="f_password" type="text" value="${escapeHtml(u.password || "")}" placeholder="${record ? "Leave as-is or change" : "Set a password"}" /></div>
        <div class="field">
          <label>Role</label>
          <select id="f_role">
            ${Object.entries(ROLE_LABEL).map(([val, label]) => `<option value="${val}" ${u.role === val ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </div>
        <div class="field" id="doctorLinkField" style="${u.role === "doctor" ? "" : "display:none;"}">
          <label>Linked Doctor Profile</label>
          <select id="f_doctorId">${doctorOptions(u.doctor_id)}</select>
        </div>
        <div class="field"><label>Department</label><input id="f_department" value="${escapeHtml(u.department || "")}" /></div>
      </div>
    `;
  }

  function openForm(record) {
    const isEdit = !!record;
    openModal({
      title: isEdit ? "Edit User" : "Add User",
      bodyHtml: form(record),
      footerHtml: `<button class="btn btn-outline" id="cancelBtn">Cancel</button><button class="btn btn-primary" id="saveBtn">${isEdit ? "Save Changes" : "Add User"}</button>`,
      onMount: () => {
        const roleSelect = document.getElementById("f_role");
        const doctorField = document.getElementById("doctorLinkField");
        roleSelect.addEventListener("change", () => { doctorField.style.display = roleSelect.value === "doctor" ? "" : "none"; });

        document.getElementById("cancelBtn").addEventListener("click", closeModal);
        document.getElementById("saveBtn").addEventListener("click", () => {
          const name = document.getElementById("f_name").value.trim();
          const username = document.getElementById("f_username").value.trim();
          if (!name || !username) { toast("Name and username are required", "danger"); return; }
          if (!isEdit && MediCoreDB.get("users").some((u) => u.username.toLowerCase() === username.toLowerCase())) {
            toast("That username is already taken", "danger"); return;
          }
          const role = roleSelect.value;
          const patch = {
            name,
            username,
            password: document.getElementById("f_password").value || "changeme123",
            role,
            doctor_id: role === "doctor" ? Number(document.getElementById("f_doctorId").value) : null,
            department: document.getElementById("f_department").value.trim(),
          };
          if (isEdit) {
            MediCoreDB.update("users", "user_id", record.user_id, patch);
            toast("User updated", "success");
          } else {
            patch.user_id = MediCoreDB.nextId("users", "user_id");
            patch.status = "Active";
            patch.last_login = "";
            MediCoreDB.insert("users", patch);
            toast("User added", "success");
          }
          closeModal();
          refresh();
        });
      },
    });
  }

  function openView(user) {
    openModal({
      title: user.name,
      bodyHtml: `
        <div class="detail-grid">
          <div class="detail-item"><span class="label">Username</span><strong>${escapeHtml(user.username)}</strong></div>
          <div class="detail-item"><span class="label">Role</span><strong>${ROLE_LABEL[user.role] || user.role}</strong></div>
          <div class="detail-item"><span class="label">Department</span><strong>${escapeHtml(user.department || "—")}</strong></div>
          <div class="detail-item"><span class="label">Status</span><strong>${badge(user.status)}</strong></div>
          <div class="detail-item"><span class="label">Last Login</span><strong>${escapeHtml(user.last_login || "Never")}</strong></div>
        </div>
      `,
      footerHtml: `<button class="btn btn-outline" id="closeBtn">Close</button>`,
      onMount: () => document.getElementById("closeBtn").addEventListener("click", closeModal),
    });
  }

  function refresh() {
    loadStats();
    const users = MediCoreDB.get("users").map((u) => Object.assign({ __id: u.user_id }, u));
    const roleFilter = document.getElementById("roleFilter");

    renderDataTable(document.getElementById("tableContainer"), {
      columns: [
        { label: "User", field: "name", render: (r) => `
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="avatar" style="background:var(--color-accent);">${initials(r.name)}</div>
            <div><div class="cell-primary">${escapeHtml(r.name)}</div><div class="cell-muted">@${escapeHtml(r.username)}</div></div>
          </div>` },
        { label: "Role", field: "role", render: (r) => badge(ROLE_LABEL[r.role] || r.role) },
        { label: "Department", field: "department" },
        { label: "Last Login", field: "last_login", className: "cell-muted", render: (r) => r.last_login || "Never" },
        { label: "Status", field: "status", render: (r) => badge(r.status) },
      ],
      data: users,
      searchInput: document.getElementById("searchInput"),
      filterFn: (row) => !roleFilter.value || row.role === roleFilter.value,
      emptyMessage: "No users match your search.",
      rowActions: (row) => `
        <button class="btn btn-ghost btn-sm" data-act="view" data-id="${row.user_id}">${icon("eye")}</button>
        <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${row.user_id}">${icon("edit")}</button>
        <button class="btn btn-outline btn-sm" data-act="toggle" data-id="${row.user_id}">${row.status === "Active" ? "Deactivate" : "Activate"}</button>
      `,
      onAction: (act, id) => {
        const user = MediCoreDB.get("users").find((u) => String(u.user_id) === id);
        if (act === "view") {
          openView(user);
        } else if (act === "edit") {
          openForm(user);
        } else if (act === "toggle") {
          const next = user.status === "Active" ? "Inactive" : "Active";
          confirmAction(`${next === "Inactive" ? "Deactivate" : "Activate"} ${user.name}'s account?`, () => {
            MediCoreDB.update("users", "user_id", id, { status: next });
            toast(`Account ${next.toLowerCase()}`, "info");
            refresh();
          });
        }
      },
    });
  }

  document.getElementById("addBtn").addEventListener("click", () => openForm(null));
  document.getElementById("roleFilter").addEventListener("change", refresh);

  refresh();
})();
