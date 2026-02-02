// dashboard/admin-expenses.js
(() => {
  if (!window.AppStore) {
    console.error("AppStore yok. shared-storage.js yüklenmemiş olabilir.");
    return;
  }

  // ---- Form ----
  const catEl = document.getElementById("expCategory");
  const descEl = document.getElementById("expDesc");
  const amountEl = document.getElementById("expAmount");
  const dateEl = document.getElementById("expDate");
  const btnAdd = document.getElementById("saveExpenseBtn");

  // ---- Filters ----
  const monthEl = document.getElementById("expMonthFilter");
  const btnFilter = document.getElementById("btnExpFilter");
  const btnReset = document.getElementById("btnExpReset");

  // ---- Table + Total ----
  const tbody = document.getElementById("expenseTbody");
  const totalEl = document.getElementById("totalExpense");

  const fmt = (n) => AppStore.fmtTRY(Number(n || 0));

  function todayYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function thisMonthYYYYMM() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function monthKeyFromDate(dateStr) {
    // dateStr: "YYYY-MM-DD"
    if (!dateStr || typeof dateStr !== "string" || dateStr.length < 7) return "";
    return dateStr.slice(0, 7);
  }

  function normalizeCategory(v) {
    const x = (v || "").toString().trim();
    if (!x) return "";
    const low = x.toLowerCase();
    if (low === "seç" || low === "sec" || low === "seçiniz") return "";
    return x;
  }

  function badgeCategory(cat) {
    const c = (cat || "").toLowerCase();
    if (c.includes("kira")) return `<span class="badge bg-light-warning border border-warning">Kira</span>`;
    if (c.includes("malzeme")) return `<span class="badge bg-light-primary border border-primary">Malzeme</span>`;
    if (c.includes("bakım") || c.includes("bakim")) return `<span class="badge bg-light-success border border-success">Bakım</span>`;
    return `<span class="badge bg-light-secondary border border-secondary">${cat || "-"}</span>`;
  }

  function applyMonthFilter(list) {
    const selectedMonth = (monthEl?.value || "").trim(); // "YYYY-MM"
    if (!selectedMonth) return list;

    return list.filter((e) => monthKeyFromDate(e.date) === selectedMonth);
  }

  function render() {
    const all = AppStore.getExp(); // expenses_v1
    const filtered = applyMonthFilter(all);

    // total (filtrelenmiş ayın toplamı)
    const sum = filtered.reduce((s, x) => s + Number(x.amount || 0), 0);
    if (totalEl) totalEl.textContent = fmt(sum);

    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Kayıt yok</td></tr>`;
      return;
    }

    const sorted = [...filtered].sort((a, b) => {
      // date alanı varsa onu baz alalım, yoksa createdAt
      const da = new Date(a.date || a.createdAt || 0);
      const db = new Date(b.date || b.createdAt || 0);
      return db - da;
    });

    tbody.innerHTML = sorted.map((e) => `
      <tr>
        <td class="text-muted">${(e.date ? new Date(e.date) : new Date(e.createdAt)).toLocaleDateString("tr-TR")}</td>
        <td>${badgeCategory(e.category)}</td>
        <td>${(e.desc || "").trim() || "-"}</td>
        <td class="text-end">${fmt(e.amount)}</td>
        <td class="text-end">
          <button class="btn btn-link text-danger p-0" data-del="${e.id}">Sil</button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.del;
        AppStore.deleteExpense(id);     // ✅ doğru fonksiyon
        render();
      });
    });
  }

  function addExpense() {
    const category = normalizeCategory(catEl?.value);
    const desc = (descEl?.value || "").trim();
    const amount = Number(amountEl?.value || 0);
    const date = (dateEl?.value || "").trim(); // "YYYY-MM-DD"

    if (!category) {
      alert("Kategori seçmelisin.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Tutar 0’dan büyük olmalı.");
      return;
    }
    if (!date) {
      alert("Tarih seçmelisin.");
      return;
    }

    AppStore.addExpense({ category, desc, amount, date }); // ✅ doğru alanlar + doğru fonksiyon

    // reset
    if (catEl) catEl.value = "Seç";
    if (descEl) descEl.value = "";
    if (amountEl) amountEl.value = "";
    if (dateEl) dateEl.value = todayYYYYMMDD();

    // filtre boşsa bugünkü aya çekelim ki eklenen satır görünsün
    if (monthEl && !monthEl.value) monthEl.value = thisMonthYYYYMM();

    render();
  }

  // ---- Events ----
  btnAdd?.addEventListener("click", (e) => {
    e.preventDefault();
    addExpense();
  });

  btnFilter?.addEventListener("click", (e) => {
    e.preventDefault();
    render();
  });

  btnReset?.addEventListener("click", (e) => {
    e.preventDefault();
    if (monthEl) monthEl.value = thisMonthYYYYMM();
    render();
  });

  monthEl?.addEventListener("change", render);

  // başka sekmede değişirse (dashboard açıksa otomatik güncellesin)
  window.addEventListener("storage", (e) => {
    if (e.key === AppStore.KEYS?.exp || e.key === "expenses_v1") {
      render();
    }
  });

  // ---- Init ----
  if (dateEl && !dateEl.value) dateEl.value = todayYYYYMMDD();
  if (monthEl && !monthEl.value) monthEl.value = thisMonthYYYYMM();
  render();
})();
