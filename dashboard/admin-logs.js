// dashboard/admin-logs.js
(() => {
  if (!window.AppStore) {
    console.error("AppStore yok. shared-storage.js yüklenmemiş olabilir.");
    return;
  }

  const userEl = document.getElementById("logUser");
  const eventEl = document.getElementById("logEvent"); // ✅ İşlem = yapılan işlem
  const typeEl = document.getElementById("logType");   // ✅ Tür = Kart/Nakit veya gider kategorisi
  const monthEl = document.getElementById("logMonth"); // ✅ Ay filtresi
  const tbody = document.getElementById("logsTbody");

  const fmtTRY = (n) => Number(n || 0).toLocaleString("tr-TR") + " ₺";

  function getMonthKey(d) {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function actionLabel(action) {
    switch (action) {
      case "TX_ADD": return "Gelir eklendi";
      case "TX_DEL": return "Gelir silindi";
      case "EXP_ADD": return "Gider eklendi";
      case "EXP_DEL": return "Gider silindi";
      case "USER_ADD": return "Kullanıcı eklendi";
      case "USER_EDIT":
      case "USER_UPD": return "Kullanıcı güncellendi";
      case "LOGIN": return "Giriş";
      case "LOGOUT": return "Çıkış";
      default: return action || "-";
    }
  }

  function badge(type) {
    const x = (type || "").toString();
    if (!x || x === "-") return `<span class="badge bg-light-secondary border border-secondary">-</span>`;
    if (x === "Kart") return `<span class="badge bg-light-primary border border-primary">Kart</span>`;
    if (x === "Nakit") return `<span class="badge bg-light-success border border-success">Nakit</span>`;
    return `<span class="badge bg-light-warning border border-warning">${x}</span>`; // gider kategorileri
  }

  function buildUserMap() {
    try {
      const users = AppStore.getUsers ? AppStore.getUsers() : [];
      return new Map(users.map(u => [String(u.id), u.name || u.fullName || u.email || String(u.id)]));
    } catch {
      return new Map();
    }
  }

  function normalizeLogs() {
    const userMap = buildUserMap();
    const raw = (AppStore.getLogs ? AppStore.getLogs() : []);

    return raw
      .map(l => {
        const action = l.action || l.event || "-";
        const payload = l.payload ?? l.detail ?? {};
        const ts = l.at || l.ts || l.createdAt || payload?.at || payload?.createdAt;

        // kullanıcı
        const userId = payload?.userId || l.userId || l.user || l.username || "-";
        const userName = userMap.get(String(userId)) || payload?.name || payload?.username || userId || "-";

        // gelir alanları
        const paymentType = (payload?.paymentType || "").toString().trim(); // Kart/Nakit
        const service = (payload?.service || payload?.job || payload?.work || "").toString().trim();

        // gider alanları
        const category = (payload?.category || "").toString().trim();
        const desc = (payload?.desc || payload?.note || payload?.description || "").toString().trim();

        // fiyat
        const amountRaw = payload?.amount ?? payload?.price ?? payload?.total;
        const amount =
          (typeof amountRaw === "number" || typeof amountRaw === "string") && String(amountRaw).trim() !== ""
            ? Number(amountRaw)
            : null;

        // ✅ Tür sütunu/filtresi: gelirde Kart/Nakit, giderde Kategori
        const type = paymentType || category || "-";

        // ✅ Yapılan işlem sütunu/filtresi: gelirde service, giderde desc (yoksa kategori), diğerlerinde action label
        let doneText = actionLabel(action);
        if (action === "TX_ADD") {
          doneText = service || "Gelir eklendi";
        } else if (action === "EXP_ADD") {
          // giderde açıklama yoksa kategori gösterelim
          doneText = desc || category || "Gider eklendi";
        } else if (action === "TX_DEL") {
          // silmede servis gelmeyebilir; label yeter
          doneText = "Gelir silindi";
        } else if (action === "EXP_DEL") {
          doneText = "Gider silindi";
        }

        return {
          ts,
          userId,
          userName,
          action,
          type,
          amount,
          doneText, // ✅ yapılan işlem
        };
      })
      .filter(x => x.ts)
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }

  function fillSelect(selectEl, values, getText = (x) => x) {
    if (!selectEl) return;
    const current = selectEl.value || "";
    selectEl.innerHTML =
      `<option value="">Tümü</option>` +
      values.map(v => `<option value="${String(v).replaceAll('"', "&quot;")}">${getText(v)}</option>`).join("");

    if (Array.from(selectEl.options).some(o => o.value === current)) selectEl.value = current;
  }

  function buildFilters(logs) {
    // kullanıcı listesi
    const uMap = new Map();
    logs.forEach(l => {
      if (!l.userId || l.userId === "-") return;
      if (!uMap.has(l.userId)) uMap.set(l.userId, l.userName);
    });
    const users = Array.from(uMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    // ✅ işlem listesi = yapılan işlem (doneText)
    const events = Array.from(new Set(logs.map(l => l.doneText).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "tr"));

    // ✅ tür listesi = Kart/Nakit + gider kategorileri
    const types = Array.from(new Set(logs.map(l => l.type).filter(x => x && x !== "-")))
      .sort((a, b) => a.localeCompare(b, "tr"));

    // doldur
    if (userEl) {
      const current = userEl.value || "";
      userEl.innerHTML = `<option value="">Tümü</option>` + users
        .map(u => `<option value="${String(u.id).replaceAll('"', "&quot;")}">${u.name}</option>`)
        .join("");
      if (Array.from(userEl.options).some(o => o.value === current)) userEl.value = current;
    }

    fillSelect(eventEl, events);
    fillSelect(typeEl, types);
  }

function applyFilters(logs) {
  const u = (userEl?.value || "").trim();   // userId
  const e = (eventEl?.value || "").trim();  // doneText
  const t = (typeEl?.value || "").trim();   // type
  const m = (monthEl?.value || "").trim();  // yyyy-mm

  // ✅ Varsayılan: silinenleri gizle (ama filtreyle özellikle seçerse göster)
  const hideDeletesByDefault = true;

  return logs.filter(l => {
    // sadece "Tümü" iken silinenleri sakla
    if (
      hideDeletesByDefault &&
      !e && // kullanıcı işlem filtresi seçmemişse
      (l.doneText === "Gelir silindi" || l.doneText === "Gider silindi")
    ) return false;

    if (u && String(l.userId) !== u) return false;
    if (e && String(l.doneText) !== e) return false;
    if (t && String(l.type) !== t) return false;
    if (m && getMonthKey(l.ts) !== m) return false;

    return true;
  });
}


  function render() {
    if (!tbody) return;

    const logs = normalizeLogs();
    buildFilters(logs);

    const filtered = applyFilters(logs);

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Kayıt yok</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(l => {
      const tarih = new Date(l.ts).toLocaleString("tr-TR");
      const kullanici = l.userName || "-";
      const turBadge = badge(l.type);
      const fiyat = (l.amount === null || Number.isNaN(l.amount)) ? "-" : fmtTRY(l.amount);
      const yapilan = l.doneText || "-";

      return `
        <tr>
          <td class="text-muted">${tarih}</td>
          <td>${kullanici}</td>
          <td>${turBadge}</td>
          <td>${fiyat}</td>
          <td>${yapilan}</td>
        </tr>
      `;
    }).join("");
  }

  userEl?.addEventListener("change", render);
  eventEl?.addEventListener("change", render);
  typeEl?.addEventListener("change", render);
  monthEl?.addEventListener("change", render);

  render();
})();
