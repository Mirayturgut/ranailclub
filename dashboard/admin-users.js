(() => {
  if (!window.AppStore) {
    console.error("AppStore yok. shared-storage.js yüklenmemiş olabilir.");
    return;
  }

  // ---- DOM ----
  const tbody = document.getElementById("usersTbody");
  const btnNew = document.getElementById("btnNewUser");
  const btnSave = document.getElementById("btnSaveUser");

  const modalEl = document.getElementById("userModal");
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;

  const titleEl = document.getElementById("userModalTitle");
  const umId = document.getElementById("umId");
  const umName = document.getElementById("umName");
  const umUsername = document.getElementById("umUsername");
  const umRole = document.getElementById("umRole");
  const umPassword = document.getElementById("umPassword");
  const umPassWrap = document.getElementById("umPassWrap");

  const fmtTRY = (n) => Number(n || 0).toLocaleString("tr-TR") + " ₺";

  // username -> email’e çeviriyoruz (shared-storage user modelinde email var)
  const usernameToEmail = (u) => `${String(u || "").trim()}@demo.com`;
  const emailToUsername = (email) => String(email || "").split("@")[0];

  // Aylık işlem ve kazanç (TX_ADD üzerinden hesap)
  function monthKey(d) {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function currentMonthKey() {
    return monthKey(new Date());
  }

  function calcUserMonthlyStats(userId) {
    const tx = (AppStore.getTx ? AppStore.getTx() : []);
    const mk = currentMonthKey();

    const mine = tx.filter(t => String(t.userId) === String(userId) && monthKey(t.createdAt) === mk);

    const count = mine.length;
    // “kazanç” = çalışan payı (employee)
    const earning = mine.reduce((s, t) => s + (Number(t.employee) || 0), 0);

    return { count, earning };
  }

  function badgeRole(role) {
    const r = String(role || "").toLowerCase();
    if (r === "admin") return `<span class="badge bg-light-warning border border-warning">Admin</span>`;
    return `<span class="badge bg-light-primary border border-primary">User</span>`;
  }

  function badgeStatus(active) {
    if (active) return `<span class="badge bg-light-success border border-success">Aktif</span>`;
    return `<span class="badge bg-light-danger border border-danger">Pasif</span>`;
  }

  function render() {
    if (!tbody) return;

    const users = AppStore.getUsers ? AppStore.getUsers() : [];
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Kullanıcı yok</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const username = emailToUsername(u.email);
      const stats = (u.role === "user") ? calcUserMonthlyStats(u.id) : { count: "-", earning: "-" };

      return `
        <tr>
          <td>${u.name || "-"}</td>
          <td class="text-muted">${username}</td>
          <td>${badgeRole(u.role)}</td>
          <td>${badgeStatus(!!u.active)}</td>
          <td class="text-center">${stats.count === "-" ? "—" : stats.count}</td>
          <td class="text-center">${stats.earning === "-" ? "—" : fmtTRY(stats.earning)}</td>
          <td class="text-end">
            <button class="btn btn-outline-secondary btn-sm me-1" data-edit="${u.id}">Düzenle</button>
            <button class="btn btn-outline-warning btn-sm me-1" data-reset="${u.id}">Şifre Reset</button>
           ${
  u.role === "admin"
    ? ""
    : `
        ${u.active
          ? `<button class="btn btn-outline-danger btn-sm me-1" data-toggle="${u.id}">Pasif</button>`
          : `<button class="btn btn-outline-success btn-sm me-1" data-toggle="${u.id}">Aktif</button>`
        }
        <button class="btn btn-outline-danger btn-sm" data-del="${u.id}">Sil</button>
      `
}

          </td>
        </tr>
      `;
    }).join("");

    // events
    tbody.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openEdit(b.dataset.edit)));
    tbody.querySelectorAll("[data-reset]").forEach(b => b.addEventListener("click", () => doReset(b.dataset.reset)));
    tbody.querySelectorAll("[data-toggle]").forEach(b => b.addEventListener("click", () => toggleActive(b.dataset.toggle)));
    tbody.querySelectorAll("[data-del]").forEach(b =>
  b.addEventListener("click", () => doDeleteUser(b.dataset.del))
);

  }

  function openNew() {
    if (!modal) return;

    if (titleEl) titleEl.textContent = "Yeni Kullanıcı";
    if (umId) umId.value = "";
    if (umName) umName.value = "";
    if (umUsername) umUsername.value = "";
    if (umRole) umRole.value = "user";
    if (umPassword) umPassword.value = "1234";
    if (umPassWrap) umPassWrap.style.display = "";

    modal.show();
  }

  function openEdit(id) {
    if (!modal) return;

    const users = AppStore.getUsers();
    const u = users.find(x => String(x.id) === String(id));
    if (!u) return;

    if (titleEl) titleEl.textContent = "Kullanıcı Düzenle";
    if (umId) umId.value = u.id;
    if (umName) umName.value = u.name || "";
    if (umUsername) umUsername.value = emailToUsername(u.email);
    if (umRole) umRole.value = String(u.role || "user").toLowerCase();
    if (umPassword) umPassword.value = ""; // edit’te boş
    if (umPassWrap) umPassWrap.style.display = "";

    modal.show();
  }

  function saveUser() {
    const id = (umId?.value || "").trim();
    const name = (umName?.value || "").trim();
    const username = (umUsername?.value || "").trim().toLowerCase();
    const role = (umRole?.value || "user").trim().toLowerCase();
    const pass = (umPassword?.value || "").trim();

    if (!name) return alert("Ad Soyad boş olamaz.");
    if (!username) return alert("Kullanıcı adı boş olamaz.");
    if (!["user", "admin"].includes(role)) return alert("Rol geçersiz.");

    const email = usernameToEmail(username);

    try {
      if (!id) {
        // NEW
        if (!pass) return alert("Şifre boş olamaz.");
        AppStore.addUser({ name, email, role, password: pass });
      } else {
        // EDIT (password boşsa değiştirme)
        const patch = { name, email, role };
        AppStore.updateUser(id, patch);
        if (pass) AppStore.resetPassword(id, pass);
      }

      modal?.hide();
      render();
      alert("Kaydedildi ✅");
    } catch (e) {
      alert(e?.message || "Bir hata oluştu.");
    }
  }

  function doReset(id) {
    if (!confirm("Şifre 1234 olarak sıfırlansın mı?")) return;
    try {
      AppStore.resetPassword(id, "1234");
      alert("Şifre 1234 yapıldı ✅");
    } catch (e) {
      alert(e?.message || "Hata");
    }
  }

  function toggleActive(id) {
    const users = AppStore.getUsers();
    const u = users.find(x => String(x.id) === String(id));
    if (!u) return;

    const next = !u.active;
    const msg = next ? "Kullanıcı aktif edilsin mi?" : "Kullanıcı pasif edilsin mi?";
    if (!confirm(msg)) return;

    try {
      AppStore.updateUser(id, { active: next });
      render();
    } catch (e) {
      alert(e?.message || "Hata");
    }
  }
  function doDeleteUser(id) {
  const users = AppStore.getUsers();
  const u = users.find(x => String(x.id) === String(id));
  if (!u) return;

  if (String(u.role || "").toLowerCase() === "admin") {
    alert("Admin kullanıcı silinemez.");
    return;
  }

  const ok = confirm(
    `${u.name || "Bu kullanıcı"} silinsin mi?\n\n` +
    `⚠️ Bu işlem geri alınamaz.\n` +
    `İstersen bu kullanıcıya ait işlemleri de temizleyebiliriz.`
  );
  if (!ok) return;

  try {
    // 1) Kullanıcıyı sil
    if (AppStore.deleteUser) {
      AppStore.deleteUser(id);
    } else {
      // deleteUser yoksa: direkt listeyi güncelle
      const nextUsers = users.filter(x => String(x.id) !== String(id));
      if (AppStore.setUsers) AppStore.setUsers(nextUsers);
      else localStorage.setItem("users_v1", JSON.stringify(nextUsers));
    }

    // 2) Bu kullanıcıya ait işlemleri de silelim (opsiyonel ama genelde doğru)
    // transactions key’in sende "transactions_v1" gibi duruyor
    const tx = AppStore.getTx ? AppStore.getTx() : [];
    const nextTx = tx.filter(t => String(t.userId) !== String(id));

    if (AppStore.setTx) AppStore.setTx(nextTx);
    else localStorage.setItem("transactions_v1", JSON.stringify(nextTx));

    // 3) Tabloyu yenile
    render();

    alert("Kullanıcı silindi ✅");
  } catch (e) {
    alert(e?.message || "Silme sırasında hata oluştu.");
  }
}


  btnNew?.addEventListener("click", openNew);
  btnSave?.addEventListener("click", (e) => {
    e.preventDefault();
    saveUser();
  });

  render();

  // başka sekmede değişirse güncelle
  window.addEventListener("storage", (e) => {
    if (!e.key) return;
    if (["users_v1", "transactions_v1"].includes(e.key)) render();
  });
})();
