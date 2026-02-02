// dashboard/admin-dashboard.js
// Kartlar + Son İşlemler tablosu (Filtreli)
// Net Kazanç = İşletme Payı - Giderler
(() => {
  if (!window.AppStore) {
    console.error("AppStore yok. shared-storage.js yüklenmemiş olabilir.");
    return;
  }

  // ---- Cards (Monthly) ----
  const elRevenue = document.getElementById("admTotalRevenue");
  const elCommission = document.getElementById("admTotalCommission");
  const elExpenses = document.getElementById("admTotalExpenses");
  const elNetProfit = document.getElementById("admNetProfit");

  // ---- Cards (Weekly - optional) ----
  const elWeekRevenue = document.getElementById("admWeekRevenue");
  const elWeekNetProfit = document.getElementById("admWeekNetProfit");

  // ---- Filters (NEW) ----
  const weekFilterEl = document.getElementById("admWeekFilter");   // select
  const monthFilterEl = document.getElementById("admMonthFilter"); // input type="month"

  // ---- Recent table ----
  const tbody = document.getElementById("admRecentTxBody");
  const countEl = document.getElementById("admRecentTxCount");

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
      service: (t.service || t.job || t.work || "").toString(),
      amount: Number(t.amount || 0),
      commission: Number(t.commission || 0),
      employee: Number(t.employee || 0),
      business: Number(t.business || 0),
      note: (t.note || "").toString()
    };
  }

  function badge(type) {
    if (type === "Kart") return `<span class="badge bg-light-primary border border-primary">Kart</span>`;
    return `<span class="badge bg-light-success border border-success">Nakit</span>`;
  }

  // Pazartesi 00:00 bazlı hafta başlangıcı
  function getWeekStart(d = new Date()) {
    const day = d.getDay(); // 0=Pazar, 1=Pzt...
    const diffToMonday = day === 0 ? 6 : day - 1;
    const ws = new Date(d);
    ws.setDate(d.getDate() - diffToMonday);
    ws.setHours(0, 0, 0, 0);
    return ws;
  }

  function getWeekRange(mode = "this") {
    const now = new Date();
    const thisStart = getWeekStart(now);
    const thisEnd = new Date(now); // şimdi

    if (mode === "prev") {
      const prevEnd = new Date(thisStart);
      prevEnd.setMilliseconds(-1); // bu haftanın başlangıcından 1ms önce
      const prevStart = getWeekStart(prevEnd);
      return { start: prevStart, end: prevEnd };
    }

    // default: this week
    return { start: thisStart, end: thisEnd };
  }

  function getMonthRange(yyyyMM) {
    // yyyy-MM
    const [y, m] = String(yyyyMM).split("-").map(Number);
    if (!y || !m) return null;

    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0, 0);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return { start, end };
  }

  function expenseDate(e) {
    return new Date(e.date || e.createdAt || 0);
  }

  function calcIncome(list) {
    return list.reduce((acc, t) => {
      acc.revenue += t.amount;
      acc.commission += t.commission;
      acc.employee += t.employee;
      acc.business += t.business;
      return acc;
    }, { revenue: 0, commission: 0, employee: 0, business: 0 });
  }

  function calcExpenses(list) {
    return list.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }

  // ✅ Filtreye göre tarih aralığını belirle
