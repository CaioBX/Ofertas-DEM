/* Painel de oferta docente. Lê window.DADOS (gerado por scripts/gerar_dados.py). */
(function () {
  "use strict";

  // Ajuste aqui o nome que aparece acima do título (ex.: nome do departamento).
  var CONFIG = {
    sobretitulo: "UFC · Departamento de Engenharia Mecânica (DEM)",
    rodape: "Departamento de Engenharia Mecânica da UFC. Dados públicos de oferta acadêmica, a partir da planilha de turmas por curso, semestre e docente.",
    linhasPorPagina: 20,
    marcoPPC: "2024.1"
  };

  var D = window.DADOS;
  var A = D.alocacoes;
  var PERIODOS = D.periodos;
  var SVGNS = "http://www.w3.org/2000/svg";
  var fmt = new Intl.NumberFormat("pt-BR");
  var fmt1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

  var estado = {
    de: PERIODOS[0], ate: PERIODOS[PERIODOS.length - 1],
    semestre: "", curso: "", docente: "", disciplina: "", nivel: "", ppc: "", natureza: "",
    medida: "turmas", busca: "", ordem: { col: "periodo", dir: 1 }, pagina: 0
  };

  /* ---------- utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function s(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function limpar(no) { while (no.firstChild) no.removeChild(no.firstChild); }
  function unicos(arr) { return Array.from(new Set(arr)); }
  function soma(arr, f) { return arr.reduce(function (t, x) { return t + f(x); }, 0); }
  function cssVar(nome) { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); }
  function ticks(max, n) {
    if (max <= 0) return [0];
    var bruto = max / n, pot = Math.pow(10, Math.floor(Math.log10(bruto)));
    var passo = [1, 2, 2.5, 5, 10].map(function (m) { return m * pot; }).find(function (p) { return p >= bruto; });
    var out = [];
    for (var v = 0; v <= max + passo * 0.001; v += passo) out.push(v);
    if (out[out.length - 1] < max) out.push(out[out.length - 1] + passo);
    return out;
  }
  function compacto(v) { return v >= 1000 ? fmt1.format(v / 1000) + " mil" : fmt.format(v); }
  function idxPeriodo(p) { return PERIODOS.indexOf(p); }

  /* ---------- filtro ---------- */
  function filtrar(ignorar) {
    ignorar = ignorar || {};
    var i0 = idxPeriodo(estado.de), i1 = idxPeriodo(estado.ate);
    return A.filter(function (a) {
      var i = idxPeriodo(a.periodo);
      if (i < i0 || i > i1) return false;
      if (estado.semestre && String(a.semestre) !== estado.semestre) return false;
      if (estado.nivel && a.nivel !== estado.nivel) return false;
      if (!ignorar.disciplina && estado.disciplina && a.disciplina !== estado.disciplina) return false;
      if (!ignorar.ppc && estado.ppc && a.ppc !== estado.ppc) return false;
      if (!ignorar.natureza && estado.natureza && a.natureza !== estado.natureza) return false;
      if (!ignorar.curso && estado.curso && a.cursos.indexOf(estado.curso) < 0) return false;
      if (!ignorar.docente && estado.docente && a.docente !== estado.docente) return false;
      return true;
    });
  }
  function periodosAtivos() {
    return PERIODOS.slice(idxPeriodo(estado.de), idxPeriodo(estado.ate) + 1).filter(function (p) {
      return !estado.semestre || p.slice(-1) === estado.semestre;
    });
  }
  function filtrosPadrao() {
    estado.de = PERIODOS[0]; estado.ate = PERIODOS[PERIODOS.length - 1];
    estado.semestre = ""; estado.curso = ""; estado.docente = ""; estado.disciplina = "";
    estado.nivel = ""; estado.ppc = ""; estado.natureza = "";
  }
  function turmasDe(arr) { return unicos(arr.map(function (a) { return a.turma_id; })); }

  /* ---------- dica ---------- */
  var dica = $("dica");
  function mostrarDica(evt, titulo, linhas, alvo) {
    limpar(dica);
    dica.appendChild(el("strong", null, titulo));
    linhas.forEach(function (l) {
      var row = el("div", "linha");
      var esq = el("span");
      if (l.cor) { var k = el("i"); k.style.background = l.cor; esq.appendChild(k); }
      esq.appendChild(document.createTextNode(l.rotulo));
      row.appendChild(esq);
      row.appendChild(el("b", null, l.valor));
      dica.appendChild(row);
    });
    dica.hidden = false;
    var x, y;
    if (evt && evt.clientX != null && evt.type !== "focus") { x = evt.clientX; y = evt.clientY; }
    else { var r = alvo.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    var w = dica.offsetWidth, h = dica.offsetHeight;
    var left = Math.min(Math.max(8, x + 14), window.innerWidth - w - 8);
    var top = y - h - 12 < 8 ? y + 16 : y - h - 12;
    dica.style.left = left + "px";
    dica.style.top = top + "px";
  }
  function esconderDica() { dica.hidden = true; }
  function ligarDica(no, fn) {
    no.setAttribute("tabindex", "0");
    no.addEventListener("pointermove", function (e) { var d = fn(); mostrarDica(e, d[0], d[1], no); });
    no.addEventListener("focus", function (e) { var d = fn(); mostrarDica(e, d[0], d[1], no); });
    no.addEventListener("pointerleave", esconderDica);
    no.addEventListener("blur", esconderDica);
  }

  /* ---------- cabeçalho e filtros ---------- */
  function montarFiltros() {
    $("sobretitulo").textContent = CONFIG.sobretitulo;
    $("rodape-texto").textContent = CONFIG.rodape;
    $("c-fonte").textContent = D.fonte;
    $("c-periodos").textContent = PERIODOS[0] + " → " + PERIODOS[PERIODOS.length - 1];
    $("c-linhas").textContent = fmt.format(D.linhas_origem);
    $("c-data").textContent = D.gerado_em;

    PERIODOS.forEach(function (p) {
      $("f-de").appendChild(new Option(p, p));
      $("f-ate").appendChild(new Option(p, p));
    });
    D.cursos.forEach(function (c) { $("f-curso").appendChild(new Option(c, c)); });
    unicos(A.map(function (a) { return a.docente; })).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); })
      .forEach(function (d) { $("f-docente").appendChild(new Option(d, d)); });
    unicos(A.map(function (a) { return a.disciplina; })).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); })
      .forEach(function (d) { $("f-disciplina").appendChild(new Option(d, d)); });

    $("f-de").addEventListener("change", function () {
      estado.de = this.value;
      if (idxPeriodo(estado.ate) < idxPeriodo(estado.de)) estado.ate = estado.de;
      atualizar();
    });
    $("f-ate").addEventListener("change", function () {
      estado.ate = this.value;
      if (idxPeriodo(estado.de) > idxPeriodo(estado.ate)) estado.de = estado.ate;
      atualizar();
    });
    $("f-curso").addEventListener("change", function () { estado.curso = this.value; atualizar(); });
    $("f-docente").addEventListener("change", function () { estado.docente = this.value; atualizar(); });
    $("f-disciplina").addEventListener("change", function () { estado.disciplina = this.value; atualizar(); });
    segmento($("f-semestre"), function (v) { estado.semestre = v; atualizar(); });
    segmento($("f-nivel"), function (v) { estado.nivel = v; atualizar(); });
    segmento($("f-ppc"), function (v) { estado.ppc = v; atualizar(); });
    segmento($("f-natureza"), function (v) { estado.natureza = v; atualizar(); });
    segmento($("m-evolucao"), function (v) { estado.medida = v; desenharEvolucao(); });
    $("f-limpar").addEventListener("click", function () { filtrosPadrao(); atualizar(); });
    $("f-busca").addEventListener("input", function () { estado.busca = this.value; estado.pagina = 0; desenharTabela(); });
    $("p-ant").addEventListener("click", function () { estado.pagina--; desenharTabela(); });
    $("p-prox").addEventListener("click", function () { estado.pagina++; desenharTabela(); });
    $("b-csv").addEventListener("click", baixarCSV);
    Array.prototype.forEach.call(document.querySelectorAll("#tabela th"), function (th) {
      th.querySelector("button").addEventListener("click", function () {
        var c = th.getAttribute("data-c");
        estado.ordem = { col: c, dir: estado.ordem.col === c ? -estado.ordem.dir : 1 };
        desenharTabela();
      });
    });
  }
  function segmento(grupo, aoMudar) {
    grupo.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      aoMudar(b.getAttribute("data-v"));
      marcarSegmento(grupo, b.getAttribute("data-v"));
    });
  }
  function marcarSegmento(grupo, v) {
    Array.prototype.forEach.call(grupo.querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === v));
    });
  }
  function sincronizarControles() {
    $("f-de").value = estado.de;
    $("f-ate").value = estado.ate;
    $("f-curso").value = estado.curso;
    $("f-docente").value = estado.docente;
    $("f-disciplina").value = estado.disciplina;
    marcarSegmento($("f-semestre"), estado.semestre);
    marcarSegmento($("f-nivel"), estado.nivel);
    marcarSegmento($("f-ppc"), estado.ppc);
    marcarSegmento($("f-natureza"), estado.natureza);
    var padrao = estado.de === PERIODOS[0] && estado.ate === PERIODOS[PERIODOS.length - 1] &&
      !estado.semestre && !estado.curso && !estado.docente && !estado.disciplina &&
      !estado.nivel && !estado.ppc && !estado.natureza;
    $("f-limpar").disabled = padrao;
    var partes = [estado.de === estado.ate ? "Semestre " + estado.de : estado.de + " a " + estado.ate];
    if (estado.semestre) partes.push("só " + estado.semestre + "º semestres");
    partes.push(estado.curso ? "curso " + estado.curso : "todos os cursos");
    partes.push(estado.docente ? estado.docente : "todos os docentes");
    if (estado.disciplina) partes.push(estado.disciplina);
    if (estado.nivel) partes.push(estado.nivel === "Pós-graduação" ? "só mestrado" : "só graduação");
    if (estado.ppc) partes.push("PPC " + estado.ppc.toLowerCase());
    if (estado.natureza) partes.push(estado.natureza === "Obrigatória" ? "só obrigatórias" : "só optativas");
    var texto = "Mostrando " + partes.join(" · ");
    if (estado.ppc || estado.natureza) texto += ". PPC e natureza existem só para turmas de Engenharia Mecânica.";
    $("resumo-filtro").textContent = texto;
  }

  /* ---------- indicadores ---------- */
  function desenharIndicadores(f) {
    var nPer = periodosAtivos().length;
    var turmas = turmasDe(f).length;
    var ch = soma(f, function (a) { return a.ch; });
    var docentes = unicos(f.map(function (a) { return a.docente; })).length;
    var codigos = unicos(f.map(function (a) { return a.codigo; })).length;
    var cursos = unicos([].concat.apply([], f.map(function (a) { return a.cursos; })));

    $("k-turmas").textContent = fmt.format(turmas);
    $("k-turmas-nota").textContent = nPer > 1
      ? "Média de " + fmt1.format(turmas / nPer) + " por semestre, em " + nPer + " semestres"
      : "No semestre " + estado.de;
    var kch = $("k-ch"); limpar(kch);
    kch.appendChild(document.createTextNode(fmt.format(ch)));
    kch.appendChild(el("small", null, "h"));
    $("k-ch-nota").textContent = nPer > 1 ? "Média de " + fmt.format(Math.round(ch / nPer)) + " h por semestre" : "Soma das horas dos docentes";
    $("k-docentes").textContent = fmt.format(docentes);
    $("k-docentes-nota").textContent = docentes ? "Média de " + fmt.format(Math.round(ch / docentes / Math.max(1, nPer))) + " h por docente e semestre" : "";
    $("k-disciplinas").textContent = fmt.format(codigos);
    $("k-disciplinas-nota").textContent = "Contadas por código";
    $("k-cursos").textContent = fmt.format(cursos.length);
    var grad = cursos.filter(function (c) { return c !== "Mestrado"; }).length;
    $("k-cursos-nota").textContent = grad + (grad === 1 ? " graduação" : " graduações") + (cursos.indexOf("Mestrado") >= 0 ? " e o mestrado" : "");
  }

  /* ---------- evolução (colunas empilhadas) ---------- */
  function desenharEvolucao() {
    var f = filtrar();
    var pers = periodosAtivos();
    var medida = estado.medida;
    var series = [
      { nome: "Graduação", cor: "var(--serie-1)", corDica: cssVar("--serie-1") },
      { nome: "Pós-graduação", rotulo: "Mestrado", cor: "var(--serie-2)", corDica: cssVar("--serie-2") }
    ];
    var dados = pers.map(function (p) {
      var doP = f.filter(function (a) { return a.periodo === p; });
      var vals = series.map(function (sr) {
        var x = doP.filter(function (a) { return a.nivel === sr.nome; });
        return medida === "turmas" ? turmasDe(x).length : soma(x, function (a) { return a.ch; });
      });
      return { p: p, vals: vals, total: vals[0] + vals[1] };
    });
    var visiveis = series.filter(function (sr, i) { return dados.some(function (d) { return d.vals[i] > 0; }); });

    $("s-evolucao").textContent = medida === "turmas"
      ? "Turmas ofertadas em cada semestre, por nível."
      : "Soma das horas dos docentes em cada semestre, por nível.";
    var leg = $("l-evolucao"); limpar(leg);
    if (visiveis.length > 1) visiveis.forEach(function (sr) {
      var sp = el("span"), i = el("i"); i.style.background = sr.cor;
      sp.appendChild(i); sp.appendChild(document.createTextNode(sr.rotulo || sr.nome)); leg.appendChild(sp);
    });

    var box = $("g-evolucao"); limpar(box);
    var W = Math.max(300, box.clientWidth), H = 280;
    var m = { t: 24, r: 8, b: 30, l: medida === "ch" ? 48 : 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = Math.max.apply(null, dados.map(function (d) { return d.total; }).concat([1]));
    var tk = ticks(max, 4), ymax = tk[tk.length - 1];
    var y = function (v) { return m.t + ih - (v / ymax) * ih; };
    var banda = iw / dados.length;
    var bw = Math.min(40, banda * 0.6);
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, role: "presentation" });

    var gx = s("g", { "class": "eixo" });
    tk.forEach(function (t) {
      gx.appendChild(s("line", { "class": t === 0 ? "base" : "grade", x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
      var tx = s("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end" });
      tx.textContent = medida === "ch" ? compacto(t) : fmt.format(t);
      gx.appendChild(tx);
    });
    var passoRot = banda < 34 ? 2 : 1;
    dados.forEach(function (d, i) {
      if (i % passoRot) return;
      var tx = s("text", { x: m.l + banda * i + banda / 2, y: H - 8, "text-anchor": "middle" });
      tx.textContent = d.p;
      gx.appendChild(tx);
    });
    svg.appendChild(gx);

    var im = pers.indexOf(CONFIG.marcoPPC);
    if (im > 0 && (!estado.curso || estado.curso === "Mecânica")) {
      var ax = m.l + banda * im - 1;
      var an = s("g", { "class": "anotacao" });
      an.appendChild(s("line", { x1: ax, x2: ax, y1: m.t - 14, y2: m.t + ih }));
      var at = s("text", { x: ax + 6, y: m.t - 4 });
      at.textContent = "PPC novo de Mecânica";
      an.appendChild(at);
      svg.appendChild(an);
    }

    dados.forEach(function (d, i) {
      var cx = m.l + banda * i + banda / 2;
      var base = 0;
      var topo = d.vals.reduce(function (k, v, j) { return v > 0 ? j : k; }, -1);
      var g = s("g", { "class": "marca", "aria-label": d.p + ": " + fmt.format(d.total) });
      g.appendChild(s("rect", { x: m.l + banda * i, y: m.t, width: banda, height: ih, fill: "transparent" }));
      d.vals.forEach(function (v, j) {
        if (v <= 0) return;
        var y0 = y(base), y1 = y(base + v);
        var h = Math.max(1, y0 - y1 - (base > 0 ? 2 : 0));
        var yTop = y1;
        g.appendChild(caminhoColuna(cx - bw / 2, yTop, bw, h, j === topo ? 4 : 0, series[j].cor));
        base += v;
      });
      if (d.total > 0) {
        var lv = s("text", { "class": "rotulo-valor", x: cx, y: y(d.total) - 6, "text-anchor": "middle" });
        lv.textContent = medida === "ch" ? compacto(d.total) : fmt.format(d.total);
        if (banda >= 30) g.appendChild(lv);
      }
      ligarDica(g, function () {
        var linhas = series.map(function (sr, j) {
          return { cor: sr.corDica, rotulo: sr.rotulo || sr.nome, valor: fmt.format(d.vals[j]) + (medida === "ch" ? " h" : "") };
        });
        linhas.push({ rotulo: "Total", valor: fmt.format(d.total) + (medida === "ch" ? " h" : "") });
        return [d.p, linhas];
      });
      svg.appendChild(g);
    });
    box.appendChild(svg);
  }
  function caminhoColuna(x, y, w, h, r, cor) {
    r = Math.min(r, h, w / 2);
    var d = "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y +
      "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
    var p = s("path", { d: d });
    p.style.fill = cor;
    return p;
  }

  /* ---------- barras horizontais ---------- */
  function barras(box, itens, opcoes) {
    limpar(box);
    if (!itens.length) { box.appendChild(el("p", "vazio", "Nenhum dado para os filtros escolhidos.")); return; }
    var max = Math.max.apply(null, itens.map(function (i) { return i.valor; }));
    var lista = el("div", "barras");
    itens.forEach(function (it) {
      var linha = el(opcoes.clicavel ? "button" : "div", "barra");
      if (opcoes.clicavel) {
        linha.type = "button";
        linha.setAttribute("aria-pressed", String(it.ativo));
        linha.addEventListener("click", function () { opcoes.aoClicar(it); });
      }
      var nome = el("span", "barra-nome", it.nome); nome.title = it.nome;
      var trilho = el("span", "barra-trilho");
      var fill = el("span", "barra-preenchida");
      fill.style.width = "calc((100% - 72px) * " + (it.valor / max).toFixed(4) + ")";
      if (it.esmaecer) fill.style.opacity = "0.35";
      trilho.appendChild(fill);
      trilho.appendChild(el("span", "barra-valor", opcoes.formato(it.valor)));
      linha.appendChild(nome); linha.appendChild(trilho);
      if (opcoes.dica) {
        linha.addEventListener("pointermove", function (e) { var d = opcoes.dica(it); mostrarDica(e, d[0], d[1], linha); });
        linha.addEventListener("pointerleave", esconderDica);
      }
      lista.appendChild(linha);
    });
    box.appendChild(lista);
  }

  function desenharDocentes() {
    var f = filtrar({ docente: true });
    var nPer = periodosAtivos().length;
    var por = {};
    f.forEach(function (a) {
      var r = por[a.docente] || (por[a.docente] = { ch: 0, turmas: new Set(), pers: new Set() });
      r.ch += a.ch; r.turmas.add(a.turma_id); r.pers.add(a.periodo);
    });
    var itens = Object.keys(por).map(function (n) {
      return { nome: n, valor: por[n].ch, info: por[n], ativo: estado.docente === n, esmaecer: estado.docente && estado.docente !== n };
    }).sort(function (a, b) { return b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"); });
    barras($("g-docentes"), itens, {
      clicavel: true,
      formato: function (v) { return fmt.format(v) + " h"; },
      aoClicar: function (it) { estado.docente = estado.docente === it.nome ? "" : it.nome; atualizar(); },
      dica: function (it) {
        return [it.nome, [
          { rotulo: "Carga horária", valor: fmt.format(it.valor) + " h" },
          { rotulo: "Turmas", valor: fmt.format(it.info.turmas.size) },
          { rotulo: "Semestres com aula", valor: it.info.pers.size + " de " + nPer },
          { rotulo: "Média por semestre ativo", valor: fmt.format(Math.round(it.valor / it.info.pers.size)) + " h" }
        ]];
      }
    });
  }

  function desenharCursos() {
    var f = filtrar({ curso: true });
    var itens = D.cursos.map(function (c) {
      var x = f.filter(function (a) { return a.cursos.indexOf(c) >= 0; });
      return { nome: c, valor: turmasDe(x).length, ch: soma(x, function (a) { return a.ch; }), ativo: estado.curso === c, esmaecer: estado.curso && estado.curso !== c };
    }).filter(function (i) { return i.valor > 0; })
      .sort(function (a, b) { return b.valor - a.valor; });
    barras($("g-cursos"), itens, {
      clicavel: true,
      formato: function (v) { return fmt.format(v) + (v === 1 ? " turma" : " turmas"); },
      aoClicar: function (it) { estado.curso = estado.curso === it.nome ? "" : it.nome; atualizar(); },
      dica: function (it) { return [it.nome, [{ rotulo: "Turmas", valor: fmt.format(it.valor) }, { rotulo: "Carga horária docente", valor: fmt.format(it.ch) + " h" }]]; }
    });

    var fd = filtrar();
    var porDisc = {};
    fd.forEach(function (a) {
      var r = porDisc[a.disciplina] || (porDisc[a.disciplina] = { turmas: new Set(), codigos: new Set() });
      r.turmas.add(a.turma_id); r.codigos.add(a.codigo);
    });
    var top = Object.keys(porDisc).map(function (n) { return { nome: n, qt: porDisc[n].turmas.size, cod: Array.from(porDisc[n].codigos).sort() }; })
      .sort(function (a, b) { return b.qt - a.qt || a.nome.localeCompare(b.nome, "pt-BR"); }).slice(0, 8);
    var ol = $("g-disciplinas"); limpar(ol);
    if (!top.length) ol.appendChild(el("li", "vazio", "Nenhuma disciplina para os filtros escolhidos."));
    top.forEach(function (t) {
      var li = el("li");
      var b = el("button");
      b.type = "button";
      b.setAttribute("aria-pressed", String(estado.disciplina === t.nome));
      b.title = estado.disciplina === t.nome ? "Remover filtro" : "Filtrar por " + t.nome;
      var nome = el("span", null, t.nome);
      nome.appendChild(el("span", "cod", t.cod.length > 2 ? t.cod.slice(0, 2).join(", ") + "…" : t.cod.join(", ")));
      b.appendChild(nome);
      b.appendChild(el("span", "qt", fmt.format(t.qt) + (t.qt === 1 ? " turma" : " turmas")));
      b.addEventListener("click", function () { estado.disciplina = estado.disciplina === t.nome ? "" : t.nome; atualizar(); });
      li.appendChild(b);
      ol.appendChild(li);
    });
  }

  /* ---------- mapa de calor ---------- */
  function hexRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
  }
  function misturar(a, b, t) {
    var c = a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); });
    return { css: "rgb(" + c.join(",") + ")", lum: (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 };
  }
  function desenharMapa() {
    var f = filtrar({ docente: true });
    var pers = periodosAtivos();
    var c0 = hexRgb(cssVar("--mapa-0")), c1 = hexRgb(cssVar("--mapa-1"));
    var escuroTexto = "#0f1722", claroTexto = "#ffffff";
    var por = {};
    f.forEach(function (a) {
      var r = por[a.docente] || (por[a.docente] = {});
      r[a.periodo] = (r[a.periodo] || 0) + a.ch;
    });
    var nomes = Object.keys(por).sort(function (a, b) {
      var ta = soma(pers, function (p) { return por[a][p] || 0; }), tb = soma(pers, function (p) { return por[b][p] || 0; });
      return tb - ta || a.localeCompare(b, "pt-BR");
    });
    var max = 1;
    nomes.forEach(function (n) { pers.forEach(function (p) { max = Math.max(max, por[n][p] || 0); }); });

    var box = $("g-mapa"); limpar(box);
    box.style.gridTemplateColumns = "minmax(150px, 230px) repeat(" + pers.length + ", minmax(46px, 1fr)) 64px";
    box.style.minWidth = (230 + pers.length * 48 + 64) + "px";
    if (!nomes.length) { box.style.minWidth = "0"; box.appendChild(el("p", "vazio", "Nenhum dado para os filtros escolhidos.")); return; }
    box.appendChild(el("div", "mapa-cab nome", "Docente"));
    pers.forEach(function (p) { box.appendChild(el("div", "mapa-cab", p)); });
    box.appendChild(el("div", "mapa-cab", "Total"));
    nomes.forEach(function (n) {
      var b = el("button", "mapa-nome", n);
      b.type = "button"; b.title = "Filtrar por " + n;
      if (estado.docente === n) { b.style.fontWeight = "600"; b.style.color = "var(--destaque)"; }
      b.addEventListener("click", function () { estado.docente = estado.docente === n ? "" : n; atualizar(); });
      box.appendChild(b);
      var total = 0;
      pers.forEach(function (p) {
        var v = por[n][p] || 0; total += v;
        var c = el("div", "mapa-cel" + (v ? "" : " zero"));
        if (v) {
          var cor = misturar(c0, c1, Math.sqrt(v / max));
          c.style.background = cor.css;
          c.style.color = cor.lum > 0.5 ? escuroTexto : claroTexto;
          c.textContent = v;
        }
        if (estado.docente && estado.docente !== n) c.style.opacity = "0.4";
        ligarDica(c, function () { return [n, [{ rotulo: p, valor: fmt.format(v) + " h" }]]; });
        box.appendChild(c);
      });
      box.appendChild(el("div", "mapa-total", fmt.format(total) + " h"));
    });

    var esc = $("e-mapa"); limpar(esc);
    esc.appendChild(el("span", null, "0 h"));
    var faixa = el("span", "faixa");
    faixa.style.background = "linear-gradient(90deg, " + misturar(c0, c1, 0.08).css + ", " + misturar(c0, c1, 1).css + ")";
    esc.appendChild(faixa);
    esc.appendChild(el("span", null, fmt.format(max) + " h"));
  }

  /* ---------- PPC de Mecânica ---------- */
  function desenharPPC() {
    var box = $("g-ppc"), leg = $("l-ppc"), nat = $("g-natureza");
    limpar(box); limpar(leg); limpar(nat);
    if ((estado.curso && estado.curso !== "Mecânica") || estado.nivel === "Pós-graduação") {
      box.appendChild(el("p", "vazio", "Este quadro mostra só Engenharia Mecânica. Escolha Mecânica ou todos os cursos para vê-lo."));
      return;
    }
    var f = filtrar({ curso: true, ppc: true }).filter(function (a) { return a.cursos.indexOf("Mecânica") >= 0; });
    var pers = periodosAtivos();
    var apagar = function (nome) { return estado.ppc && estado.ppc !== nome; };
    var series = [
      { nome: "Antigo", rotulo: "PPC antigo", cor: "var(--neutro-serie)", corDica: cssVar("--neutro-serie") },
      { nome: "Novo", rotulo: "PPC novo", cor: "var(--serie-1)", corDica: cssVar("--serie-1") }
    ];
    series.forEach(function (sr) {
      var sp = el("span"), i = el("i"); i.style.background = sr.cor;
      sp.appendChild(i); sp.appendChild(document.createTextNode(sr.rotulo)); leg.appendChild(sp);
    });
    var dados = pers.map(function (p) {
      var x = f.filter(function (a) { return a.periodo === p; });
      var vals = series.map(function (sr) { return turmasDe(x.filter(function (a) { return a.ppc === sr.nome; })).length; });
      return { p: p, vals: vals, total: vals[0] + vals[1] };
    });

    var W = Math.max(300, box.clientWidth), H = 220;
    var m = { t: 18, r: 8, b: 30, l: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var tk = ticks(Math.max.apply(null, dados.map(function (d) { return d.total; }).concat([1])), 4), ymax = tk[tk.length - 1];
    var y = function (v) { return m.t + ih - (v / ymax) * ih; };
    var banda = iw / dados.length, bw = Math.min(40, banda * 0.6);
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, role: "presentation" });
    var gx = s("g", { "class": "eixo" });
    tk.forEach(function (t) {
      gx.appendChild(s("line", { "class": t === 0 ? "base" : "grade", x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }));
      var tx = s("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end" }); tx.textContent = fmt.format(t); gx.appendChild(tx);
    });
    var passoRot = banda < 34 ? 2 : 1;
    dados.forEach(function (d, i) {
      if (i % passoRot) return;
      var tx = s("text", { x: m.l + banda * i + banda / 2, y: H - 8, "text-anchor": "middle" }); tx.textContent = d.p; gx.appendChild(tx);
    });
    svg.appendChild(gx);
    dados.forEach(function (d, i) {
      var cx = m.l + banda * i + banda / 2, base = 0;
      var topo = d.vals.reduce(function (k, v, j) { return v > 0 ? j : k; }, -1);
      var g = s("g", { "class": "marca" });
      g.appendChild(s("rect", { x: m.l + banda * i, y: m.t, width: banda, height: ih, fill: "transparent" }));
      d.vals.forEach(function (v, j) {
        if (v <= 0) return;
        var y0 = y(base), y1 = y(base + v);
        var col = caminhoColuna(cx - bw / 2, y1, bw, Math.max(1, y0 - y1 - (base > 0 ? 2 : 0)), j === topo ? 4 : 0, series[j].cor);
        if (apagar(series[j].nome)) col.style.opacity = "0.3";
        g.appendChild(col);
        base += v;
      });
      if (d.total > 0 && banda >= 30) {
        var lv = s("text", { "class": "rotulo-valor", x: cx, y: y(d.total) - 6, "text-anchor": "middle" });
        lv.textContent = fmt.format(d.total); g.appendChild(lv);
      }
      ligarDica(g, function () {
        return [d.p + " · Mecânica", series.map(function (sr, j) { return { cor: sr.corDica, rotulo: sr.rotulo, valor: fmt.format(d.vals[j]) + " turmas" }; })];
      });
      svg.appendChild(g);
    });
    box.appendChild(svg);

    var fn = filtrar({ curso: true, natureza: true }).filter(function (a) { return a.cursos.indexOf("Mecânica") >= 0; });
    var ob = turmasDe(fn.filter(function (a) { return a.natureza === "Obrigatória"; })).length;
    var op = turmasDe(fn.filter(function (a) { return a.natureza === "Optativa"; })).length;
    if (ob + op > 0) {
      nat.appendChild(el("span", "natureza-titulo", "Natureza das turmas de Mecânica"));
      var meter = el("div", "meter");
      var a1 = el("span"); a1.style.flex = String(ob);
      var a2 = el("span"); a2.style.flex = String(op);
      if (estado.natureza === "Optativa") a1.style.opacity = "0.3";
      if (estado.natureza === "Obrigatória") a2.style.opacity = "0.3";
      meter.appendChild(a1); if (op) meter.appendChild(a2);
      nat.appendChild(meter);
      var lg = el("div", "meter-leg");
      [[ob, "Obrigatórias", "var(--serie-1)"], [op, "Optativas", "var(--serie-2)"]].forEach(function (x) {
        var sp = el("span"), i = el("i"); i.style.background = x[2];
        sp.appendChild(i);
        sp.appendChild(el("b", null, fmt.format(x[0]) + " "));
        sp.appendChild(document.createTextNode(x[1] + " (" + Math.round(100 * x[0] / (ob + op)) + "%)"));
        lg.appendChild(sp);
      });
      nat.appendChild(lg);
    }
  }

  /* ---------- tabela ---------- */
  function semAcento(t) { return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function linhasTabela() {
    var q = semAcento(estado.busca.trim());
    var f = filtrar();
    if (q) f = f.filter(function (a) { return semAcento(a.disciplina + " " + a.codigo + " " + a.docente + " " + a.cursos.join(" ")).indexOf(q) >= 0; });
    var c = estado.ordem.col, dir = estado.ordem.dir;
    return f.slice().sort(function (a, b) {
      var va = c === "cursos" ? a.cursos.join(", ") : a[c], vb = c === "cursos" ? b.cursos.join(", ") : b[c];
      var r = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
      if (r === 0) r = a.periodo.localeCompare(b.periodo) || a.disciplina.localeCompare(b.disciplina, "pt-BR");
      return r * dir;
    });
  }
  function desenharTabela() {
    var linhas = linhasTabela();
    var n = CONFIG.linhasPorPagina, paginas = Math.max(1, Math.ceil(linhas.length / n));
    estado.pagina = Math.min(Math.max(0, estado.pagina), paginas - 1);
    var corpo = document.querySelector("#tabela tbody"); limpar(corpo);
    Array.prototype.forEach.call(document.querySelectorAll("#tabela th"), function (th) {
      if (th.getAttribute("data-c") === estado.ordem.col) th.setAttribute("aria-sort", estado.ordem.dir > 0 ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    });
    if (!linhas.length) {
      var tr0 = el("tr"), td0 = el("td", "vazio", "Nenhuma turma encontrada com esses filtros.");
      td0.colSpan = 7; tr0.appendChild(td0); corpo.appendChild(tr0);
    }
    linhas.slice(estado.pagina * n, estado.pagina * n + n).forEach(function (a) {
      var tr = el("tr");
      tr.appendChild(el("td", "per", a.periodo));
      tr.appendChild(el("td", "cod", a.codigo));
      tr.appendChild(el("td", null, a.disciplina));
      tr.appendChild(el("td", null, a.turma));
      tr.appendChild(el("td", null, a.docente));
      var tdch = el("td", "num", String(a.ch));
      if (a.ch !== a.ch_turma) tdch.title = "Carga da turma: " + a.ch_turma + " h (dividida entre docentes)";
      tr.appendChild(tdch);
      var tdc = el("td");
      a.cursos.forEach(function (c) { tdc.appendChild(el("span", "chip", c)); });
      tr.appendChild(tdc);
      corpo.appendChild(tr);
    });
    var ini = linhas.length ? estado.pagina * n + 1 : 0, fim = Math.min(linhas.length, (estado.pagina + 1) * n);
    $("p-info").textContent = ini + "–" + fim + " de " + fmt.format(linhas.length) + " linhas";
    $("p-ant").disabled = estado.pagina === 0;
    $("p-prox").disabled = estado.pagina >= paginas - 1;
    $("s-tabela").textContent = "Uma linha por docente em cada turma. " + fmt.format(turmasDe(linhas).length) + " turmas nesta seleção.";
  }
  function baixarCSV() {
    var cab = ["Período", "Código", "Disciplina", "Turma", "Docente", "CH do docente (h)", "CH da turma (h)", "Nível", "Natureza", "PPC", "Cursos"];
    var esc = function (v) { v = String(v == null ? "" : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var txt = [cab.join(";")].concat(linhasTabela().map(function (a) {
      return [a.periodo, a.codigo, a.disciplina, a.turma, a.docente, a.ch, a.ch_turma, a.nivel, a.natureza, a.ppc, a.cursos.join(", ")].map(esc).join(";");
    })).join("\n");
    var blob = new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "turmas_" + estado.de + "_" + estado.ate + ".csv";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  /* ---------- notas ---------- */
  function montarNotas() {
    var o = D.ocorrencias;
    var metodo = [
      "Cada linha da tabela é um docente numa turma. Turmas com dois docentes viram duas linhas, cada uma com a carga indicada na planilha (" + (o.turma_com_dois_docentes || 0) + " casos).",
      "A mesma turma aparece na lista de cada curso que atende. Essas repetições (" + (o.repeticao_entre_cursos || 0) + ") são contadas uma vez só, e a turma guarda a lista de cursos.",
      "Carga horária docente é a soma das horas de cada docente. Turmas são contadas por semestre, código e número da turma.",
      "As " + (o.sem_turma || 0) + " linhas “Nenhuma turma encontrada” ficam fora das contagens.",
      "Nomes de docentes e disciplinas foram padronizados (maiúsculas, acentos, quebras de linha). Natureza e PPC só existem para Engenharia Mecânica na planilha; quando faltavam, vieram de outra linha com o mesmo código."
    ];
    var ul = $("n-metodo"); limpar(ul);
    metodo.forEach(function (t) { ul.appendChild(el("li", null, t)); });
    var ua = $("n-avisos"); limpar(ua);
    (D.avisos.length ? D.avisos : ["Nenhum ponto pendente."]).forEach(function (t) { ua.appendChild(el("li", null, t)); });
  }

  /* ---------- tema ---------- */
  function montarTema() {
    var raiz = document.documentElement;
    try { var salvo = localStorage.getItem("painel-tema"); if (salvo) raiz.setAttribute("data-theme", salvo); } catch (e) {}
    $("f-tema").addEventListener("click", function () {
      var atual = raiz.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var novo = atual === "dark" ? "light" : "dark";
      raiz.setAttribute("data-theme", novo);
      try { localStorage.setItem("painel-tema", novo); } catch (e) {}
      redesenharGraficos();
    });
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redesenharGraficos); } catch (e) {}
  }

  /* ---------- ciclo ---------- */
  function redesenharGraficos() { desenharEvolucao(); desenharMapa(); desenharPPC(); }
  function atualizar() {
    estado.pagina = 0;
    sincronizarControles();
    var f = filtrar();
    desenharIndicadores(f);
    desenharEvolucao();
    desenharDocentes();
    desenharCursos();
    desenharMapa();
    desenharPPC();
    desenharTabela();
  }

  montarTema();
  montarFiltros();
  montarNotas();
  atualizar();

  var largura = 0, espera;
  function aoRedimensionar() {
    clearTimeout(espera);
    espera = setTimeout(function () {
      var w = $("g-evolucao").clientWidth;
      if (w !== largura) { largura = w; desenharEvolucao(); desenharPPC(); }
    }, 80);
  }
  if (window.ResizeObserver) new ResizeObserver(aoRedimensionar).observe($("g-evolucao"));
  else window.addEventListener("resize", aoRedimensionar);
})();
