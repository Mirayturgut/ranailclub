// dashboard/shared-storage.js
(() => {
  const KEYS = {
    tx: "transactions_v1",
    exp: "expenses_v1",
    users: "users_v1",
    logs: "logs_v1",
    session: "session_v1",
  };

  const read = (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  const fmtTRY = (n) => Number(n || 0).toLocaleString("tr-TR") + " ₺";
  const nowISO = () => new Date().toISOString();

  // ---- LOGS ----
  function addLog(action, payload = {}) {
    const logs = read(KEYS.logs, []);
    logs.push({
      id: uid(),
      action,              // "TX_ADD" | "TX_DEL" | "EXP_ADD" | "USER_ADD" | ...
      payload,             // {userId, amount, ...}
      at: nowISO(),
    });
    write(KEYS.logs, logs);
  }

  // ---- USERS ----
  function getUsers() {
    let users = read(KEYS.users, []);
    if (!users.length) {
      // demo seed
      users = [
        { id: "admin", name: "Admin", email: "admin@demo.com", role: "admin", password: "1234", active: true },
        { id: "ayse", name: "Ayşe", email: "ayse@demo.com", role: "user", password: "1234", active: true },
      ];
      write(KEYS.users, users);
    }
    return users;
  }

  function addUser({ name, email, role, password }) {
    const users = getUsers();
    if (users.some(u => u.email === email)) throw new Error("Bu email zaten kayıtlı.");
    const u = { id: uid(), name, email, role, password, active: true };
    users.push(u);
    write(KEYS.users, users);
    addLog("USER_ADD", { userId: u.id, email, role });
    return u;
  }

  function updateUser(id, patch) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) throw new Error("Kullanıcı bulunamadı.");
    users[idx] = { ...users[idx], ...patch };
    write(KEYS.users, users);
    addLog("USER_EDIT", { userId: id, patch });
    return users[idx];
  }

  function resetPassword(id, newPass = "1234") {
    return updateUser(id, { password: newPass });
  }

// ---- TRANSACTIONS ----
function normalizeTx(list) {
  let changed = false;

  const arr = Array.isArray(list) ? list : [];
  const fixed = arr
    .filter(t => t && typeof t === "object" && !Array.isArray(t)) // ✅ bozuk [] kayıtları at
    .map((t) => {
      const userId = t.userId ?? t.user ?? t.username ?? "unknown";

      let paymentType = (t.paymentType || "").toString();
      if (paymentType === "Card") paymentType = "Kart";
      if (paymentType === "Cash") paymentType = "Nakit";

      const out = {
        id: t.id ?? uid(),
        createdAt: t.createdAt ?? nowISO(),
        userId,
        paymentType,
        service: (t.service ?? t.job ?? t.work ?? "").toString(),
        amount: Number(t.amount || 0),
        commission: Number(t.commission || 0),
        base: Number(t.base || 0),
        employee: Number(t.employee || 0),
        business: Number(t.business || 0),
        note: (t.note || "").toString(),
      };

      // değişiklik kontrolü
      const prevService = (t.service ?? t.job ?? t.work ?? "").toString();
      if (
        out.userId !== t.userId ||
        out.paymentType !== t.paymentType ||
        out.service !== prevService ||
        out.id !== t.id ||
        out.createdAt !== t.createdAt
      ) changed = true;

      return out;
    });

  // ✅ Bozuk kayıt temizlendiyse veya migrate olduysa kaydet
  if (changed || fixed.length !== arr.length) write(KEYS.tx, fixed);

  return fixed;
}

function getTx() {
  const raw = read(KEYS.tx, []);
  return normalizeTx(raw);
}

function setTx(list) { write(KEYS.tx, list); }


function getTx() {
  const raw = read(KEYS.tx, []);
  return normalizeTx(raw);
}

  function setTx(list) { write(KEYS.tx, list); }

function addTx(tx) {
  const list = getTx();

  // normalizeTx array bekliyor -> tek kaydı array'e koyup ilk elemanı alıyoruz
  const normalized = normalizeTx([{
    ...tx,
    id: uid(),
    createdAt: nowISO(),
    userId: tx.userId || "unknown",
    // service alanı rapor/admin listelerinde görünecek
    service: (tx.service ?? tx.job ?? tx.work ?? "").toString(),
    note: (tx.note || "").toString(),
  }]);

  const item = normalized[0];

  list.push(item);
  setTx(list);

  // log'a service de ekleyelim
  addLog("TX_ADD", {
    userId: item.userId,
    amount: item.amount,
    paymentType: item.paymentType,
    service: item.service
  });

  return item;
}



  function deleteTx(id) {
    const list = getTx();
    const item = list.find(x => x.id === id);
    const next = list.filter(x => x.id !== id);
    setTx(next);
    addLog("TX_DEL", { txId: id, userId: item?.userId });
  }

  // ---- EXPENSES ----
  function getExp() { return read(KEYS.exp, []); }
  function setExp(list) { write(KEYS.exp, list); }

  function addExpense(exp) {
    const list = getExp();
    const item = {
      id: uid(),
      createdAt: nowISO(),
      category: exp.category,
      desc: exp.desc || "",
      amount: Number(exp.amount || 0),
      date: exp.date, // YYYY-MM-DD
    };
    list.push(item);
    setExp(list);
    addLog("EXP_ADD", { category: item.category, amount: item.amount, date: item.date });
    return item;
  }

  function deleteExpense(id) {
    const list = getExp();
    const item = list.find(x => x.id === id);
    setExp(list.filter(x => x.id !== id));
    addLog("EXP_DEL", { expId: id, amount: item?.amount });
  }

  // ---- SUMMARY ----
  function calcIncomeSummary(txList) {
    const list = Array.isArray(txList) ? txList : getTx();

    const totalRevenue = list.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const totalCommission = list.reduce((s, x) => s + (Number(x.commission) || 0), 0);
    const totalEmployee = list.reduce((s, x) => s + (Number(x.employee) || 0), 0);
    const totalBusiness = list.reduce((s, x) => s + (Number(x.business) || 0), 0);

    // geriye dönük uyum
    const totalAmount = totalRevenue;

    return { totalRevenue, totalAmount, totalCommission, totalEmployee, totalBusiness };
  }

  function calcExpenseSummary(expList) {
    const list = Array.isArray(expList) ? expList : getExp();
    const totalAmount = list.reduce((s, x) => s + (Number(x.amount) || 0), 0);

    // geriye dönük uyum
    const totalExpense = totalAmount;

    return { totalAmount, totalExpense };
  }

  // ---- SESSION (isteğe bağlı, auth-guard ile) ----
  function getSession() { return read(KEYS.session, null); }
  function setSession(s) { write(KEYS.session, s); }
  function clearSession() { localStorage.removeItem(KEYS.session); }

  // expose
  window.AppStore = {
    KEYS,
    fmtTRY,
    // users
    getUsers, addUser, updateUser, resetPassword,
    // tx
    getTx, addTx, deleteTx, calcIncomeSummary,
    // exp
    getExp, addExpense, deleteExpense, calcExpenseSummary,
    // logs
    getLogs: () => read(KEYS.logs, []),
    // session
    getSession, setSession, clearSession,
  };
})();
