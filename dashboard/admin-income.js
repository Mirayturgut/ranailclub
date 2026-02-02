// dashboard/admin-income.js
(() => {
  if (!window.AppStore) {
    console.error("AppStore yok. shared-storage.js yüklenmemiş olabilir.");
    return;
  }

  // ---- DOM ----
  const sumAmountEl = document.getElementById("sumAmount");
  const sumCommissionEl = document.getElementById("sumCommission");
  const sumEmployeeEl = document.getElementById("sumEmployee");
  const sumBusinessEl = document.getElementById("sumBusiness");

  const startEl = document.getElementById("fStart");
  const endEl = document.getElementById("fEnd");
  const userEl = document.getElementById("fUser");
  const typeEl = document.getElementById("fType");

  const btnApply = document.getElementById("btnApply");
  const btnReset = document.getElementById("btnReset");
  const btnExport = document.getElementById("btnExport");

  const tbody = document.getElementById("incomeTbody");

  const fmt = (n) => AppStore.fmtTRY(Number(n || 0));

  function normalizeTx(t) {
    const ptRaw = (t.paymentType || "").toString();
    const paymentType =
      ptRaw === "Card" ? "Kart" :
      ptRaw === "Cash" ? "Nakit" :
      ptRaw;

    return {
      id: t.id,
      createdAt: t.createdAt,
      userId: t.userId || t.user || t.username || "unknown",
      paymentType,
      service: (t.service || "").toString(), // ✅ yapılan işlem
      amount: Number(t.amount || 0),
      commission: Number(t.commission || 0),
      employee: Number(t.employee || 0),
      business: Number(t.business || 0),
    };
  }

  function badge(type) {
    if (type === "Kart") return `<span class="badge bg-light-primary border border-primary">Kart</span>`;
    return `<span class="badge bg-light-success border border-success">Nakit</span>`;
  }

  // yyyy-mm-dd (input[type=date]) → Date start of day
  function parseDateStart(v) {
    if (!v) return null;
    const [y, m, d] = v.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  // yyyy-mm-dd → Date end of day
  function parseDateEnd(v) {
    if (!v) return null;
    const [y, m, d] = v.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  function fillUserSelect(allTx) {
    if (!userEl) return;
    const current = userEl.value || "";

    // Users varsa isim map’i kur
    const userMap = new Map();
    try {
      const users = AppStore.getUsers ? AppStore.getUsers() : [];
      users.forEach(u => userMap.set(String(u.id), (u.name || u.fullName || u.email || String(u.id))));
    } catch {}

    const uniq = new Map(); // id -> label
    allTx.forEach(t => {
      const id = String(t.userId);
      const label = userMap.get(id) || id;
      if (!uniq.has(id)) uniq.set(id, label);
    });

    const options = Array.from(uniq.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "tr"));

    userEl.innerHTML =
      `<option value="">Tümü</option>` +
      options.map(([id, label]) => `<option value="${id}">${label}</option>`).join("");

    if (Array.from(userEl.options).some(o => o.value === current)) userEl.value = current;
  }

  function applyFilters(list) {
    const start = parseDateStart(startEl?.value);
    const end = parseDateEnd(endEl?.value);
    const u = (userEl?.value || "").trim();
    const t = (typeEl?.value || "").trim(); // Kart / Nakit / ""

    return list.filter(x => {
      const dt = new Date(x.createdAt);

      if (start && dt < start) return false;
      if (end && dt > end) return false;

      if (u && String(x.userId) !== u) return false;
      if (t && String(x.paymentType) !== t) return false;

      return true;
    });
  }

  function renderTotals(list) {
    const totals = list.reduce((acc, x) => {
      acc.amount += x.amount;
      acc.commission += x.commission;
      acc.employee += x.employee;
      acc.business += x.business;
      return acc;
    }, { amount: 0, commission: 0, employee: 0, business: 0 });

    if (sumAmountEl) sumAmountEl.textContent = fmt(totals.amount);
    if (sumCommissionEl) sumCommissionEl.textContent = fmt(totals.commission);
    if (sumEmployeeEl) sumEmployeeEl.textContent = fmt(totals.employee);
    if (sumBusinessEl) sumBusinessEl.textContent = fmt(totals.business);
  }

  function renderTable(list) {
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Kayıt yok</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((x) => `
      <tr>
        <td class="text-muted">${new Date(x.createdAt).toLocaleString("tr-TR")}</td>
        <td>${x.userId}</td>
        <td>${badge(x.paymentType)}</td>
        <td>${x.service || "-"}</td>
        <td class="text-end">${fmt(x.amount)}</td>
        <td class="text-end">${fmt(x.commission)}</td>
        <td class="text-end">${fmt(x.employee)}</td>
        <td class="text-end">${fmt(x.business)}</td>
      </tr>
    `).join("");
  }

  function exportCSV(list) {
    const header = ["Tarih", "Kullanıcı", "Tür", "Yapılan İşlem", "Tutar", "Komisyon", "Çalışan", "İşletme"];
    const rows = list.map(x => ([
      new Date(x.createdAt).toLocaleString("tr-TR"),
      x.userId,
      x.paymentType,
      x.service || "",
      x.amount,
      x.commission,
      x.employee,
      x.business
    ]));

    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gelir_listesi.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function refresh() {
    const all = AppStore.getTx().map(normalizeTx);
    const sorted = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    fillUserSelect(sorted);

    const filtered = applyFilters(sorted);
    renderTotals(filtered);
    renderTable(filtered);
  }

  function setDefaultDates() {
    // default: bu ay
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const toISO = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${da}`;
    };

    if (startEl && !startEl.value) startEl.value = toISO(start);
    if (endEl && !endEl.value) endEl.value = toISO(end);
  }

  // ---- Events ----
  btnApply?.addEventListener("click", (e) => { e.preventDefault(); refresh(); });

  btnReset?.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeEl) typeEl.value = "";
    if (userEl) userEl.value = "";
    if (startEl) startEl.value = "";
    if (endEl) endEl.value = "";
    setDefaultDates();
    refresh();
  });

  startEl?.addEventListener("change", refresh);
  endEl?.addEventListener("change", refresh);
  userEl?.addEventListener("change", refresh);
  typeEl?.addEventListener("change", refresh);

  btnExport?.addEventListener("click", (e) => {
    e.preventDefault();
    const all = AppStore.getTx().map(normalizeTx);
    const sorted = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const filtered = applyFilters(sorted);
    exportCSV(filtered);
  });

  // başka sekmeden ekleme olursa güncelle
  window.addEventListener("storage", (e) => {
    if (!e.key) return;
    if (e.key === "transactions_v1") refresh();
  });

  // ---- Init ----
  setDefaultDates();
  refresh();
})();
