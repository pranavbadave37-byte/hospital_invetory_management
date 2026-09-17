/* ==========================================================================
   MediCore — shared UI shell + component helpers
   Every page defines <body data-page="..."> and mounts
   <div id="app-shell"></div> before its own content; initLayout() wraps
   that content with the sidebar + topbar (scoped to the signed-in role)
   and wires common interactions.
   ========================================================================== */

(function (global) {
  const NAV_BY_ROLE = {
    admin: {
      group: "Admin",
      items: [
        { key: "admin-dashboard", label: "Dashboard", href: "/admin/index.html", icon: "home" },
        { key: "admin-user", label: "Users", href: "/admin/user/index.html", icon: "user-cog" },
        { key: "admin-security", label: "Security", href: "/admin/security/index.html", icon: "shield" },
        { key: "admin-system", label: "System", href: "/admin/system/index.html", icon: "settings" },
      ],
    },
    doctor: {
      group: "Doctor",
      items: [
        { key: "doctor-dashboard", label: "Dashboard", href: "/doctor/index.html", icon: "home" },
        { key: "doctor-appointments", label: "Appointments", href: "/doctor/appointments/index.html", icon: "calendar" },
        { key: "doctor-patients", label: "Patients", href: "/doctor/patients/index.html", icon: "users" },
        { key: "doctor-consultation", label: "Consultations", href: "/doctor/consultation/index.html", icon: "clipboard" },
      ],
    },
    pharmacy: {
      group: "Pharmacy",
      items: [
        { key: "pharmacy-dashboard", label: "Dashboard", href: "/pharmacy/index.html", icon: "home" },
        { key: "pharmacy-medicines", label: "Medicines", href: "/pharmacy/medicines/index.html", icon: "pill" },
        { key: "pharmacy-stock", label: "Stock", href: "/pharmacy/stock/index.html", icon: "box" },
        { key: "pharmacy-alert", label: "Alerts", href: "/pharmacy/alert/index.html", icon: "bell" },
      ],
    },
    instrument: {
      group: "Instrument Management",
      items: [
        { key: "instruments-dashboard", label: "Dashboard", href: "/instruments/index.html", icon: "home" },
        { key: "instruments-instruments", label: "Instruments", href: "/instruments/instruments/index.html", icon: "tool" },
        { key: "instruments-issue_return", label: "Issue / Return", href: "/instruments/issue_return/index.html", icon: "swap" },
        { key: "instruments-alerts", label: "Alerts", href: "/instruments/alerts/index.html", icon: "alert" },
      ],
    },
  };

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><path d="M3 11.5 12 4l9 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15.5 5.2c1.5.3 2.5 1.6 2.5 3.1 0 1.5-1 2.8-2.5 3.1M18 14.8c2 .5 3.5 2.2 3.5 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><rect x="5" y="4.5" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="9" y="3" width="6" height="3" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 11.5h7M8.5 15h7M8.5 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    pill: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><rect x="3.5" y="9" width="17" height="8.5" rx="4.25" transform="rotate(-30 12 13.25)" stroke="currentColor" stroke-width="1.8"/><path d="M11 8.3 15 15" stroke="currentColor" stroke-width="1.8"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><path d="M3.5 8 12 3.5 20.5 8 12 12.5 3.5 8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3.5 8v9L12 21.5 20.5 17V8M12 12.5V21.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    tool: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><path d="M14.5 6.5 17.5 3.5l3 3-3 3M14.5 6.5 6 15l-3 5 5-3 8.5-8.5M14.5 6.5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><path d="M4 8h13M17 8l-3-3M17 8l-3 3M20 16H7M7 16l3-3M7 16l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><path d="M12 3.5 21.5 20h-19L12 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4.2M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    "user-cog": '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="17.5" cy="16.5" r="2.6" stroke="currentColor" stroke-width="1.6"/><path d="M17.5 12.5v1.1M17.5 19.4v1.1M13.9 16.5H15M20 16.5h1.1M14.9 13.9l.8.8M19.3 18.3l.8.8M14.9 19.1l.8-.8M19.3 14.7l.8-.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><path d="M12 3.5 19 6.2v5.6c0 4.5-3 7.4-7 8.7-4-1.3-7-4.2-7-8.7V6.2L12 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12.2l2 2 4-4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" width="17" height="17"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.7 7.7 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.7 7.7 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9c.77.66 1.65 1.17 2.6 1.5l.5 2.5h4l.5-2.5a7.7 7.7 0 0 0 2.6-1.5l2.3.9 2-3.4-2-1.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 16l4-4-4-4M20 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" width="15" height="15"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M4 17.5V20h2.5L18 8.5 15.5 6 4 17.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m14 7.5 2.5 2.5" stroke="currentColor" stroke-width="1.6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M5 7h14M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M7 7l1 12.5a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9L17 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6"/></svg>',
  };

  function icon(name) {
    return ICONS[name] || "";
  }

  function initials(name) {
    if (!name) return "?";
    const parts = name.replace(/^Dr\.\s*/i, "").trim().split(/\s+/);
    return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }

  function buildSidebar(role, activeKey) {
    const nav = NAV_BY_ROLE[role];
    const items = (nav ? nav.items : [])
      .map((item) => {
        const cls = item.key === activeKey ? "nav-item active" : "nav-item";
        return `<a class="${cls}" href="${item.href}"><span class="nav-icon">${icon(item.icon)}</span><span>${item.label}</span></a>`;
      })
      .join("");
    const groupLabel = nav ? nav.group : "";

    return `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="logo-mark">MC</div>
          <div class="brand-text"><strong>MediCore</strong><span>Hospital & Inventory</span></div>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-group"><div class="nav-group-label">${groupLabel}</div>${items}</div>
        </nav>
        <div class="sidebar-footer">v1.0 &middot; Demo data</div>
      </aside>
      <div class="overlay-backdrop" id="sidebarOverlay"></div>
    `;
  }

  function buildTopbar(title, breadcrumb, session) {
    const name = session ? session.name : "Guest";
    const roleLabel = session ? MediCoreAuth.roleLabel(session.role) : "";
    return `
      <header class="topbar">
        <div class="topbar-left">
          <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle menu">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <div class="page-heading">
            <h1>${title}</h1>
            ${breadcrumb ? `<div class="breadcrumb">${breadcrumb}</div>` : ""}
          </div>
        </div>
        <div class="topbar-right">
          <button class="icon-btn" title="Notifications">${icon("bell")}<span class="dot"></span></button>
          <div class="user-chip" title="${escapeHtml(name)}">
            <div class="avatar">${initials(name)}</div>
            <div class="user-meta"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(roleLabel)}</span></div>
          </div>
          <button class="icon-btn" id="logoutBtn" title="Sign out">${icon("logout")}</button>
        </div>
      </header>
    `;
  }

  function initLayout(opts) {
    const { activeKey, title, breadcrumb, role } = opts;
    const session = global.MediCoreAuth ? global.MediCoreAuth.getSession() : null;
    const effectiveRole = role || (session ? session.role : null);

    const shell = document.getElementById("app-shell");
    if (!shell) return;

    const existingContent = shell.innerHTML;
    shell.innerHTML = "";
    shell.classList.add("app-layout");

    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildSidebar(effectiveRole, activeKey);
    while (wrapper.firstChild) shell.appendChild(wrapper.firstChild);

    const mainCol = document.createElement("div");
    mainCol.className = "main-col";
    mainCol.innerHTML = buildTopbar(title, breadcrumb, session) + `<main class="content" id="pageContent">${existingContent}</main>`;
    shell.appendChild(mainCol);

    if (!document.getElementById("toast-stack")) {
      const stack = document.createElement("div");
      stack.id = "toast-stack";
      document.body.appendChild(stack);
    }

    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (toggle && sidebar && overlay) {
      toggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        overlay.classList.toggle("open");
      });
      overlay.addEventListener("click", () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("open");
      });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (global.MediCoreAuth) global.MediCoreAuth.logout();
      });
    }

    return document.getElementById("pageContent");
  }

  function toast(message, type) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = `toast ${type || "info"}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 200ms ease";
      setTimeout(() => el.remove(), 220);
    }, 2600);
  }

  const STATUS_MAP = {
    active: "success", available: "success", completed: "success", "in stock": "success", success: "success", good: "success", returned: "success",
    scheduled: "info", "in progress": "info", info: "info", requested: "info", issued: "info",
    "low stock": "warning", "needs service": "warning", "under maintenance": "warning", due: "warning", "on leave": "warning", pending: "warning", scheduled_maint: "warning",
    "stock in": "success", "stock out": "danger",
    "out of stock": "danger", cancelled: "danger", overdue: "danger", failed: "danger", expired: "danger", inactive: "danger", damaged: "danger",
  };

  function badge(text) {
    const key = String(text || "").toLowerCase();
    const variant = STATUS_MAP[key] || "neutral";
    return `<span class="badge badge-${variant}">${text}</span>`;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatCurrency(n) {
    if (n == null || isNaN(n)) return "—";
    return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ---------------- DataTable ----------------
     rowActions(row) should return buttons using data-act="<name>" data-id="<id>";
     onAction(act, id, row) is called on click, delegated at the container level
     so it keeps working after the table redraws (e.g. from a live search). */
  function renderDataTable(container, config) {
    const { columns, data, rowActions, emptyMessage, searchInput, filterFn, onAction } = config;
    let currentRows = [];

    function draw(rows) {
      if (!rows.length) {
        container.innerHTML = `<div class="empty-state"><div class="icon">🗂️</div><div>${emptyMessage || "No records found."}</div></div>`;
        return;
      }
      const head = columns.map((c) => `<th>${c.label}</th>`).join("") + (rowActions ? '<th style="text-align:right;">Actions</th>' : "");
      const body = rows
        .map((row) => {
          const cells = columns
            .map((c) => `<td class="${c.className || ""}">${c.render ? c.render(row) : escapeHtml(row[c.field])}</td>`)
            .join("");
          const actions = rowActions
            ? `<td><div class="row-actions">${rowActions(row)}</div></td>`
            : "";
          return `<tr data-row-id="${row.__id != null ? row.__id : ""}">${cells}${actions}</tr>`;
        })
        .join("");
      container.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    function apply() {
      let rows = data.slice();
      const term = searchInput && searchInput.value ? searchInput.value.trim().toLowerCase() : "";
      if (term) {
        rows = rows.filter((row) => columns.some((c) => String(row[c.field] || "").toLowerCase().includes(term)));
      }
      if (filterFn) rows = rows.filter(filterFn);
      currentRows = rows;
      draw(rows);
    }

    apply();
    if (searchInput) searchInput.addEventListener("input", apply);

    if (onAction && !container.__actionBound) {
      container.__actionBound = true;
      container.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-act]");
        if (!btn || !container.contains(btn)) return;
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        const row = currentRows.find((r) => String(r.__id) === String(id));
        onAction(act, id, row);
      });
    }

    return { refresh: apply };
  }

  /* ---------------- Modal ---------------- */
  function ensureModalRoot() {
    let root = document.getElementById("modal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root";
      root.className = "modal-overlay";
      root.innerHTML = '<div class="modal" id="modal-box"></div>';
      document.body.appendChild(root);
      root.addEventListener("click", (e) => {
        if (e.target === root) closeModal();
      });
    }
    return root;
  }

  function openModal({ title, bodyHtml, footerHtml, onMount, wide }) {
    const root = ensureModalRoot();
    const box = document.getElementById("modal-box");
    box.style.maxWidth = wide ? "760px" : "";
    box.innerHTML = `
      <div class="modal-header"><h3>${title}</h3><button class="modal-close" id="modalCloseBtn">✕</button></div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
    `;
    root.classList.add("open");
    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
    if (onMount) onMount(box);
  }

  function closeModal() {
    const root = document.getElementById("modal-root");
    if (root) root.classList.remove("open");
  }

  function confirmAction(message, onConfirm) {
    openModal({
      title: "Please confirm",
      bodyHtml: `<p style="margin:0;">${escapeHtml(message)}</p>`,
      footerHtml: `<button class="btn btn-outline" id="cfCancel">Cancel</button><button class="btn btn-danger" id="cfOk">Confirm</button>`,
      onMount: () => {
        document.getElementById("cfCancel").addEventListener("click", closeModal);
        document.getElementById("cfOk").addEventListener("click", () => {
          closeModal();
          onConfirm();
        });
      },
    });
  }

  /* ---------------- Tabs (used by details views) ---------------- */
  function renderTabs(container, tabs, defaultKey) {
    let active = defaultKey || tabs[0].key;

    function draw() {
      const nav = tabs.map((t) => `<button class="tab-btn ${t.key === active ? "active" : ""}" data-tab="${t.key}">${t.label}</button>`).join("");
      container.innerHTML = `<div class="tab-nav">${nav}</div><div class="tab-panel" id="tabPanel"></div>`;
      const panel = container.querySelector("#tabPanel");
      const current = tabs.find((t) => t.key === active);
      if (current) current.render(panel);
      container.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          active = btn.getAttribute("data-tab");
          draw();
        });
      });
    }
    draw();
    return { setActive: (key) => { active = key; draw(); } };
  }

  global.MediCoreUI = {
    initLayout,
    toast,
    badge,
    escapeHtml,
    formatDate,
    formatCurrency,
    initials,
    icon,
    renderDataTable,
    renderTabs,
    openModal,
    closeModal,
    confirmAction,
  };
})(window);
