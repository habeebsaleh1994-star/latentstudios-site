/* Plans as data. A plan is a list of what is allowed; every control in every room asks here.
   Names, numbers and the choice of what is free are placeholders until the tiers are decided. */
(function () {
  var PLANS = {
    free: {
      name: "Free", photographs: 20, video: false, domain: false,
      allow: {
        look: ["quiet", "gallery"], palette: ["silk", "bone"], type: ["silk", "press"], mount: ["bare", "line"], space: ["standard", "airy", "close"], motion: ["slow", "still"],
        mode: ["light", "dark", "system"], read: ["standard"], accentFromWork: false
      }
    },
    full: {
      name: "Full", photographs: 500, video: true, domain: true,
      allow: { look: "*", palette: "*", type: "*", mount: "*", space: "*", motion: "*", mode: "*", read: "*", accentFromWork: true }
    }
  };
  var KEY = "latent-plan-preview";
  var plan = "free";
  try { plan = localStorage.getItem(KEY) || "free"; } catch (e) {}
  if (!PLANS[plan]) plan = "free";

  window.LatentEntitlements = {
    PLANS: PLANS,
    get plan() { return plan; },
    set: function (p) { if (PLANS[p]) { plan = p; try { localStorage.setItem(KEY, p); } catch (e) {} } },
    allows: function (group, value) {
      var a = PLANS[plan].allow[group];
      if (a === "*" || a === true) return true;
      if (a === false || a == null) return false;
      return Array.isArray(a) ? a.indexOf(value) > -1 : !!a;
    },
    name: function () { return PLANS[plan].name; },
    limit: function (k) { return PLANS[plan][k]; }
  };
})();
