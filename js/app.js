(() => {
  const STORAGE_KEY = "archive.personal.v1";
  const PLACEHOLDER =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
        <rect fill="#e8e7e1" width="600" height="600"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
          font-family="Helvetica,Arial,sans-serif" font-size="28" fill="#888"
          letter-spacing="4">NO IMAGE</text>
      </svg>`
    );

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EXIT_MS = reduceMotion ? 0 : 240;
  const ENTER_STAGGER = reduceMotion ? 0 : 45;
  const OVERLAY_MS = reduceMotion ? 0 : 380;

  const state = {
    source: "sample",
    filter: "ALL",
    view: "grid",
    query: "",
    sample: Array.isArray(window.ARCHIVE_SAMPLE) ? window.ARCHIVE_SAMPLE : [],
    mine: loadMine(),
    activeId: null,
    rendering: false,
    swapping: false,
    closing: false,
  };

  const els = {
    grid: document.getElementById("archive-grid"),
    heroNum: document.getElementById("hero-num"),
    countLabel: document.getElementById("count-label"),
    searchPanel: document.getElementById("search-panel"),
    searchInput: document.getElementById("search-input"),
    toast: document.getElementById("toast"),
    specimen: document.getElementById("specimen-overlay"),
    info: document.getElementById("info-overlay"),
    add: document.getElementById("add-overlay"),
    form: document.getElementById("add-form"),
    startOwn: document.getElementById("start-own"),
    deleteItem: document.getElementById("delete-item"),
    specimenSwap: document.getElementById("specimen-swap"),
  };

  function loadMine() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveMine() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.mine));
  }

  function pad3(n) {
    return String(n).padStart(3, "0");
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function currentList() {
    return state.source === "mine" ? state.mine : state.sample;
  }

  function filteredList() {
    const q = state.query.trim().toLowerCase();
    return currentList().filter((item) => {
      const catOk = state.filter === "ALL" || item.category === state.filter;
      if (!catOk) return false;
      if (!q) return true;
      const hay = [
        item.name,
        item.colour,
        item.colourZh,
        item.notes,
        item.category,
        item.id,
        item.index,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function counts(list) {
    const c = { ALL: list.length, CLOTHING: 0, FOOTWEAR: 0, OBJECTS: 0 };
    list.forEach((item) => {
      if (c[item.category] != null) c[item.category] += 1;
    });
    return c;
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove("is-show");
    void els.toast.offsetWidth;
    els.toast.classList.add("is-show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove("is-show"), 2200);
  }

  async function openOverlay(name) {
    const map = { specimen: els.specimen, info: els.info, add: els.add };
    const target = map[name];
    for (const el of Object.values(map)) {
      if (el !== target && el.classList.contains("is-open")) {
        await closeOverlayEl(el);
      }
    }
    target.classList.remove("is-closing");
    void target.offsetWidth;
    target.classList.add("is-open");
    document.body.classList.add("is-locked");
  }

  async function closeOverlayEl(el) {
    if (!el.classList.contains("is-open") && !el.classList.contains("is-closing")) {
      return;
    }
    el.classList.add("is-closing");
    el.classList.remove("is-open");
    await wait(OVERLAY_MS);
    el.classList.remove("is-closing");
  }

  async function closeOverlays() {
    if (state.closing) return;
    state.closing = true;
    await Promise.all(
      [els.specimen, els.info, els.add].map((el) => closeOverlayEl(el))
    );
    document.body.classList.remove("is-locked");
    state.activeId = null;
    state.closing = false;
  }

  function featureCard(i) {
    const total = pad3(currentList().length || 0);
    return `
      <article class="card feature-card" style="--i:${i}" aria-hidden="false">
        <div class="feature-top">
          <span>Index / 001 &nbsp; A Specimen Collection</span>
          <span class="feature-arrow" aria-hidden="true">↘</span>
        </div>
        <h2 class="feature-title">Every-Day,<br />Archived.</h2>
        <div class="feature-bottom">
          <span>A Study In Everyday Objects.</span>
          <span>(${total})</span>
        </div>
      </article>
    `;
  }

  function itemCard(item, i) {
    const img = item.image || PLACEHOLDER;
    return `
      <button class="card" type="button" data-open-id="${item.id}" style="--i:${i}">
        <div class="card-head">
          <span>${item.index} / ${item.category}</span>
          <span aria-hidden="true">↗</span>
        </div>
        <div class="card-media">
          <img src="${img}" alt="${escapeAttr(item.name)}" loading="lazy" />
        </div>
        <div class="card-foot">
          <h3 class="card-name">${escapeHtml(item.name)}</h3>
          <div class="card-meta">${escapeHtml(item.colour || "—")} · ${escapeHtml(item.year || "—")}</div>
        </div>
      </button>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function animateHeroNum(next) {
    const text = pad3(next);
    if (els.heroNum.textContent === text) return;
    els.heroNum.classList.remove("is-tick");
    void els.heroNum.offsetWidth;
    els.heroNum.textContent = text;
    els.heroNum.classList.add("is-tick");
  }

  async function exitCards() {
    const cards = [...els.grid.querySelectorAll(".card, .empty-state")];
    if (!cards.length) return;
    els.grid.classList.add("is-morphing");
    cards.forEach((card, i) => {
      card.style.setProperty("--i", String(Math.min(i, 8)));
      card.classList.add("is-out");
      card.classList.remove("is-in");
    });
    await wait(EXIT_MS + Math.min(cards.length, 8) * 18);
  }

  function enterCards() {
    els.grid.classList.remove("is-morphing");
  }

  function paintGrid(animate = true) {
    const list = currentList();
    const shown = filteredList();
    const c = counts(list);

    document.querySelectorAll("[data-count]").forEach((el) => {
      el.textContent = c[el.dataset.count] ?? 0;
    });

    els.mineCount && (els.mineCount.textContent = pad3(state.mine.length));
    els.sampleCount && (els.sampleCount.textContent = pad3(state.sample.length));
    animateHeroNum(list.length);
    els.countLabel.textContent =
      state.source === "mine" ? "Your Objects" : "Sample Objects";

    document.querySelectorAll("[data-source]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.source === state.source);
    });

    els.grid.classList.toggle("is-list", state.view === "list");

    if (!shown.length) {
      const emptyMine = state.source === "mine";
      els.grid.innerHTML = `
        <div class="empty-state">
          <h3>${emptyMine ? "Your Archive Is Empty" : "No Matches"}</h3>
          <p>${
            emptyMine
              ? "Add your first object to begin. Data stays on this device."
              : "Try another filter or clear search."
          }</p>
        </div>
      `;
      els.grid.classList.remove("is-morphing");
      return;
    }

    const leadNeeded =
      state.source === "sample" && state.filter === "ALL" && !state.query;
    let i = 0;
    const lead = leadNeeded ? featureCard(i++) : "";
    const cards = shown.map((item) => itemCard(item, i++)).join("");
    els.grid.innerHTML = lead + cards;
    if (!animate) {
      els.grid.querySelectorAll(".card").forEach((card) => {
        card.style.animation = "none";
        card.style.opacity = "1";
        card.style.transform = "none";
      });
    }
    enterCards();
  }

  async function render({ animate = true } = {}) {
    if (state.rendering) {
      state._pendingRender = { animate };
      return;
    }
    state.rendering = true;
    try {
      if (animate && els.grid.children.length) {
        await exitCards();
      }
      paintGrid(animate);
      // allow enter stagger to start
      await wait(ENTER_STAGGER);
    } finally {
      state.rendering = false;
      if (state._pendingRender) {
        const next = state._pendingRender;
        state._pendingRender = null;
        render(next);
      }
    }
  }

  function findActiveIndex() {
    return filteredList().findIndex((i) => i.id === state.activeId);
  }

  function fillSpecimen(item) {
    document.getElementById("specimen-id").textContent = `Specimen / ${item.id}`;
    document.getElementById("specimen-media-label").textContent =
      `${item.category} / Object View`;
    document.getElementById("specimen-data-label").textContent =
      state.source === "mine"
        ? `${item.category} / Your Record`
        : `${item.category} / Example Record`;
    document.getElementById("specimen-title").textContent = item.name;
    document.getElementById("specimen-sub").textContent =
      state.source === "mine"
        ? "Personal record / 本地档案"
        : "Illustrative object / 非经核实的商品资料";
    document.getElementById("spec-acquired").textContent = item.acquired || "—";
    document.getElementById("spec-colour").textContent = item.colour || "—";
    document.getElementById("spec-size").textContent =
      item.size || "Not recorded / 待补充";
    document.getElementById("spec-status").textContent =
      item.status || "In collection / 仍持有";
    document.getElementById("specimen-notes").textContent =
      item.notes || "（暂无笔记）";
    const img = document.getElementById("specimen-image");
    img.src = item.image || PLACEHOLDER;
    img.alt = item.name;

    els.startOwn.hidden = state.source !== "sample";
    els.deleteItem.hidden = state.source !== "mine";
  }

  async function openSpecimen(id, { direction = null } = {}) {
    const list = filteredList();
    const item =
      list.find((i) => i.id === id) || currentList().find((i) => i.id === id);
    if (!item) return;
    state.activeId = item.id;

    const swap = els.specimenSwap;
    const alreadyOpen = els.specimen.classList.contains("is-open");

    if (alreadyOpen && direction && !reduceMotion) {
      if (state.swapping) return;
      state.swapping = true;
      const leave = direction > 0 ? "is-leave-next" : "is-leave-prev";
      const enter = direction > 0 ? "is-enter-next" : "is-enter-prev";
      swap.classList.remove(
        "is-leave-next",
        "is-leave-prev",
        "is-enter-next",
        "is-enter-prev"
      );
      swap.classList.add(leave);
      await wait(EXIT_MS);
      fillSpecimen(item);
      swap.classList.remove(leave);
      swap.classList.add(enter);
      await wait(OVERLAY_MS);
      swap.classList.remove(enter);
      state.swapping = false;
      return;
    }

    fillSpecimen(item);
    await openOverlay("specimen");
  }

  async function stepSpecimen(delta) {
    const list = filteredList();
    if (!list.length) return;
    let idx = findActiveIndex();
    if (idx < 0) idx = 0;
    idx = (idx + delta + list.length) % list.length;
    await openSpecimen(list[idx].id, { direction: delta });
  }

  function createItem(data) {
    const nextIndex = pad3(state.mine.length + 1);
    return {
      id: `U-${Date.now().toString(36).toUpperCase()}`,
      index: nextIndex,
      category: data.category,
      name: data.name.trim().toUpperCase(),
      colour: data.colour.trim() || "—",
      year: data.year.trim() || String(new Date().getFullYear()),
      acquired: data.acquired || new Date().toISOString().slice(0, 10),
      size: data.size.trim() || "Not recorded / 待补充",
      status: data.status.trim() || "In collection / 仍持有",
      notes: data.notes.trim() || "（暂无笔记）",
      image: data.image.trim() || PLACEHOLDER,
    };
  }

  function reindexMine() {
    state.mine.forEach((item, i) => {
      item.index = pad3(i + 1);
    });
  }

  function exportMine() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: state.mine,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archive-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported JSON");
  }

  function importMine(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        const items = Array.isArray(data) ? data : data.items;
        if (!Array.isArray(items)) throw new Error("Invalid file");
        state.mine = items.map((item, i) => ({
          id: item.id || `U-${Date.now().toString(36).toUpperCase()}-${i}`,
          index: pad3(i + 1),
          category: ["CLOTHING", "FOOTWEAR", "OBJECTS"].includes(item.category)
            ? item.category
            : "OBJECTS",
          name: String(item.name || "UNTITLED").toUpperCase(),
          colour: item.colour || "—",
          year: item.year || "",
          acquired: item.acquired || "",
          size: item.size || "Not recorded / 待补充",
          status: item.status || "In collection / 仍持有",
          notes: item.notes || "",
          image: item.image || PLACEHOLDER,
        }));
        saveMine();
        state.source = "mine";
        await render();
        showToast(`Imported ${state.mine.length} objects`);
      } catch {
        showToast("Import failed");
      }
    };
    reader.readAsText(file);
  }

  // Events
  document.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => openOverlay(btn.dataset.open));
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeOverlays());
  });

  [els.specimen, els.info, els.add].forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeOverlays();
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOverlays();
    if (!els.specimen.classList.contains("is-open")) return;
    if (e.key === "ArrowLeft") stepSpecimen(-1);
    if (e.key === "ArrowRight") stepSpecimen(1);
  });

  document.querySelectorAll("[data-source]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (state.source === btn.dataset.source) return;
      state.source = btn.dataset.source;
      state.filter = "ALL";
      document.querySelectorAll(".filter-btn").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.filter === "ALL");
      });
      await render();
    });
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (state.filter === btn.dataset.filter) return;
      state.filter = btn.dataset.filter;
      document.querySelectorAll(".filter-btn").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
      await render();
    });
  });

  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (state.view === btn.dataset.view) return;
      state.view = btn.dataset.view;
      document.querySelectorAll("[data-view]").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
      await render();
    });
  });

  document.getElementById("search-toggle").addEventListener("click", () => {
    const opening = !els.searchPanel.classList.contains("is-open");
    els.searchPanel.classList.toggle("is-open", opening);
    if (opening) {
      setTimeout(() => els.searchInput.focus(), reduceMotion ? 0 : 280);
    }
  });

  let searchTimer = null;
  els.searchInput.addEventListener("input", () => {
    state.query = els.searchInput.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => render(), reduceMotion ? 0 : 180);
  });

  els.grid.addEventListener("click", (e) => {
    const card = e.target.closest("[data-open-id]");
    if (!card) return;
    openSpecimen(card.dataset.openId);
  });

  document.getElementById("prev-btn").addEventListener("click", () => stepSpecimen(-1));
  document.getElementById("next-btn").addEventListener("click", () => stepSpecimen(1));

  els.startOwn.addEventListener("click", async () => {
    await closeOverlays();
    state.source = "mine";
    await render();
    await openOverlay("add");
    showToast("Switched to your archive");
  });

  els.deleteItem.addEventListener("click", async () => {
    if (!state.activeId) return;
    state.mine = state.mine.filter((i) => i.id !== state.activeId);
    reindexMine();
    saveMine();
    await closeOverlays();
    await render();
    showToast("Object removed");
  });

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(els.form);
    const item = createItem({
      name: fd.get("name") || "",
      category: fd.get("category") || "OBJECTS",
      colour: fd.get("colour") || "",
      year: fd.get("year") || "",
      acquired: fd.get("acquired") || "",
      size: fd.get("size") || "",
      status: fd.get("status") || "",
      image: fd.get("image") || "",
      notes: fd.get("notes") || "",
    });
    state.mine.push(item);
    saveMine();
    state.source = "mine";
    els.form.reset();
    document.getElementById("f-status").value = "In collection / 仍持有";
    await closeOverlays();
    await render();
    await openSpecimen(item.id);
    showToast("Saved locally");
  });

  document.getElementById("export-btn").addEventListener("click", exportMine);
  document.getElementById("import-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importMine(file);
    e.target.value = "";
  });

  // Initial paint + page choreography
  paintGrid(true);
  requestAnimationFrame(() => {
    document.body.classList.add("is-ready");
  });
})();
