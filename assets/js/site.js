/* Elpee — site. Sem dependências. Nada de terceiros carrega antes do consentimento. */
(function () {
  "use strict";
  var C = window.ELPEE_CFG || {};
  var K = "elpee_consent_v1";
  var R = C.rastreamento || {};
  var temRastreio = !!(R.ga4 || R.google_ads || R.meta_pixel);
  var carregado = false;

  function ler() { try { return localStorage.getItem(K); } catch (e) { return null; } }
  function gravar(v) { try { localStorage.setItem(K, v); } catch (e) { /* sem armazenamento: pergunta de novo na próxima visita */ } }

  function evento(nome, params) {
    if (!carregado) return;
    try {
      if (window.gtag) window.gtag("event", nome, params || {});
      if (window.fbq && nome === "generate_lead") window.fbq("track", "Lead");
    } catch (e) { /* medição nunca quebra a página */ }
  }
  window.elpeeEvento = evento;

  function carregarRastreio() {
    if (carregado || !temRastreio) return;
    carregado = true;
    var gid = R.ga4 || R.google_ads;
    if (gid) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      if (R.ga4) window.gtag("config", R.ga4);
      if (R.google_ads) window.gtag("config", R.google_ads);
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gid);
      document.head.appendChild(s);
    }
    if (R.meta_pixel) {
      (function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
        t = b.createElement(e); t.async = true; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", R.meta_pixel);
      window.fbq("track", "PageView");
    }
  }

  function banner() {
    var el = document.getElementById("consent");
    if (!el) return;
    var estado = ler();
    if (estado === "sim") { carregarRastreio(); el.hidden = true; return; }
    el.hidden = estado === "nao";
    var aceitar = el.querySelector("[data-consent=sim]");
    var recusar = el.querySelector("[data-consent=nao]");
    aceitar.onclick = function () { gravar("sim"); el.hidden = true; carregarRastreio(); };
    recusar.onclick = function () { var antes = carregado; gravar("nao"); el.hidden = true; if (antes) location.reload(); };
  }

  document.addEventListener("click", function (ev) {
    var p = ev.target.closest("[data-cookie-prefs]");
    if (p) { var el = document.getElementById("consent"); if (el) { el.hidden = false; var b = el.querySelector("button"); if (b) b.focus(); } }
    var t = ev.target.closest("[data-evento]");
    if (t) evento(t.getAttribute("data-evento"), { origem: t.getAttribute("data-origem") || location.pathname });
  });

  /* Origem do acesso (UTM): só vai junto com a mensagem enviada pelo visitante. */
  var UTMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  function utms() {
    var o = {}, q = new URLSearchParams(location.search), achou = false;
    UTMS.forEach(function (k) { if (q.get(k)) { o[k] = q.get(k).slice(0, 120); achou = true; } });
    try {
      if (achou) sessionStorage.setItem("elpee_utm", JSON.stringify(o));
      else { var s = sessionStorage.getItem("elpee_utm"); if (s) o = JSON.parse(s); }
    } catch (e) { /* ignora */ }
    return o;
  }

  /* Frase da página inicial: leva a atividade e o objetivo para o contato. */
  var go = document.querySelector("[data-frase-go]");
  if (go) {
    go.addEventListener("click", function (e) {
      e.preventDefault();
      var a = document.getElementById("frase-atividade").value;
      var o = document.getElementById("frase-objetivo").value;
      var q = new URLSearchParams({ atividade: a, objetivo: o });
      var u = utms();
      Object.keys(u).forEach(function (k) { q.set(k, u[k]); });
      location.href = "contato.html?" + q.toString() + "#formulario";
    });
  }

  /* Formulário de contato. */
  var f = document.getElementById("form-contato");
  if (f) {
    var qs = new URLSearchParams(location.search);
    ["atividade", "objetivo"].forEach(function (n) {
      var v = qs.get(n); var sel = f.elements[n];
      if (!v || !sel) return;
      var existe = Array.prototype.some.call(sel.options, function (op) { return op.value === v; });
      if (!existe) { var op = document.createElement("option"); op.textContent = v.slice(0, 80); op.value = v.slice(0, 80); sel.appendChild(op); }
      sel.value = v.slice(0, 80);
    });
    var u0 = utms();
    UTMS.forEach(function (k) { if (f.elements[k]) f.elements[k].value = u0[k] || ""; });
    if (f.elements.pagina_origem) f.elements.pagina_origem.value = document.referrer ? new URL(document.referrer).pathname : "direto";

    var status = document.getElementById("form-status");
    function marcar(campo, ruim) { var b = campo.closest(".campo"); if (b) b.classList.toggle("invalido", ruim); }
    function validar() {
      var ok = true;
      [["nome", function (v) { return v.trim().length >= 2; }],
       ["email", function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); }],
       ["mensagem", function (v) { return v.trim().length >= 5; }]].forEach(function (r) {
        var c = f.elements[r[0]]; var ruim = !r[1](c.value); marcar(c, ruim); if (ruim) ok = false;
      });
      var ac = f.elements.aceite; marcar(ac, !ac.checked); if (!ac.checked) ok = false;
      return ok;
    }
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      status.textContent = "";
      if (f.elements.empresa_site.value) return; /* armadilha de robô */
      if (!validar()) { status.textContent = "Confira os campos destacados."; var p = f.querySelector(".invalido input,.invalido select,.invalido textarea"); if (p) p.focus(); return; }
      var d = {};
      Array.prototype.forEach.call(f.elements, function (c) { if (c.name && c.name !== "empresa_site" && c.type !== "checkbox") d[c.name] = c.value; });
      d.aceite_politica = "sim";
      d.enviado_em = new Date().toISOString();
      var qOrigem = qs.get("origem"); if (qOrigem) { d.origem = qOrigem.slice(0, 120); }
      if (C.form_endpoint) {
        var corpo = new URLSearchParams(d);
        var botao = f.querySelector("button[type=submit]");
        if (botao) { botao.disabled = true; }
        status.textContent = "Enviando...";
        fetch(C.form_endpoint, { method: "POST", body: corpo })
          .then(function (resp) { return resp.json(); })
          .then(function (res) {
            if (res && res.ok) {
              status.textContent = res.mensagem || "Recebemos a sua mensagem. Respondemos em até 1 dia útil.";
              f.reset();
              /* O reset limpa também os campos escondidos de origem. Sem
                 estas duas linhas, um segundo envio feito da mesma página
                 chegaria sem a origem e sem a página de onde a pessoa veio. */
              UTMS.forEach(function (k) { if (f.elements[k]) { f.elements[k].value = u0[k] || ""; } });
              if (f.elements.pagina_origem) { f.elements.pagina_origem.value = document.referrer ? new URL(document.referrer).pathname : "direto"; }
              evento("generate_lead", { origem: "formulario" });
            } else {
              /* O recebedor manda o texto já pronto para a tela, em
                 português e acentuado. Mostra-se o dele, não um genérico. */
              status.textContent = (res && res.erro) ? res.erro : "Confira os campos e tente de novo.";
            }
          })
          .catch(function () {
            status.textContent = "Não conseguimos enviar agora. Escreva para " + C.email + " e responderemos por lá.";
          })
          .then(function () { if (botao) { botao.disabled = false; } });
      } else {
        var assunto = "Contato pelo site — " + (d.atividade || "atividade não informada");
        var texto = ["Nome: " + d.nome, "E-mail: " + d.email, d.telefone ? "Telefone: " + d.telefone : "", "Atividade: " + (d.atividade || ""), "Quero: " + (d.objetivo || ""), "", d.mensagem].filter(function (x, i) { return x !== "" || i > 4; }).join("\n");
        location.href = "mailto:" + C.email + "?subject=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(texto);
        status.textContent = "Abrimos o seu aplicativo de e-mail com a mensagem pronta. É só enviar.";
        evento("generate_lead", { origem: "mailto" });
      }
    });
  }

  if (temRastreio) banner();
})();
