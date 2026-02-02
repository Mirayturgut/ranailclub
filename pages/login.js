(() => {
  const form = document.getElementById("loginForm");
  const usernameEl = document.getElementById("username");
  const passwordEl = document.getElementById("password");
  const errorEl = document.getElementById("loginError");

  if (!form || !usernameEl || !passwordEl) {
    console.warn("Login form elemanları bulunamadı. ID'leri kontrol et.");
    return;
  }

  if (!window.AppStore) {
    console.warn("AppStore yok. shared-storage.js yüklenmemiş veya yolu yanlış.");
    // formu yine de dinleyelim, ama girişte hata vereceğiz
  }

  function showError(msg) {
    if (!errorEl) return alert(msg);
    errorEl.textContent = msg;
    errorEl.classList.remove("d-none");
  }
  function clearError() {
    if (!errorEl) return;
    errorEl.classList.add("d-none");
    errorEl.textContent = "";
  }

  // username: "ayse" veya "ayse@demo.com" gibi girilebilir
  function normalizeLoginText(v) {
    const x = String(v || "").trim().toLowerCase();
    if (!x) return "";
    // email girildiyse username kısmını da üretelim
    const uname = x.includes("@") ? x.split("@")[0] : x;
    return { raw: x, uname };
  }

  function getUsersSafe() {
    try {
      return window.AppStore?.getUsers ? window.AppStore.getUsers() : [];
    } catch {
      return [];
    }
  }

  function setSessionSafe(sessionObj) {
    // Sisteminizin asıl session key'i: session_v1
    try {
      if (window.AppStore?.setSession) window.AppStore.setSession(sessionObj);
    } catch {}

    // bazı sayfalar hâlâ "session" okuyorsa diye (uyumluluk)
    localStorage.setItem("session", JSON.stringify(sessionObj));
  }

  function findUser(loginText) {
    const { raw, uname } = normalizeLoginText(loginText);
    const users = getUsersSafe();

    // users_v1 şemasına göre:
    // { id, name, email, role, password, active }
    return users.find(u => {
      const email = String(u.email || "").trim().toLowerCase(); // ayse@demo.com
      const emailUname = email.includes("@") ? email.split("@")[0] : "";
      const id = String(u.id || "").trim().toLowerCase();      // admin / uuid
      return raw === email || uname === emailUname || uname === id;
    });
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearError();

    if (!window.AppStore) {
      showError("shared-storage.js yüklenmemiş. login.html içine eklediğinden emin ol.");
      return;
    }

    const loginText = (usernameEl?.value || "").trim();
    const pass = (passwordEl?.value || "").trim();

    const user = findUser(loginText);
    if (!user) {
      showError("Kullanıcı bulunamadı.");
      return;
    }

    if (user.active === false) {
      showError("Bu kullanıcı pasif. Yöneticiyle iletişime geçin.");
      return;
    }

    if (String(user.password || "") !== pass) {
      showError("Kullanıcı adı veya şifre hatalı.");
      return;
    }

    const role = String(user.role || "user").toLowerCase(); // "admin" / "user"
    const sessionObj = {
      id: user.id,
      username: (String(user.email || "").split("@")[0]) || String(user.id || ""),
      name: user.name || "User",
      role
    };

    setSessionSafe(sessionObj);

    // ✅ Doğru redirect
    if (role === "admin") window.location.href = "../dashboard/index.html";
    else window.location.href = "../dashboard/user.html";
  });
})();