function getActiveRange() {
  const weekVal = (weekFilterEl?.value || "").trim();   // ✅ "2026-W06"
  const monthVal = (monthFilterEl?.value || "").trim(); // ✅ "2026-02"

  // Öncelik: Ay seçildiyse AY
  if (monthVal) return getMonthRange(monthVal);

  // Ay yoksa hafta seçildiyse HAFTA
  if (weekVal) return getISOWeekRange(weekVal);

  // hiçbiri yoksa tüm zaman
  return null;
}


  function inRange(dateVal, range) {
    if (!range) return true;
    const d = new Date(dateVal);
    return d >= range.start && d <= range.end;
  }

  function renderCards() {
    const range = getActiveRange();

    const allTx = (AppStore.getTx ? AppStore.getTx() : []).map(normalizeTx);
    const txFiltered = allTx.filter(t => inRange(t.createdAt, range));

    const allExp = (AppStore.getExp ? AppStore.getExp() : []);
    const expFiltered = allExp.filter(e => inRange(expenseDate(e), range));

    const inc = calcIncome(txFiltered);
    const expTotal = calcExpenses(expFiltered);
    const net = inc.business - expTotal;

    // Cards
    if (elRevenue) elRevenue.textContent = fmt(inc.revenue);
    if (elCommission) elCommission.textContent = fmt(inc.commission);
    if (elExpenses) elExpenses.textContent = fmt(expTotal);
    if (elNetProfit) elNetProfit.textContent = fmt(net);

    // Weekly cards (opsiyonel): sadece “hafta filtresi” seçiliyken doldur
    // Ay filtresi varken haftalık kartlar mantıksız olabileceği için boş bırakıyoruz.
    if (elWeekRevenue || elWeekNetProfit) {
      const weekMode = (weekFilterEl?.value || "").trim();
      const monthVal = (monthFilterEl?.value || "").trim();

      if (!monthVal && weekMode) {
        // haftayı ayrıca göster
        if (elWeekRevenue) elWeekRevenue.textContent = fmt(inc.revenue);
        if (elWeekNetProfit) elWeekNetProfit.textContent = fmt(net);
      } else {
        // istersen burada "—" yap
        if (elWeekRevenue) elWeekRevenue.textContent = "—";
        if (elWeekNetProfit) elWeekNetProfit.textContent = "—";
      }
    }
  }

  function renderRecentTable() {
    if (!tbody) return;

    const range = getActiveRange();
    const tx = (AppStore.getTx ? AppStore.getTx() : []).map(normalizeTx);
    const filtered = tx.filter(t => inRange(t.createdAt, range));

    const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const last = sorted.slice(0, 10);

    if (!last.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Kayıt yok</td></tr>`;
      if (countEl) countEl.textContent = "0 kayıt";
      return;
    }

    if (countEl) countEl.textContent = `Son ${last.length} kayıt`;

    tbody.innerHTML = last.map(t => `
      <tr>
        <td class="text-muted">${new Date(t.createdAt).toLocaleString("tr-TR")}</td>
        <td>${t.userId}</td>
        <td>${badge(t.paymentType)}</td>
        <td class="text-truncate" style="max-width:260px">${t.service || "-"}</td>
        <td class="text-end">${fmt(t.amount)}</td>
        <td class="text-end">${fmt(t.employee)}</td>
      </tr>
    `).join("");
  }

  function refresh() {
    renderCards();
    renderRecentTable();
  }
  function getISOWeekRange(weekValue) {
  // weekValue: "2026-W06"
  if (!weekValue) return null;

  const [yPart, wPart] = weekValue.split("-W");
  const year = Number(yPart);
  const week = Number(wPart);
  if (!year || !week) return null;

  // ISO week: 1. hafta = 4 Ocak'ın olduğu hafta
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // 1..7 (Mon..Sun), Sun->7

  // ISO week 1'in pazartesisi
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - (jan4Day - 1));
  week1Mon.setHours(0, 0, 0, 0);

  // seçilen haftanın pazartesisi
  const start = new Date(week1Mon);
  start.setDate(week1Mon.getDate() + (week - 1) * 7);

  // pazar 23:59:59.999
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function inRange(dateVal, range) {
  if (!range) return true;
  const d = new Date(dateVal);
  return d >= range.start && d <= range.end;
}


  // ✅ Filtre eventleri
weekFilterEl?.addEventListener("change", () => {
  // hafta seçilince ayı sıfırla istersen
  if (monthFilterEl) monthFilterEl.value = "";
  refresh();
});

monthFilterEl?.addEventListener("change", () => {
  // ay seçilince haftayı sıfırla istersen
  if (weekFilterEl) weekFilterEl.value = "";
  refresh();
});


  refresh();

  window.addEventListener("storage", (e) => {
    if (!e.key) return;
    if (["transactions_v1", "expenses_v1"].includes(e.key)) refresh();
  });
})();
