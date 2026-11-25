/* Elpee - bloco de contato no fim da pagina de nicho e da pagina base. 24/11/2026.
   Sem dependencia nenhuma e sem endereco de fora: o unico pedido que este arquivo faz
   e ao recebedor do proprio escritorio, o mesmo que o formulario de contato ja usa
   (window.ELPEE_CFG.form_endpoint).

   A REGRA QUE MANDA NESTE ARQUIVO: a mensagem de recebido so aparece quando o
   recebedor responde que aceitou de verdade (ok === true). Em qualquer outro caso -
   recusa do recebedor, resposta que nao da para ler, rede fora do ar, endereco vazio -
   a pessoa ve que falhou. Aviso de recebido em envio recusado ja aconteceu nesta casa:
   a pessoa vai embora achando que pediu, e nao pediu.

   POR QUE NAO SE DECLARA mode e nem cabecalho: o /exec responde ao POST com
   redirecionamento para outro endereco do proprio Google, e a resposta final e que
   traz a liberacao de origem. Mandando o corpo como URLSearchParams (que vai como
   x-www-form-urlencoded) e SEM cabecalho escrito a mao, a chamada e simples, o
   navegador nao pede verificacao previa e a resposta pode ser LIDA. Declarar
   Content-Type application/json, acrescentar cabecalho proprio ou pedir mode no-cors
   quebra isso - e o no-cors devolve resposta lacrada, que foi o defeito de origem. */
(function () {
  "use strict";
  var C = window.ELPEE_CFG || {};
  var formularios = document.querySelectorAll("form[data-bloco-contato]");
  if (!formularios.length) { return; }

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function texto(f, chave) {
    return f.getAttribute("data-" + chave) || "";
  }

  Array.prototype.forEach.call(formularios, function (f) {
    var status = f.querySelector("[data-bc-status]");
    var botao = f.querySelector("button[type=submit]");
    var guarda = f.elements["empresa_site"];

    /* Os campos escondidos (origem e pagina) sao escritos pelo gerador. O reset()
       apaga tambem eles: sem guardar o valor de nascenca, um segundo envio feito
       da mesma pagina chegaria SEM a origem, e a coluna ficaria vazia sem erro. */
    var ocultos = {};
    Array.prototype.forEach.call(f.elements, function (c) {
      if (c.type === "hidden" && c.name) { ocultos[c.name] = c.value; }
    });
    function repor() {
      Object.keys(ocultos).forEach(function (k) {
        if (f.elements[k]) { f.elements[k].value = ocultos[k]; }
      });
    }

    function marcar(campo, ruim) {
      var caixa = campo.closest(".campo");
      if (caixa) { caixa.classList.toggle("invalido", ruim); }
    }

    function dizer(msg, bom) {
      status.className = "bc-status " + (bom ? "bc-bom" : "bc-ruim");
      status.textContent = msg;
    }

    function validar() {
      var ok = true;
      var regras = [
        ["nome", function (v) { return v.trim().length >= 2; }],
        ["email", function (v) { return EMAIL.test(v.trim()); }],
        ["assunto", function (v) { return v.trim().length > 0; }]
      ];
      regras.forEach(function (r) {
        var c = f.elements[r[0]];
        if (!c) { return; }
        var ruim = !r[1](c.value);
        marcar(c, ruim);
        if (ruim) { ok = false; }
      });
      var ac = f.elements["aceite"];
      if (ac) {
        marcar(ac, !ac.checked);
        if (!ac.checked) { ok = false; }
      }
      return ok;
    }

    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      /* Guarda: campo escondido que pessoa nenhuma ve e robo preenche. Preenchido,
         o envio e recusado em silencio - nenhum pedido sai e nada e gravado. Vazio,
         nao atrapalha envio nenhum. */
      if (guarda && guarda.value) {
        /* Armadilha de robô: preenchida, nada sai e nada se grava. Responde a mesma
           frase do envio aceito, como o recebedor faz, em vez de ficar muda. */
        dizer(texto(f, "msg-ok"), true);
        f.reset();
        repor();
        return;
      }
      status.className = "bc-status";
      status.textContent = "";
      if (!validar()) {
        dizer(texto(f, "msg-confira"), false);
        var primeiro = f.querySelector(".invalido input,.invalido select,.invalido textarea");
        if (primeiro) { primeiro.focus(); }
        return;
      }
      var d = {};
      Array.prototype.forEach.call(f.elements, function (c) {
        if (!c.name || c.name === "empresa_site") { return; }
        if (c.type === "checkbox" || c.type === "submit" || c.type === "button") { return; }
        d[c.name] = c.value;
      });
      d.aceite_politica = "sim";
      d.enviado_em = new Date().toISOString();

      if (!C.form_endpoint) {
        /* Sem recebedor publicado nao se finge recebimento. */
        dizer(texto(f, "msg-erro"), false);
        return;
      }
      if (botao) { botao.disabled = true; }
      status.className = "bc-status";
      status.textContent = texto(f, "msg-enviando");
      fetch(C.form_endpoint, { method: "POST", body: new URLSearchParams(d) })
        .then(function (resp) {
          if (!resp.ok) { throw new Error("resposta " + resp.status); }
          return resp.json();
        })
        .then(function (res) {
          if (res && res.ok === true) {
            dizer(texto(f, "msg-ok"), true);
            f.reset();
            repor();
            if (window.elpeeEvento) { window.elpeeEvento("generate_lead", { origem: d.origem || "" }); }
          } else {
            /* O recebedor manda o texto da recusa pronto para a tela, em portugues
               e acentuado. Mostra-se o dele; o generico so quando ele nao manda. */
            dizer((res && res.erro) ? res.erro : texto(f, "msg-erro"), false);
          }
        })
        .catch(function () {
          dizer(texto(f, "msg-erro"), false);
        })
        .then(function () {
          if (botao) { botao.disabled = false; }
        });
    });
  });
})();
