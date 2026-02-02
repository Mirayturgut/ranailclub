// dashboard/user-transactions.js
(() => {
  if (!window.AppStore) {
    console.error("AppStore yok. shared-storage.js yüklenmemiş olabilir.");
    return;
  }

  // ---- DOM ----
  const qEl = document.getElementById("q");
  const typeEl = document.getElementById("typeFilter");
  const weekEl = document.getElementById("weekFilter");
  const monthEl = document.getElementById("monthFilter");
  const btnExport = document.getElementById("btnExport");
  const txCountEl = document.getElementById("txCount");
  const tbody = document.getElementById("txList");

  // ---- Session ----
  const session =
    AppStore.getSession?.() ||
    JSON.parse(localStorage.getItem("session") || "null") ||
    JSON.parse(localStorage.getItem("session_v1") || "null");

  if (!session) return;
  const currentUserId = session.username || session.userId || session.id;

  // ---- Helpers ----
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
      service: (t.service || t.category || "").toString(),
      amount: Number(t.amount || 0),
      commission: Number(t.commission || 0),
      employee: Number(t.employee || 0),
      business: Number(t.business || 0),
      note: (t.note || "").toString(),
    };
  }

  function badge(type) {
    if (type === "Kart") return `<span class="badge bg-light-primary border border-primary">Kart</span>`;
    return `<span class="badge bg-light-success border border-success">Nakit</span>`;
  }

  function getMonthKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`; // "2026-01"
  }
  function getWeekRange(weekValue) {
  // weekValue örn: "2026-W05"
  if (!weekValue) return null;

  const [yStr, wStr] = weekValue.split("-W");
  const year = Number(yStr);
  const week = Number(wStr);
  if (!Number.isFinite(year) || !Number.isFinite(week)) return null;

  // ISO week: haftanın pazartesi günü
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay(); // 0 pazar
  const ISOweekStart = new Date(simple);
  const diff = dow === 0 ? -6 : 1 - dow; // pazartesiye çek
  ISOweekStart.setDate(simple.getDate() + diff);
  ISOweekStart.setHours(0, 0, 0, 0);

  const ISOweekEnd = new Date(ISOweekStart);
  ISOweekEnd.setDate(ISOweekStart.getDate() + 7); // sonraki pazartesi (exclusive)

  return { start: ISOweekStart, end: ISOweekEnd };
}


  function normalizeTypeValue(v) {
    const x = (v || "").toString().trim().toLowerCase();

    // "hepsi" varyasyonları
    if (!x || x === "hepsi" || x === "all" || x === "tümü" || x === "tum" || x === "tumü") {
      return "Hepsi";
    }

    // Kart varyasyonları
    if (x === "kart" || x === "card" || x === "kredi" || x === "kredikarti" || x === "kredi kartı") {
      return "Kart";
    }

    // Nakit varyasyonları
    if (x === "nakit" || x === "cash" || x === "peşin" || x === "pesin") {
      return "Nakit";
    }

    // bilinmeyen gelirse hepsi gibi davran
    return "Hepsi";
  }

function applyFilters(list) {
  const q = (qEl?.value || "").trim().toLowerCase();
  const type = normalizeTypeValue(typeEl?.value);
  const week = (weekEl?.value || "").trim();   // ✅ NEW
  const month = (monthEl?.value || "").trim(); // "2026-01"

  const weekRange = getWeekRange(week);        // ✅ NEW

  return list.filter((t) => {
    if (type !== "Hepsi" && t.paymentType !== type) return false;

    // ✅ week filtresi
    if (weekRange) {
      const dt = new Date(t.createdAt);
      if (!(dt >= weekRange.start && dt < weekRange.end)) return false;
    }

    // month (week seçiliyse ay genelde boş olacak — aşağıda event ile temizleyeceğiz)
    if (month) {
      const mk = getMonthKey(new Date(t.createdAt));
      if (mk !== month) return false;
    }

    if (q) {
      const hay =
        `${t.service} ${t.note} ${t.amount} ${new Date(t.createdAt).toLocaleString("tr-TR")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

  function render(list) {
    if (!tbody) return;

    if (!list.length) {
      // ✅ NEW: 9 kolon (Tarih, Tür, Yapılan İşlem, Not, Tutar, Komisyon, Kazanç, İşletme, İşlem)
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Kayıt yok</td></tr>`;
      if (txCountEl) txCountEl.textContent = "0 kayıt";
      return;
    }

    const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (txCountEl) txCountEl.textContent = `Toplam: ${sorted.length} işlem`;

    tbody.innerHTML = sorted.map((t) => {
      const service = t.service || "-";

      return `
        <tr>
          <td class="text-muted">${new Date(t.createdAt).toLocaleString("tr-TR")}</td>
          <td>${badge(t.paymentType)}</td>
          <td>${service}</td>
          <td>${t.note || "-"}</td>
          <td class="text-end">${fmt(t.amount)}</td>
          <td class="text-end">${fmt(t.commission)}</td>
          <td class="text-end">${fmt(t.employee)}</td>
          <td class="text-end">${fmt(t.business)}</td>
          <td class="text-end">
            <button class="btn btn-link text-danger p-0" data-del="${t.id}">Sil</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del");
        AppStore.deleteTx(id);
        refresh();
      });
    });
  }

  function exportCSV(list) {
    // ✅ NEW: Service kolonu eklendi
    const header = ["Tarih", "Tür", "Yapılan İşlem", "Not", "Tutar", "Komisyon", "Kazanç", "İşletme"];
    const rows = list.map((t) => ([
      new Date(t.createdAt).toLocaleString("tr-TR"),
      t.paymentType,
      (t.service || "").replaceAll('"', '""'),
      (t.note || "").replaceAll('"', '""'),
      t.amount,
      t.commission,
      t.employee,
      t.business
    ]));

    const csv = [header, ...rows]
      .map(r => r.map(x => `"${x}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "islemler.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function refresh() {
    const all = AppStore.getTx().map(normalizeTx);
    const mine = all.filter(t => t.userId === currentUserId);
    const filtered = applyFilters(mine);
    render(filtered);
  }

  // ---- Events ----
  qEl?.addEventListener("input", refresh);
  typeEl?.addEventListener("change", refresh);
 weekEl?.addEventListener("change", () => {
  // Hafta seçilince ay temizlensin
  if (weekEl.value && monthEl) monthEl.value = "";
  refresh();
});

monthEl?.addEventListener("change", () => {
  // Ay seçilince hafta temizlensin
  if (monthEl.value && weekEl) weekEl.value = "";
  refresh();
});


  btnExport?.addEventListener("click", () => {
    const all = AppStore.getTx().map(normalizeTx);
    const mine = all.filter(t => t.userId === currentUserId);
    const filtered = applyFilters(mine);
    exportCSV(filtered);
  });

  // ---- Init ----
  refresh();
})();
