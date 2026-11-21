// Worn Hoodie docs kit: the theme switch, the narrow-screen menu, heading anchors and the
// "On this page" list. Pages read fine without it: it only adds to them.
(function () {
  "use strict";
  var root = document.documentElement;
  var KEY = "worn-hoodie-docs-theme";

  function stored() {
    try { return localStorage.getItem(KEY) || "auto"; } catch (e) { return "auto"; }
  }
  function apply(choice) {
    if (choice === "light" || choice === "dark") root.setAttribute("data-theme", choice);
    else root.removeAttribute("data-theme");
  }
  // Before first paint (this script loads in <head>). With no stored choice, a data-theme
  // the page sets itself stays.
  if (stored() !== "auto") apply(stored());
  root.classList.add("js");

  function setUp() {
    // Theme switch: Auto (the OS), Light, Dark.
    var current = stored();
    document.querySelectorAll("[data-theme-choice]").forEach(function (b) {
      b.setAttribute("aria-checked", String(b.dataset.themeChoice === current));
      b.addEventListener("click", function () {
        var choice = b.dataset.themeChoice;
        try { localStorage.setItem(KEY, choice); } catch (e) { /* private window: this page only */ }
        apply(choice);
        document.querySelectorAll("[data-theme-choice]").forEach(function (o) {
          o.setAttribute("aria-checked", String(o === b));
        });
      });
    });

    // Menu button on narrow screens.
    var menu = document.querySelector(".menu-button");
    if (menu) menu.addEventListener("click", function () {
      var open = root.classList.toggle("nav-open");
      menu.setAttribute("aria-expanded", String(open));
    });

    // Every h2 and h3 gets an id and links to itself; the long pages get "On this page".
    var content = document.querySelector(".docs-content");
    var toc = document.querySelector(".docs-toc");
    if (!content) return;
    var used = {};
    var heads = content.querySelectorAll("h2, h3");
    heads.forEach(function (h) {
      if (!h.id) {
        var base = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
        var id = base, n = 2;
        while (used[id] || document.getElementById(id)) id = base + "-" + n++;
        h.id = id;
      }
      used[h.id] = true;
      if (!h.querySelector("a")) {
        var a = document.createElement("a");
        a.className = "heading-anchor";
        a.href = "#" + h.id;
        while (h.firstChild) a.appendChild(h.firstChild);
        h.appendChild(a);
      }
    });
    if (toc && heads.length >= 3) {
      var title = document.createElement("p");
      title.className = "group";
      title.textContent = "On this page";
      var list = document.createElement("ul");
      heads.forEach(function (h) {
        var li = document.createElement("li");
        if (h.tagName === "H3") li.className = "sub";
        var a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = h.textContent;
        li.appendChild(a);
        list.appendChild(li);
      });
      toc.appendChild(title);
      toc.appendChild(list);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setUp);
  else setUp();
})();
