(function () {
  const { translations, data } = window.MILLIY_TEATR;

  const STORAGE_LANG_KEY = "muqimiy_lang";
  const STORAGE_BOOKINGS_KEY = "muqimiy_bookings";

  function loadSavedLang() {
    try {
      const saved = localStorage.getItem(STORAGE_LANG_KEY);
      return saved && translations[saved] ? saved : "uz";
    } catch {
      return "uz";
    }
  }

  function loadSavedBookings() {
    try {
      const raw = localStorage.getItem(STORAGE_BOOKINGS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const map = {};
      Object.keys(parsed).forEach((sessionId) => {
        if (Array.isArray(parsed[sessionId])) {
          map[sessionId] = new Set(parsed[sessionId]);
        }
      });
      return map;
    } catch {
      return {};
    }
  }

  function persistBookings() {
    try {
      const serializable = {};
      Object.keys(state.bookedBySession).forEach((sessionId) => {
        serializable[sessionId] = Array.from(state.bookedBySession[sessionId]);
      });
      localStorage.setItem(STORAGE_BOOKINGS_KEY, JSON.stringify(serializable));
    } catch {
      // ignore storage quota/privacy errors
    }
  }

  const state = {
    lang: loadSavedLang(),
    filter: "all",
    search: "",
    selectedShowId: data.productions[0].id,
    selectedSessionId: data.productions[0].sessions[0].id,
    selectedSeats: [], // { key, zoneKey, rowLabel, seat, price }
    bookedBySession: loadSavedBookings()
  };

  function t(path) {
    const parts = path.split(".");
    let cur = translations[state.lang];
    for (const part of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) {
        cur = cur[part];
      } else {
        return path;
      }
    }
    return cur;
  }

  function formatPrice(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + t("production.currency");
  }

  function applyI18n() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.setAttribute("placeholder", t(key));
    });

    const featured = data.productions[0];
    document.getElementById("heroPremiereTitle").textContent = featured.title[state.lang];
    document.getElementById("heroPremiereMeta").textContent =
      `${featured.sessions[0].label[state.lang]} · ${t("production.mainHall")}`;
  }

  function renderProductions() {
    const grid = document.getElementById("productionsGrid");
    const query = state.search.trim().toLowerCase();

    const filtered = data.productions.filter((item) => {
      const matchesCategory = state.filter === "all" || item.tags.includes(state.filter);
      const title = item.title[state.lang].toLowerCase();
      const author = item.author[state.lang].toLowerCase();
      const matchesSearch = !query || title.includes(query) || author.includes(query);
      return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<p style="grid-column: 1 / -1; color: var(--ink-muted);">${t("production.emptyFilter")}</p>`;
      return;
    }

    grid.innerHTML = filtered
      .map((item) => {
        const badgeLabel = t(`filters.${item.category}`);
        return `
          <article class="prod-card">
            <div class="prod-thumb">
              <img src="${item.image}" alt="${item.title[state.lang]}" loading="lazy" />
              <span class="prod-badge">${badgeLabel}</span>
            </div>
            <div class="prod-body">
              <div class="prod-meta">
                <span>${item.sessions[0].label[state.lang]}</span>
                <span>•</span>
                <span>${t("production.mainHall")}</span>
                <span>•</span>
                <span>${item.ageLimit}</span>
              </div>
              <h3 class="prod-title">${item.title[state.lang]}</h3>
              <div class="prod-author">${item.author[state.lang]}</div>
              <p class="prod-desc">${item.synopsis[state.lang]}</p>
              <div class="prod-footer">
                <div class="prod-price">
                  <span>${t("production.priceFrom")}</span>
                  <strong>${formatPrice(item.minPrice)}</strong>
                </div>
                <div class="prod-actions">
                  <button type="button" class="btn btn-outline btn-sm" data-action="details" data-id="${item.id}">
                    ${t("production.detailsBtn")}
                  </button>
                  <button type="button" class="btn btn-primary btn-sm" data-action="book" data-id="${item.id}">
                    ${t("production.bookBtn")}
                  </button>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderActors() {
    const grid = document.getElementById("actorsGrid");
    grid.innerHTML = data.actors
      .map(
        (actor) => `
        <article class="actor-card">
          <div class="actor-top">
            <div class="actor-avatar" style="background: ${actor.accent};">${actor.initials}</div>
            <div>
              <h3 class="actor-name">${actor.name[state.lang]}</h3>
              <div class="actor-role-title">${actor.title[state.lang]}</div>
            </div>
          </div>
          <p class="actor-bio">${actor.bio[state.lang]}</p>
          <div class="actor-meta">
            <strong>${t("actor.keyRoles")}:</strong> ${actor.roles[state.lang]}
          </div>
        </article>
      `
      )
      .join("");
  }

  function renderNews() {
    const grid = document.getElementById("newsGrid");
    grid.innerHTML = data.news
      .map(
        (item) => `
        <article class="news-card" data-news-id="${item.id}" tabindex="0" role="button">
          <div class="news-thumb">
            <img src="${item.image}" alt="${item.title[state.lang]}" loading="lazy" />
          </div>
          <div class="news-body">
            <div class="news-top">
              <span class="news-tag">${item.tag[state.lang]}</span>
              <span>${item.date}</span>
            </div>
            <h3 class="news-title">${item.title[state.lang]}</h3>
            <p class="news-summary">${item.summary[state.lang]}</p>
          </div>
        </article>
      `
      )
      .join("");
  }

  function openNewsModal(newsId) {
    const item = data.news.find((n) => n.id === newsId);
    if (!item) return;
    openModal(`
      <img src="${item.image}" alt="${item.title[state.lang]}" class="modal-cover" />
      <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--ink-soft); margin-bottom:0.5rem;">
        <span style="color:var(--accent); font-weight:600;">${item.tag[state.lang]}</span>
        <span>${item.date}</span>
      </div>
      <h2 class="modal-title">${item.title[state.lang]}</h2>
      <p style="color: var(--ink-muted); line-height: 1.7; margin-top: 0.75rem;">${item.summary[state.lang]}</p>
    `);
  }

  function populateBookingSelectors() {
    const showSelect = document.getElementById("bookingShowSelect");
    const sessionSelect = document.getElementById("bookingSessionSelect");

    showSelect.innerHTML = data.productions
      .map((p) => `<option value="${p.id}">${p.title[state.lang]}</option>`)
      .join("");
    showSelect.value = state.selectedShowId;

    const currentShow = data.productions.find((p) => p.id === state.selectedShowId) || data.productions[0];
    if (!currentShow.sessions.some((s) => s.id === state.selectedSessionId)) {
      state.selectedSessionId = currentShow.sessions[0].id;
    }

    sessionSelect.innerHTML = currentShow.sessions
      .map((s) => `<option value="${s.id}">${s.label[state.lang]}</option>`)
      .join("");
    sessionSelect.value = state.selectedSessionId;
  }

  function getOccupiedSet(sessionId) {
    const currentShow = data.productions.find((p) => p.id === state.selectedShowId);
    const session = currentShow ? currentShow.sessions.find((s) => s.id === sessionId) : null;
    const baseOccupied = new Set(session ? session.occupied : []);
    const localBooked = state.bookedBySession[sessionId];
    if (localBooked) {
      localBooked.forEach((k) => baseOccupied.add(k));
    }
    return baseOccupied;
  }

  function renderSeatMap() {
    const container = document.getElementById("hallZones");
    const occupiedSet = getOccupiedSet(state.selectedSessionId);
    const selectedKeys = new Set(state.selectedSeats.map((s) => s.key));

    container.innerHTML = data.hallLayout
      .map((zone) => {
        const rowsHtml = zone.rows
          .map((rowObj) => {
            const segmentsHtml = rowObj.groups
              .map((group, gIdx) => {
                if (group === "aisle") {
                  return `<span class="seat-aisle"></span>`;
                }
                const gapHtml = gIdx > 0 && rowObj.groups[gIdx - 1] !== "aisle"
                  ? `<span class="seat-group-gap"></span>`
                  : "";
                const btns = group
                  .map((seatNum) => {
                    const seatKey = `${zone.prefix}-${rowObj.rowNum}-${seatNum}`;
                    const isOccupied = occupiedSet.has(seatKey);
                    const isSelected = selectedKeys.has(seatKey);
                    const classes = ["seat-btn"];
                    if (rowObj.vip) classes.push("vip");
                    if (isSelected) classes.push("selected");

                    return `
                      <button
                        type="button"
                        class="${classes.join(" ")}"
                        data-seat-key="${seatKey}"
                        data-zone-key="${zone.labelKey}"
                        data-row-label="${rowObj.rowLabel}"
                        data-seat="${seatNum}"
                        data-price="${rowObj.price}"
                        title="${t(`booking.${zone.labelKey}`)} · ${t("booking.row")} ${rowObj.rowLabel}, ${t("booking.seat")} ${seatNum} (${formatPrice(rowObj.price)})"
                        ${isOccupied ? "disabled" : ""}
                      >${seatNum}</button>
                    `;
                  })
                  .join("");
                return gapHtml + btns;
              })
              .join("");

            return `
              <div class="seat-row">
                <span class="row-num">${rowObj.rowLabel}</span>
                ${segmentsHtml}
                <span class="row-num">${rowObj.rowLabel}</span>
              </div>
            `;
          })
          .join("");

        return `
          <div>
            <div class="zone-title">${t(`booking.${zone.labelKey}`)}</div>
            ${rowsHtml}
          </div>
        `;
      })
      .join("");
  }

  function renderBookingSummary() {
    const list = document.getElementById("selectedSeatsList");
    const totalEl = document.getElementById("bookingTotal");

    if (state.selectedSeats.length === 0) {
      list.innerHTML = `<div class="empty-seats-msg">${t("booking.noSeatsSelected")}</div>`;
      totalEl.textContent = formatPrice(0);
      return;
    }

    list.innerHTML = state.selectedSeats
      .map(
        (s) => `
        <div class="selected-seat-chip">
          <span>
            <strong>${t(`booking.${s.zoneKey}`)}</strong> · ${t("booking.row")} ${s.rowLabel}, ${t("booking.seat")} ${s.seat}
          </span>
          <span>
            ${formatPrice(s.price)}
            <button type="button" class="remove-seat-btn" data-remove-key="${s.key}" aria-label="Remove">×</button>
          </span>
        </div>
      `
      )
      .join("");

    const total = state.selectedSeats.reduce((sum, s) => sum + s.price, 0);
    totalEl.textContent = formatPrice(total);
  }

  function openModal(html) {
    const backdrop = document.getElementById("modalBackdrop");
    document.getElementById("modalContent").innerHTML = html;
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    const backdrop = document.getElementById("modalBackdrop");
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
  }

  function openProductionModal(prodId) {
    const item = data.productions.find((p) => p.id === prodId);
    if (!item) return;

    const castNames = item.cast
      .map((cid) => data.actors.find((a) => a.id === cid))
      .filter(Boolean)
      .map((a) => a.name[state.lang])
      .join(", ");

    const sessionsHtml = item.sessions
      .map((s) => `<span class="filter-pill" style="cursor:default;">${s.label[state.lang]}</span>`)
      .join(" ");

    openModal(`
      <img src="${item.image}" alt="${item.title[state.lang]}" class="modal-cover" />
      <h2 class="modal-title">${item.title[state.lang]}</h2>
      <p style="color: var(--ink-muted); margin-bottom: 1rem;">${item.synopsis[state.lang]}</p>
      <div class="modal-meta-grid">
        <div><strong>${t("production.author")}:</strong> ${item.author[state.lang]}</div>
        <div><strong>${t("production.director")}:</strong> ${item.director[state.lang]}</div>
        <div><strong>${t("production.composer")}:</strong> ${item.composer[state.lang]}</div>
        <div><strong>${t("production.duration")}:</strong> ${item.duration} (${item.ageLimit})</div>
      </div>
      ${castNames ? `<p style="font-size: 0.9rem; margin-bottom: 1rem;"><strong>${t("production.castTitle")}:</strong> ${castNames}</p>` : ""}
      <div style="margin-bottom: 1.5rem;">
        <strong style="display:block; font-size: 0.9rem; margin-bottom: 0.5rem;">${t("production.sessionsTitle")}:</strong>
        <div style="display:flex; gap: 0.5rem; flex-wrap: wrap;">${sessionsHtml}</div>
      </div>
      <button type="button" class="btn btn-primary" id="modalBookBtn" data-id="${item.id}">
        ${t("production.bookBtn")}
      </button>
    `);

    document.getElementById("modalBookBtn").addEventListener("click", () => {
      closeModal();
      selectShowForBooking(item.id);
    });
  }

  function selectShowForBooking(prodId) {
    const show = data.productions.find((p) => p.id === prodId);
    if (!show) return;
    state.selectedShowId = show.id;
    state.selectedSessionId = show.sessions[0].id;
    state.selectedSeats = [];
    populateBookingSelectors();
    renderSeatMap();
    renderBookingSummary();
    document.getElementById("booking").scrollIntoView({ behavior: "smooth" });
  }

  function bindEvents() {
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === state.lang);
      btn.addEventListener("click", () => {
        state.lang = btn.getAttribute("data-lang");
        try {
          localStorage.setItem(STORAGE_LANG_KEY, state.lang);
        } catch {
          // ignore
        }
        document.querySelectorAll(".lang-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        applyI18n();
        renderProductions();
        renderActors();
        renderNews();
        populateBookingSelectors();
        renderSeatMap();
        renderBookingSummary();
      });
    });

    const menuBtn = document.getElementById("mobileMenuBtn");
    const navLinks = document.getElementById("navLinks");
    menuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => navLinks.classList.remove("open"));
    });

    document.getElementById("genreFilters").addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-pill");
      if (!btn) return;
      state.filter = btn.getAttribute("data-filter");
      document.querySelectorAll("#genreFilters .filter-pill").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      renderProductions();
    });

    document.getElementById("searchInput").addEventListener("input", (e) => {
      state.search = e.target.value;
      renderProductions();
    });

    document.getElementById("newsGrid").addEventListener("click", (e) => {
      const card = e.target.closest(".news-card[data-news-id]");
      if (card) openNewsModal(card.getAttribute("data-news-id"));
    });

    document.getElementById("newsGrid").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const card = e.target.closest(".news-card[data-news-id]");
        if (card) {
          e.preventDefault();
          openNewsModal(card.getAttribute("data-news-id"));
        }
      }
    });

    document.getElementById("productionsGrid").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (action === "details") {
        openProductionModal(id);
      } else if (action === "book") {
        selectShowForBooking(id);
      }
    });

    document.getElementById("bookingShowSelect").addEventListener("change", (e) => {
      state.selectedShowId = e.target.value;
      const show = data.productions.find((p) => p.id === state.selectedShowId);
      state.selectedSessionId = show.sessions[0].id;
      state.selectedSeats = [];
      populateBookingSelectors();
      renderSeatMap();
      renderBookingSummary();
    });

    document.getElementById("bookingSessionSelect").addEventListener("change", (e) => {
      state.selectedSessionId = e.target.value;
      state.selectedSeats = [];
      renderSeatMap();
      renderBookingSummary();
    });

    document.getElementById("hallZones").addEventListener("click", (e) => {
      const btn = e.target.closest(".seat-btn");
      if (!btn || btn.disabled) return;
      const key = btn.getAttribute("data-seat-key");
      const existingIdx = state.selectedSeats.findIndex((s) => s.key === key);

      if (existingIdx >= 0) {
        state.selectedSeats.splice(existingIdx, 1);
      } else {
        state.selectedSeats.push({
          key,
          zoneKey: btn.getAttribute("data-zone-key"),
          rowLabel: btn.getAttribute("data-row-label"),
          seat: Number(btn.getAttribute("data-seat")),
          price: Number(btn.getAttribute("data-price"))
        });
      }
      renderSeatMap();
      renderBookingSummary();
    });

    document.getElementById("selectedSeatsList").addEventListener("click", (e) => {
      const btn = e.target.closest(".remove-seat-btn");
      if (!btn) return;
      const key = btn.getAttribute("data-remove-key");
      state.selectedSeats = state.selectedSeats.filter((s) => s.key !== key);
      renderSeatMap();
      renderBookingSummary();
    });

    document.getElementById("clearSeatsBtn").addEventListener("click", () => {
      state.selectedSeats = [];
      renderSeatMap();
      renderBookingSummary();
    });

    document.getElementById("bookingForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("customerName").value.trim();
      const phone = document.getElementById("customerPhone").value.trim();
      const errorEl = document.getElementById("bookingError");

      if (state.selectedSeats.length === 0 || !name || !phone) {
        errorEl.classList.add("visible");
        return;
      }

      errorEl.classList.remove("visible");

      if (!state.bookedBySession[state.selectedSessionId]) {
        state.bookedBySession[state.selectedSessionId] = new Set();
      }
      state.selectedSeats.forEach((s) => state.bookedBySession[state.selectedSessionId].add(s.key));
      persistBookings();

      const show = data.productions.find((p) => p.id === state.selectedShowId);
      const session = show.sessions.find((s) => s.id === state.selectedSessionId);
      const total = state.selectedSeats.reduce((sum, s) => sum + s.price, 0);
      const bookingCode = "MQ-" + Math.floor(100000 + Math.random() * 900000);
      const seatSummary = state.selectedSeats
        .map((s) => `${t(`booking.${s.zoneKey}`)} (${t("booking.row")} ${s.rowLabel}, ${t("booking.seat")} ${s.seat})`)
        .join(", ");

      openModal(`
        <div class="success-box">
          <div class="success-icon">✓</div>
          <h2 class="modal-title">${t("booking.successTitle")}</h2>
          <p style="color: var(--ink-muted); margin-bottom: 1rem;">${t("booking.successDesc")}</p>
          <div class="booking-code-pill">${t("booking.bookingCode")}: ${bookingCode}</div>
          <div style="text-align: left; background: var(--bg); padding: 1rem; border-radius: var(--radius-sm); font-size: 0.9rem; margin: 1rem 0 1.5rem;">
            <div><strong>${show.title[state.lang]}</strong> — ${session.label[state.lang]}</div>
            <div style="margin-top: 0.35rem; color: var(--ink-muted);">${seatSummary}</div>
            <div style="margin-top: 0.5rem;"><strong>${t("booking.total")}:</strong> ${formatPrice(total)}</div>
          </div>
          <button type="button" class="btn btn-primary" id="successCloseBtn">${t("booking.close")}</button>
        </div>
      `);

      document.getElementById("successCloseBtn").addEventListener("click", closeModal);

      state.selectedSeats = [];
      e.target.reset();
      renderSeatMap();
      renderBookingSummary();
    });

    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
    document.getElementById("modalBackdrop").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  function init() {
    applyI18n();
    renderProductions();
    renderActors();
    renderNews();
    populateBookingSelectors();
    renderSeatMap();
    renderBookingSummary();
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
