(() => {
  "use strict";

  const TZ = "Asia/Tokyo";
  const CATEGORY_ORDER = ["👻活動", "🏡住宿", "🚗移動", "🛒購物", "🍎超市", "🏪便利商店", "🥯早餐", "🍴美食", "🏛️博物館", "☕咖啡廳", "📍景點", "⛩️神社", "🍰點心"];
  const state = {
    data: null,
    viewer: localStorage.getItem("viewer") || "我",
    dayIndex: 0,
    dates: [],
    candFilters: { q: "", city: "全部", cats: new Set(), interests: new Set() },
  };

  function sortCategories(cats) {
    return [...cats].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
  }

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function japanNow() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  }

  function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function weekdayLabel(dateStr) {
    const wd = ["日", "一", "二", "三", "四", "五", "六"];
    const d = new Date(dateStr + "T00:00:00+09:00");
    return `星期${wd[d.getDay()]}`;
  }

  function shortDateLabel(dateStr) {
    const [y, m, day] = dateStr.split("-");
    return `${parseInt(m, 10)}/${parseInt(day, 10)}`;
  }

  function extractPhone(detail) {
    const m = detail.match(/電話(?:號碼)?[:：]\s*([0-9+\-() ]{7,})/);
    return m ? m[1].trim() : null;
  }

  function firstGlanceLine(detail) {
    const lines = detail.split("\n").map((l) => l.trim()).filter(Boolean);
    const hours = lines.find((l) => /^(營業時間|開館時間)/.test(l));
    return hours || lines[0] || "";
  }

  // ---------- boot ----------
  async function boot() {
    try {
      const res = await fetch("data.json", { cache: "no-cache" });
      state.data = await res.json();
    } catch (e) {
      $("#timeline-list").innerHTML = `<div class="empty-note">資料載入失敗，請確認網路連線後重新整理一次（之後離線就能開了）。</div>`;
      return;
    }
    state.dates = Object.keys(state.data.timeline).sort();
    state.dayIndex = pickInitialDayIndex();
    setViewer(state.viewer, false);
    renderTripStatus();
    renderDay();
    renderCandidateChips();
    renderCandidates();
    bindEvents();
    registerSW();
  }

  function accommodationForDate(dateStr) {
    const list = state.data.accommodations || [];
    // dateEnd是退房日：換宿日（前一間退房=後一間入住）要指向「當晚要住」的那間，
    // 所以區間用 start <= date < end；最後一天（純退房、當晚不住）退回end==date的那間
    return list.find((a) => dateStr >= a.dateStart && dateStr < a.dateEnd)
        || list.find((a) => dateStr === a.dateEnd)
        || null;
  }

  function pickInitialDayIndex() {
    const today = fmtDate(japanNow());
    const idx = state.dates.indexOf(today);
    if (idx !== -1) return idx;
    if (today < state.dates[0]) return 0;
    return state.dates.length - 1;
  }

  function renderTripStatus() {
    const today = fmtDate(japanNow());
    const el = $("#trip-status");
    if (today < state.dates[0]) {
      el.style.display = "";
      el.textContent = `旅程還沒開始，這是第一天的行程（出發日 ${shortDateLabel(state.dates[0])}）`;
    } else if (today > state.dates[state.dates.length - 1]) {
      el.style.display = "";
      el.textContent = "旅程已經結束了，這是最後一天的行程";
    } else {
      el.style.display = "none";
    }
  }

  // ---------- viewer switch ----------
  function setViewer(v, rerender = true) {
    state.viewer = v;
    localStorage.setItem("viewer", v);
    $$(".viewer-switch button").forEach((b) => b.classList.toggle("active", b.dataset.viewer === v));
    if (rerender) renderDay();
  }

  // ---------- timeline ----------
  function renderDay() {
    const dateStr = state.dates[state.dayIndex];
    $("#day-date").textContent = `${shortDateLabel(dateStr)}（${weekdayLabel(dateStr)}）`;
    $("#day-weekday").textContent = dateStr;
    $("#day-prev").disabled = state.dayIndex === 0;
    $("#day-next").disabled = state.dayIndex === state.dates.length - 1;

    const items = (state.data.timeline[dateStr] || []).filter(
      (it) => it.type !== "item" || !it.viewerOnly || it.viewerOnly === "me" && state.viewer === "我"
    );

    const nowJST = japanNow();
    const isToday = fmtDate(nowJST) === dateStr;
    const nowHM = isToday ? `${String(nowJST.getHours()).padStart(2, "0")}:${String(nowJST.getMinutes()).padStart(2, "0")}` : null;

    // find "current" item: last item whose time <= now
    let nowId = null;
    if (isToday) {
      const timed = items.filter((it) => it.type === "item" && it.time);
      for (const it of timed) {
        if (it.time <= nowHM) nowId = it.id;
        else break;
      }
    }

    const list = $("#timeline-list");
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-note">這天還沒有排定的固定行程。</div>`;
      return;
    }

    list.innerHTML = items.map((it) => {
      if (it.type === "free") {
        return `<button class="free-card" data-open-candidates="1">
          <span class="label">🕊️ ${escapeHtml(it.label)}</span>
          <span class="go">打開候選清單</span>
        </button>`;
      }
      const isNow = it.id === nowId;
      return `<button class="item-card ${isNow ? "now" : ""}" data-item-id="${it.id}">
        <span class="time">${it.time || "—"}</span>
        <span class="cat">${(it.categories || []).join("")}</span>
        <span class="body">
          ${isNow ? '<span class="now-badge">現在</span><br>' : ""}
          <span class="name">${escapeHtml(stripCategoryPrefix(it.name))}</span>
          <div class="glance">${escapeHtml(firstGlanceLine(it.detail || ""))}</div>
        </span>
      </button>`;
    }).join("");
  }

  function stripCategoryPrefix(name) {
    const s = name || "";
    const stripped = s.replace(/^《[^》]*》/, "");
    // 括號內若就是店名本身（去掉後沒剩文字），不要砍，否則名稱會變空白
    return stripped.trim() ? stripped : s;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function findItemById(id) {
    for (const d of state.dates) {
      const hit = (state.data.timeline[d] || []).find((it) => it.type === "item" && it.id === id);
      if (hit) return hit;
    }
    return state.data.candidates.find((c) => c.id === id) || null;
  }

  // ---------- detail sheet ----------
  function openSheet(item) {
    $("#sheet-name").textContent = stripCategoryPrefix(item.name);
    $("#sheet-cat").textContent = [(item.categories || []).join(" "), item.city].filter(Boolean).join(" ・ ");
    $("#sheet-detail").textContent = item.detail || "";
    const phone = extractPhone(item.detail || "");
    if (phone) {
      $("#sheet-phone").style.display = "";
      $("#sheet-phone-num").textContent = phone;
    } else {
      $("#sheet-phone").style.display = "none";
    }
    const mapBtn = $("#sheet-map");
    if (item.map) {
      mapBtn.style.display = "";
      mapBtn.href = item.map;
    } else {
      mapBtn.style.display = "none";
    }
    $("#sheet-attachments").innerHTML = (item.attachments || []).map((a) =>
      `<a class="map-btn confirm" href="${escapeHtml(a.file)}" target="_blank" rel="noopener">📄 ${escapeHtml(a.label)}</a>`
    ).join("");
    const confirmBtn = $("#sheet-confirm");
    if (item.bookingConfirmationUrl) {
      confirmBtn.style.display = "";
      confirmBtn.href = item.bookingConfirmationUrl;
    } else {
      confirmBtn.style.display = "none";
    }
    $("#sheet-backdrop").classList.remove("hidden");
  }
  function closeSheet() {
    $("#sheet-backdrop").classList.add("hidden");
  }

  // ---------- candidates ----------
  function renderCandidateChips() {
    const allInterests = new Set();
    state.data.candidates.forEach((c) => (c.interests || []).forEach((i) => allInterests.add(i)));
    const interestWrap = $("#cand-interest-wrap");
    if (allInterests.size > 0) {
      interestWrap.style.display = "";
      $("#cand-interest-chips").innerHTML = Array.from(allInterests).map((i) =>
        `<button class="chip interest ${state.candFilters.interests.has(i) ? "active" : ""}" data-interest="${escapeHtml(i)}">${escapeHtml(i)}</button>`
      ).join("");
    } else {
      interestWrap.style.display = "none";
    }

    const cities = ["全部", ...Array.from(new Set(state.data.candidates.map((c) => c.city).filter(Boolean)))];
    $("#cand-city-chips").innerHTML = cities.map((c) =>
      `<button class="chip ${c === state.candFilters.city ? "active" : ""}" data-city="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    ).join("");

    const allCats = new Set();
    state.data.candidates.forEach((c) => (c.categories || []).forEach((cc) => allCats.add(cc)));
    $("#cand-cat-chips").innerHTML = sortCategories(allCats).map((c) =>
      `<button class="chip ${state.candFilters.cats.has(c) ? "active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    ).join("");
  }

  function renderCandidates() {
    const { q, city, cats, interests } = state.candFilters;
    const ql = q.trim().toLowerCase();
    const filtered = state.data.candidates.filter((c) => {
      if (city !== "全部" && c.city !== city) return false;
      if (cats.size > 0 && !(c.categories || []).some((cc) => cats.has(cc))) return false;
      if (interests.size > 0 && !(c.interests || []).some((ii) => interests.has(ii))) return false;
      if (ql && !(`${c.name} ${c.detail}`.toLowerCase().includes(ql))) return false;
      return true;
    });
    $("#cand-count").textContent = `${filtered.length} 個地點`;
    $("#candidate-list").innerHTML = filtered.map((c) => `
      <button class="cand-card" data-item-id="${c.id}">
        <span class="cat">${(c.categories || []).join("")}</span>
        <span class="body">
          <span class="name">${escapeHtml(stripCategoryPrefix(c.name))}</span>
          <div class="city">${escapeHtml(c.city || "")} ・ ${escapeHtml(firstGlanceLine(c.detail || ""))}</div>
        </span>
      </button>
    `).join("");
  }

  // ---------- events ----------
  function bindEvents() {
    $$(".viewer-switch button").forEach((b) => b.addEventListener("click", () => setViewer(b.dataset.viewer)));

    $("#day-prev").addEventListener("click", () => { if (state.dayIndex > 0) { state.dayIndex--; renderDay(); } });
    $("#day-next").addEventListener("click", () => { if (state.dayIndex < state.dates.length - 1) { state.dayIndex++; renderDay(); } });

    $("#timeline-list").addEventListener("click", (e) => {
      const freeBtn = e.target.closest("[data-open-candidates]");
      if (freeBtn) { switchScreen("screen-candidates"); return; }
      const card = e.target.closest("[data-item-id]");
      if (card) { const item = findItemById(card.dataset.itemId); if (item) openSheet(item); }
    });

    $("#candidate-list").addEventListener("click", (e) => {
      const card = e.target.closest("[data-item-id]");
      if (card) { const item = findItemById(card.dataset.itemId); if (item) openSheet(item); }
    });

    $("#sheet-close").addEventListener("click", closeSheet);
    $("#sheet-backdrop").addEventListener("click", (e) => { if (e.target.id === "sheet-backdrop") closeSheet(); });

    $("#cand-search").addEventListener("input", (e) => { state.candFilters.q = e.target.value; renderCandidates(); });

    $("#cand-city-chips").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip"); if (!chip) return;
      state.candFilters.city = chip.dataset.city;
      renderCandidateChips();
      renderCandidates();
    });

    $("#cand-interest-chips").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip"); if (!chip) return;
      const interest = chip.dataset.interest;
      if (state.candFilters.interests.has(interest)) state.candFilters.interests.delete(interest);
      else state.candFilters.interests.add(interest);
      chip.classList.toggle("active");
      renderCandidates();
    });

    $("#cand-cat-chips").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip"); if (!chip) return;
      const cat = chip.dataset.cat;
      if (state.candFilters.cats.has(cat)) state.candFilters.cats.delete(cat);
      else state.candFilters.cats.add(cat);
      chip.classList.toggle("active");
      renderCandidates();
    });

    $$("nav.tabbar button").forEach((b) => b.addEventListener("click", () => switchScreen(b.dataset.screen)));

    $("#hotel-fab").addEventListener("click", () => {
      const timelineActive = $("#screen-timeline").classList.contains("active");
      const refDate = timelineActive ? state.dates[state.dayIndex] : fmtDate(japanNow());
      const acc = accommodationForDate(refDate) || (state.data.accommodations || [])[0];
      if (acc) openSheet(acc);
    });
  }

  function switchScreen(id) {
    $$(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    $$("nav.tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.screen === id));
  }

  function registerSW() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  boot();
})();
