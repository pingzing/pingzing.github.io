/**
 * Vanilla WoW Talent Calculator — DOM-driven runtime.
 * All talent structure is baked into index.html by tools/build.ps1.
 * This file only manages state, rules, and toggles.
 */

(function () {
  "use strict";

  const CLASSES = [
    "druid", "hunter", "mage", "paladin", "priest",
    "rogue", "shaman", "warlock", "warrior",
  ];
  const POINT_CAP = 51;

  const state = {
    className: null,
    ranks: Object.create(null),
    cells: [],           // per-class meta list, DOM order
    cellsByName: {},     // per-class name -> meta
    trees: [],           // per-class tree names in DOM order
    treeSet: null,       // current class's <section class="tree-set"> element
    hoverCell: null,
    tooltipMeta: null,
  };

  const el = {
    body: document.body,
    trees: document.getElementById("trees"),
    pointsSpent: document.getElementById("pointsSpent"),
    pointsCap: document.getElementById("pointsCap"),
    requiredLevel: document.getElementById("requiredLevel"),
    copyLinkBtn: document.getElementById("copyLinkBtn"),
    tooltip: document.getElementById("tooltip"),
    classPicker: document.getElementById("classPicker"),
  };

  /* ---------- Class loading ---------- */

  function loadClass(className) {
    const set = document.querySelector(`.tree-set[data-class="${className}"]`);
    if (!set) {
      return false;
    }
    state.className = className;
    state.ranks = Object.create(null);
    state.treeSet = set;
    state.cells = [];
    state.cellsByName = Object.create(null);
    state.trees = [];

    for (const treeEl of set.querySelectorAll(".tree[data-tree]")) {
      state.trees.push(treeEl.dataset.tree);
    }

    for (const cellEl of set.querySelectorAll(".talent")) {
      const meta = {
        name: cellEl.dataset.name,
        tree: cellEl.dataset.tree,
        tier: parseInt(cellEl.dataset.tier, 10),
        maxRanks: parseInt(cellEl.dataset.maxRanks, 10),
        treeReq: parseInt(cellEl.dataset.treeReq, 10),
        prereqs: JSON.parse(cellEl.dataset.prereqs),
        cell: cellEl,
      };
      state.cells.push(meta);
      state.cellsByName[meta.name] = meta;
    }

    el.body.dataset.class = className;
    updateActiveClassButton();
    return true;
  }

  function updateActiveClassButton() {
    for (const btn of el.classPicker.querySelectorAll("button[data-class]")) {
      btn.classList.toggle("active", btn.dataset.class === state.className);
    }
  }

  /* ---------- Derived state ---------- */

  function pointsInTree(treeName) {
    let sum = 0;
    for (const c of state.cells) {
      if (c.tree === treeName) {
        sum += state.ranks[c.name] || 0;
      }
    }
    return sum;
  }

  function totalPoints() {
    let sum = 0;
    for (const name in state.ranks) {
      sum += state.ranks[name];
    }
    return sum;
  }

  /* ---------- Rules ---------- */

  function unmetSpendReason(meta) {
    const rank = state.ranks[meta.name] || 0;
    if (rank >= meta.maxRanks) {
      return "Already at maximum rank.";
    }
    if (totalPoints() >= POINT_CAP) {
      return `You have spent all ${POINT_CAP} points.`;
    }
    const treePts = pointsInTree(meta.tree);
    if (treePts < meta.treeReq) {
      return `Requires ${meta.treeReq} points in ${meta.tree} (currently ${treePts}).`;
    }
    for (const p of meta.prereqs) {
      const have = state.ranks[p.name] || 0;
      if (have < p.points) {
        return `Requires ${p.points} points in ${p.name} (currently ${have}).`;
      }
    }
    return null;
  }

  function canSpend(meta) {
    return unmetSpendReason(meta) === null;
  }

  // Returns null if refundable; else the name of the talent that would break.
  function refundBlocker(meta) {
    const rank = state.ranks[meta.name] || 0;
    if (rank <= 0) {
      return "__none__";
    }
    state.ranks[meta.name] = rank - 1;
    let blocker = null;
    for (const other of state.cells) {
      const otherRank = state.ranks[other.name] || 0;
      if (otherRank === 0) {
        continue;
      }
      if (other.treeReq > pointsInTree(other.tree)) {
        blocker = other.name;
        break;
      }
      for (const p of other.prereqs) {
        if ((state.ranks[p.name] || 0) < p.points) {
          blocker = other.name;
          break;
        }
      }
      if (blocker) {
        break;
      }
    }
    state.ranks[meta.name] = rank;
    return blocker;
  }

  function canRefund(meta) {
    return refundBlocker(meta) === null;
  }

  /* ---------- Refresh ---------- */

  function applyCellState(meta) {
    const rank = state.ranks[meta.name] || 0;
    const cell = meta.cell;
    cell.classList.remove("locked", "available", "active", "maxed");
    if (rank >= meta.maxRanks) {
      cell.classList.add("maxed");
    } else if (rank > 0) {
      cell.classList.add("active");
    } else if (canSpend(meta)) {
      cell.classList.add("available");
    } else {
      cell.classList.add("locked");
    }
    cell.querySelector(".rank-badge").textContent = `${rank}/${meta.maxRanks}`;
  }

  function refreshArrows() {
    if (!state.treeSet) {
      return;
    }
    for (const arrow of state.treeSet.querySelectorAll(".arrow[data-from]")) {
      const req = parseInt(arrow.dataset.reqPoints, 10);
      const satisfied = (state.ranks[arrow.dataset.from] || 0) >= req;
      arrow.classList.toggle("satisfied", satisfied);
    }
  }

  function updateTreePoints() {
    if (!state.treeSet) {
      return;
    }
    for (const span of state.treeSet.querySelectorAll("[data-tree-points]")) {
      span.textContent = pointsInTree(span.dataset.treePoints);
    }
  }

  function refreshCells() {
    for (const meta of state.cells) {
      applyCellState(meta);
    }
    updateTreePoints();
    el.pointsSpent.textContent = totalPoints();
    updateRequiredLevel();
    refreshArrows();
    if (state.tooltipMeta) {
      renderTooltip(state.tooltipMeta);
    }
    writeHash();
  }

  function updateRequiredLevel() {
    const n = totalPoints();
    el.requiredLevel.textContent = n === 0 ? "--" : String(9 + n);
  }

  /* ---------- Tooltip ---------- */

  function showTooltip(meta, ev) {
    state.tooltipMeta = meta;
    renderTooltip(meta);
    el.tooltip.hidden = false;
    positionTooltip(ev);
  }

  function renderTooltip(meta) {
    const rank = state.ranks[meta.name] || 0;
    const template = meta.cell.querySelector("template.tt");
    const clone = template.content.cloneNode(true);

    for (const r of clone.querySelectorAll(".tt-rank")) {
      const n = parseInt(r.dataset.rank, 10);
      if (rank > 0 && n === rank) {
        r.hidden = false;
        r.classList.add("current");
        r.querySelector(".tt-rank-label").textContent =
          `Rank ${rank}/${meta.maxRanks}`;
      } else if (rank < meta.maxRanks && n === rank + 1) {
        r.hidden = false;
        r.classList.add("next");
        r.querySelector(".tt-rank-label").textContent = `Next rank (${n})`;
      }
    }

    for (const r of clone.querySelectorAll(".tt-req")) {
      const need = parseInt(r.dataset.reqPoints, 10);
      let have = 0;
      if (r.dataset.reqTree) {
        have = pointsInTree(r.dataset.reqTree);
      } else if (r.dataset.reqTalent) {
        have = state.ranks[r.dataset.reqTalent] || 0;
      }
      r.classList.toggle("ok", have >= need);
      r.classList.toggle("bad", have < need);
    }

    if (rank > 0) {
      const blocker = refundBlocker(meta);
      if (blocker && blocker !== "__none__") {
        const div = document.createElement("div");
        div.className = "tt-block";
        div.textContent = `Can't refund: would invalidate ${blocker}.`;
        clone.appendChild(div);
      }
    } else if (!canSpend(meta)) {
      const reason = unmetSpendReason(meta);
      // Skip "Requires ..." reasons — the tt-reqs list already flags them in red.
      if (reason && !reason.startsWith("Requires ")) {
        const div = document.createElement("div");
        div.className = "tt-block";
        div.textContent = reason;
        clone.appendChild(div);
      }
    }

    el.tooltip.innerHTML = "";
    el.tooltip.appendChild(clone);
  }

  function positionTooltip(ev) {
    if (el.tooltip.hidden) {
      return;
    }
    const pad = 14;
    const rect = el.tooltip.getBoundingClientRect();
    let x = ev.clientX + pad;
    let y = ev.clientY + pad;
    if (x + rect.width > window.innerWidth - 4) {
      x = ev.clientX - rect.width - pad;
    }
    if (y + rect.height > window.innerHeight - 4) {
      y = ev.clientY - rect.height - pad;
    }
    el.tooltip.style.left = Math.max(4, x) + "px";
    el.tooltip.style.top = Math.max(4, y) + "px";
  }

  function hideTooltip() {
    el.tooltip.hidden = true;
    state.tooltipMeta = null;
    state.hoverCell = null;
  }

  /* ---------- Actions ---------- */

  function trySpend(meta) {
    if (!canSpend(meta)) {
      return;
    }
    state.ranks[meta.name] = (state.ranks[meta.name] || 0) + 1;
    refreshCells();
  }

  function tryRefund(meta) {
    if (!canRefund(meta)) {
      return;
    }
    state.ranks[meta.name] = (state.ranks[meta.name] || 0) - 1;
    if (state.ranks[meta.name] <= 0) {
      delete state.ranks[meta.name];
    }
    refreshCells();
  }

  function resetTree(treeName) {
    for (const c of state.cells) {
      if (c.tree === treeName) {
        delete state.ranks[c.name];
      }
    }
    refreshCells();
  }

  function resetClass() {
    state.ranks = Object.create(null);
    refreshCells();
  }

  function switchClass(className) {
    if (state.className === className) {
      return;
    }
    if (!loadClass(className)) {
      return;
    }
    refreshCells();
  }

  async function copyLink() {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      el.copyLinkBtn.textContent = "Copied!";
      setTimeout(() => (el.copyLinkBtn.textContent = "Copy Link"), 1200);
    } catch {
      prompt("Copy this URL:", url);
    }
  }

  function resetAll() {
    if (!state.className) {
      return;
    }
    resetClass();
  }

  /* ---------- URL hash ---------- */

  function writeHash() {
    if (!state.className) {
      if (location.hash) {
        history.replaceState(null, "", location.pathname + location.search);
      }
      return;
    }
    const parts = state.trees.map((treeName) => {
      let s = "";
      for (const c of state.cells) {
        if (c.tree === treeName) {
          s += String(state.ranks[c.name] || 0);
        }
      }
      return s.replace(/0+$/, "");
    });
    const hash = `#${state.className}:${parts.join("-")}`;
    if (location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  }

  function readHash() {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) {
      return false;
    }
    const [cls, spec] = raw.split(":");
    if (!cls || !CLASSES.includes(cls)) {
      return false;
    }
    if (!loadClass(cls)) {
      return false;
    }
    if (spec) {
      const treeDigits = spec.split("-");
      state.trees.forEach((treeName, i) => {
        const s = treeDigits[i] || "";
        let j = 0;
        for (const c of state.cells) {
          if (c.tree !== treeName) {
            continue;
          }
          const d = parseInt(s.charAt(j), 10);
          if (!isNaN(d) && d > 0) {
            state.ranks[c.name] = Math.min(d, c.maxRanks);
          }
          j++;
        }
      });
    }
    return true;
  }

  /* ---------- Init ---------- */

  function init() {
    el.pointsCap.textContent = String(POINT_CAP);

    el.trees.addEventListener("click", (ev) => {
      const cell = ev.target.closest(".talent");
      if (cell && cell.dataset.name in state.cellsByName) {
        ev.preventDefault();
        trySpend(state.cellsByName[cell.dataset.name]);
        return;
      }
      const reset = ev.target.closest(".reset-tree");
      if (reset) {
        resetTree(reset.dataset.tree);
      }
    });

    el.trees.addEventListener("contextmenu", (ev) => {
      const cell = ev.target.closest(".talent");
      if (cell && cell.dataset.name in state.cellsByName) {
        ev.preventDefault();
        tryRefund(state.cellsByName[cell.dataset.name]);
      }
    });

    el.trees.addEventListener("mouseover", (ev) => {
      const cell = ev.target.closest(".talent");
      if (!cell || cell === state.hoverCell) {
        return;
      }
      const meta = state.cellsByName[cell.dataset.name];
      if (!meta) {
        return;
      }
      state.hoverCell = cell;
      showTooltip(meta, ev);
    });

    el.trees.addEventListener("mouseout", (ev) => {
      const cell = ev.target.closest(".talent");
      if (!cell || cell !== state.hoverCell) {
        return;
      }
      if (cell.contains(ev.relatedTarget)) {
        return;
      }
      hideTooltip();
    });

    el.trees.addEventListener("mousemove", positionTooltip);

    window.addEventListener("hashchange", () => {
      if (readHash()) {
        refreshCells();
      }
    });

    if (readHash()) {
      refreshCells();
    }
  }

  window.TalentCalc = { switchClass, resetAll, copyLink };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
