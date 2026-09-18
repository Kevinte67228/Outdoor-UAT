document.addEventListener('DOMContentLoaded', () => {
  // ===== Lightbox =====
  const overlay = document.getElementById('lightbox-overlay');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');

  document.querySelectorAll('.thumb').forEach(thumb => {
    thumb.addEventListener('click', (e) => {
      const src = e.target.getAttribute('data-full') || e.target.src;
      const caption = e.target.getAttribute('data-caption') || '';
      const rot = parseInt(e.target.getAttribute('data-rotate') || '0', 10);
      window.currentLightboxSourceImg = e.target;
      lightboxImg.src = src;
      lightboxImg.setAttribute('data-rotate', rot);
      lightboxImg.style.transform = rot ? 'rotate(' + rot + 'deg)' : '';
      lightboxCaption.textContent = caption;
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('lightbox-close')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  function closeLightbox() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    lightboxImg.src = '';
    lightboxImg.style.transform = '';
    window.currentLightboxSourceImg = null;
  }

  // ===== Search & Filter =====
  const searchInput = document.getElementById('search-input');
  const countyFilter = document.getElementById('county-filter');
  const typeFilter = document.getElementById('type-filter');
  const monthFilter = document.getElementById('month-filter');
  const bookingFilter = document.getElementById('booking-filter');
  const newFilter = document.getElementById('new-filter');
  const table = document.getElementById('main-table');
  const tbody = table.querySelector('tbody');
  const rows = table.querySelectorAll('tbody tr');

  // Group rows by merged item block (row with store-code)
  const entryGroups = [];

  function buildEntryGroups() {
    entryGroups.length = 0;
    let currentGroup = null;
    const currentRows = table.querySelectorAll('tbody tr');
    currentRows.forEach(row => {
      const storeCodeCell = row.querySelector('.store-code');
      if (storeCodeCell) {
        currentGroup = {
          storeCode: row.dataset.store || storeCodeCell.innerText.trim(),
          storeName: row.dataset.name || (row.querySelector('.store-name') ? row.querySelector('.store-name').innerText.trim() : ''),
          county: row.dataset.county || (row.querySelector('.store-county') ? row.querySelector('.store-county').innerText.trim() : ''),
          address: row.dataset.addr || (row.querySelector('.store-address') ? row.querySelector('.store-address').innerText.trim() : ''),
          type: row.dataset.type || (row.querySelector('.ad-type') ? row.querySelector('.ad-type').innerText.trim() : ''),
          isNew: row.dataset.new || (row.querySelector('.badge-new-col') ? '新增' : ''),
          originalIndex: entryGroups.length,
          rows: [row]
        };
        entryGroups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.rows.push(row);
      }
    });
  }

  window.reindexFilterGroups = function() {
    buildEntryGroups();
    applyFilter();
  };

  buildEntryGroups();

  function applyFilter() {
    const query = searchInput.value.toLowerCase().trim();
    const countyVal = countyFilter ? countyFilter.value : '';
    const typeVal = typeFilter.value;
    const newVal = newFilter ? newFilter.value : '';
    const targetMonth = monthFilter ? monthFilter.value : '';
    const bookingVal = bookingFilter ? bookingFilter.value : '';

    entryGroups.forEach(group => {
      const matchesSearch = !query || 
        group.storeCode.toLowerCase().includes(query) ||
        group.storeName.toLowerCase().includes(query) ||
        group.county.toLowerCase().includes(query) ||
        group.address.toLowerCase().includes(query) ||
        group.rows.some(r => r.textContent.toLowerCase().includes(query));
      
      const matchesCounty = !countyVal || group.county === countyVal;
      const matchesType = !typeVal || group.type === typeVal;
      const matchesNew = !newVal || group.isNew === newVal;

      const matchesBooking = !bookingVal || group.rows.some(r => {
        const cell = r.querySelector('.month-schedule-cell');
        if (!cell) return false;
        let sched = {};
        try { sched = JSON.parse(cell.dataset.schedule || '{}'); } catch(e) {}
        if (targetMonth) {
          const rev = sched[targetMonth] ? (typeof sched[targetMonth] === 'object' ? sched[targetMonth].revenue : sched[targetMonth]) : 0;
          return bookingVal === 'booked' ? (Number(rev) > 0) : (Number(rev) === 0);
        } else {
          let hasBooked = false;
          for (let m = 1; m <= 12; m++) {
            const v = sched[String(m)];
            const rev = (typeof v === 'object' ? v.revenue : v) || 0;
            if (Number(rev) > 0) { hasBooked = true; break; }
          }
          return bookingVal === 'booked' ? hasBooked : !hasBooked;
        }
      });

      const visible = matchesSearch && matchesCounty && matchesType && matchesNew && matchesBooking;

      group.rows.forEach(row => {
        row.classList.toggle('hidden-row', !visible);
      });
    });
  }

  searchInput.addEventListener('input', applyFilter);
  if (countyFilter) countyFilter.addEventListener('change', applyFilter);
  typeFilter.addEventListener('change', applyFilter);
  if (monthFilter) {
    monthFilter.addEventListener('change', () => {
      if (window.refreshAllScheduleCells) window.refreshAllScheduleCells();
      applyFilter();
    });
  }
  if (bookingFilter) bookingFilter.addEventListener('change', applyFilter);
  if (newFilter) newFilter.addEventListener('change', applyFilter);

  // ===== Sorting (Store Code & County) =====
  let currentSort = { field: null, direction: null }; // 'asc' | 'desc' | null

  const sortBtns = document.querySelectorAll('.sort-btn');

  sortBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const field = btn.getAttribute('data-sort');
      
      let newDir = 'asc';
      if (currentSort.field === field) {
        if (currentSort.direction === 'asc') newDir = 'desc';
        else if (currentSort.direction === 'desc') newDir = null;
      }
      
      currentSort = { field: newDir ? field : null, direction: newDir };

      // Update button icons
      sortBtns.forEach(b => {
        b.classList.remove('active');
        b.textContent = '↕';
      });

      if (newDir) {
        btn.classList.add('active');
        btn.textContent = newDir === 'asc' ? '▲' : '▼';
      }

      // Sort entryGroups
      const sorted = [...entryGroups].sort((a, b) => {
        if (!currentSort.direction) {
          return a.originalIndex - b.originalIndex;
        }
        
        let valA = a[currentSort.field] || '';
        let valB = b[currentSort.field] || '';

        // Keep '—' entries at the bottom in ascending order
        if (valA === '—') valA = 'zzz';
        if (valB === '—') valB = 'zzz';

        let cmp = 0;
        if (currentSort.field === 'county') {
          cmp = valA.localeCompare(valB, 'zh-Hant');
          if (cmp === 0) cmp = a.storeCode.localeCompare(b.storeCode);
        } else {
          cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        }

        return currentSort.direction === 'asc' ? cmp : -cmp;
      });

      // Re-attach rows in sorted order to tbody preserving rowspan
      const fragment = document.createDocumentFragment();
      sorted.forEach(group => {
        group.rows.forEach(r => fragment.appendChild(r));
      });
      tbody.appendChild(fragment);
    });
  });

  // ===== Month Schedule Modal & Interactive Handlers =====
  const scheduleModal = document.getElementById('schedule-modal');
  const scheduleModalClose = document.getElementById('schedule-modal-close');
  const scheduleModalCancel = document.getElementById('schedule-modal-cancel');
  const scheduleModalSave = document.getElementById('schedule-modal-save');
  let activeScheduleCell = null;

  function closeScheduleModal() {
    if (scheduleModal) scheduleModal.style.display = 'none';
    activeScheduleCell = null;
  }

  if (scheduleModalClose) scheduleModalClose.addEventListener('click', closeScheduleModal);
  if (scheduleModalCancel) scheduleModalCancel.addEventListener('click', closeScheduleModal);
  if (scheduleModal) {
    scheduleModal.addEventListener('click', (e) => {
      if (e.target === scheduleModal) closeScheduleModal();
    });
  }

  function getActiveFilterMonth() {
    const mf = document.getElementById('month-filter');
    return (mf && mf.value) ? mf.value : '2';
  }

  window.updateScheduleCellUI = function(cell, schedule, targetMonth) {
    if (!cell) return;
    if (typeof schedule === 'string') {
      try { schedule = JSON.parse(schedule || '{}'); } catch(e) { schedule = {}; }
    }
    schedule = schedule || {};
    cell.dataset.schedule = JSON.stringify(schedule);

    const m = targetMonth || getActiveFilterMonth();
    const rev = schedule[m] ? (typeof schedule[m] === 'object' ? schedule[m].revenue : schedule[m]) : 0;
    const isBooked = Number(rev) > 0;
    const isAdmin = document.body.classList.contains('admin-mode');

    const tag = cell.querySelector('.schedule-status-tag');
    if (tag) {
      tag.setAttribute('data-target-m', m);
      if (isAdmin) {
        if (isBooked) {
          tag.className = 'schedule-status-tag status-booked admin-rev';
          tag.innerHTML = `${m}月 💰$${Number(rev).toLocaleString()} <span class="tag-sub">(不開放)</span>`;
          tag.title = `${m}月份已有收益 $${Number(rev).toLocaleString()}，普通用戶看到為「不開放預訂」 (點擊編輯)`;
        } else {
          tag.className = 'schedule-status-tag status-avail';
          tag.innerHTML = `${m}月 🟢 開放預訂`;
          tag.title = `${m}月份開放預訂 (點擊輸入收益)`;
        }
      } else {
        if (isBooked) {
          tag.className = 'schedule-status-tag status-booked';
          tag.innerHTML = `${m}月 🔒 不開放預訂`;
          tag.title = `${m}月份不開放預訂 (點擊檢視明細)`;
        } else {
          tag.className = 'schedule-status-tag status-avail';
          tag.innerHTML = `${m}月 🟢 開放預訂`;
          tag.title = `${m}月份開放預訂 (點擊檢視明細)`;
        }
      }
    }

    cell.querySelectorAll('.m-dot').forEach(dot => {
      const dm = dot.getAttribute('data-m');
      const dRev = schedule[dm] ? (typeof schedule[dm] === 'object' ? schedule[dm].revenue : schedule[dm]) : 0;
      const dBooked = Number(dRev) > 0;
      dot.className = 'm-dot ' + (dBooked ? 'm-booked' : 'm-avail') + (dm === m ? ' m-active' : '');
      if (isAdmin) {
        dot.title = dBooked 
          ? `${dm}月：💰 收益 $${Number(dRev).toLocaleString()} (不開放預訂) - 點擊編輯`
          : `${dm}月：🟢 開放預訂 - 點擊輸入收益`;
      } else {
        dot.title = dBooked 
          ? `${dm}月：🔒 不開放預訂`
          : `${dm}月：🟢 開放預訂`;
      }
    });

    const btn = cell.querySelector('.btn-schedule-action');
    if (btn) {
      btn.innerHTML = isAdmin ? '⚙️ 設定收益' : '📅 1~12月排程';
    }
  };

  window.refreshAllScheduleCells = function() {
    const targetMonth = getActiveFilterMonth();
    document.querySelectorAll('.month-schedule-cell').forEach(cell => {
      let schedule = {};
      try { schedule = JSON.parse(cell.dataset.schedule || '{}'); } catch(e) {}
      window.updateScheduleCellUI(cell, schedule, targetMonth);
    });
  };

  window.openScheduleModal = function(cell, clickedMonth) {
    if (!scheduleModal || !cell) return;
    activeScheduleCell = cell;
    const row = cell.closest('tr');
    const isAdmin = document.body.classList.contains('admin-mode');

    const storeCode = row.dataset.store || (row.querySelector('.store-code') ? row.querySelector('.store-code').innerText.trim() : '');
    const storeName = row.dataset.name || (row.querySelector('.store-name') ? row.querySelector('.store-name').innerText.trim() : '');
    const loc = (row.querySelector('.bb-text') ? row.querySelector('.bb-text').innerText.trim() : '') || cell.dataset.loc || 'A';
    const adType = row.dataset.type || (row.querySelector('.ad-type') ? row.querySelector('.ad-type').innerText.trim() : '');
    const rentalCell = row.querySelector('.rental');
    const baseRental = rentalCell ? rentalCell.innerText.trim() : '—';
    const numRental = parseInt(baseRental.replace(/[^0-9]/g, ''), 10) || 0;

    let schedule = {};
    try { schedule = JSON.parse(cell.dataset.schedule || '{}'); } catch(e) {}

    const titleEl = document.getElementById('schedule-modal-title');
    const storeInfoEl = document.getElementById('schedule-modal-store-info');
    const rentInfoEl = document.getElementById('schedule-modal-rent-info');
    const hintEl = document.getElementById('schedule-role-hint');
    const gridEl = document.getElementById('schedule-months-grid');

    if (titleEl) titleEl.innerHTML = isAdmin ? '⚙️ 管理者設定：各月份收益與預訂排程' : '📅 2026 年度版位預訂與排程明細';
    if (storeInfoEl) storeInfoEl.textContent = `🏪 ${storeCode} ${storeName} · 版位 [${loc}] · ${adType}`;
    if (rentInfoEl) rentInfoEl.textContent = `基準月租金：${baseRental}`;

    if (hintEl) {
      if (isAdmin) {
        hintEl.className = 'schedule-role-hint hint-admin';
        hintEl.innerHTML = '🛡️ <strong>管理者模式</strong>：您可在特定月份輸入收益金額。一旦輸入收益（金額 &gt; 0），普通權限用戶將看到該月份為「<strong>不開放預訂</strong>」（普通用戶無法看到收益金額）。若無收益請設為 0 或清空，即恢復為「開放預訂」。';
      } else {
        hintEl.className = 'schedule-role-hint hint-user';
        hintEl.innerHTML = 'ℹ️ <strong>2026 年度各月份檔期開放狀況表</strong>。標示「不開放預訂」之月份代表已有檔期安排，歡迎預訂其他開放月份。';
      }
    }

    if (scheduleModalSave) {
      scheduleModalSave.style.display = isAdmin ? 'inline-block' : 'none';
    }

    gridEl.innerHTML = '';
    const activeM = clickedMonth || getActiveFilterMonth();

    for (let m = 1; m <= 12; m++) {
      const rev = schedule[String(m)] ? (typeof schedule[String(m)] === 'object' ? schedule[String(m)].revenue : schedule[String(m)]) : 0;
      const isBooked = Number(rev) > 0;

      const card = document.createElement('div');
      card.className = `month-card ${isBooked ? 'is-booked' : 'is-available'} ${String(m) === String(activeM) ? 'month-highlight-2' : ''}`;

      if (isAdmin) {
        card.innerHTML = `
          <div class="month-card-header">
            <span class="month-card-title">${m} 月</span>
            <span class="month-badge-pill ${isBooked ? 'pill-booked' : 'pill-avail'}">${isBooked ? '🔒 不開放預訂' : '🟢 開放預訂'}</span>
          </div>
          <div class="month-card-body">
            <label style="font-size:11px; font-weight:600; color:#475569;">收益金額 (NT$)：</label>
            <div class="month-rev-input-row">
              <input type="number" class="month-rev-input" data-m="${m}" value="${rev > 0 ? rev : ''}" placeholder="0 (開放預訂)" min="0" step="1000">
            </div>
            <div class="month-quick-actions">
              <button type="button" class="btn-card-quick btn-fill-rent" data-m="${m}">帶入租金</button>
              <button type="button" class="btn-card-quick btn-clear" data-m="${m}">清除(開放)</button>
            </div>
          </div>
        `;

        const input = card.querySelector('.month-rev-input');
        const pill = card.querySelector('.month-badge-pill');

        input.addEventListener('input', () => {
          const val = parseInt(input.value.replace(/[^0-9]/g, ''), 10) || 0;
          if (val > 0) {
            pill.className = 'month-badge-pill pill-booked';
            pill.textContent = '🔒 不開放預訂';
            card.classList.remove('is-available');
            card.classList.add('is-booked');
          } else {
            pill.className = 'month-badge-pill pill-avail';
            pill.textContent = '🟢 開放預訂';
            card.classList.remove('is-booked');
            card.classList.add('is-available');
          }
        });

        card.querySelector('.btn-fill-rent').addEventListener('click', () => {
          if (numRental > 0) {
            input.value = numRental;
            pill.className = 'month-badge-pill pill-booked';
            pill.textContent = '🔒 不開放預訂';
            card.classList.remove('is-available');
            card.classList.add('is-booked');
          } else {
            alert('此版位目前未設定基準月租金');
          }
        });

        card.querySelector('.btn-clear').addEventListener('click', () => {
          input.value = '';
          pill.className = 'month-badge-pill pill-avail';
          pill.textContent = '🟢 開放預訂';
          card.classList.remove('is-booked');
          card.classList.add('is-available');
        });
      } else {
        card.innerHTML = `
          <div class="month-card-header">
            <span class="month-card-title">${m} 月</span>
            <span class="month-badge-pill ${isBooked ? 'pill-booked' : 'pill-avail'}">${isBooked ? '🔒 不開放預訂' : '🟢 開放預訂'}</span>
          </div>
          <div class="month-card-body">
            <div class="user-status-text ${isBooked ? 'text-booked' : 'text-avail'}">
              ${isBooked ? '⚠️ 本月檔期已有預訂，不對外開放' : '✅ 本月檔期正常開放預訂中'}
            </div>
          </div>
        `;
      }

      gridEl.appendChild(card);
    }

    scheduleModal.style.display = 'flex';
  };

  if (scheduleModalSave) {
    scheduleModalSave.addEventListener('click', () => {
      if (!activeScheduleCell) return;
      const inputs = scheduleModal.querySelectorAll('.month-rev-input');
      const newSchedule = {};
      inputs.forEach(inp => {
        const m = inp.dataset.m;
        const val = parseInt(inp.value.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(val) && val > 0) {
          newSchedule[m] = val;
        }
      });

      activeScheduleCell.dataset.schedule = JSON.stringify(newSchedule);
      window.updateScheduleCellUI(activeScheduleCell, newSchedule, getActiveFilterMonth());
      closeScheduleModal();

      if (window.triggerAutoSave) window.triggerAutoSave();
      if (window.showToast) window.showToast('✅ 已成功儲存版位月份收益與預訂排程！', 'success');
      if (window.reindexFilterGroups) window.reindexFilterGroups();
    });
  }

  table.addEventListener('click', (e) => {
    const cell = e.target.closest('.month-schedule-cell');
    if (!cell) return;

    const dot = e.target.closest('.m-dot');
    const tag = e.target.closest('.schedule-status-tag');
    const btn = e.target.closest('.btn-schedule-action');

    if (dot) {
      e.stopPropagation();
      const clickedM = dot.getAttribute('data-m');
      window.openScheduleModal(cell, clickedM);
      return;
    }

    if (tag || btn) {
      e.stopPropagation();
      const targetM = tag ? tag.getAttribute('data-target-m') : getActiveFilterMonth();
      window.openScheduleModal(cell, targetM);
      return;
    }
  });

  // Initial UI refresh for all schedule cells
  window.refreshAllScheduleCells();
});

