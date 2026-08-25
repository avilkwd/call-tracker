(() => {
  const STORAGE_KEY = 'callTracker.v1';
  const DAY_NAMES = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
  const DAY_NAMES_FULL = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' };
  const RING_CIRCUMFERENCE = 2 * Math.PI * 88;

  // ---------- state ----------
  function loadState() {
    let s;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    if (!s.goal) s.goal = 100;
    if (!Array.isArray(s.activeDays) || !s.activeDays.length) s.activeDays = [1, 2, 3, 4];
    if (!s.weeks) s.weeks = {};
    if (!Array.isArray(s.celebratedWeeks)) s.celebratedWeeks = [];
    return s;
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  const state = loadState();

  // ---------- date helpers ----------
  function dateOnly(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function startOfWeekMonday(date) {
    const d = dateOnly(date);
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }
  function addDays(date, n) { const d = dateOnly(date); d.setDate(d.getDate() + n); return d; }
  function isoKey(date) {
    const d = dateOnly(date);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function dayDate(monday, isoWeekday) { return addDays(monday, isoWeekday - 1); }
  function isoWeekday(date) { const wd = date.getDay(); return wd === 0 ? 7 : wd; }
  function sameDate(a, b) { return isoKey(a) === isoKey(b); }
  function fmtShort(d) { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

  const today = new Date();
  let viewMonday = startOfWeekMonday(today);
  let viewMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  let viewMode = 'week';

  // ---------- color ----------
  function colorForRatio(r) {
    if (r >= 1) {
      const bonus = Math.min((r - 1) / 0.5, 1);
      const hue = 140 - bonus * 95; // green -> gold
      return `hsl(${hue.toFixed(0)} 85% 55%)`;
    }
    const hue = Math.max(0, r) * 140; // red -> green
    return `hsl(${hue.toFixed(0)} 80% 52%)`;
  }

  // ---------- week data access ----------
  function weekEntries(monday) {
    const key = isoKey(monday);
    if (!state.weeks[key]) state.weeks[key] = {};
    return state.weeks[key];
  }
  function weekTotal(monday) {
    const entries = weekEntries(monday);
    return state.activeDays.reduce((sum, wd) => sum + (Number(entries[wd]) || 0), 0);
  }
  function perDayTarget() { return state.goal / state.activeDays.length; }

  // ---------- rendering ----------
  const els = {
    weekRange: document.getElementById('weekRange'),
    ring: document.getElementById('ringProgress'),
    weekTotal: document.getElementById('weekTotal'),
    weekGoalLabel: document.getElementById('weekGoalLabel'),
    weekPct: document.getElementById('weekPct'),
    hero: document.getElementById('hero'),
    momentumMsg: document.getElementById('momentumMsg'),
    remainingNum: document.getElementById('remainingNum'),
    paceNum: document.getElementById('paceNum'),
    streakNum: document.getElementById('streakNum'),
    days: document.getElementById('days'),
    historyChart: document.getElementById('historyChart'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsBackdrop: document.getElementById('settingsBackdrop'),
    closeSettings: document.getElementById('closeSettings'),
    goalInput: document.getElementById('goalInput'),
    dayToggles: document.getElementById('dayToggles'),
    resetDataBtn: document.getElementById('resetDataBtn'),
    prevWeek: document.getElementById('prevWeek'),
    nextWeek: document.getElementById('nextWeek'),
    thisWeekBtn: document.getElementById('thisWeekBtn'),
    confettiLayer: document.getElementById('confettiLayer'),
    viewToggle: document.getElementById('viewToggle'),
    weekNav: document.getElementById('weekNav'),
    monthNav: document.getElementById('monthNav'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    thisMonthBtn: document.getElementById('thisMonthBtn'),
    monthLabel: document.getElementById('monthLabel'),
    calendarSection: document.getElementById('calendarSection'),
    calendarWeekdays: document.getElementById('calendarWeekdays'),
    calendarGrid: document.getElementById('calendarGrid'),
    historySection: document.getElementById('historySection'),
    weekContent: document.getElementById('weekContent'),
  };

  els.ring.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;

  function momentumMessage(r) {
    if (r <= 0) return "Let's get moving — first call sets the tone.";
    if (r < 0.25) return 'Building momentum…';
    if (r < 0.5) return 'Halfway to unstoppable.';
    if (r < 0.75) return "You're heating up 🔥";
    if (r < 1) return "So close — finish strong!";
    if (r < 1.25) return 'Goal crushed! Nice work. 🎉';
    return 'Way over goal — incredible week! 🚀';
  }

  function computeStreak() {
    // Walk backwards week by week from the current real week.
    let cursor = startOfWeekMonday(today);
    let streak = 0;
    // if this week isn't finished yet and not at goal, don't break streak on it -
    // only count it if it already met goal, otherwise start counting from last week.
    if (weekTotal(cursor) >= state.goal && state.goal > 0) {
      streak++;
      cursor = addDays(cursor, -7);
    } else {
      cursor = addDays(cursor, -7);
    }
    while (true) {
      const key = isoKey(cursor);
      if (!state.weeks[key]) break;
      if (weekTotal(cursor) >= state.goal && state.goal > 0) {
        streak++;
        cursor = addDays(cursor, -7);
      } else break;
    }
    return streak;
  }

  function render() {
    const entries = weekEntries(viewMonday);
    const total = weekTotal(viewMonday);
    const goal = state.goal;
    const ratio = goal > 0 ? total / goal : 0;
    const color = colorForRatio(ratio);

    // week range label
    const days = state.activeDays.slice().sort((a, b) => a - b);
    const first = dayDate(viewMonday, days[0]);
    const last = dayDate(viewMonday, days[days.length - 1]);
    els.weekRange.textContent = `${fmtShort(first)} – ${fmtShort(last)}`;
    els.thisWeekBtn.style.display = sameDate(viewMonday, startOfWeekMonday(today)) ? 'none' : 'inline';

    // ring
    const clampedRatio = Math.min(ratio, 1);
    const offset = RING_CIRCUMFERENCE * (1 - clampedRatio);
    els.ring.style.strokeDashoffset = String(offset);
    els.ring.style.setProperty('--progress-color', color);
    els.ring.style.stroke = color;
    els.weekTotal.textContent = total;
    els.weekGoalLabel.textContent = goal;
    els.weekPct.textContent = `${Math.round(ratio * 100)}%`;

    // hero glow
    if (ratio >= 1) {
      els.hero.classList.add('goal-hit');
      els.hero.style.setProperty('--glow-color', color);
    } else {
      els.hero.classList.remove('goal-hit');
    }
    els.momentumMsg.textContent = momentumMessage(ratio);

    // stats
    const remaining = Math.max(0, goal - total);
    els.remainingNum.textContent = remaining;

    const isCurrentWeek = sameDate(viewMonday, startOfWeekMonday(today));
    let remainingActiveDaysCount;
    if (isCurrentWeek) {
      remainingActiveDaysCount = days.filter(wd => dayDate(viewMonday, wd) >= dateOnly(today)).length;
    } else if (viewMonday > startOfWeekMonday(today)) {
      remainingActiveDaysCount = days.length;
    } else {
      remainingActiveDaysCount = 0;
    }
    const pace = remainingActiveDaysCount > 0 ? Math.ceil(remaining / remainingActiveDaysCount) : (remaining > 0 ? remaining : 0);
    els.paceNum.textContent = remaining === 0 ? '🎉' : pace;

    els.streakNum.textContent = `${computeStreak()}🔥`;

    // day cards
    els.days.innerHTML = '';
    const target = perDayTarget();
    days.forEach(wd => {
      const d = dayDate(viewMonday, wd);
      const count = Number(entries[wd]) || 0;
      const dayRatio = target > 0 ? count / target : 0;
      const dayColor = colorForRatio(dayRatio);

      const card = document.createElement('div');
      card.className = 'day-card';
      if (sameDate(d, today)) card.classList.add('today');
      if (dayRatio >= 1) card.classList.add('hit');
      card.style.setProperty('--card-color', dayColor);

      card.innerHTML = `
        <div class="day-card-head">
          <span class="day-name">${DAY_NAMES[wd]}</span>
          <span class="day-date">${fmtShort(d)}</span>
        </div>
        <div class="day-bar-track"><div class="day-bar-fill" style="width:${Math.min(dayRatio, 1) * 100}%"></div></div>
        <div class="day-count-row">
          <button class="step-btn" data-action="dec" aria-label="Decrease">−</button>
          <input class="day-input" type="number" min="0" inputmode="numeric" value="${count}">
          <button class="step-btn" data-action="inc" aria-label="Increase">+</button>
        </div>
        <div class="day-target">goal ${Math.round(target)}</div>
      `;

      const input = card.querySelector('.day-input');
      const decBtn = card.querySelector('[data-action="dec"]');
      const incBtn = card.querySelector('[data-action="inc"]');

      function setCount(n) {
        n = Math.max(0, Math.round(n) || 0);
        entries[wd] = n;
        saveState();
        checkCelebration(viewMonday);
        render();
      }
      input.addEventListener('change', () => setCount(Number(input.value)));
      decBtn.addEventListener('click', () => setCount(count - 1));
      incBtn.addEventListener('click', () => setCount(count + 1));

      els.days.appendChild(card);
    });

    renderHistory();
    renderCalendar();
  }

  function renderCalendar() {
    const year = viewMonthDate.getFullYear();
    const month = viewMonthDate.getMonth();
    els.monthLabel.textContent = viewMonthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    els.thisMonthBtn.style.display = (year === today.getFullYear() && month === today.getMonth()) ? 'none' : 'inline';

    els.calendarWeekdays.innerHTML = '';
    for (let wd = 1; wd <= 7; wd++) {
      const span = document.createElement('span');
      span.textContent = DAY_NAMES[wd];
      els.calendarWeekdays.appendChild(span);
    }

    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const gridStart = startOfWeekMonday(firstOfMonth);
    const gridEnd = addDays(startOfWeekMonday(lastOfMonth), 6);
    const target = perDayTarget();

    els.calendarGrid.innerHTML = '';
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      const weekMonday = cursor;
      for (let i = 0; i < 7; i++) {
        const d = addDays(cursor, i);
        const wd = isoWeekday(d);
        const isOutside = d.getMonth() !== month;
        const isActive = state.activeDays.includes(wd);
        const entries = weekEntries(startOfWeekMonday(d));
        const count = Number(entries[wd]) || 0;
        const ratio = target > 0 ? count / target : 0;
        const color = colorForRatio(ratio);

        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        if (isOutside) cell.classList.add('outside');
        if (sameDate(d, today)) cell.classList.add('today');
        if (isActive) {
          cell.classList.add('tracked');
          if (ratio >= 1) cell.classList.add('hit');
          cell.style.setProperty('--cell-color', color);
        }
        cell.innerHTML = isActive
          ? `<span class="cal-date">${d.getDate()}</span><span class="cal-count">${count}</span>`
          : `<span class="cal-date">${d.getDate()}</span><span class="cal-dot"></span>`;
        cell.addEventListener('click', () => {
          viewMonday = startOfWeekMonday(d);
          setView('week');
        });
        els.calendarGrid.appendChild(cell);
      }

      const wTotal = weekTotal(weekMonday);
      const wRatio = state.goal > 0 ? wTotal / state.goal : 0;
      const totalRow = document.createElement('div');
      totalRow.className = 'cal-week-total';
      totalRow.innerHTML = `<span class="dot" style="background:${colorForRatio(wRatio)}"></span>${wTotal}/${state.goal}`;
      els.calendarGrid.appendChild(totalRow);

      cursor = addDays(cursor, 7);
    }
  }

  function renderHistory() {
    els.historyChart.innerHTML = '';
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      weeks.push(addDays(viewMonday, -7 * i));
    }
    const goal = state.goal;
    const maxVal = Math.max(goal, ...weeks.map(m => weekTotal(m)), 1);
    weeks.forEach(m => {
      const total = weekTotal(m);
      const ratio = goal > 0 ? total / goal : 0;
      const heightPct = Math.min(100, (total / maxVal) * 100);
      const color = colorForRatio(ratio);
      const wrap = document.createElement('div');
      wrap.className = 'hist-bar-wrap';
      wrap.title = `${fmtShort(m)}: ${total} calls`;
      wrap.innerHTML = `
        <div class="hist-bar" style="height:${Math.max(heightPct, total > 0 ? 4 : 0)}%; --bar-color:${color}"></div>
        <div class="hist-label">${m.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</div>
      `;
      els.historyChart.appendChild(wrap);
    });
  }

  function checkCelebration(monday) {
    const key = isoKey(monday);
    const total = weekTotal(monday);
    if (total >= state.goal && state.goal > 0 && !state.celebratedWeeks.includes(key)) {
      state.celebratedWeeks.push(key);
      saveState();
      fireConfetti();
    }
  }

  function fireConfetti() {
    const colors = ['#4ade80', '#facc15', '#38bdf8', '#f472b6', '#fb923c'];
    const layer = els.confettiLayer;
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 4000);
    }
  }

  // ---------- settings ----------
  function renderSettings() {
    els.goalInput.value = state.goal;
    els.dayToggles.innerHTML = '';
    for (let wd = 1; wd <= 7; wd++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day-toggle' + (state.activeDays.includes(wd) ? ' active' : '');
      btn.textContent = DAY_NAMES[wd];
      btn.title = DAY_NAMES_FULL[wd];
      btn.addEventListener('click', () => {
        if (state.activeDays.includes(wd)) {
          if (state.activeDays.length === 1) return;
          state.activeDays = state.activeDays.filter(d => d !== wd);
        } else {
          state.activeDays.push(wd);
        }
        saveState();
        renderSettings();
        render();
      });
      els.dayToggles.appendChild(btn);
    }
  }

  els.settingsBtn.addEventListener('click', () => {
    renderSettings();
    els.settingsBackdrop.classList.add('open');
  });
  els.closeSettings.addEventListener('click', () => els.settingsBackdrop.classList.remove('open'));
  els.settingsBackdrop.addEventListener('click', e => { if (e.target === els.settingsBackdrop) els.settingsBackdrop.classList.remove('open'); });
  els.goalInput.addEventListener('change', () => {
    const v = Math.max(1, Math.round(Number(els.goalInput.value)) || 1);
    state.goal = v;
    saveState();
    render();
  });
  els.resetDataBtn.addEventListener('click', () => {
    if (confirm('Reset all logged calls? This cannot be undone.')) {
      state.weeks = {};
      state.celebratedWeeks = [];
      saveState();
      render();
    }
  });

  // ---------- week nav ----------
  els.prevWeek.addEventListener('click', () => { viewMonday = addDays(viewMonday, -7); render(); });
  els.nextWeek.addEventListener('click', () => { viewMonday = addDays(viewMonday, 7); render(); });
  els.thisWeekBtn.addEventListener('click', () => { viewMonday = startOfWeekMonday(today); render(); });

  // ---------- month nav ----------
  els.prevMonth.addEventListener('click', () => {
    viewMonthDate = new Date(viewMonthDate.getFullYear(), viewMonthDate.getMonth() - 1, 1);
    render();
  });
  els.nextMonth.addEventListener('click', () => {
    viewMonthDate = new Date(viewMonthDate.getFullYear(), viewMonthDate.getMonth() + 1, 1);
    render();
  });
  els.thisMonthBtn.addEventListener('click', () => {
    viewMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
    render();
  });

  // ---------- view switching ----------
  function setView(mode) {
    viewMode = mode;
    els.viewToggle.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.view === mode));
    const isWeek = mode === 'week';
    els.weekNav.hidden = !isWeek;
    els.monthNav.hidden = isWeek;
    els.weekContent.hidden = !isWeek;
    els.calendarSection.hidden = isWeek;
    render();
  }
  els.viewToggle.addEventListener('click', e => {
    const btn = e.target.closest('.view-toggle-btn');
    if (btn) setView(btn.dataset.view);
  });

  render();
})();
