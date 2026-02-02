// dashboard/user-profile.js
(function () {
  const session = JSON.parse(localStorage.getItem("session") || "null");
  if (!session) return;

  const pName = document.getElementById("pName");
  const pUsername = document.getElementById("pUsername");
  const pRole = document.getElementById("pRole");

  if (pName) pName.textContent = session.name || "-";
  if (pUsername) pUsername.textContent = session.username || "-";
  if (pRole) pRole.textContent = session.role || "-";
})();
