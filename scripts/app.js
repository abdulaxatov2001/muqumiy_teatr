(function () {
  const { translations, data, QRCode } = window.MILLIY_TEATR;

  const STORAGE_LANG_KEY = "muqimiy_lang";
  const STORAGE_BOOKINGS_KEY = "muqimiy_bookings";
  const STORAGE_ORDERS_KEY = "muqimiy_orders";

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

  function loadSavedOrders() {
    try {
      const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {

      return [];
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
      // ignore storage errors
    }
  }

  function persistOrders() {
    try {
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(state.orders));
    } catch {
      // ignore storage errors
    }
  }

  const state = {
    lang: loadSavedLang(),
    filter: "all",
    search: "",
    teamFilter: "all",
    teamSearch: "",
    calendarMonth: "2026-11",
    selectedDate: "2026-11-28",
    activeSeatViewZone: "parter",
    selectedShowId: data.productions[0].id,
    selectedSessionId: data.productions[0].sessions[0].id,
    selectedSeats: [], // { key, zone, zoneKey, rowLabel, seat, price }
    bookedBySession: loadSavedBookings(),
    orders: loadSavedOrders(),
    ticketSearchQuery: ""
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
      const val = t(key);
      if (typeof val === "string") el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.setAttribute("placeholder", t(key));
    });

    const featured = data.productions[0];
    document.getElementById("heroPremiereTitle").textContent = featured.title[state.lang];
    document.getElementById("heroPremiereMeta").textContent =
      `${featured.sessions[0].label[state.lang]} · ${t("production.mainHall")}`;

    // Update calendar month pills
    document.querySelectorAll("#calendarMonthSwitcher button").forEach((btn) => {
      const m = btn.getAttribute("data-month");
      btn.textContent = t(`calendar.months.${m}`);
    });
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

  /* Interactive Monthly Calendar */
  function renderCalendar() {
    const weekdaysEl = document.getElementById("calendarWeekdays");
    const daysEl = document.getElementById("calendarDays");
    const weekdays = t("calendar.weekdays");
    weekdaysEl.innerHTML = weekdays.map((d) => `<span>${d}</span>`).join("");

    const [year, month] = state.calendarMonth.split("-").map(Number);
    const firstDayJs = new Date(year, month - 1, 1).getDay(); // 0=Sun..6=Sat
    const startOffset = (firstDayJs + 6) % 7; // Mon=0..Sun=6
    const daysInMonth = new Date(year, month, 0).getDate();

    let html = "";
    for (let i = 0; i < startOffset; i++) {
      html += `<div class="cal-day empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateStr = `${year}-${mm}-${dd}`;
      const dow = new Date(year, month - 1, day).getDay(); // 2 = Tuesday (day off)
      const entries = data.calendarSchedule[dateStr] || [];
      const isSelected = state.selectedDate === dateStr;
      const isDayOff = dow === 2 && entries.length === 0;

      const classes = ["cal-day"];
      if (entries.length > 0) classes.push("has-show");
      if (isDayOff) classes.push("day-off");
      if (isSelected) classes.push("selected");

      let dotText = "";
      if (entries.length > 0) {
        const show = data.productions.find((p) => p.id === entries[0].showId);
        dotText = show ? show.title[state.lang] : "";
      } else if (isDayOff) {
        dotText = "×";
      }

      html += `
        <button type="button" class="${classes.join(" ")}" data-date="${dateStr}">
          <span class="cal-day-num">${day}</span>
          ${dotText ? `<span class="cal-day-dot">${dotText}</span>` : ""}
        </button>
      `;
    }

    daysEl.innerHTML = html;
    renderCalendarDetail();
  }

  function renderCalendarDetail() {
    const detailEl = document.getElementById("calendarDetail");
    const dateStr = state.selectedDate;
    const entries = data.calendarSchedule[dateStr] || [];
    const dateObj = new Date(dateStr + "T12:00:00");
    const isTuesday = dateObj.getDay() === 2;
    const monthLabel = t(`calendar.months.${dateStr.slice(0, 7)}`);
    const dayNum = Number(dateStr.slice(8, 10));

    if (entries.length === 0) {
      detailEl.innerHTML = `
        <div class="cal-detail-date">${dayNum} · ${monthLabel}</div>
        <h3 style="font-family:var(--font-display); font-size:1.6rem; margin-bottom:0.5rem;">
          ${isTuesday ? t("calendar.dayOff") : t("calendar.selectDayHint")}
        </h3>
        <p style="color:var(--ink-muted); font-size:0.9rem;">${t("calendar.noShow")}</p>
      `;
      return;
    }

    const itemsHtml = entries
      .map((entry) => {
        const show = data.productions.find((p) => p.id === entry.showId);
        if (!show) return "";
        const timesHtml = entry.times.map((tm) => `<span class="cal-time-pill">${tm}</span>`).join("");
        return `
          <div class="cal-detail-item">
            <h4>${show.title[state.lang]}</h4>
            <p style="font-size:0.85rem; color:var(--ink-muted); margin-bottom:0.5rem;">
              ${show.author[state.lang]} · ${show.duration}
            </p>
            <div class="cal-time-pills">${timesHtml}</div>
            <p style="font-size:0.86rem; color:var(--ink-muted); margin-bottom:1rem;">${show.synopsis[state.lang]}</p>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-sm" data-cal-book="${show.id}">
                ${t("production.bookBtn")}
              </button>
              <button type="button" class="btn btn-outline btn-sm" data-cal-details="${show.id}">
                ${t("production.detailsBtn")}
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    detailEl.innerHTML = `
      <div class="cal-detail-date">${dayNum} · ${monthLabel}</div>
      ${itemsHtml}
    `;
  }

  function renderActors() {
    const grid = document.getElementById("actorsGrid");
    const q = state.teamSearch.trim().toLowerCase();

    const filtered = data.actors.filter((actor) => {
      const matchesCat = state.teamFilter === "all" || actor.category === state.teamFilter;
      const name = actor.name[state.lang].toLowerCase();
      const title = actor.title[state.lang].toLowerCase();
      const roles = (actor.roles && actor.roles[state.lang] ? actor.roles[state.lang] : "").toLowerCase();
      const matchesSearch = !q || name.includes(q) || title.includes(q) || roles.includes(q);
      return matchesCat && matchesSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<p style="grid-column: 1 / -1; color: var(--ink-muted); text-align: center; padding: 2rem 0;">${t("teamFilters.empty")}</p>`;
      return;
    }

    grid.innerHTML = filtered
      .map(
        (actor) => {
          const categoryBadge = t(`teamFilters.${actor.category}`);
          return `
          <article class="actor-card" data-member-id="${actor.id}">
            <div class="actor-card-badge">${categoryBadge}</div>
            <div class="actor-top">
              <div class="actor-avatar" style="background: ${actor.accent};">${actor.initials}</div>
              <div>
                <h3 class="actor-name">${actor.name[state.lang]}</h3>
                <div class="actor-role-title">${actor.title[state.lang]}</div>
              </div>
            </div>
            <p class="actor-bio">${actor.bio[state.lang]}</p>
            <div class="actor-meta">
              <strong>${t("teamMember.rolesOrWorks")}:</strong> ${actor.roles[state.lang]}
            </div>
            <div class="actor-card-footer">
              <button type="button" class="btn btn-outline btn-sm" data-action="member-details" data-id="${actor.id}">
                ${t("teamMember.detailsBtn")}
              </button>
            </div>
          </article>
        `;
        }
      )
      .join("");
  }

  function openTeamMemberModal(memberId) {
    const item = data.actors.find((a) => a.id === memberId);
    if (!item) return;

    const categoryBadge = t(`teamFilters.${item.category}`);
    const awardsHtml = item.awards && item.awards[state.lang]
      ? `<div><strong>${t("teamMember.awards")}:</strong> ${item.awards[state.lang]}</div>`
      : "";

    openModal(`
      <div style="display:flex; align-items:center; gap:1.25rem; margin-bottom:1.25rem;">
        <div class="actor-avatar" style="background:${item.accent}; width:72px; height:72px; font-size:1.75rem;">${item.initials}</div>
        <div>
          <span class="ticket-status-badge" style="margin-bottom:0.35rem; display:inline-block;">${categoryBadge}</span>
          <h2 class="modal-title" style="margin-bottom:0.25rem;">${item.name[state.lang]}</h2>
          <div style="font-size:0.9rem; color:var(--accent); font-weight:600;">${item.title[state.lang]}</div>
        </div>
      </div>
      <div class="modal-meta-grid">
        <div><strong>${t("teamMember.rolesOrWorks")}:</strong> ${item.roles[state.lang]}</div>
        ${awardsHtml}
      </div>
      <div style="margin: 1.25rem 0;">
        <h4 style="font-size:0.9rem; margin-bottom:0.45rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--ink-soft);">
          ${t("teamMember.detailsBtn")}
        </h4>
        <p style="color:var(--ink-muted); line-height:1.7; font-size:0.95rem;">${item.bio[state.lang]}</p>
      </div>
      <div style="display:flex; justify-content:flex-end;">
        <button type="button" class="btn btn-primary btn-sm" id="modalMemberCloseBtn">${t("teamMember.closeBtn")}</button>
      </div>
    `);

    document.getElementById("modalMemberCloseBtn").addEventListener("click", closeModal);
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

  /* View from Seat Perspective Renderer */
  function renderSeatView() {
    const zone = state.activeSeatViewZone;
    const zoneInfo = t(`seatView.zones.${zone}`);
    document.getElementById("seatViewZoneName").textContent = zoneInfo.name;
    document.getElementById("seatViewDesc").textContent = zoneInfo.desc;

    document.querySelectorAll("#seatViewTabs .sv-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-zone") === zone);
    });

    document.getElementById("seatViewMetrics").innerHTML = `
      <div class="sv-metric">
        <span>${t("seatView.distanceLabel")}</span>
        <strong>${zoneInfo.distance}</strong>
      </div>
      <div class="sv-metric">
        <span>${t("seatView.angleLabel")}</span>
        <strong>${zoneInfo.angle}</strong>
      </div>
      <div class="sv-metric">
        <span>${t("seatView.acousticsLabel")}</span>
        <strong>${zoneInfo.acoustics}</strong>
      </div>
    `;

    // Architectural SVG stage perspective adjusted per zone
    const configs = {
      parter: { stageW: 260, stageH: 108, stageY: 22, pitH: 14, balconyRim: false, scaleText: "100%" },
      amphitheater: { stageW: 210, stageH: 88, stageY: 32, pitH: 18, balconyRim: false, scaleText: "82%" },
      balcony: { stageW: 164, stageH: 70, stageY: 28, pitH: 20, balconyRim: true, scaleText: "65%" }
    };
    const cfg = configs[zone] || configs.parter;
    const sx = (320 - cfg.stageW) / 2;

    document.getElementById("seatViewSvgWrap").innerHTML = `
      <svg viewBox="0 0 320 155" width="100%" style="display:block;" aria-label="${zoneInfo.name}">
        <defs>
          <radialGradient id="stageGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stop-color="#FDE68A" stop-opacity="0.95"/>
            <stop offset="55%" stop-color="#D97706" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#1C1917" stop-opacity="0.98"/>
          </radialGradient>
        </defs>
        <rect width="320" height="155" fill="#18181B"/>
        <!-- Auditorium side walls -->
        <polygon points="0,0 ${sx},${cfg.stageY} ${sx},${cfg.stageY + cfg.stageH} 0,155" fill="#27272A"/>
        <polygon points="320,0 ${sx + cfg.stageW},${cfg.stageY} ${sx + cfg.stageW},${cfg.stageY + cfg.stageH} 320,155" fill="#27272A"/>
        <!-- Stage Opening -->
        <rect x="${sx}" y="${cfg.stageY}" width="${cfg.stageW}" height="${cfg.stageH}" rx="4" fill="url(#stageGlow)"/>
        <!-- Curtains -->
        <path d="M${sx},${cfg.stageY} Q${sx + 26},${cfg.stageY + cfg.stageH * 0.55} ${sx + 14},${cfg.stageY + cfg.stageH} L${sx},${cfg.stageY + cfg.stageH} Z" fill="#8C2E21"/>
        <path d="M${sx + cfg.stageW},${cfg.stageY} Q${sx + cfg.stageW - 26},${cfg.stageY + cfg.stageH * 0.55} ${sx + cfg.stageW - 14},${cfg.stageY + cfg.stageH} L${sx + cfg.stageW},${cfg.stageY + cfg.stageH} Z" fill="#8C2E21"/>
        <rect x="${sx}" y="${cfg.stageY}" width="${cfg.stageW}" height="10" fill="#A63A2B"/>
        <!-- Performer silhouettes on stage -->
        <circle cx="148" cy="${cfg.stageY + cfg.stageH * 0.62}" r="${zone === 'parter' ? 6 : 4}" fill="#18181B"/>
        <path d="M141,${cfg.stageY + cfg.stageH - 6} L148,${cfg.stageY + cfg.stageH * 0.68} L155,${cfg.stageY + cfg.stageH - 6} Z" fill="#18181B"/>
        <circle cx="174" cy="${cfg.stageY + cfg.stageH * 0.64}" r="${zone === 'parter' ? 5.5 : 3.8}" fill="#18181B"/>
        <path d="M167,${cfg.stageY + cfg.stageH - 6} L174,${cfg.stageY + cfg.stageH * 0.7} L181,${cfg.stageY + cfg.stageH - 6} Z" fill="#18181B"/>
        <!-- Stage Floor / Orchestra Pit -->
        <rect x="${sx - 8}" y="${cfg.stageY + cfg.stageH}" width="${cfg.stageW + 16}" height="${cfg.pitH}" fill="#3F2E21"/>
        ${cfg.balconyRim ? `<path d="M0,126 Q160,114 320,126 L320,155 L0,155 Z" fill="#292524" stroke="#57534E" stroke-width="1"/>` : `<path d="M20,142 Q160,132 300,142 L320,155 L0,155 Z" fill="#27272A"/>`}
        <text x="160" y="14" text-anchor="middle" fill="#D4D4D8" font-size="8.5" font-family="sans-serif" letter-spacing="1.5">${t("booking.stage")} · ${cfg.scaleText}</text>
      </svg>
    `;
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
                        data-zone="${zone.zone}"
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

  function formatOrderSeats(order) {
    return order.seats
      .map((s) => `${t(`booking.${s.zoneKey}`)} (${t("booking.row")} ${s.rowLabel}, ${t("booking.seat")} ${s.seat})`)
      .join(", ");
  }

  function getOrderQrPayload(order) {
    return `${order.code}|${order.showId}|${order.sessionId}|${order.seats.map((s) => s.key).join(",")}`;
  }

  function openTicketQrModal(order, isNewBooking = false) {
    const show = data.productions.find((p) => p.id === order.showId) || data.productions[0];
    const session = show.sessions.find((s) => s.id === order.sessionId) || show.sessions[0];
    const seatSummary = formatOrderSeats(order);
    const qrPayload = getOrderQrPayload(order);

    openModal(`
      <div class="success-box">
        ${isNewBooking ? `<div class="success-icon">✓</div>` : ""}
        <h2 class="modal-title">${isNewBooking ? t("booking.successTitle") : show.title[state.lang]}</h2>
        <p style="color: var(--ink-muted); margin-bottom: 0.75rem;">
          ${isNewBooking ? t("booking.successDesc") : session.label[state.lang]}
        </p>

        <div class="qr-modal-box">
          <canvas id="modalQrCanvas"></canvas>
          <span>${t("booking.qrHint")}</span>
        </div>

        <div class="booking-code-pill">${t("booking.bookingCode")}: ${order.code}</div>

        <div style="text-align: left; background: var(--bg); padding: 1rem; border-radius: var(--radius-sm); font-size: 0.9rem; margin: 0.75rem 0 1.25rem;">
          <div><strong>${show.title[state.lang]}</strong> — ${session.label[state.lang]}</div>
          <div style="margin-top: 0.35rem; color: var(--ink-muted);">${seatSummary}</div>
          <div style="margin-top: 0.35rem; color: var(--ink-muted);">${order.customerName} (${order.customerPhone})</div>
          <div style="margin-top: 0.5rem;"><strong>${t("booking.total")}:</strong> ${formatPrice(order.total)}</div>
        </div>

        <div style="display:flex; gap:0.65rem; justify-content:center; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" id="downloadTicketBtn">${t("booking.downloadTicket")}</button>
          <button type="button" class="btn btn-outline btn-sm" id="printTicketBtn">${t("booking.printTicket")}</button>
          <button type="button" class="btn btn-outline btn-sm" id="successCloseBtn">${t("booking.close")}</button>
        </div>
      </div>
    `);

    const qrCanvas = document.getElementById("modalQrCanvas");
    if (qrCanvas && QRCode) {
      QRCode.renderToCanvas(qrCanvas, qrPayload, { scale: 5, quiet: 2 });
    }

    document.getElementById("downloadTicketBtn").addEventListener("click", () => {
      QRCode.downloadTicketPng({
        code: order.code,
        showTitle: show.title[state.lang],
        sessionLabel: session.label[state.lang],
        hallLabel: t("production.mainHall"),
        seatSummary,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        totalFormatted: formatPrice(order.total),
        qrPayload,
        labels: {
          seats: t("myTickets.seats"),
          guest: t("myTickets.guest"),
          total: t("myTickets.total"),
          code: t("booking.bookingCode")
        }
      });
    });

    document.getElementById("printTicketBtn").addEventListener("click", () => window.print());
    document.getElementById("successCloseBtn").addEventListener("click", closeModal);
  }

  /* My Tickets Lookup & Rendering */
  function renderMyTickets() {
    const grid = document.getElementById("myTicketsGrid");
    const q = state.ticketSearchQuery.trim().toLowerCase();

    const list = state.orders.filter((o) => {
      if (!q) return true;
      return (
        o.code.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q)
      );
    });

    if (list.length === 0) {
      grid.innerHTML = `<div class="empty-seats-msg" style="grid-column: 1 / -1;">${t("myTickets.empty")}</div>`;
      return;
    }

    grid.innerHTML = list
      .map((order) => {
        const show = data.productions.find((p) => p.id === order.showId) || data.productions[0];
        const session = show.sessions.find((s) => s.id === order.sessionId) || show.sessions[0];
        return `
          <article class="ticket-card">
            <div class="ticket-qr-thumb">
              <canvas data-ticket-qr="${order.code}"></canvas>
            </div>
            <div class="ticket-info">
              <div class="ticket-top-row">
                <span class="ticket-code-badge">${order.code}</span>
                <span class="ticket-status-badge">${t("myTickets.statusActive")}</span>
              </div>
              <h4>${show.title[state.lang]}</h4>
              <div class="ticket-meta-line">${session.label[state.lang]}</div>
              <div class="ticket-meta-line"><strong>${t("myTickets.seats")}:</strong> ${formatOrderSeats(order)}</div>
              <div class="ticket-meta-line"><strong>${t("myTickets.total")}:</strong> ${formatPrice(order.total)}</div>
              <div class="ticket-actions">
                <button type="button" class="btn btn-primary btn-sm" data-view-ticket="${order.code}">
                  ${t("myTickets.viewQrBtn")}
                </button>
                <button type="button" class="btn btn-outline btn-sm" data-cancel-ticket="${order.code}">
                  ${t("myTickets.cancelBtn")}
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    // Render small QR canvases for each ticket card
    list.forEach((order) => {
      const canvas = grid.querySelector(`canvas[data-ticket-qr="${order.code}"]`);
      if (canvas && QRCode) {
        QRCode.renderToCanvas(canvas, getOrderQrPayload(order), { scale: 3, quiet: 1 });
      }
    });
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
        renderCalendar();
        renderActors();
        renderNews();
        populateBookingSelectors();
        renderSeatMap();
        renderSeatView();
        renderBookingSummary();
        renderMyTickets();
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

    // Team Category Filters
    document.getElementById("teamCategoryFilters").addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-pill[data-team-filter]");
      if (!btn) return;
      state.teamFilter = btn.getAttribute("data-team-filter");
      document.querySelectorAll("#teamCategoryFilters .filter-pill").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      renderActors();
    });

    // Team Search Input
    document.getElementById("teamSearchInput").addEventListener("input", (e) => {
      state.teamSearch = e.target.value;
      renderActors();
    });

    // Team member details modal
    document.getElementById("actorsGrid").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action='member-details']");
      const card = e.target.closest(".actor-card[data-member-id]");
      if (btn) {
        openTeamMemberModal(btn.getAttribute("data-id"));
      } else if (card && !e.target.closest("button")) {
        openTeamMemberModal(card.getAttribute("data-member-id"));
      }
    });

    // Calendar events
    document.getElementById("calendarMonthSwitcher").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-month]");
      if (!btn) return;
      state.calendarMonth = btn.getAttribute("data-month");
      document.querySelectorAll("#calendarMonthSwitcher button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedDate = state.calendarMonth === "2026-11" ? "2026-11-28" : "2026-12-05";
      renderCalendar();
    });

    document.getElementById("calendarDays").addEventListener("click", (e) => {
      const btn = e.target.closest(".cal-day[data-date]");
      if (!btn) return;
      state.selectedDate = btn.getAttribute("data-date");
      renderCalendar();
    });

    document.getElementById("calendarDetail").addEventListener("click", (e) => {
      const bookBtn = e.target.closest("button[data-cal-book]");
      const detBtn = e.target.closest("button[data-cal-details]");
      if (bookBtn) selectShowForBooking(bookBtn.getAttribute("data-cal-book"));
      if (detBtn) openProductionModal(detBtn.getAttribute("data-cal-details"));
    });

    // View from Seat tabs
    document.getElementById("seatViewTabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".sv-tab[data-zone]");
      if (!tab) return;
      state.activeSeatViewZone = tab.getAttribute("data-zone");
      renderSeatView();
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
      const zone = btn.getAttribute("data-zone");
      const existingIdx = state.selectedSeats.findIndex((s) => s.key === key);

      if (existingIdx >= 0) {
        state.selectedSeats.splice(existingIdx, 1);
      } else {
        state.selectedSeats.push({
          key,
          zone,
          zoneKey: btn.getAttribute("data-zone-key"),
          rowLabel: btn.getAttribute("data-row-label"),
          seat: Number(btn.getAttribute("data-seat")),
          price: Number(btn.getAttribute("data-price"))
        });
        state.activeSeatViewZone = zone;
        renderSeatView();
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
      const email = document.getElementById("customerEmail").value.trim();
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

      const total = state.selectedSeats.reduce((sum, s) => sum + s.price, 0);
      const bookingCode = "MQ-" + Math.floor(100000 + Math.random() * 900000);

      const newOrder = {
        code: bookingCode,
        showId: state.selectedShowId,
        sessionId: state.selectedSessionId,
        seats: state.selectedSeats.map((s) => ({ ...s })),
        total,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        createdAt: new Date().toISOString()
      };

      state.orders.unshift(newOrder);
      persistOrders();
      renderMyTickets();

      openTicketQrModal(newOrder, true);

      state.selectedSeats = [];
      e.target.reset();
      renderSeatMap();
      renderBookingSummary();
    });

    // My Tickets Search & Actions
    document.getElementById("ticketSearchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      state.ticketSearchQuery = document.getElementById("ticketSearchInput").value;
      renderMyTickets();
    });

    document.getElementById("ticketShowAllBtn").addEventListener("click", () => {
      state.ticketSearchQuery = "";
      document.getElementById("ticketSearchInput").value = "";
      renderMyTickets();
    });

    document.getElementById("myTicketsGrid").addEventListener("click", (e) => {
      const viewBtn = e.target.closest("button[data-view-ticket]");
      const cancelBtn = e.target.closest("button[data-cancel-ticket]");

      if (viewBtn) {
        const code = viewBtn.getAttribute("data-view-ticket");
        const order = state.orders.find((o) => o.code === code);
        if (order) openTicketQrModal(order, false);
      } else if (cancelBtn) {
        const code = cancelBtn.getAttribute("data-cancel-ticket");
        const order = state.orders.find((o) => o.code === code);
        if (!order) return;

        // Free up seats in bookedBySession
        const sessionSet = state.bookedBySession[order.sessionId];
        if (sessionSet) {
          order.seats.forEach((s) => sessionSet.delete(s.key));
          persistBookings();
        }

        state.orders = state.orders.filter((o) => o.code !== code);
        persistOrders();
        renderSeatMap();
        renderMyTickets();
      }
    });

    // Map tab switching
    const mapTabPills = document.getElementById("mapTabPills");
    if (mapTabPills) {
      const googleExtLinks = { google: "https://maps.app.goo.gl/iPkUKok2j26iauxs9", yandex: "https://yandex.uz/maps/-/CXgR5Bkt" };
      mapTabPills.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-map]");
        if (!btn) return;
        const mapType = btn.getAttribute("data-map");
        document.querySelectorAll("#mapTabPills .filter-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".map-iframe").forEach((f) => f.classList.remove("active"));
        const frame = document.getElementById(mapType + "MapFrame");
        if (frame) frame.classList.add("active");
        const extLink = document.getElementById("mapExtLink");
        if (extLink) extLink.href = googleExtLinks[mapType] || googleExtLinks.google;
      });
    }

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
    renderCalendar();
    renderActors();
    renderNews();
    populateBookingSelectors();
    renderSeatMap();
    renderSeatView();
    renderBookingSummary();
    renderMyTickets();
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
