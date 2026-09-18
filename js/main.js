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

  // Helper: check if a month slot is booked
  function checkIsBooked(mData) {
    if (!mData) return false;
    if (typeof mData === 'number') return mData > 0;
    if (typeof mData === 'boolean') return mData;
    if (typeof mData === 'object') {
      if (mData.booked === true || mData.booked === 'true') return true;
      if (mData.booked === false || mData.booked === 'false') return false;
      return (Number(mData.revenue) > 0) || Boolean(mData.tenant && mData.tenant.trim());
    }
    return false;
  }
  window.checkIsBooked = checkIsBooked;

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
          const isB = checkIsBooked(sched[targetMonth]);
          return bookingVal === 'booked' ? isB : !isB;
        } else {
          let hasBooked = false;
          for (let m = 1; m <= 12; m++) {
            if (checkIsBooked(sched[String(m)])) { hasBooked = true; break; }
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

  // ===== Month Schedule Helpers & Globals =====
  window.formatMonthRanges = function(months) {
    if (!months || months.length === 0) return '';
    const sorted = [...months].map(Number).sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let prev = start;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
      } else {
        ranges.push(start === prev ? `${start}月` : `${start}~${prev}月`);
        start = sorted[i];
        prev = start;
      }
    }
    ranges.push(start === prev ? `${start}月` : `${start}~${prev}月`);
    return ranges.join(', ');
  };

  const scheduleModal = document.getElementById('schedule-modal');
  const scheduleModalClose = document.getElementById('schedule-modal-close');
  const scheduleModalCancel = document.getElementById('schedule-modal-cancel');
  const scheduleModalSave = document.getElementById('schedule-modal-save');
  let activeScheduleCell = null;

  window.closeMonthScheduleModal = function() {
    const modal = document.getElementById('schedule-modal');
    if (modal) modal.style.display = 'none';
    activeScheduleCell = null;
  };
  window.closeScheduleModal = window.closeMonthScheduleModal;

  if (scheduleModalClose) scheduleModalClose.addEventListener('click', window.closeMonthScheduleModal);
  if (scheduleModalCancel) scheduleModalCancel.addEventListener('click', window.closeMonthScheduleModal);
  if (scheduleModal) {
    scheduleModal.addEventListener('click', (e) => {
      if (e.target === scheduleModal) window.closeMonthScheduleModal();
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

    const isAdmin = document.body.classList.contains('admin-mode');

    // Clean up summary header if present
    const sumHeader = cell.querySelector('.schedule-summary-header');
    if (sumHeader) sumHeader.remove();

    // Pills (Retain exactly this 12-month block)
    cell.querySelectorAll('.m-pill').forEach(pill => {
      const dm = parseInt(pill.getAttribute('data-m'), 10);
      const mData = schedule[String(dm)];
      const rev = mData ? (typeof mData === 'object' ? mData.revenue : mData) : 0;
      const tenant = (mData && typeof mData === 'object' && mData.tenant) ? mData.tenant : '';
      const isBooked = checkIsBooked(mData);

      pill.className = 'm-pill ' + (isBooked ? 'm-pill-booked' : 'm-pill-avail');
      pill.innerHTML = isBooked ? `${dm}月<span class="m-lock">🔒</span>` : `${dm}月`;

      if (isAdmin) {
        const tenantInfo = tenant ? ` (${tenant})` : '';
        const revInfo = Number(rev) > 0 ? ` · 💰 $${Number(rev).toLocaleString()}` : '';
        pill.title = isBooked 
          ? `${dm}月：🔒 不開放預訂${revInfo}${tenantInfo} - 點擊編輯` 
          : `${dm}月：🟢 開放預訂 - 點擊設定預訂、收益與廠商`;
      } else {
        pill.title = isBooked ? `${dm}月：🔒 不開放預訂` : `${dm}月：🟢 開放預訂`;
      }
    });

    // Admin action button: Ensure it exists and is controlled properly
    let actionBtn = cell.querySelector('.btn-schedule-action');
    if (isAdmin) {
      if (!actionBtn) {
        actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'btn-schedule-action';
        actionBtn.title = '管理各月份預訂排程、收益與承租廠商';
        actionBtn.textContent = '⚙️ 管理預訂/收益/廠商';
        actionBtn.onclick = function(e) {
          e.stopPropagation();
          window.openMonthScheduleModal(cell);
        };
        const wrapper = cell.querySelector('.schedule-cell-wrapper') || cell;
        wrapper.appendChild(actionBtn);
      }
      actionBtn.style.display = 'block';
    } else {
      if (actionBtn) actionBtn.style.display = 'none';
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

  window.promptAdminLoginFromModal = function() {
    const pwd = window.prompt('請輸入管理者密碼：');
    if (pwd === null) return;
    if (pwd.trim() === '291') {
      if (window.enableAdminMode) {
        window.enableAdminMode(true);
      } else {
        document.body.classList.add('admin-mode');
        sessionStorage.setItem('outdoor_admin_auth', 'true');
        if (window.refreshAllScheduleCells) window.refreshAllScheduleCells();
      }
      if (activeScheduleCell) {
        window.openMonthScheduleModal(activeScheduleCell);
      }
    } else {
      alert('⚠️ 密碼錯誤，請重新輸入');
    }
  };

  window.openMonthScheduleModal = function(el, clickedMonth) {
    const modal = document.getElementById('schedule-modal');
    if (!modal || !el) return;
    const cell = el.classList && el.classList.contains('month-schedule-cell') ? el : el.closest('.month-schedule-cell');
    if (!cell) return;

    activeScheduleCell = cell;
    const row = cell.closest('tr');
    const isAdmin = document.body.classList.contains('admin-mode');

    const storeCode = (row && (row.dataset.store || (row.querySelector('.store-code') ? row.querySelector('.store-code').innerText.trim() : ''))) || cell.dataset.store || '';
    const storeName = (row && (row.dataset.name || (row.querySelector('.store-name') ? row.querySelector('.store-name').innerText.trim() : ''))) || '';
    const loc = (row && row.querySelector('.bb-text') ? row.querySelector('.bb-text').innerText.trim() : '') || cell.dataset.loc || 'A';
    const adType = (row && (row.dataset.type || (row.querySelector('.ad-type') ? row.querySelector('.ad-type').innerText.trim() : ''))) || '';
    const rentalCell = row ? row.querySelector('.rental') : null;
    const baseRental = rentalCell ? rentalCell.innerText.trim() : '—';
    const numRental = parseInt(baseRental.replace(/[^0-9]/g, ''), 10) || 0;

    let schedule = {};
    try { schedule = JSON.parse(cell.dataset.schedule || '{}'); } catch(e) {}

    const titleEl = document.getElementById('schedule-modal-title');
    const storeInfoEl = document.getElementById('schedule-modal-store-info');
    const rentInfoEl = document.getElementById('schedule-modal-rent-info');
    const hintEl = document.getElementById('schedule-role-hint');
    const gridEl = document.getElementById('schedule-months-grid');
    const saveBtn = document.getElementById('schedule-modal-save');
    const batchPanel = document.getElementById('schedule-batch-panel');
    const adminSwitchBtn = document.getElementById('btn-modal-switch-admin');

    if (titleEl) titleEl.innerHTML = isAdmin ? '⚙️ 管理者設定：各月份預訂排程、收益與承租廠商' : '📅 2026 年度版位預訂與排程明細';
    if (storeInfoEl) storeInfoEl.textContent = `🏪 ${storeCode} ${storeName} · 版位 [${loc}] · ${adType}`;
    if (rentInfoEl) {
      rentInfoEl.style.display = isAdmin ? 'inline-block' : 'none';
      if (isAdmin) rentInfoEl.textContent = `基準月租金：${baseRental}`;
    }

    if (adminSwitchBtn) {
      adminSwitchBtn.style.display = isAdmin ? 'none' : 'inline-block';
    }

    if (hintEl) {
      if (isAdmin) {
        hintEl.className = 'schedule-role-hint hint-admin';
        hintEl.innerHTML = '🛡️ <strong>管理者模式</strong>：您可針對各月份直接設定「預訂狀態」、輸入「收益金額」與「承租廠商」（承租人與金額只有管理者可見）。若有單一廠商承租多月份（如半年、全年），可利用下方<strong>「⚡ 快速連續月份承租設定」</strong>工具一鍵套用！';
      } else {
        hintEl.className = 'schedule-role-hint hint-user';
        hintEl.innerHTML = 'ℹ️ <strong>2026 年度各月份檔期開放狀況表</strong>。標示「🔒 不開放預訂」之月份代表已有檔期安排，標示「🟢 開放預訂」之月份歡迎安排預訂。';
      }
    }

    if (saveBtn) {
      saveBtn.style.display = isAdmin ? 'inline-block' : 'none';
      saveBtn.textContent = '💾 儲存預訂與收益設定';
    }

    if (batchPanel) {
      batchPanel.style.display = isAdmin ? 'block' : 'none';
      if (isAdmin) {
        const batchTenantInput = document.getElementById('batch-tenant-input');
        const batchRevInput = document.getElementById('batch-rev-input');
        const batchStartSelect = document.getElementById('batch-start-month');
        const batchEndSelect = document.getElementById('batch-end-month');
        const batchStatusSelect = document.getElementById('batch-status-select');
        if (batchTenantInput) batchTenantInput.value = '';
        if (batchRevInput) batchRevInput.value = numRental > 0 ? numRental : '';
        if (batchStartSelect) batchStartSelect.value = '1';
        if (batchEndSelect) batchEndSelect.value = '6';
        if (batchStatusSelect) batchStatusSelect.value = 'booked';
        batchPanel.querySelectorAll('.batch-preset-btn').forEach(b => b.classList.remove('active'));
        const halfYearBtn = batchPanel.querySelector('.batch-preset-btn[data-start="1"][data-end="6"]');
        if (halfYearBtn) halfYearBtn.classList.add('active');
      }
    }

    gridEl.innerHTML = '';
    const activeM = clickedMonth || getActiveFilterMonth();

    for (let m = 1; m <= 12; m++) {
      const mData = schedule[String(m)];
      const rev = mData ? (typeof mData === 'object' ? mData.revenue : mData) : 0;
      const tenant = (mData && typeof mData === 'object' && mData.tenant) ? mData.tenant : '';
      const isBooked = checkIsBooked(mData);

      const card = document.createElement('div');
      card.setAttribute('data-card-m', m);

      if (isAdmin) {
        card.className = `month-card ${isBooked ? 'is-booked' : 'is-available'} ${String(m) === String(activeM) ? 'month-highlight-2' : ''}`;
        card.innerHTML = `
          <div class="month-card-header">
            <span class="month-card-title">${m} 月</span>
            <span class="month-badge-pill ${isBooked ? 'pill-booked' : 'pill-avail'}">${isBooked ? '🔒 不開放預訂' : '🟢 開放預訂'}</span>
          </div>
          <div class="month-card-body">
            <div class="status-toggle-group">
              <button type="button" class="status-toggle-btn btn-status-avail ${!isBooked ? 'active-avail' : ''}" data-m="${m}">🟢 開放預訂</button>
              <button type="button" class="status-toggle-btn btn-status-booked ${isBooked ? 'active-booked' : ''}" data-m="${m}">🔒 不開放預訂</button>
            </div>
            <label style="font-size:11px; font-weight:600; color:#475569;">收益金額 (NT$)：</label>
            <div class="month-rev-input-row">
              <input type="number" class="month-rev-input" data-m="${m}" value="${rev > 0 ? rev : ''}" placeholder="0 (無收益/未設定)" min="0" step="1000">
            </div>
            <label style="font-size:11px; font-weight:600; color:#475569; margin-top:2px;">承租廠商 / 客戶備註 (僅管理者可見)：</label>
            <div class="month-tenant-row">
              <input type="text" class="month-tenant-input" data-m="${m}" value="${tenant ? tenant.replace(/"/g, '&quot;') : ''}" placeholder="承租客戶/廠商名稱">
            </div>
            <div class="month-quick-actions">
              <button type="button" class="btn-card-quick btn-fill-rent" data-m="${m}">帶入租金</button>
              <button type="button" class="btn-card-quick btn-clear" data-m="${m}">清空重設</button>
            </div>
          </div>
        `;

        const revInput = card.querySelector('.month-rev-input');
        const tenantInput = card.querySelector('.month-tenant-input');
        const pill = card.querySelector('.month-badge-pill');
        const btnAvail = card.querySelector('.btn-status-avail');
        const btnBooked = card.querySelector('.btn-status-booked');

        function setCardState(booked) {
          if (booked) {
            pill.className = 'month-badge-pill pill-booked';
            pill.textContent = '🔒 不開放預訂';
            card.classList.remove('is-available');
            card.classList.add('is-booked');
            if (btnAvail) btnAvail.classList.remove('active-avail');
            if (btnBooked) btnBooked.classList.add('active-booked');
          } else {
            pill.className = 'month-badge-pill pill-avail';
            pill.textContent = '🟢 開放預訂';
            card.classList.remove('is-booked');
            card.classList.add('is-available');
            if (btnBooked) btnBooked.classList.remove('active-booked');
            if (btnAvail) btnAvail.classList.add('active-avail');
          }
        }

        btnAvail.addEventListener('click', () => {
          setCardState(false);
        });

        btnBooked.addEventListener('click', () => {
          setCardState(true);
        });

        revInput.addEventListener('input', () => {
          const val = parseInt(revInput.value.replace(/[^0-9]/g, ''), 10) || 0;
          if (val > 0) setCardState(true);
        });

        tenantInput.addEventListener('input', () => {
          const tVal = tenantInput.value.trim();
          if (tVal) setCardState(true);
        });

        card.querySelector('.btn-fill-rent').addEventListener('click', () => {
          if (numRental > 0) {
            revInput.value = numRental;
            setCardState(true);
          } else {
            alert('此版位目前未設定基準月租金');
          }
        });

        card.querySelector('.btn-clear').addEventListener('click', () => {
          revInput.value = '';
          tenantInput.value = '';
          setCardState(false);
        });
      } else {
        // Visitor View: Clean card only displaying month & open/booked badge
        card.className = `month-card visitor-month-card ${isBooked ? 'is-booked' : 'is-available'} ${String(m) === String(activeM) ? 'month-highlight-2' : ''}`;
        card.innerHTML = `
          <div class="month-card-header">
            <span class="month-card-title">${m} 月</span>
            <span class="month-badge-pill ${isBooked ? 'pill-booked' : 'pill-avail'}">${isBooked ? '🔒 不開放預訂' : '🟢 開放預訂'}</span>
          </div>
        `;
      }

      gridEl.appendChild(card);
    }

    modal.style.display = 'flex';
  };
  window.openScheduleModal = window.openMonthScheduleModal;

  window.saveMonthScheduleModal = function() {
    const modal = document.getElementById('schedule-modal');
    if (!activeScheduleCell || !modal) return;
    const cards = modal.querySelectorAll('.month-card');
    const newSchedule = {};
    cards.forEach(card => {
      const revInput = card.querySelector('.month-rev-input');
      const tenantInput = card.querySelector('.month-tenant-input');
      if (!revInput) return;
      const m = revInput.dataset.m;
      const val = parseInt(revInput.value.replace(/[^0-9]/g, ''), 10) || 0;
      const tenant = tenantInput ? tenantInput.value.trim() : '';
      const isBooked = card.classList.contains('is-booked');

      if (isBooked || val > 0 || tenant) {
        newSchedule[m] = {
          booked: isBooked,
          revenue: val,
          tenant: tenant
        };
      }
    });

    activeScheduleCell.dataset.schedule = JSON.stringify(newSchedule);
    window.updateScheduleCellUI(activeScheduleCell, newSchedule);
    window.closeMonthScheduleModal();

    if (window.triggerAutoSave) window.triggerAutoSave();
    if (window.showToast) window.showToast('✅ 已成功儲存各月預訂狀態、收益與承租廠商！', 'success');
    if (window.reindexFilterGroups) window.reindexFilterGroups();
  };

  // Batch panel event bindings (One-time binding)
  const batchPanelInit = document.getElementById('schedule-batch-panel');
  if (batchPanelInit) {
    batchPanelInit.querySelectorAll('.batch-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        batchPanelInit.querySelectorAll('.batch-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const startM = btn.getAttribute('data-start');
        const endM = btn.getAttribute('data-end');
        const startSelect = document.getElementById('batch-start-month');
        const endSelect = document.getElementById('batch-end-month');
        if (startSelect) startSelect.value = startM;
        if (endSelect) endSelect.value = endM;
      });
    });

    const btnApply = document.getElementById('btn-batch-apply');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        const startSelect = document.getElementById('batch-start-month');
        const endSelect = document.getElementById('batch-end-month');
        const startM = parseInt(startSelect ? startSelect.value : '1', 10);
        const endM = parseInt(endSelect ? endSelect.value : '12', 10);
        const minM = Math.min(startM, endM);
        const maxM = Math.max(startM, endM);

        const statusSelect = document.getElementById('batch-status-select');
        const isTargetBooked = statusSelect ? (statusSelect.value !== 'avail') : true;

        const batchTenant = (document.getElementById('batch-tenant-input') ? document.getElementById('batch-tenant-input').value.trim() : '');
        const batchRevRaw = (document.getElementById('batch-rev-input') ? document.getElementById('batch-rev-input').value : '');
        const batchRev = parseInt(batchRevRaw.replace(/[^0-9]/g, ''), 10) || 0;

        for (let m = minM; m <= maxM; m++) {
          const card = document.querySelector(`.month-card[data-card-m="${m}"]`);
          if (card) {
            const revInput = card.querySelector('.month-rev-input');
            const tenantInput = card.querySelector('.month-tenant-input');
            const pill = card.querySelector('.month-badge-pill');
            const btnAvail = card.querySelector('.btn-status-avail');
            const btnBooked = card.querySelector('.btn-status-booked');

            if (isTargetBooked) {
              if (revInput) revInput.value = batchRev > 0 ? batchRev : (revInput.value || '');
              if (tenantInput) tenantInput.value = batchTenant || tenantInput.value;
              if (pill) {
                pill.className = 'month-badge-pill pill-booked';
                pill.textContent = '🔒 不開放預訂';
              }
              card.classList.remove('is-available');
              card.classList.add('is-booked');
              if (btnAvail) btnAvail.classList.remove('active-avail');
              if (btnBooked) btnBooked.classList.add('active-booked');
            } else {
              if (revInput) revInput.value = '';
              if (tenantInput) tenantInput.value = '';
              if (pill) {
                pill.className = 'month-badge-pill pill-avail';
                pill.textContent = '🟢 開放預訂';
              }
              card.classList.remove('is-booked');
              card.classList.add('is-available');
              if (btnBooked) btnBooked.classList.remove('active-booked');
              if (btnAvail) btnAvail.classList.add('active-avail');
            }
          }
        }

        const count = maxM - minM + 1;
        const statusText = isTargetBooked ? '不開放預訂 (已承租)' : '開放預訂';
        if (window.showToast) {
          window.showToast(`⚡ 已成功批次設定 ${minM}~${maxM} 月 (共 ${count} 個月份) 為「${statusText}」！請點擊「💾 儲存預訂與收益設定」`, 'info');
        }
      });
    }

    const btnClear = document.getElementById('btn-batch-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        const startSelect = document.getElementById('batch-start-month');
        const endSelect = document.getElementById('batch-end-month');
        const startM = parseInt(startSelect ? startSelect.value : '1', 10);
        const endM = parseInt(endSelect ? endSelect.value : '12', 10);
        const minM = Math.min(startM, endM);
        const maxM = Math.max(startM, endM);

        for (let m = minM; m <= maxM; m++) {
          const card = document.querySelector(`.month-card[data-card-m="${m}"]`);
          if (card) {
            const revInput = card.querySelector('.month-rev-input');
            const tenantInput = card.querySelector('.month-tenant-input');
            const pill = card.querySelector('.month-badge-pill');
            const btnAvail = card.querySelector('.btn-status-avail');
            const btnBooked = card.querySelector('.btn-status-booked');

            if (revInput) revInput.value = '';
            if (tenantInput) tenantInput.value = '';
            if (pill) {
              pill.className = 'month-badge-pill pill-avail';
              pill.textContent = '🟢 開放預訂';
            }
            card.classList.remove('is-booked');
            card.classList.add('is-available');
            if (btnBooked) btnBooked.classList.remove('active-booked');
            if (btnAvail) btnAvail.classList.add('active-avail');
          }
        }

        if (window.showToast) {
          window.showToast(`🔄 已清空 ${minM}~${maxM} 月並恢復為開放預訂`, 'warning');
        }
      });
    }
  }

  if (scheduleModalSave) {
    scheduleModalSave.addEventListener('click', window.saveMonthScheduleModal);
  }

  table.addEventListener('click', (e) => {
    const cell = e.target.closest('.month-schedule-cell');
    if (!cell) return;

    const pill = e.target.closest('.m-pill');
    const btn = e.target.closest('.btn-schedule-action');

    if (pill) {
      e.stopPropagation();
      const clickedM = pill.getAttribute('data-m');
      window.openMonthScheduleModal(cell, clickedM);
      return;
    }

    if (btn) {
      e.stopPropagation();
      window.openMonthScheduleModal(cell);
      return;
    }
  });

  // Initial UI refresh for all schedule cells
  window.refreshAllScheduleCells();
});

