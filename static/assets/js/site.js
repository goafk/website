// goafk.dev — small, dependency-free enhancements. The page works without it.
(function () {
  "use strict";
  var root = document.documentElement;
  // ?static shows the page with no motion (screenshots, QA).
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || /[?&]static\b/.test(location.search);

  // Theme: system → light → dark → system. Stored per visitor; storage may be unavailable.
  function readPref() {
    try {
      return localStorage.getItem("afk-theme") || "system";
    } catch (e) {
      return "system";
    }
  }
  function applyPref(p) {
    if (p === "light" || p === "dark") {
      root.dataset.theme = p;
      root.dataset.themePref = p;
    } else {
      delete root.dataset.theme;
      root.dataset.themePref = "system";
    }
    var btn = document.querySelector(".theme-toggle");
    if (btn) btn.setAttribute("aria-label", "Theme: " + p + " (change)");
    var dark = p === "dark" || (p === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var meta = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < meta.length; i++) {
      if (p === "system") meta[i].setAttribute("content", meta[i].getAttribute("media").indexOf("dark") > -1 ? "#111315" : "#F7F7F5");
      else meta[i].setAttribute("content", dark ? "#111315" : "#F7F7F5");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyPref(readPref());
    var toggle = document.querySelector(".theme-toggle");
    if (toggle)
      toggle.addEventListener("click", function () {
        var order = ["system", "light", "dark"];
        var next = order[(order.indexOf(readPref()) + 1) % order.length];
        try {
          if (next === "system") localStorage.removeItem("afk-theme");
          else localStorage.setItem("afk-theme", next);
        } catch (e) {}
        applyPref(next);
      });

    // Copy buttons.
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var el = document.querySelector(btn.getAttribute("data-copy"));
        var text = el ? el.textContent.trim() : "";
        var done = function () {
          btn.classList.add("is-copied");
          clearTimeout(btn._t);
          btn._t = setTimeout(function () {
            btn.classList.remove("is-copied");
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
        else fallback();
        function fallback() {
          var range = document.createRange();
          range.selectNodeContents(el);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          try {
            document.execCommand("copy");
            done();
          } catch (e) {}
        }
      });
    });

    // Header border once scrolled.
    var header = document.querySelector(".header");
    var onScroll = function () {
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 4);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Reveal on scroll.
    var items = document.querySelectorAll(".reveal");
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-in");
      });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              e.target.classList.add("is-in");
              io.unobserve(e.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
      items.forEach(function (el) {
        io.observe(el);
      });
    }

    hero();
    terminal();
  });

  // Hero: the agent works → asks for permission (notification) → you allow → it finishes.
  function hero() {
    var phone = document.querySelector("[data-hero]");
    if (!phone || reduce) return;
    var scenes = {};
    phone.querySelectorAll("[data-scene]").forEach(function (s) {
      scenes[s.getAttribute("data-scene")] = s;
    });
    var notif = phone.querySelector("[data-notif]");
    var title = phone.querySelector("[data-notif-title]");
    var body = phone.querySelector("[data-notif-body]");
    var show = function (name) {
      Object.keys(scenes).forEach(function (k) {
        scenes[k].classList.toggle("is-hidden", k !== name);
      });
    };
    var note = function (t, b) {
      title.textContent = t;
      body.textContent = b;
      notif.classList.add("is-in");
    };
    var hide = function () {
      notif.classList.remove("is-in");
    };
    var steps = [
      [2600, function () { note("pocket-ledger · Migrate payments", "Permission needed: npm test -- billing"); }],
      [1700, function () { show("permission"); }],
      [2400, function () { hide(); }],
      [2200, function () { note("aurora-ui · Fix flaky checkout test", "Ran it 50× locally: 50 passed."); }],
      [1700, function () { show("done"); }],
      [2400, function () { hide(); }],
      [2600, function () { show("live"); }],
    ];
    var i = 0;
    var visible = true;
    var timer;
    var tick = function () {
      if (!visible) return;
      var s = steps[i];
      s[1]();
      i = (i + 1) % steps.length;
      timer = setTimeout(tick, steps[i][0]);
    };
    // Only animate while the hero is on screen.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {
        visible = e[0].isIntersecting;
        clearTimeout(timer);
        if (visible) timer = setTimeout(tick, steps[i][0]);
      }).observe(phone);
    } else timer = setTimeout(tick, steps[0][0]);
  }

  // Terminal: type the installer output once, when it scrolls into view.
  function terminal() {
    var pre = document.querySelector("[data-term]");
    if (!pre || reduce || !("IntersectionObserver" in window)) return;
    var html = pre.innerHTML;
    var lines = html.split("\n");
    pre.style.minHeight = pre.offsetHeight + "px";
    pre.innerHTML = '<span class="caret"></span>';
    var io = new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var n = 0;
        var step = function () {
          n++;
          pre.innerHTML = lines.slice(0, n).join("\n") + (n < lines.length ? '<span class="caret"></span>' : "");
          if (n < lines.length) setTimeout(step, n === 1 ? 700 : lines[n - 1].trim() === "" ? 140 : 210);
        };
        setTimeout(step, 400);
      },
      { threshold: 0.4 },
    );
    io.observe(pre);
  }
})();
