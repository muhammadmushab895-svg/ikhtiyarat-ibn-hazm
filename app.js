/**
 * موسوعة اختيارات ابن حزم الفقهية من كتاب المحلى بالآثار
 * محرك التطبيق والربط المباشر مع منصة تراث الرقمية
 */

(function () {
  'use strict';

  // --- الحالة العامة للتطبيق ---
  const state = {
    activeTab: 'katalog', // 'katalog' | 'curated' | 'bookmarks'
    category: 'all',
    kitabId: 0,
    hukum: 'all',
    onlyMunfarid: false,
    searchQuery: '',
    page: 1,
    pageSize: 24,
    bookmarks: JSON.parse(localStorage.getItem('ibnhazm_bookmarks') || '[]'),
    theme: localStorage.getItem('ibnhazm_theme') || 'light',
    arabicFontSize: parseFloat(localStorage.getItem('ibnhazm_ar_size') || '1.30'),
    currentMasalah: null,
    turathPage: null,
    deferredPrompt: null
  };

  // --- ذاكرة التخزين المؤقت لصفحات تراث ---
  const turathCache = new Map();

  // --- تجريد النصوص للبحث السريع وتوحيد الحروف ---
  function normalizeArabic(text) {
    if (!text) return '';
    return text
      .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل والحركات
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .toLowerCase()
      .trim();
  }

  // --- عناصر واجهة المستخدم ---
  const elements = {
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    categoryChips: document.getElementById('categoryChips'),
    kitabSelect: document.getElementById('kitabSelect'),
    hukumSelect: document.getElementById('hukumSelect'),
    munfaridCheckbox: document.getElementById('munfaridCheckbox'),
    resetFilterBtn: document.getElementById('resetFilterBtn'),
    tabKatalog: document.getElementById('tabKatalog'),
    tabCurated: document.getElementById('tabCurated'),
    tabBookmarks: document.getElementById('tabBookmarks'),
    resultsInfo: document.getElementById('resultsInfo'),
    cardsGrid: document.getElementById('cardsGrid'),
    loadMoreContainer: document.getElementById('loadMoreContainer'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    bookmarkBadge: document.getElementById('bookmarkBadge'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    fontDecBtn: document.getElementById('fontDecBtn'),
    fontIncBtn: document.getElementById('fontIncBtn'),
    pwaInstallBtn: document.getElementById('pwaInstallBtn'),
    
    // قارئ تراث (النافذة المنبثقة)
    readerModal: document.getElementById('readerModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalTitle: document.getElementById('modalTitle'),
    modalSubtitle: document.getElementById('modalSubtitle'),
    modalCuratedBox: document.getElementById('modalCuratedBox'),
    modalArabicText: document.getElementById('modalArabicText'),
    modalPrevPageBtn: document.getElementById('modalPrevPageBtn'),
    modalNextPageBtn: document.getElementById('modalNextPageBtn'),
    modalPageInfo: document.getElementById('modalPageInfo'),
    modalCopyBtn: document.getElementById('modalCopyBtn'),
    modalTurathLink: document.getElementById('modalTurathLink'),
    modalBookmarkBtn: document.getElementById('modalBookmarkBtn'),
    modalLiveBadge: document.getElementById('modalLiveBadge'),
    
    // شريط التنقل السفلي للهواتف
    navKatalog: document.getElementById('navKatalog'),
    navCurated: document.getElementById('navCurated'),
    navBookmarks: document.getElementById('navBookmarks'),
    navSearch: document.getElementById('navSearch')
  };

  // --- بدء تشغيل التطبيق وتطهير الكاشات القديمة ---
  async function init() {
    cleanupForeignServiceWorkers();
    applyTheme(state.theme);
    applyArabicFontSize(state.arabicFontSize);
    updateBookmarkBadge();
    populateKitabSelect();
    renderCategoryChips();
    setupEventListeners();
    registerServiceWorker();
    renderCards();
  }

  // --- تطهير أي Service Worker غريب من تطبيقات أخرى على localhost ---
  function cleanupForeignServiceWorkers() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          // إذا كان الرابط لا يحتوي على sw.js الخاص بالتطبيق نقوم بإلغائه
          if (!registration.active || !registration.active.scriptURL.endsWith('/sw.js')) {
            console.log('[تطهير SW قديم]', registration);
            registration.unregister();
          }
        }
      }).catch(err => console.log('خطأ فحص Service Worker:', err));
    }
  }

  // --- محرك المظهر البصري ---
  function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem('ibnhazm_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    const nextTheme = state.theme === 'light' ? 'dark' : state.theme === 'dark' ? 'sepia' : 'light';
    applyTheme(nextTheme);
    const themeName = nextTheme === 'dark' ? 'الوضع الليلي (الزمردي الداكن)' : nextTheme === 'sepia' ? 'نمط المخطوطات القديم (البيج)' : 'نمط المصحف الكلاسيكي';
    showToast(`تم تحويل المظهر إلى: ${themeName}`);
  }

  function applyArabicFontSize(size) {
    state.arabicFontSize = Math.min(Math.max(size, 1.05), 2.25);
    localStorage.setItem('ibnhazm_ar_size', state.arabicFontSize);
    document.documentElement.style.setProperty('--base-arabic-size', `${state.arabicFontSize}rem`);
  }

  // --- أزرار التصنيفات الفقهية الكبرى ---
  function renderCategoryChips() {
    const categories = window.DATA_CATEGORIES || {};
    let html = `
      <button class="chip-btn ${state.category === 'all' && !state.onlyMunfarid ? 'active' : ''}" data-cat="all">
        <i class="fa-solid fa-list-check"></i>
        <span>جميع الأبواب</span>
        <span class="chip-count">${window.DATA_MASAIL?.length || 2254}</span>
      </button>
      <button class="chip-btn ${state.onlyMunfarid ? 'active' : ''}" data-cat="munfarid">
        <i class="fa-solid fa-star" style="color: #f59e0b;"></i>
        <span>مفردات ابن حزم (خلاف الجمهور)</span>
        <span class="chip-count">الترجيحات</span>
      </button>
    `;

    for (const [key, cat] of Object.entries(categories)) {
      const count = (window.DATA_MASAIL || []).filter(m => m.cat === key).length;
      html += `
        <button class="chip-btn ${state.category === key && !state.onlyMunfarid ? 'active' : ''}" data-cat="${key}">
          <span style="color: ${cat.color};">●</span>
          <span>${cat.ar}</span>
          <span class="chip-count">${count}</span>
        </button>
      `;
    }

    elements.categoryChips.innerHTML = html;

    // تفعيل النقر على الأزرار
    elements.categoryChips.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat');
        if (cat === 'munfarid') {
          state.onlyMunfarid = !state.onlyMunfarid;
          state.category = 'all';
        } else {
          state.onlyMunfarid = false;
          state.category = cat;
        }
        state.page = 1;
        renderCategoryChips();
        renderCards();
      });
    });
  }

  // --- تعبئة قائمة الكتب الـ 93 ---
  function populateKitabSelect() {
    const kitabs = window.DATA_KITABS || [];
    let options = '<option value="0">-- اختر الكتاب أو الباب الفقهي (٩٣ كتاباً) --</option>';
    kitabs.forEach(k => {
      options += `<option value="${k.id}">${k.id}. ${k.title}</option>`;
    });
    elements.kitabSelect.innerHTML = options;
  }

  // --- تصفية وفرز البيانات ---
  function getFilteredData() {
    let sourceData = [];

    if (state.activeTab === 'curated') {
      sourceData = window.DATA_CURATED || [];
    } else if (state.activeTab === 'bookmarks') {
      const bookmarkSet = new Set(state.bookmarks);
      sourceData = (window.DATA_MASAIL || []).filter(m => bookmarkSet.has(m.id));
    } else {
      sourceData = window.DATA_MASAIL || [];
    }

    const query = normalizeArabic(state.searchQuery);
    const isNumSearch = /^\d+$/.test(state.searchQuery.trim());
    const targetNum = isNumSearch ? parseInt(state.searchQuery.trim(), 10) : null;

    return sourceData.filter(item => {
      // تصفية حسب التصنيف الكبير
      if (state.category !== 'all' && item.cat !== state.category) {
        return false;
      }

      // تصفية حسب الكتاب
      if (state.kitabId > 0 && item.kId !== state.kitabId) {
        return false;
      }

      // تصفية حسب الحكم
      if (state.hukum !== 'all' && item.h !== state.hukum) {
        return false;
      }

      // تصفية المفردات
      if (state.onlyMunfarid && !item.m && !item.isMunfarid) {
        return false;
      }

      // نص البحث
      if (query) {
        if (targetNum !== null) {
          if (item.id === targetNum || item.p === targetNum) return true;
        }
        const titleAr = normalizeArabic(item.t || item.title_ar || '');
        const titleSub = normalizeArabic(item.title_sub || item.bayan_ar || '');
        const kitabTitle = normalizeArabic(item.k || item.kitab || '');
        const tags = (item.tags || []).map(t => normalizeArabic(t)).join(' ');

        if (!titleAr.includes(query) && !titleSub.includes(query) && !kitabTitle.includes(query) && !tags.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }

  // --- عرض بطاقات المسائل ---
  function renderCards() {
    const filtered = getFilteredData();
    const total = filtered.length;
    const paginated = filtered.slice(0, state.page * state.pageSize);

    // تحديث إحصاء النتائج
    elements.resultsInfo.textContent = `عرض ${paginated.length} من أصل ${total} مسألة فقهية`;

    if (paginated.length === 0) {
      elements.cardsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
          </svg>
          <h3>لم نجد مسألة مطابقة لخيارات البحث</h3>
          <p>يرجى تجربة كلمات بحث أخرى أو إلغاء قيود التصفية الحالية.</p>
          <button class="reset-filter-btn" style="margin: 1rem auto 0;" onclick="window.resetFilters()">
            <i class="fa-solid fa-rotate-left"></i> إعادة ضبط جميع عوامل التصفية
          </button>
        </div>
      `;
      elements.loadMoreContainer.style.display = 'none';
      return;
    }

    const bookmarkSet = new Set(state.bookmarks);

    let html = '';
    paginated.forEach(m => {
      const isBookmarked = bookmarkSet.has(m.id);
      const isCurated = !!(window.DATA_CURATED || []).find(c => c.id === m.id);
      const curatedItem = isCurated ? (window.DATA_CURATED || []).find(c => c.id === m.id) : null;
      const titleAr = m.t || m.title_ar;
      const titleSub = curatedItem ? curatedItem.title_sub : '';
      const bayanAr = curatedItem ? curatedItem.bayan_ar : '';
      const hukum = m.h || m.hukum || 'tashih';
      const hukumLabel = getHukumLabel(hukum);
      const isMunfarid = m.m === 1 || m.isMunfarid;

      html += `
        <div class="masalah-card">
          <div>
            <div class="card-top-bar">
              <span class="kitab-badge" title="${m.k || m.kitab}">
                <i class="fa-solid fa-book-open"></i> ${m.k || m.kitab}
              </span>
              <span class="hukum-badge hukum-${hukum}">
                ${hukumLabel}
              </span>
            </div>

            ${isMunfarid ? `
              <div class="munfarid-badge">
                <i class="fa-solid fa-star"></i> من مفردات ابن حزم الظاهري
              </div>
            ` : ''}

            <h3 class="masalah-title-ar">${titleAr}</h3>
            ${titleSub ? `<div class="masalah-title-id"><i class="fa-solid fa-feather-pointed" style="font-size:0.8rem; margin-left: 0.35rem;"></i> ${titleSub}</div>` : ''}
            ${bayanAr ? `<p class="masalah-excerpt">${bayanAr.slice(0, 190)}...</p>` : ''}
          </div>

          <div>
            <div class="card-meta-row">
              <span class="card-ref-badge">
                <i class="fa-solid fa-hashtag"></i> مسألة #${m.id}
              </span>
              <span class="card-ref-badge">
                <i class="fa-solid fa-book"></i> المجلد ${m.v || m.vol}، ص ${m.pp || m.printPage} (تراث ص ${m.p || m.page})
              </span>
            </div>

            <div class="card-actions">
              <button class="read-btn" data-id="${m.id}">
                <i class="fa-solid fa-book-reader"></i> قراءة النص الأصلي (تراث)
              </button>
              <button class="card-icon-btn bookmark-btn ${isBookmarked ? 'active' : ''}" data-id="${m.id}" title="${isBookmarked ? 'محفوظ في المفضلة' : 'حفظ في المفضلة'}">
                <i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
              </button>
              <button class="card-icon-btn copy-btn" data-id="${m.id}" title="نسخ العزو العلمي">
                <i class="fa-regular fa-copy"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    elements.cardsGrid.innerHTML = html;

    // ربط أحداث البطاقات
    elements.cardsGrid.querySelectorAll('.read-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        openReaderModal(id);
      });
    });

    elements.cardsGrid.querySelectorAll('.bookmark-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        toggleBookmark(id);
      });
    });

    elements.cardsGrid.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        copyCitation(id);
      });
    });

    // إظهار أو إخفاء زر المزيد
    if (paginated.length < total) {
      elements.loadMoreContainer.style.display = 'block';
    } else {
      elements.loadMoreContainer.style.display = 'none';
    }
  }

  // --- مسميات الأحكام الفقهية بالعربية الفصحى ---
  function getHukumLabel(hukum) {
    const labels = {
      wajib: 'فرض / واجب',
      haram: 'محرم / لا يحل',
      batal: 'باطل / مردود',
      sah: 'صحيح / يجزئ',
      sunnah: 'مستحب / سنة',
      makruh: 'مكروه',
      mubah: 'مباح / جائز',
      tashih: 'حكم وقاعدة'
    };
    return labels[hukum] || 'حكم فقهي';
  }

  // --- إدارة المفضلة ---
  function toggleBookmark(id) {
    const idx = state.bookmarks.indexOf(id);
    if (idx > -1) {
      state.bookmarks.splice(idx, 1);
      showToast('تم حذف المسألة من المفضلة.');
    } else {
      state.bookmarks.push(id);
      showToast('تم حفظ المسألة في المفضلة بنجاح!');
    }
    localStorage.setItem('ibnhazm_bookmarks', JSON.stringify(state.bookmarks));
    updateBookmarkBadge();
    renderCards();
    if (state.currentMasalah && state.currentMasalah.id === id) {
      updateModalBookmarkState();
    }
  }

  function updateBookmarkBadge() {
    const count = state.bookmarks.length;
    elements.bookmarkBadge.textContent = count;
    elements.bookmarkBadge.style.display = count > 0 ? 'flex' : 'none';
  }

  // --- محرك جلب صفحات تراث المتعدد (Multi-tier Fetcher) ---
  async function fetchTurathPageData(pageNum) {
    // 1. المسار الأول: وسيط الخادم المحلي المدمج (Local Proxy)
    try {
      const localProxyUrl = `/api/turath/page?book_id=767&pg=${pageNum}&ver=3`;
      const res = await fetch(localProxyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.text || data.meta)) {
          return { data, source: 'خادم تراث (عبر الوسيط المباشر)' };
        }
      }
    } catch (e) {
      console.warn('تعذر جلب الصفحة عبر الوسيط المحلي:', e);
    }

    // 2. المسار الثاني: الاتصال المباشر بخادم تراث الرسمي
    try {
      const directUrl = `https://api.turath.io/page?book_id=767&pg=${pageNum}&ver=3`;
      const res = await fetch(directUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.text || data.meta)) {
          return { data, source: 'خادم تراث الرسمي (مباشر)' };
        }
      }
    } catch (e) {
      console.warn('تعذر الاتصال المباشر بسبب حماية CORS في المتصفح:', e);
    }

    // 3. المسار الثالث: خادم وكيل سحابي بديل
    try {
      const fallbackUrl = `https://corsproxy.io/?url=` + encodeURIComponent(`https://api.turath.io/page?book_id=767&pg=${pageNum}&ver=3`);
      const res = await fetch(fallbackUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.text || data.meta)) {
          return { data, source: 'خادم تراث (وسيط سحابي)' };
        }
      }
    } catch (e) {
      console.warn('تعذر الاتصال بالوسيط السحابي:', e);
    }

    throw new Error('تعذر جلب صفحة تراث عبر جميع المسارات.');
  }

  // --- قارئ نصوص تراث المنبثق ---
  async function openReaderModal(masalahId) {
    let item = (window.DATA_MASAIL || []).find(m => m.id === masalahId);
    if (!item && window.DATA_CURATED) {
      item = (window.DATA_CURATED || []).find(m => m.id === masalahId);
    }
    if (!item) return;

    state.currentMasalah = item;
    const pageNum = item.p || item.page;
    state.turathPage = pageNum;

    // رأس النافذة
    elements.modalTitle.textContent = item.t || item.title_ar;
    elements.modalSubtitle.textContent = `${item.k || item.kitab} • مسألة رقم #${item.id} • المجلد ${item.v || item.vol}، ص ${item.pp || item.printPage}`;
    elements.modalTurathLink.href = `https://app.turath.io/book/767?page=${pageNum}`;
    updateModalBookmarkState();

    // فحص الشرح المحقق والتحليل المذهبي
    const curated = (window.DATA_CURATED || []).find(c => c.id === item.id);
    if (curated) {
      elements.modalCuratedBox.style.display = 'block';
      elements.modalCuratedBox.innerHTML = `
        <div class="analysis-header">
          <span class="analysis-tag"><i class="fa-solid fa-star"></i> اختيار وترجيح ابن حزم الظاهري</span>
          <span class="hukum-badge hukum-${curated.hukum}">${getHukumLabel(curated.hukum)}</span>
        </div>
        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--emerald); margin-bottom: 0.65rem;">${curated.title_sub || curated.title_ar}</h3>
        <p class="analysis-text">${curated.bayan_ar}</p>
        
        <div class="madhhab-table-box">
          <h4><i class="fa-solid fa-scale-balanced"></i> مقارنة بمذاهب الأئمة الأربعة (أبي حنيفة، ومالك، والشافعي، وأحمد):</h4>
          <p style="color: var(--text-secondary); line-height: 1.7; font-size: 0.92rem;">${curated.muqaranah_madhahib}</p>
        </div>
      `;
    } else {
      elements.modalCuratedBox.style.display = 'none';
    }

    // فتح النافذة وتحميل نص تراث
    elements.readerModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    await loadTurathPage(pageNum);
  }

  function updateModalBookmarkState() {
    if (!state.currentMasalah) return;
    const isBookmarked = state.bookmarks.includes(state.currentMasalah.id);
    elements.modalBookmarkBtn.innerHTML = `
      <i class="${isBookmarked ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
      <span>${isBookmarked ? 'محفوظ' : 'حفظ'}</span>
    `;
    elements.modalBookmarkBtn.classList.toggle('active', isBookmarked);
  }

  async function loadTurathPage(pageNumber) {
    elements.modalPageInfo.textContent = `صفحة تراث: ${pageNumber}`;
    elements.modalArabicText.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: var(--emerald); margin-bottom: 0.75rem;"></i>
        <p>جارٍ جلب النص الأصلي من منصة تراث الرقمية...</p>
      </div>
    `;

    // 1. فحص النسخة المدمجة الجاهزة (Bundled Offline Cache)
    if (window.DATA_TURATH_CACHE && window.DATA_TURATH_CACHE[pageNumber]) {
      displayTurathText(window.DATA_TURATH_CACHE[pageNumber], true, 'منصة تراث الرقمية (نسخة مدمجة)');
      return;
    }

    // 2. فحص الذاكرة المؤقتة السريعة
    if (turathCache.has(pageNumber)) {
      displayTurathText(turathCache.get(pageNumber), true, 'الذاكرة المؤقتة (مخزن محلياً)');
      return;
    }

    try {
      const { data, source } = await fetchTurathPageData(pageNumber);
      turathCache.set(pageNumber, data);
      displayTurathText(data, false, source);
    } catch (err) {
      console.error('خطأ في تحميل صفحة تراث:', err);
      const curated = (window.DATA_CURATED || []).find(c => c.id === state.currentMasalah?.id);
      if (curated && curated.dalil_ar) {
        elements.modalLiveBadge.innerHTML = `<span style="color: var(--gold);">● النص المعتمد محلياً</span>`;
        elements.modalArabicText.innerHTML = `
          <div style="background-color: var(--gold-light); border: 1px solid var(--gold-border); color: var(--gold); padding: 0.85rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem; font-size: 0.88rem; line-height: 1.6;">
            <i class="fa-solid fa-circle-info"></i> يُعرض أدناه نص عبارة الإمام ابن حزم واستدلاله الأصلي من النسخة المحققة المحلية. لقراءة الصفحة الكاملة من خادم تراث يمكنك فتح الرابط المباشر أدناه.
          </div>
          <div class="arabic-text-container">
            <div class="arabic-title-block">${curated.title_ar}</div>
            <p style="font-size: 1.15em; line-height: 2.2;">${curated.dalil_ar}</p>
          </div>
          <div style="margin-top: 1.5rem; text-align: center;">
            <a href="https://app.turath.io/book/767?page=${pageNumber}" target="_blank" rel="noopener noreferrer" class="read-btn" style="max-width: 280px; margin: 0 auto; text-decoration: none;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> قراءة الصفحة كاملة في موقع تراث
            </a>
          </div>
        `;
      } else {
        elements.modalArabicText.innerHTML = `
          <div style="background-color: var(--bg-secondary); border: 1px solid var(--border); padding: 1.5rem; border-radius: var(--radius-md); text-align: center;">
            <i class="fa-solid fa-book-open-reader fa-2x" style="color: var(--emerald); margin-bottom: 0.75rem;"></i>
            <h3 style="font-size: 1.1rem; color: var(--emerald); margin-bottom: 0.5rem;">قراءة الصفحة في منصة تراث الرقمية</h3>
            <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1rem; max-width: 500px; margin-left: auto; margin-right: auto;">
              الصفحة رقم <strong>${pageNumber}</strong> من كتاب المحلى متاحة مباشرة على منصة تراث الرقمية. يمكنك فتحها مباشرة بنقرة واحدة أو تشغيل الخادم المحلي عبر <code>Jalankan_Aplikasi.bat</code>.
            </p>
            <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
              <a href="https://app.turath.io/book/767?page=${pageNumber}" target="_blank" rel="noopener noreferrer" class="read-btn" style="max-width: 250px; text-decoration: none;">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> فتح الصفحة في موقع تراث
              </a>
              <button class="page-nav-btn" onclick="window.reloadCurrentTurathPage()">
                <i class="fa-solid fa-rotate-right"></i> إعادة المحاولة
              </button>
            </div>
          </div>
        `;
        elements.modalLiveBadge.innerHTML = `<span style="color: var(--text-muted);">● الربط الخارجي متاح</span>`;
      }
    }
  }

  function displayTurathText(pageData, fromCache, sourceLabel) {
    elements.modalLiveBadge.innerHTML = `
      <span class="pulse-dot"></span>
      <span>${sourceLabel || (fromCache ? 'تراث الرقمي (مخزن في الذاكرة)' : 'تراث الرقمي (اتصال مباشر)')}</span>
    `;

    let rawText = pageData.text || '';

    // تلوين وتنسيق النص العربي التراثي
    let beautified = rawText
      .replace(/<span data-type="title"[^>]*>\[(.*?)\]<\/span>/g, '<div class="arabic-title-block">$1</div>')
      .replace(/﴿(.*?)﴾/g, '<span class="arabic-verse">﴿$1﴾</span>')
      .replace(/(قَالَ أَبُو مُحَمَّدٍ\s*[-–—]?\s*(?:﵁)?\s*[:：])/g, '<span class="arabic-ibn-hazm">$1</span>')
      .replace(/(بُرْهَانُ ذَلِكَ|وَبُرْهَانُهُ)/g, '<strong style="color: var(--gold);">$1</strong>')
      .replace(/(حَدَّثَنَا|أَخْبَرَنَا|ثنا|أنا|عَنْ|قَالَ رَسُولُ اللَّهِ ﷺ|قَالَ النَّبِيُّ ﷺ)/g, '<strong style="color: var(--emerald);">$1</strong>');

    elements.modalArabicText.innerHTML = `<div class="arabic-text-container">${beautified}</div>`;
  }

  function closeReaderModal() {
    elements.readerModal.classList.remove('active');
    document.body.style.overflow = '';
    state.currentMasalah = null;
  }

  // --- نسخ العزو العلمي للتوثيق ---
  function copyCitation(masalahId) {
    let item = (window.DATA_MASAIL || []).find(m => m.id === masalahId);
    if (!item && window.DATA_CURATED) {
      item = (window.DATA_CURATED || []).find(m => m.id === masalahId);
    }
    if (!item) return;

    const citation = `[موسوعة اختيارات ابن حزم الفقهية]
المسألة: ${item.t || item.title_ar}
الكتاب: ${item.k || item.kitab}
المصدر: المحلى بالآثار، المجلد ${item.v || item.vol}، الصفحة ${item.pp || item.printPage} (صفحة تراث: ${item.p || item.page})
الرابط الرقمي المباشر: https://app.turath.io/book/767?page=${item.p || item.page}`;

    navigator.clipboard.writeText(citation).then(() => {
      showToast('تم نسخ العزو العلمي بنجاح إلى الحافظة!');
    }).catch(() => {
      showToast('تعذر نسخ العزو العلمي.');
    });
  }

  // --- إشعارات التنبيه السريعة (Toast) ---
  function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> <span>${message}</span>`;

    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2600);
  }

  // --- ربط الأحداث العامة ---
  function setupEventListeners() {
    // مربع البحث
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      state.page = 1;
      elements.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
      renderCards();
    });

    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      elements.clearSearchBtn.style.display = 'none';
      state.page = 1;
      renderCards();
    });

    // القوائم المنسدلة
    elements.kitabSelect.addEventListener('change', (e) => {
      state.kitabId = parseInt(e.target.value, 10);
      state.page = 1;
      renderCards();
    });

    elements.hukumSelect.addEventListener('change', (e) => {
      state.hukum = e.target.value;
      state.page = 1;
      renderCards();
    });

    elements.munfaridCheckbox.addEventListener('change', (e) => {
      state.onlyMunfarid = e.target.checked;
      state.page = 1;
      renderCategoryChips();
      renderCards();
    });

    elements.resetFilterBtn.addEventListener('click', window.resetFilters);

    // ألسنة التبويب
    elements.tabKatalog.addEventListener('click', () => switchTab('katalog'));
    elements.tabCurated.addEventListener('click', () => switchTab('curated'));
    elements.tabBookmarks.addEventListener('click', () => switchTab('bookmarks'));

    // شريط التنقل السفلي للهواتف
    if (elements.navKatalog) elements.navKatalog.addEventListener('click', () => switchTab('katalog'));
    if (elements.navCurated) elements.navCurated.addEventListener('click', () => switchTab('curated'));
    if (elements.navBookmarks) elements.navBookmarks.addEventListener('click', () => switchTab('bookmarks'));
    if (elements.navSearch) elements.navSearch.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      elements.searchInput.focus();
    });

    // تحميل المزيد
    elements.loadMoreBtn.addEventListener('click', () => {
      state.page++;
      renderCards();
    });

    // تغيير المظهر والخط
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    elements.fontIncBtn.addEventListener('click', () => {
      applyArabicFontSize(state.arabicFontSize + 0.15);
      showToast(`حجم الخط العربي: ${(state.arabicFontSize * 16).toFixed(0)} نقطة`);
    });
    elements.fontDecBtn.addEventListener('click', () => {
      applyArabicFontSize(state.arabicFontSize - 0.15);
      showToast(`حجم الخط العربي: ${(state.arabicFontSize * 16).toFixed(0)} نقطة`);
    });

    // إغلاق النافذة المنبثقة
    elements.modalCloseBtn.addEventListener('click', closeReaderModal);
    elements.readerModal.addEventListener('click', (e) => {
      if (e.target === elements.readerModal) closeReaderModal();
    });

    // التنقل بين صفحات تراث في القارئ
    elements.modalPrevPageBtn.addEventListener('click', () => {
      if (state.turathPage > 1) {
        state.turathPage--;
        loadTurathPage(state.turathPage);
      }
    });

    elements.modalNextPageBtn.addEventListener('click', () => {
      if (state.turathPage < 5300) {
        state.turathPage++;
        loadTurathPage(state.turathPage);
      }
    });

    // أزرار النسخ والمفضلة داخل القارئ
    elements.modalCopyBtn.addEventListener('click', () => {
      if (state.currentMasalah) {
        copyCitation(state.currentMasalah.id);
      }
    });

    elements.modalBookmarkBtn.addEventListener('click', () => {
      if (state.currentMasalah) {
        toggleBookmark(state.currentMasalah.id);
      }
    });

    // زر الهروب Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.readerModal.classList.contains('active')) {
        closeReaderModal();
      }
    });
  }

  // --- التبديل بين ألسنة التبويب ---
  function switchTab(tabName) {
    state.activeTab = tabName;
    state.page = 1;

    [elements.tabKatalog, elements.tabCurated, elements.tabBookmarks].forEach(t => t.classList.remove('active'));
    if (tabName === 'katalog') elements.tabKatalog.classList.add('active');
    if (tabName === 'curated') elements.tabCurated.classList.add('active');
    if (tabName === 'bookmarks') elements.tabBookmarks.classList.add('active');

    if (elements.navKatalog && elements.navCurated && elements.navBookmarks) {
      [elements.navKatalog, elements.navCurated, elements.navBookmarks].forEach(n => n.classList.remove('active'));
      if (tabName === 'katalog') elements.navKatalog.classList.add('active');
      if (tabName === 'curated') elements.navCurated.classList.add('active');
      if (tabName === 'bookmarks') elements.navBookmarks.classList.add('active');
    }

    renderCards();
    window.scrollTo({ top: 350, behavior: 'smooth' });
  }

  // --- إعادة ضبط الفلاتر ---
  window.resetFilters = function () {
    state.category = 'all';
    state.kitabId = 0;
    state.hukum = 'all';
    state.onlyMunfarid = false;
    state.searchQuery = '';
    state.page = 1;

    elements.searchInput.value = '';
    elements.clearSearchBtn.style.display = 'none';
    elements.kitabSelect.value = '0';
    elements.hukumSelect.value = 'all';
    elements.munfaridCheckbox.checked = false;

    renderCategoryChips();
    renderCards();
    showToast('تمت إعادة ضبط جميع عوامل التصفية بنجاح.');
  };

  window.reloadCurrentTurathPage = function () {
    if (state.turathPage) {
      loadTurathPage(state.turathPage);
    }
  };

  // --- تسجيل خدمة العمل دون اتصال (PWA) وتحديث النسخة ---
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => {
            console.log('[PWA] تم تفعيل Service Worker بنطاق:', reg.scope);
            reg.update();
          })
          .catch(err => console.log('[PWA] فشل تفعيل Service Worker:', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPrompt = e;
      elements.pwaInstallBtn.style.display = 'inline-flex';
    });

    elements.pwaInstallBtn.addEventListener('click', async () => {
      if (!state.deferredPrompt) return;
      state.deferredPrompt.prompt();
      const { outcome } = await state.deferredPrompt.userChoice;
      console.log('[PWA] نتيجة تثبيت التطبيق:', outcome);
      state.deferredPrompt = null;
      elements.pwaInstallBtn.style.display = 'none';
    });
  }

  // تشغيل التهيئة عند اكتمال تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
