// goafk.dev — small, dependency-free enhancements. The page works without it.
(function () {
  "use strict";
  var root = document.documentElement;
  // ?static shows the page fully revealed with no motion (screenshots, QA).
  var staticMode = /[?&]static\b/.test(location.search);
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || staticMode;

  // Analytics (Umami): events queue until the script has loaded; it only reports on goafk.dev.
  var pending = [];
  var copyingByButton = false;
  function track(name, data) {
    if (window.umami && typeof window.umami.track === "function") {
      try {
        window.umami.track(name, data);
      } catch (e) {}
    } else if (pending.length < 50) pending.push([name, data]);
  }
  (function flush(tries) {
    if (window.umami && typeof window.umami.track === "function") {
      var q = pending;
      pending = [];
      q.forEach(function (e) {
        track(e[0], e[1]);
      });
    } else if (tries < 40) setTimeout(flush, 500, tries + 1);
  })(0);
  // Where on the page something happened: header, footer, or the enclosing section.
  function region(el) {
    if (el.closest("header")) return "header";
    if (el.closest("footer")) return "footer";
    var sec = el.closest("section");
    if (!sec) return "page";
    return sec.id || (sec.classList.contains("hero") ? "hero" : "page");
  }

  // Notifications drop in from above and leave with a small lift (softer than the entry).
  function notifIn(n) {
    clearTimeout(n._t);
    n.classList.remove("is-out");
    n.classList.add("is-in");
  }
  function notifOut(n) {
    if (!n.classList.contains("is-in")) return;
    n.classList.add("is-out");
    n.classList.remove("is-in");
    clearTimeout(n._t);
    n._t = setTimeout(function () {
      n.style.transition = "none"; // reset to the drop-in start without animating back
      n.classList.remove("is-out");
      void n.offsetWidth;
      n.style.transition = "";
    }, 200);
  }

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
    initThemeCycle();
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
        track("theme-change", { theme: next });
        // One quick cross-fade of the whole page where View Transitions exist.
        if (document.startViewTransition && !reduce)
          document.startViewTransition(function () {
            applyPref(next);
          });
        else applyPref(next);
      });

    // Copy buttons.
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var el = document.querySelector(btn.getAttribute("data-copy"));
        var text = el ? el.textContent.trim() : "";
        var done = function () {
          var where = btn.getAttribute("data-copy") === "#install-cmd" ? "hero" : region(btn);
          track("install-copy", { location: where, page: location.pathname });
          btn.classList.add("is-copied");
          clearTimeout(btn._t);
          btn._t = setTimeout(function () {
            btn.classList.remove("is-copied");
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
        else fallback();
        function fallback() {
          copyingByButton = true; // not a "manual" copy
          setTimeout(function () {
            copyingByButton = false;
          }, 50);
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
    if (staticMode || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-in");
      });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          // Things that arrive together stagger in reading order (55ms apart, capped), unless a
          // delay is set by hand.
          var shown = entries
            .filter(function (e) {
              return e.isIntersecting;
            })
            .map(function (e) {
              return e.target;
            })
            .sort(function (a, b) {
              return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
            });
          shown.forEach(function (el, i) {
            if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", Math.min(i * 55, 330) + "ms");
            el.classList.add("is-in");
            io.unobserve(el);
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
    syncDemo();
    notifyForm();
    analytics();
  });

  // Live sync demo: one script drives the editor and the phone together; visitors can take over.
  function syncDemo() {
    var root = document.querySelector("[data-sync]");
    if (!root) return;
    var lists = { ed: root.querySelector('[data-msgs="ed"]'), ph: root.querySelector('[data-msgs="ph"]') };
    var dot = root.querySelector("[data-wire]");
    var notif = root.querySelector("[data-sync-notif]");
    var caption = document.querySelector("[data-sync-caption]");
    var typed = root.querySelector("[data-typed]");
    var input = root.querySelector("[data-input]");
    var send = root.querySelector("[data-send]");
    var edStatus = root.querySelector('[data-st="ed"]');
    var modelBtns = root.querySelectorAll("[data-model]");
    var MODELS = ["Opus 5.5", "Sonnet 5.5", "Haiku 4.5"];
    var model = 0;
    var gen = 0; // bumps to cancel the running script
    var visible = false;
    var pendingAllow = null; // resolver while a permission is waiting
    var idleTimer;

    var sleep = function (ms, g) {
      return new Promise(function (res, rej) {
        var left = reduce ? 0 : ms;
        var step = function () {
          if (g !== gen) return rej("cancel");
          if (!visible) return setTimeout(step, 200); // pause off-screen
          if (left <= 0) return res();
          var d = Math.min(left, 100);
          left -= d;
          setTimeout(step, d);
        };
        step();
      });
    };
    var say = function (t) {
      if (caption) caption.textContent = t;
    };
    var trim = function (list) {
      while (list.children.length > 7) list.removeChild(list.firstChild);
    };
    // Same message on both sides; returns [mac node, phone node].
    var add = function (cls, html) {
      return ["ed", "ph"].map(function (k) {
        var n = document.createElement("div");
        n.className = "m " + cls;
        n.innerHTML = html;
        lists[k].appendChild(n);
        trim(lists[k]);
        return n;
      });
    };
    var stream = function (text, g) {
      var nodes = add("m-agent", "");
      var words = text.split(" ");
      var i = 0;
      return new Promise(function (res, rej) {
        var tick = function () {
          if (g !== gen) return rej("cancel");
          i++;
          nodes.forEach(function (n) {
            n.textContent = words.slice(0, i).join(" ");
          });
          if (i < words.length) setTimeout(tick, reduce ? 0 : 55);
          else res(nodes);
        };
        tick();
      });
    };
    // The brand dot carries a change: "mac" = phone → Mac, "phone" = Mac → phone.
    var travel = function (to) {
      if (reduce || !dot.animate) return Promise.resolve();
      var wide = window.matchMedia("(min-width: 900px)").matches;
      var r = dot.parentNode.getBoundingClientRect();
      var span = (wide ? r.width : r.height) / 2;
      var from = to === "mac" ? span : -span;
      var prop = wide ? "translateX" : "translateY";
      var a = dot.animate(
        [
          { transform: prop + "(" + from + "px)", opacity: 0 },
          { opacity: 1, offset: 0.2 },
          { opacity: 1, offset: 0.8 },
          { transform: prop + "(" + -from + "px)", opacity: 0 },
        ],
        { duration: 520, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
      return a.finished.catch(function () {});
    };
    var status = function (s) {
      edStatus.className = "st " + (s === "run" ? "st-run" : s === "wait" ? "st-wait" : "st-done");
    };
    var setModel = function (i, from) {
      model = i % MODELS.length;
      modelBtns.forEach(function (b) {
        b.firstChild.nodeValue = MODELS[model] + " ";
        var other = from === "ph" ? b.closest(".win") : b.closest(".phone");
        if (other) {
          b.classList.add("is-flash");
          setTimeout(function () {
            b.classList.remove("is-flash");
          }, 700);
        }
      });
    };
    var perm = function () {
      var html =
        '<span class="q">Permission needed</span><span class="cmdline">npm test -- theme</span>' +
        '<span class="btns"><button type="button" class="pbtn is-primary" data-act="allow">Allow</button>' +
        '<button type="button" class="pbtn" data-act="always">Always allow</button>' +
        '<button type="button" class="pbtn" data-act="reject">Reject</button></span>';
      return add("m-perm", html);
    };
    var tool = function (t, done) {
      return add("m-tool" + (done ? " is-done" : ""), '<span class="t">' + t + '</span><span class="r"></span><span class="s"></span>');
    };

    var reset = function () {
      lists.ed.innerHTML = "";
      lists.ph.innerHTML = "";
      typed.textContent = "";
      send.classList.remove("is-ready");
      notifOut(notif);
      add("m-user", "Add a dark mode toggle to settings. Follow the system by default.");
      add("m-agent", "Added an Appearance row with System, Light and Dark.");
      tool("Edit src/theme/ThemeProvider.tsx", true);
      status("run");
    };

    var typeInto = function (text, g) {
      input.classList.add("is-typing");
      var i = 0;
      return new Promise(function (res, rej) {
        var tick = function () {
          if (g !== gen) return rej("cancel");
          i++;
          typed.textContent = text.slice(0, i);
          if (i < text.length) setTimeout(tick, reduce ? 0 : 38);
          else {
            input.classList.remove("is-typing");
            send.classList.add("is-ready");
            res();
          }
        };
        tick();
      });
    };
    var sendFromPhone = function (text, g) {
      typed.textContent = "";
      send.classList.remove("is-ready");
      return travel("mac").then(function () {
        if (g !== gen) throw "cancel";
        add("m-user", text);
      });
    };

    async function script() {
      var g = ++gen;
      try {
        reset();
        say("Live: the agent is working on your Mac, and on your phone.");
        await sleep(1400, g);
        await travel("phone");
        await stream("Now I'll run the theme tests to make sure nothing broke.", g);
        await sleep(700, g);
        var t = tool("npm test -- theme", false);
        var p = perm();
        status("wait");
        notifIn(notif);
        say("It needs permission. Your phone gets a notification.");
        var allowBtn = p[1].querySelector('[data-act="allow"]');
        allowBtn.classList.add("is-hint");
        // Wait for a tap, or answer by itself after a few seconds.
        var choice = await new Promise(function (res) {
          pendingAllow = res;
          sleep(4800, g).then(function () {
            res({ act: "allow", from: "ph", auto: true });
          }, function () {});
        });
        pendingAllow = null;
        if (g !== gen) return;
        allowBtn.classList.remove("is-hint");
        var btn = p[choice.from === "ed" ? 0 : 1].querySelector('[data-act="' + choice.act + '"]');
        if (btn) {
          btn.classList.add("is-pressed");
          await sleep(160, g);
        }
        notifOut(notif);
        say(choice.from === "ed" ? "Answered on the Mac. The phone updates too." : "Answered on the phone. Zed carries on.");
        await travel(choice.from === "ed" ? "phone" : "mac");
        var verdict = choice.act === "reject" ? "Rejected" : choice.act === "always" ? "Always allowed" : "Allowed";
        p.forEach(function (n) {
          n.classList.add("is-resolved");
          n.insertAdjacentHTML("beforeend", '<span class="verdict">' + verdict + (choice.from === "ed" ? " on the Mac" : " from the phone") + "</span>");
        });
        status("run");
        if (choice.act === "reject") {
          t.forEach(function (n) {
            n.classList.add("is-done");
            n.querySelector(".r").textContent = "skipped";
          });
          await stream("Okay, I won't run them. Anything else?", g);
        } else {
          await sleep(900, g);
          t.forEach(function (n) {
            n.classList.add("is-done");
            n.querySelector(".r").textContent = "24 passed";
          });
          await stream("All 24 tests pass. The choice is saved with your settings, so it survives restarts.", g);
        }
        await sleep(1200, g);
        say("Reply from anywhere. It shows up in Zed as your message.");
        await typeInto("Also add a high-contrast option", g);
        await sleep(450, g);
        await sendFromPhone("Also add a high-contrast option", g);
        await sleep(500, g);
        await travel("phone");
        await stream("On it: adding a high-contrast palette next to Dark.", g);
        await sleep(1100, g);
        say("Switch the model on either side. The other follows.");
        modelBtns[1].classList.add("is-flash");
        await sleep(300, g);
        await travel("mac");
        setModel(model + 1, "ph");
        await sleep(2600, g);
        status("done");
        say("Done. Step away. Keep them moving.");
        await sleep(3200, g);
        script();
      } catch (e) {
        /* cancelled */
      }
    }

    // Visitor actions take over; autoplay resumes after a quiet moment.
    var takeOver = function () {
      gen++;
      clearTimeout(idleTimer);
      if (!reduce) idleTimer = setTimeout(script, 8000);
    };
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b || !root.contains(b)) return;
      var from = b.closest(".phone") ? "ph" : "ed";
      var side = from === "ph" ? "phone" : "mac";
      if (b.dataset.act) {
        if (pendingAllow) {
          track("demo-allow", { action: b.dataset.act, side: side });
          pendingAllow({ act: b.dataset.act, from: from });
        }
        return;
      }
      if (b.hasAttribute("data-model")) {
        track("demo-model", { side: side });
        takeOver();
        var g = gen;
        travel(from === "ph" ? "mac" : "phone").then(function () {
          if (g === gen) setModel(model + 1, from);
        });
        say(from === "ph" ? "Changed on the phone. Zed's dropdown follows." : "Changed on the Mac. The phone follows.");
        return;
      }
      if (b.dataset.quick) {
        track("demo-quick-reply", { reply: b.dataset.quick });
        takeOver();
        var g2 = gen;
        var text = b.dataset.quick;
        b.classList.add("is-pressed");
        setTimeout(function () {
          b.classList.remove("is-pressed");
        }, 160);
        notifOut(notif);
        say("Sent from the phone. It appears in Zed as your message.");
        sendFromPhone(text, g2)
          .then(function () {
            return travel("phone");
          })
          .then(function () {
            status("run");
            return stream(text === "Continue" ? "Continuing with the high-contrast palette." : "Running the tests: 24 passed.", g2);
          })
          .catch(function () {});
      }
    });

    if ("IntersectionObserver" in window) {
      var started = false;
      new IntersectionObserver(
        function (en) {
          visible = en[0].isIntersecting;
          if (visible && !started) {
            started = true;
            if (reduce) {
              visible = true;
              reset();
              say("Tap the model or a quick reply on the phone to see it sync.");
            } else script();
          }
        },
        { threshold: 0.25 },
      ).observe(root);
    } else {
      visible = true;
      reset();
    }
  }

  // "Notify me": POST /api/notify (a Cloudflare Pages Function).
  function notifyForm() {
    var form = document.querySelector("[data-notify]");
    if (!form) return;
    var status = form.querySelector("[data-notify-status]");
    var btn = form.querySelector('button[type="submit"]');
    var set = function (text, ok) {
      status.textContent = text;
      status.classList.toggle("is-ok", !!ok);
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        track("notify-submit", { result: "invalid-client" });
        set("That email doesn't look right.");
        form.email.focus();
        return;
      }
      var platforms = [].slice
        .call(form.querySelectorAll('input[name="platforms"]:checked'))
        .map(function (i) {
          return i.value;
        });
      btn.classList.add("is-loading");
      set("");
      fetch("/api/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email, platforms: platforms, company: form.company.value }),
      })
        .then(function (r) {
          return r.json().catch(function () {
            return {};
          }).then(function (j) {
            return { status: r.status, body: j };
          });
        })
        .then(function (r) {
          track("notify-submit", { result: r.status === 200 ? "ok" : r.body.error || "error", platforms: platforms.join("+") || "none" });
          if (r.status === 200) {
            set("You're on the list. One email when it ships.", true);
            form.email.value = "";
          } else if (r.body.error === "email") set("That email doesn't look right.");
          else if (r.body.error === "rate") set("Too many tries. Give it an hour.");
          else if (r.body.error === "not_configured") set("Sign-ups open very soon. Check back in a bit.");
          else set("Something went wrong. Please try again.");
        })
        .catch(function () {
          track("notify-submit", { result: "network" });
          set("Couldn't reach the server. Please try again.");
        })
        .then(function () {
          btn.classList.remove("is-loading");
        });
    });
  }

  // Funnel + intent events (names show as-is in the Umami dashboard).
  function analytics() {
    // Links: classify by destination; record where on the page they were clicked.
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[href]");
      if (!a) return;
      var where = region(a);
      if (a.hasAttribute("data-store")) return track("store-click", { store: a.getAttribute("data-store"), location: where });
      var url;
      try {
        url = new URL(a.getAttribute("href"), location.href);
      } catch (err) {
        return;
      }
      if (url.host === "github.com") return track("github-click", { location: where });
      if (url.host !== location.host) return track("outbound", { host: url.host, location: where });
      if (url.pathname === "/install.sh") return track("installsh-view", { location: where });
      if (url.pathname.indexOf("/docs") === 0 && location.pathname.indexOf("/docs") !== 0)
        return track("docs-click", { section: url.hash.slice(1) || "top", location: where });
      if (url.hash && (url.pathname === location.pathname || url.pathname === "/")) return track("nav-click", { target: url.hash.slice(1), location: where });
    });

    // Someone selected and copied the install command by hand (not via the copy button).
    document.addEventListener("copy", function () {
      var sel = String(window.getSelection ? window.getSelection() : "");
      if (!copyingByButton && sel.indexOf("goafk.dev/install.sh") > -1) track("install-manual-copy", { page: location.pathname });
    });

    // How far people get: each key section, once, when 35% of it is on screen.
    if ("IntersectionObserver" in window) {
      var seen = {};
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            var id = en.target.id;
            // Counts once 35% of the section is visible, or it fills half the screen (tall sections).
            var enough = en.intersectionRatio >= 0.35 || en.intersectionRect.height >= window.innerHeight * 0.5;
            if (en.isIntersecting && enough && !seen[id]) {
              seen[id] = true;
              track("section-view", { section: id });
              io.unobserve(en.target);
            }
          });
        },
        { threshold: [0, 0.1, 0.2, 0.35, 0.5] },
      );
      ["sync", "features", "how", "privacy", "install", "notify", "faq"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }

    // Which questions people actually have.
    document.querySelectorAll(".faq details").forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (d.open) track("faq-open", { question: d.querySelector("summary").textContent.trim().slice(0, 60) });
      });
    });

    // Broken links: which missing paths people hit.
    if (document.querySelector(".notfound")) {
      var ref = "direct";
      try {
        if (document.referrer) ref = new URL(document.referrer).host;
      } catch (err) {}
      track("404", { path: location.pathname.slice(0, 120), referrer: ref });
    }
  }

  // Hero: the agent works → asks for permission (notification) → you allow → it finishes.
  // While the permission screen shows, "Allow" is a real button.
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
    var hotspot = phone.querySelector("[data-hotspot]");
    var hint = document.querySelector("[data-hero-hint]");
    var show = function (name) {
      Object.keys(scenes).forEach(function (k) {
        scenes[k].classList.toggle("is-hidden", k !== name);
      });
      var tappable = name === "permission";
      hotspot.classList.toggle("is-on", tappable);
      hotspot.tabIndex = tappable ? 0 : -1;
      if (hint) hint.classList.toggle("is-on", tappable);
    };
    var note = function (t, b) {
      title.textContent = t;
      body.textContent = b;
      notifIn(notif);
    };
    var hide = function () {
      notifOut(notif);
    };
    var ALLOWED = 4; // index of the step that shows the finished thread
    var steps = [
      [2600, function () { note("pocket-ledger · Migrate payments", "Permission needed: npm test -- billing"); }],
      [1700, function () { show("permission"); }],
      [2400, function () { hide(); }],
      [2600, function () { note("pocket-ledger · Allowed", "The agent carries on in Zed."); }],
      [1200, function () { show("done"); }],
      [2400, function () { note("aurora-ui · Fix flaky checkout test", "Ran it 50× locally: 50 passed."); }],
      [2600, function () { hide(); }],
      [2600, function () { show("live"); }],
    ];
    var i = 0;
    var visible = true;
    var timer;
    var tick = function () {
      if (!visible) return;
      steps[i][1]();
      i = (i + 1) % steps.length;
      timer = setTimeout(tick, steps[i][0]);
    };
    hotspot.addEventListener("click", function () {
      track("hero-allow");
      clearTimeout(timer);
      hotspot.classList.add("is-pressed");
      setTimeout(function () {
        hotspot.classList.remove("is-pressed");
        note("pocket-ledger · Allowed from your phone", "The agent carries on in Zed.");
        show("done");
        i = ALLOWED + 1;
        timer = setTimeout(tick, 2600);
      }, 140);
    });
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

  /* Themes section: crossfade the phone through a few themes while it's on screen. */
  function initThemeCycle() {
    var phone = document.querySelector("[data-theme-cycle]");
    if (!phone) return;
    var pics = phone.querySelectorAll("picture");
    var label = document.querySelector("[data-theme-name]");
    var i = 0;
    var timer = null;
    function show(n) {
      pics[i].classList.remove("is-on");
      i = n % pics.length;
      var p = pics[i];
      p.classList.add("is-on");
      phone.style.setProperty("--sb-bg", p.getAttribute("data-sb"));
      phone.style.setProperty("--sb-fg", p.getAttribute("data-sbfg"));
      if (label) label.textContent = p.getAttribute("data-name");
    }
    // Reduced motion: no autoplay; tapping the phone steps through themes instead.
    phone.addEventListener("click", function () {
      show(i + 1);
    });
    if (reduce || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !timer) {
          timer = setInterval(function () {
            show(i + 1);
          }, 2200);
        } else if (!e.isIntersecting && timer) {
          clearInterval(timer);
          timer = null;
        }
      });
    }, { threshold: 0.4 }).observe(phone);
  }
})();
