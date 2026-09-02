fetch("https://mi-solicitud-card-2341.pages.dev/api/check-action?id=test")
  .then(r => r.text())
  .then(console.log)
  .catch(console.error);
