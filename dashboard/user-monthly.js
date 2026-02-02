// dashboard/user-monthly.js
(() => {
  if (!window.AppStore) {
    console.error("AppStore yok. shared-storage.js yüklenmemiş olabilir.");
    return;
  }

  const monthPick = document.getElementById("monthPick");
  const sCount = document.getElementById("sCount");
  const sEmployee = document.getElementById("sEmployee");
  const sBusiness = document.getElementById("sBusiness");
  const tbody = document.getElementById("mList");

  const session =
    AppStore.getSession?.() ||
    JSON.parse(localStorage.getItem("session") || "null") ||
    JSON.parse(localStorage.getItem("session_v1") || "null");

  if (!session) return;
  const currentUserId = session.username || session.userId || session.id;

  const fmt = (n) => AppStore.fmtTRY(n);

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
      // ✅ NEW: Yapılan İşlem
      service: (t.service || "").toString(),
      amount: Number(t.amount || 0),
      employee: Number(t.employee || 0),
      business: Number(t.business || 0),
      note: (t.note || "").toString(),
    };
  }

  function badge(type) {
    if (type === "Kart") return `<span class="badge bg-light-primary border border-primary">Kart</span>`;
    return `<span class="badge bg-light-success border border-success">Nakit</span>`;
  }

  function monthKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function render(list) {
    if (!tbody) return;

    if (!list.length) {
      // ✅ 5 kolon: Tarih, Tür, Yapılan İşlem, Tutar, Kazanç
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Kayıt yok</td></tr>`;
      return;
    }

    const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    tbody.innerHTML = sorted.slice(0, 10).map((t) => {
      const service = t.service || "-";

      return `
        <tr>
          <td class="text-muted">${new Date(t.createdAt).toLocaleString("tr-TR")}</td>
          <td>${badge(t.paymentType)}</td>
          <td>${service}</td>
          <td class="text-end">${fmt(t.amount)}</td>
          <td class="text-end">${fmt(t.employee)}</td>
        </tr>
      `;
    }).join("");
  }

  function refresh() {
    const all = AppStore.getTx().map(normalizeTx);
    const mine = all.filter(t => t.userId === currentUserId);

    // seçili ay: monthPick yoksa bu ay
    const selected = (monthPick?.value || monthKey(new Date())).trim();
    const monthTx = mine.filter(t => monthKey(new Date(t.createdAt)) === selected);

    const summary = monthTx.reduce((acc, t) => {
      acc.count += 1;
      acc.employee += t.employee;
      acc.business += t.business;
      return acc;
    }, { count: 0, employee: 0, business: 0 });

    if (sCount) sCount.textContent = String(summary.count);
    if (sEmployee) sEmployee.textContent = fmt(summary.employee);
    if (sBusiness) sBusiness.textContent = fmt(summary.business);

    render(monthTx);
  }

  monthPick?.addEventListener("change", refresh);
  refresh();
})();
