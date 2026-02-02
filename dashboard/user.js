// dashboard/user.js
(() => {
  // ---- SETTINGS ----
  const CARD_COMMISSION_MULTIPLIER = 1.20; // 1,20 (yani %20 dahil brüt)
  const EMPLOYEE_RATE = 0.40;        // %40

  // ---- Elements ----
  const btnCard = document.getElementById("btnCard");
  const btnCash = document.getElementById("btnCash");
  const btnSave = document.getElementById("btnSave");
  const btnClear = document.getElementById("btnClear");

  const amountEl = document.getElementById("amount");
  const noteEl = document.getElementById("note");
  const errEl = document.getElementById("calcError");

  // ✅ NEW: Yapılan İşlem
  const serviceEl = document.getElementById("service");

  const payBadge = document.getElementById("payBadge");

  const rCommission = document.getElementById("rCommission");
  const rBase = document.getElementById("rBase");
  const rEmployee = document.getElementById("rEmployee");
  const rBusiness = document.getElementById("rBusiness");
  const rAmount = document.getElementById("rAmount");

  const mCount = document.getElementById("mCount");
  const wAmount = document.getElementById("wAmount"); // ✅ Haftalık
  const mAmount = document.getElementById("mAmount");
  const mEmployee = document.getElementById("mEmployee");
  const mBusiness = document.getElementById("mBusiness");

  const txTable = document.getElementById("txTable");

  // ---- Guards ----
  if (!window.AppStore) {
    console.error("AppStore bulunamadı. shared-storage.js yüklenmiyor olabilir.");
    return;
  }

  const session =
    AppStore.getSession?.() ||
    JSON.parse(localStorage.getItem("session") || "null") ||
    JSON.parse(localStorage.getItem("session_v1") || "null");

  if (!session) return; // auth-guard zaten yönlendirir

  const currentUserId = session.username || session.userId || session.id;

  // ---- State ----
  let paymentType = ""; // "Kart" | "Nakit"

  // ---- Helpers ----
  const fmt = (n) => AppStore.fmtTRY(n);

  function showError(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.classList.remove("d-none");
  }
  function clearError() {
    if (!errEl) return;
    errEl.textContent = "";
    errEl.classList.add("d-none");
  }

  function calculate(amount, type) {
    const a = Number(amount);
    if (!type) throw new Error("Ödeme türü seçmelisin (Kart/Nakit).");
    if (!Number.isFinite(a) || a <= 0) throw new Error("Tutar 0’dan büyük olmalı.");

    let commission = 0;
    let base = a;

   if (type === "Kart") {
  // Brüt (a) = Net (base) * 1.20  =>  Net = Brüt / 1.20
  base = a / CARD_COMMISSION_MULTIPLIER;
  commission = a - base; // aradaki fark: 1200 - 1000 = 200
}


    const employee = base * EMPLOYEE_RATE;
    const business = base - employee;

    return { amount: a, paymentType: type, commission, base, employee, business };
  }

  function setPayBadge() {
    if (!payBadge) return;

    if (paymentType === "Kart") {
      payBadge.textContent = "Kart";
      payBadge.className = "badge bg-light-primary border border-primary";
    } else if (paymentType === "Nakit") {
      payBadge.textContent = "Nakit";
      payBadge.className = "badge bg-light-success border border-success";
    } else {
      payBadge.textContent = "Seçim yok";
      payBadge.className = "badge bg-light-secondary border border-secondary";
    }
  }

  function renderPreview() {
    clearError();

    try {
      if (!amountEl) return;

      const amount = amountEl.value;
      if (!amount && !paymentType) {
        // reset
        if (rAmount) rAmount.textContent = fmt(0);
        if (rCommission) rCommission.textContent = fmt(0);
        if (rBase) rBase.textContent = fmt(0);
        if (rEmployee) rEmployee.textContent = fmt(0);
        if (rBusiness) rBusiness.textContent = fmt(0);
        setPayBadge();
        return;
      }

      const res = calculate(amount, paymentType);

      if (rAmount) rAmount.textContent = fmt(res.amount);
      if (rCommission) rCommission.textContent = fmt(res.commission);
      if (rBase) rBase.textContent = fmt(res.base);
      if (rEmployee) rEmployee.textContent = fmt(res.employee);
      if (rBusiness) rBusiness.textContent = fmt(res.business);

      setPayBadge();
    } catch (e) {
      // reset values on error
      if (rAmount) rAmount.textContent = fmt(0);
      if (rCommission) rCommission.textContent = fmt(0);
      if (rBase) rBase.textContent = fmt(0);
      if (rEmployee) rEmployee.textContent = fmt(0);
      if (rBusiness) rBusiness.textContent = fmt(0);
      setPayBadge();

      showError(e.message);
    }
  }

  function renderTable(list) {
    if (!txTable) return;

    if (!list.length) {
      // ✅ 6 kolon (Tarih, Tür, Yapılan İşlem, Tutar, Kazanç, İşlem)
      txTable.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Henüz işlem yok</td></tr>`;
      return;
    }

    const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    txTable.innerHTML = sorted.slice(0, 10).map((t) => {
      const badge =
        t.paymentType === "Kart"
          ? `<span class="badge bg-light-primary border border-primary">Kart</span>`
          : `<span class="badge bg-light-success border border-success">Nakit</span>`;

      const service = t.service || "-";

      return `
        <tr>
          <td class="text-muted">${new Date(t.createdAt).toLocaleString("tr-TR")}</td>
          <td>${badge}</td>
          <td>${service}</td>
          <td class="text-end">${fmt(t.amount)}</td>
          <td class="text-end">${fmt(t.employee)}</td>
          <td class="text-end">
            <button class="btn btn-link text-danger p-0" data-del="${t.id}">Sil</button>
          </td>
        </tr>
      `;
    }).join("");

  txTable.querySelectorAll("[data-del]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.del; // ✅ FIX
    AppStore.deleteTx(id);
    refreshUI();
  });
});

  }

  function refreshUI() {
    const all = AppStore.getTx();
    const mine = all.filter((t) => t.userId === currentUserId);

    // ---- Aylık özet ----
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTx = mine.filter((t) => new Date(t.createdAt) >= monthStart);

    const monthSummary = monthTx.reduce(
      (acc, t) => {
        acc.count += 1;
        acc.amount += Number(t.amount || 0);
        acc.employee += Number(t.employee || 0);
        acc.business += Number(t.business || 0);
        return acc;
      },
      { count: 0, amount: 0, employee: 0, business: 0 }
    );

    if (mCount) mCount.textContent = String(monthSummary.count);
    if (mAmount) mAmount.textContent = fmt(monthSummary.amount);
    if (mEmployee) mEmployee.textContent = fmt(monthSummary.employee);
    if (mBusiness) mBusiness.textContent = fmt(monthSummary.business);

    // ✅ NEW: Haftalık toplam (Pazartesi 00:00 → şimdi)
    const day = now.getDay(); // 0=Pazar, 1=Pzt, ... 6=Cts
    const diffToMonday = day === 0 ? 6 : day - 1;

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekTx = mine.filter((t) => new Date(t.createdAt) >= weekStart);
    const weekTotal = weekTx.reduce((sum, t) => sum + Number(t.employee || 0), 0);

    if (wAmount) wAmount.textContent = fmt(weekTotal);

    renderTable(mine);
  }

  function resetForm() {
    clearError();
    if (amountEl) amountEl.value = "";
    if (noteEl) noteEl.value = "";
    if (serviceEl) serviceEl.value = ""; // ✅ NEW
    paymentType = "";

    btnCard?.classList.remove("btn-primary");
    btnCard?.classList.add("btn-outline-primary");
    btnCash?.classList.remove("btn-success");
    btnCash?.classList.add("btn-outline-success");

    renderPreview();
  }

function saveTx() {
  clearError();
  try {
    const res = calculate(amountEl?.value, paymentType);

    // ✅ service zorunlu
    const service = (serviceEl?.value || "").trim();
    if (!service) throw new Error("Yapılan işlem seçmelisin.");

    const note = (noteEl?.value || "").trim();

    AppStore.addTx({
      userId: currentUserId,          // ✅ sen zaten yukarıda currentUserId üretmişsin
      paymentType: res.paymentType,
      service,
      amount: res.amount,
      commission: res.commission,
      base: res.base,
      employee: res.employee,
      business: res.business,
      note
    });

    resetForm();
    refreshUI();
  } catch (e) {
    showError(e.message);
  }
}

  

  // ---- Events ----
  btnCard?.addEventListener("click", () => {
    paymentType = "Kart";
    btnCard.classList.remove("btn-outline-primary");
    btnCard.classList.add("btn-primary");
    btnCash?.classList.remove("btn-success");
    btnCash?.classList.add("btn-outline-success");
    renderPreview();
  });

  btnCash?.addEventListener("click", () => {
    paymentType = "Nakit";
    btnCash.classList.remove("btn-outline-success");
    btnCash.classList.add("btn-success");
    btnCard?.classList.remove("btn-primary");
    btnCard?.classList.add("btn-outline-primary");
    renderPreview();
  });

  amountEl?.addEventListener("input", renderPreview);
  btnSave?.addEventListener("click", saveTx);
  btnClear?.addEventListener("click", resetForm);

  // ---- Init ----
  setPayBadge();
  renderPreview();
  refreshUI();
})();
