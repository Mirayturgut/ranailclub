// dashboard/auth-guard.js
(() => {
  const raw = localStorage.getItem("session") 
  if (!raw) {
    window.location.href = "../pages/login.html";
    return;
  }

  let session = null;
  try {
    session = JSON.parse(raw);
  } catch {
    localStorage.removeItem("session");
    window.location.href = "../pages/login.html";
    return;
  }

  const role = String(session.role || "").toLowerCase(); // "admin" | "user"
  const page = location.pathname.toLowerCase();

  // Admin sayfaları
  if (page.includes("admin") && role !== "admin") {
    window.location.href = "../dashboard/user.html";
    return;
  }

  // User sayfaları
  if (page.includes("user") && role !== "user") {
    window.location.href = "../dashboard/index.html";
    return;
  }

  // Header isim (opsiyonel)
  const nameEl = document.getElementById("sessionName");
  if (nameEl) nameEl.textContent = `${session.name || session.username || "Kullanıcı"}`;

  // Logout (tek fonksiyon, tek yer)
  function doLogout(e) {
    e?.preventDefault?.();
    localStorage.removeItem("session");
    window.location.href = "../pages/login.html";
  }

  document.getElementById("logoutBtn")?.addEventListener("click", doLogout);
  document.getElementById("logoutBtnHeader")?.addEventListener("click", doLogout);
  document.getElementById("logoutBtnProfile")?.addEventListener("click", doLogout);
})();
