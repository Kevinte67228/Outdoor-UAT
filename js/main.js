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
    const availMonths = [];
    const bookedMonths = [];
    for (let m = 1; m <= 12; m++) {
      const rev = schedule[String(m)] ? (typeof schedule[String(m)] === 'object' ? schedule[String(m)].revenue : schedule[String(m)]) : 0;
      if (Number(rev) > 0) {
        bookedMonths.push(m);
      } else {
        availMonths.push(m);
      }
    }

    // Summary texts
    let availText = '';
    if (availMonths.length === 12) {
      availText = '🟢 全年 1~12月 皆可預訂';
    } else if (availMonths.length === 0) {
      availText = '🔴 全年檔期額滿';
    } else {
      availText = '🟢 可預訂：' + window.formatMonthRanges(availMonths);
    }

    let bookedText = '';
    if (bookedMonths.length > 0) {
      bookedText = '🔒 不開放：' + bookedMonths.map(m => m + '月').join(', ');
    }

    const availEl = cell.querySelector('.summary-avail-text');
    if (availEl) {
      availEl.textContent = availText;
    }

    let bookedEl = cell.querySelector('.summary-booked-text');
    if (bookedMonths.length > 0) {
      if (!bookedEl) {
        const header = cell.querySelector('.schedule-summary-header');
        if (header) {
          bookedEl = document.createElement('div');
          bookedEl.className = 'summary-booked-text';
          header.appendChild(bookedEl);
        }
      }
      if (bookedEl) {
        bookedEl.textContent = bookedText;
        bookedEl.style.display = '';
      }
    } else if (bookedEl) {
      bookedEl.style.display = 'none';
    }

    // Pills
    cell.querySelectorAll('.m-pill').forEach(pill => {
      const dm = parseInt(pill.getAttribute('data-m'), 10);
      const mData = schedule[String(dm)];
      const rev = mData ? (typeof mData === 'object' ? mData.revenue : mData) : 0;
      const tenant = (mData && typeof mData === 'object' && mData.tenant) ? mData.tenant : '';
      const isBooked = Number(rev) > 0 || Boolean(tenant);
      pill.className = 'm-pill ' + (isBooked ? 'm-pill-booked' : 'm-pill-avail');
      pill.textContent = isBooked ? `${dm}月🔒` : `${dm}月`;
      if (isAdmin) {
        const tenantInfo = tenant ? ` (${tenant})` : '';
        pill.title = isBooked 
          ? `${dm}月：💰 收益 $${Number(rev).toLocaleString()}${tenantInfo} (不開放預訂) - 點擊編輯` 
          : `${dm}月：🟢 開放預訂 - 點擊輸入收益與廠商`;
      } else {
        pill.title = isBooked ? `${dm}月：🔒 不開放預訂` : `${dm}月：🟢 開放預訂`;
      }
    });

    // Action button
    const btn = cell.querySelector('.btn-schedule-action');
    if (btn) {
      btn.innerHTML = isAdmin ? '⚙️ 設定各月收益與承租人' : '📅 1~12月排程明細';
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

    if (titleEl) titleEl.innerHTML = isAdmin ? '⚙️ 管理者設定：各月份收益、承租人與預訂排程' : '📅 2026 年度版位預訂與排程明細';
    if (storeInfoEl) storeInfoEl.textContent = `🏪 ${storeCode} ${storeName} · 版位 [${loc}] · ${adType}`;
    if (rentInfoEl) {
      rentInfoEl.style.display = isAdmin ? 'inline-block' : 'none';
      if (isAdmin) rentInfoEl.textContent = `基準月租金：${baseRental}`;
    }

    if (hintEl) {
      if (isAdmin) {
        hintEl.className = 'schedule-role-hint hint-admin';
        hintEl.innerHTML = '🛡️ <strong>管理者模式</strong>：您可在特定月份輸入收益金額與<strong>承租廠商</strong>（承租人與金額只有管理者可見，普通訪客絕對無法看到）。若有單一廠商承租 6 個月或全年，可利用下方<strong>「⚡ 快速連續月份承租設定」</strong>工具一鍵批量套用！';
      } else {
        hintEl.className = 'schedule-role-hint hint-user';
        hintEl.innerHTML = 'ℹ️ <strong>2026 年度各月份檔期開放狀況表</strong>。標示「🔒 不開放預訂」之月份代表已有檔期安排，標示「🟢 開放預訂」之月份歡迎安排預訂。';
      }
    }

    if (saveBtn) {
      saveBtn.style.display = isAdmin ? 'inline-block' : 'none';
    }

    if (batchPanel) {
      batchPanel.style.display = isAdmin ? 'block' : 'none';
      if (isAdmin) {
        const batchTenantInput = document.getElementById('batch-tenant-input');
        const batchRevInput = document.getElementById('batch-rev-input');
        const batchStartSelect = document.getElementById('batch-start-month');
        const batchEndSelect = document.getElementById('batch-end-month');
        if (batchTenantInput) batchTenantInput.value = '';
        if (batchRevInput) batchRevInput.value = numRental > 0 ? numRental : '';
        if (batchStartSelect) batchStartSelect.value = '1';
        if (batchEndSelect) batchEndSelect.value = '6';
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
      const isBooked = Number(rev) > 0 || Boolean(tenant);

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
            <label style="font-size:11px; font-weight:600; color:#475569;">收益金額 (NT$)：</label>
            <div class="month-rev-input-row">
              <input type="number" class="month-rev-input" data-m="${m}" value="${rev > 0 ? rev : ''}" placeholder="0 (開放預訂)" min="0" step="1000">
            </div>
            <label style="font-size:11px; font-weight:600; color:#475569; margin-top:2px;">承租廠商 / 客戶備註 (僅管理者可見)：</label>
            <div class="month-tenant-row">
              <input type="text" class="month-tenant-input" data-m="${m}" value="${tenant ? tenant.replace(/"/g, '&quot;') : ''}" placeholder="承租客戶/廠商名稱">
            </div>
            <div class="month-quick-actions">
              <button type="button" class="btn-card-quick btn-fill-rent" data-m="${m}">帶入租金</button>
              <button type="button" class="btn-card-quick btn-clear" data-m="${m}">清除(開放)</button>
            </div>
          </div>
        `;

        const revInput = card.querySelector('.month-rev-input');
        const tenantInput = card.querySelector('.month-tenant-input');
        const pill = card.querySelector('.month-badge-pill');

        function updateCardStatus() {
          const val = parseInt(revInput.value.replace(/[^0-9]/g, ''), 10) || 0;
          const tVal = tenantInput.value.trim();
          if (val > 0 || tVal) {
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
        }

        revInput.addEventListener('input', updateCardStatus);
        tenantInput.addEventListener('input', updateCardStatus);

        card.querySelector('.btn-fill-rent').addEventListener('click', () => {
          if (numRental > 0) {
            revInput.value = numRental;
            updateCardStatus();
          } else {
            alert('此版位目前未設定基準月租金');
          }
        });

        card.querySelector('.btn-clear').addEventListener('click', () => {
          revInput.value = '';
          tenantInput.value = '';
          updateCardStatus();
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

      if (val > 0 || tenant) {
        newSchedule[m] = {
          revenue: val,
          tenant: tenant
        };
      }
    });

    activeScheduleCell.dataset.schedule = JSON.stringify(newSchedule);
    window.updateScheduleCellUI(activeScheduleCell, newSchedule);
    window.closeMonthScheduleModal();

    if (window.triggerAutoSave) window.triggerAutoSave();
    if (window.showToast) window.showToast('✅ 已成功儲存各月收益、承租人與排程！', 'success');
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

        const batchTenant = (document.getElementById('batch-tenant-input') ? document.getElementById('batch-tenant-input').value.trim() : '');
        const batchRevRaw = (document.getElementById('batch-rev-input') ? document.getElementById('batch-rev-input').value : '');
        const batchRev = parseInt(batchRevRaw.replace(/[^0-9]/g, ''), 10) || 0;

        for (let m = minM; m <= maxM; m++) {
          const card = document.querySelector(`.month-card[data-card-m="${m}"]`);
          if (card) {
            const revInput = card.querySelector('.month-rev-input');
            const tenantInput = card.querySelector('.month-tenant-input');
            const pill = card.querySelector('.month-badge-pill');

            if (revInput) revInput.value = batchRev > 0 ? batchRev : '';
            if (tenantInput) tenantInput.value = batchTenant;

            if (batchRev > 0 || batchTenant) {
              if (pill) {
                pill.className = 'month-badge-pill pill-booked';
                pill.textContent = '🔒 不開放預訂';
              }
              card.classList.remove('is-available');
              card.classList.add('is-booked');
            } else {
              if (pill) {
                pill.className = 'month-badge-pill pill-avail';
                pill.textContent = '🟢 開放預訂';
              }
              card.classList.remove('is-booked');
              card.classList.add('is-available');
            }
          }
        }

        const count = maxM - minM + 1;
        if (window.showToast) {
          window.showToast(`⚡ 已成功套用至 ${minM}~${maxM} 月 (共 ${count} 個月份)！請確認後點擊「💾 儲存收益設定」`, 'info');
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

            if (revInput) revInput.value = '';
            if (tenantInput) tenantInput.value = '';
            if (pill) {
              pill.className = 'month-badge-pill pill-avail';
              pill.textContent = '🟢 開放預訂';
            }
            card.classList.remove('is-booked');
            card.classList.add('is-available');
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

