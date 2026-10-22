// Shared by /basement and the 404 page: ask the server for this player's
// code for the egg named in <body data-egg>. Without a case file, say so.
const egg = document.body.dataset.egg;
const out = document.getElementById("code");
let token = null;
try { token = localStorage.getItem("nightshift.token"); } catch { /* blocked */ }
if (!token) {
  out.textContent = "You need a case file for ARCHIE to recognise you. Open one first.";
} else {
  fetch(`/api/egg/${egg}`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json())
    .then((d) => {
      out.textContent = d.code
        ? `${d.message} Report this under Discoveries: ${d.code}`
        : d.message || "Nothing here right now.";
    })
    .catch(() => { out.textContent = "The light flickers and goes out."; });
}
