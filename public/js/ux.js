/* ImageForge UX enhancements — loaded after script.js */

(function () {
    'use strict';

    const LS_DARK = 'if_dark_mode';
    const LS_PROMPTS = 'if_my_prompts';
    const HISTORY_PAGE = 10;

    // ==================== Toast System ====================
    function ensureToastContainer() {
        let c = document.getElementById('toastContainer');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toastContainer';
            c.className = 'toast-container';
            document.body.appendChild(c);
        }
        return c;
    }

    window.showToast = function (msg, type = 'info', duration = 3500) {
        const container = ensureToastContainer();
        const icons = { success: '✓', error: '✗', info: 'ℹ' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${msg}</span>`;
        toast.addEventListener('click', () => dismiss(toast));
        container.appendChild(toast);

        let timer = setTimeout(() => dismiss(toast), duration);
        function dismiss(el) {
            if (el._dismissed) return;
            el._dismissed = true;
            clearTimeout(timer);
            el.classList.add('toast-out');
            setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
        }
    };

    // Replace browser alert/confirm with toast where possible
    const origAlert = window.alert;
    window.alert = function (msg) {
        window.showToast(msg, 'info', 4000);
    };

    // ==================== Dark Mode ====================
    function applyTheme(dark) {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
        const toggle = document.getElementById('themeToggle');
        if (toggle) toggle.textContent = dark ? '☀' : '☽';
    }

    function toggleTheme() {
        const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
        applyTheme(dark);
        try { localStorage.setItem(LS_DARK, dark ? '1' : '0'); } catch (_) {}
    }

    (function initDarkMode() {
        const stored = (function () { try { return localStorage.getItem(LS_DARK); } catch (_) { return '0'; } })();
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(stored === '1' || (!stored && prefersDark));
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            if (!localStorage.getItem(LS_DARK)) applyTheme(e.matches);
        });
    })();

    // ==================== Drag & Drop Upload ====================
    function initDragDrop() {
        const area = document.getElementById('uploadArea');
        const input = document.getElementById('fileInput');
        if (!area || !input) return;

        ['dragenter', 'dragover'].forEach(function (evt) {
            area.addEventListener(evt, function (e) { e.preventDefault(); area.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(function (evt) {
            area.addEventListener(evt, function (e) { e.preventDefault(); area.classList.remove('drag-over'); });
        });
        area.addEventListener('drop', function (e) {
            const files = e.dataTransfer && e.dataTransfer.files;
            if (files && files.length) {
                input.files = files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // ==================== Compare Slider ====================
    function buildCompareSlider(beforeUrl, afterUrl) {
        const existing = document.querySelector('.compare-slider');
        if (existing) existing.remove();
        const box = document.getElementById('compareBox');
        if (!box) return;

        box.innerHTML = '';
        box.classList.remove('hidden');

        const slider = document.createElement('div');
        slider.className = 'compare-slider';

        const imgBefore = document.createElement('img');
        imgBefore.src = beforeUrl;
        imgBefore.alt = 'Before';
        imgBefore.draggable = false;

        const afterWrap = document.createElement('div');
        afterWrap.className = 'compare-after-wrap';
        const imgAfter = document.createElement('img');
        imgAfter.src = afterUrl;
        imgAfter.alt = 'After';
        imgAfter.draggable = false;
        afterWrap.appendChild(imgAfter);

        const line = document.createElement('div');
        line.className = 'compare-line';

        const handle = document.createElement('div');
        handle.className = 'compare-handle';
        handle.innerHTML = '↔';

        const labelB = document.createElement('div');
        labelB.className = 'compare-label compare-label-before';
        labelB.textContent = currentLang === 'zh' ? '原图' : 'Before';
        const labelA = document.createElement('div');
        labelA.className = 'compare-label compare-label-after';
        labelA.textContent = currentLang === 'zh' ? '结果' : 'After';

        slider.appendChild(imgBefore);
        slider.appendChild(afterWrap);
        slider.appendChild(line);
        slider.appendChild(handle);
        slider.appendChild(labelB);
        slider.appendChild(labelA);
        box.appendChild(slider);

        let dragging = false;
        function updatePos(clientX) {
            const rect = slider.getBoundingClientRect();
            let pct = Math.max(0.02, Math.min(0.98, (clientX - rect.left) / rect.width));
            afterWrap.style.clipPath = `inset(0 0 0 ${pct * 100}%)`;
            line.style.left = (pct * 100) + '%';
            handle.style.left = (pct * 100) + '%';
        }
        updatePos(0.5);

        function onStart(e) { dragging = true; e.preventDefault(); }
        function onMove(e) {
            if (!dragging) return;
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            updatePos(cx);
        }
        function onEnd() { dragging = false; }

        handle.addEventListener('mousedown', onStart);
        handle.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    }

    // Patch setCompareAfterEdit to use slider
    var _origSetCompare = window.setCompareAfterEdit;
    window._origSetCompareAfterEdit = _origSetCompare;
    window.setCompareAfterEdit = function (beforeDataUrl, outThumbOrUrl, outFullUrl) {
        var absBefore = beforeDataUrl || '';
        var absAfter = typeof outThumbOrUrl === 'string' && outThumbOrUrl.startsWith('http')
            ? outThumbOrUrl
            : (typeof outThumbOrUrl === 'string' && outThumbOrUrl.startsWith('/')
                ? absUrl(outThumbOrUrl) : outThumbOrUrl);
        if (absAfter && typeof absAfter === 'string' && absAfter.startsWith('data:')) {
            // Data URL — use after image directly
            absAfter = absAfter;
        }
        var afterSrc = absAfter || outThumbOrUrl;
        if (!afterSrc || typeof afterSrc !== 'string') {
            if (_origSetCompare) { _origSetCompare(beforeDataUrl, outThumbOrUrl, outFullUrl); return; }
        }
        buildCompareSlider(absBefore || '', afterSrc);
    };

    // ==================== Prompt Library ====================
    function loadMyPrompts() {
        try { return JSON.parse(localStorage.getItem(LS_PROMPTS) || '[]'); } catch (_) { return []; }
    }
    function saveMyPrompts(arr) {
        try { localStorage.setItem(LS_PROMPTS, JSON.stringify(arr.slice(0, 50))); } catch (_) {}
    }

    function renderPromptLibrary() {
        var bar = document.getElementById('editPresetBar');
        if (!bar) return;
        var existing = document.getElementById('myPromptLibrary');
        if (existing) existing.remove();

        var prompts = loadMyPrompts();
        var lang = typeof currentLang !== 'undefined' ? currentLang : 'en';

        var wrap = document.createElement('div');
        wrap.id = 'myPromptLibrary';
        wrap.className = 'prompt-library';

        var header = document.createElement('h4');
        header.innerHTML = `<span>${lang === 'zh' ? '我的提示词' : 'My Prompts'}</span>`;
        wrap.appendChild(header);

        var list = document.createElement('div');
        var promptInput = document.getElementById('promptInput');
        prompts.forEach(function (item, idx) {
            var row = document.createElement('div');
            row.className = 'prompt-lib-item';
            row.innerHTML = `<span title="${escHtml(item.text)}">${escHtml(item.label || item.text.slice(0, 30))}</span><button class="prompt-lib-del" title="${lang === 'zh' ? '删除' : 'Delete'}">&times;</button>`;
            row.querySelector('span').addEventListener('click', function () {
                if (promptInput) { promptInput.value = item.text; promptInput.focus(); }
            });
            row.querySelector('.prompt-lib-del').addEventListener('click', function (e) {
                e.stopPropagation();
                prompts.splice(idx, 1);
                saveMyPrompts(prompts);
                renderPromptLibrary();
            });
            list.appendChild(row);
        });
        wrap.appendChild(list);

        var saveRow = document.createElement('div');
        saveRow.className = 'prompt-lib-save';
        var inp = document.createElement('input');
        inp.placeholder = lang === 'zh' ? '提示词名称' : 'Prompt name';
        var btn = document.createElement('button');
        btn.textContent = lang === 'zh' ? '保存当前' : 'Save current';
        btn.addEventListener('click', function () {
            var cur = promptInput ? promptInput.value.trim() : '';
            if (!cur) { window.showToast(lang === 'zh' ? '提示词为空' : 'Prompt is empty', 'error'); return; }
            prompts.unshift({ label: inp.value.trim() || cur.slice(0, 30), text: cur });
            saveMyPrompts(prompts);
            renderPromptLibrary();
            window.showToast(lang === 'zh' ? '已保存' : 'Saved', 'success', 1500);
        });
        saveRow.appendChild(inp);
        saveRow.appendChild(btn);
        wrap.appendChild(saveRow);

        bar.after(wrap);
    }

    function escHtml(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ==================== History Lazy Load ====================
    function patchHistoryRender() {
        var origRender = window.renderHistoryList;
        if (!origRender) return;
        window._historyPage = 1;
        window.renderHistoryList = function () {
            var all = readHistory();
            var pageSize = HISTORY_PAGE;
            var shown = all.slice(0, window._historyPage * pageSize);
            origRender.call ? origRender(shown) : null;

            // Add load-more button
            var list = document.getElementById('historyList');
            if (!list) return;
            var existingBtn = document.getElementById('historyLoadMore');
            if (existingBtn) existingBtn.remove();
            if (shown.length < all.length) {
                var wrap = document.createElement('div');
                wrap.className = 'history-load-more';
                wrap.id = 'historyLoadMore';
                var btn = document.createElement('button');
                btn.textContent = (typeof currentLang !== 'undefined' && currentLang === 'zh')
                    ? `加载更多 (${shown.length}/${all.length})`
                    : `Load more (${shown.length}/${all.length})`;
                btn.addEventListener('click', function () {
                    window._historyPage++;
                    window.renderHistoryList();
                });
                wrap.appendChild(btn);
                list.after(wrap);
            }
        };
    }

    // ==================== Countdown Timer ====================
    function startCountdowns() {
        document.querySelectorAll('.countdown-timer').forEach(function (el) {
            if (el._cdInterval) return;
            var endStr = el.getAttribute('data-end');
            if (!endStr) return;
            function tick() {
                var diff = new Date(endStr).getTime() - Date.now();
                if (diff <= 0) {
                    el.textContent = (typeof currentLang !== 'undefined' && currentLang === 'zh')
                        ? '已结束' : 'Ended';
                    el.classList.add('ending-soon');
                    clearInterval(el._cdInterval);
                    return;
                }
                if (diff < 3600000) el.classList.add('ending-soon');
                var d = Math.floor(diff / 86400000);
                var h = Math.floor((diff % 86400000) / 3600000);
                var m = Math.floor((diff % 3600000) / 60000);
                var s = Math.floor((diff % 60000) / 1000);
                var zh = typeof currentLang !== 'undefined' && currentLang === 'zh';
                el.innerHTML = d > 0
                    ? `<span class="countdown-segment"><span class="countdown-num">${d}</span><span class="countdown-label">${zh ? '天' : 'd'}</span></span>` +
                      `<span class="countdown-segment"><span class="countdown-num">${String(h).padStart(2,'0')}</span><span class="countdown-label">:</span></span>` +
                      `<span class="countdown-segment"><span class="countdown-num">${String(m).padStart(2,'0')}</span><span class="countdown-label">:</span></span>` +
                      `<span class="countdown-segment"><span class="countdown-num">${String(s).padStart(2,'0')}</span><span class="countdown-label"></span></span>`
                    : `<span class="countdown-segment"><span class="countdown-num">${String(h).padStart(2,'0')}</span><span class="countdown-label">h</span></span>` +
                      `<span class="countdown-segment"><span class="countdown-num">${String(m).padStart(2,'0')}</span><span class="countdown-label">m</span></span>` +
                      `<span class="countdown-segment"><span class="countdown-num">${String(s).padStart(2,'0')}</span><span class="countdown-label">s</span></span>`;
            }
            tick();
            el._cdInterval = setInterval(tick, 1000);
        });
    }

    function injectTopicCountdowns() {
        var container = document.getElementById('topicDetailHero');
        if (!container) return;
        var endEl = container.querySelector('[data-topic-end]');
        if (!endEl) return;
        var endStr = endEl.getAttribute('data-topic-end');
        if (!endStr) return;
        var existing = container.querySelector('.countdown-timer');
        if (existing) existing.remove();
        var cd = document.createElement('span');
        cd.className = 'countdown-timer';
        cd.setAttribute('data-end', endStr);
        endEl.after(cd);
        startCountdowns();
    }

    // ==================== Notification Bell ====================
    function initNotifBell() {
        var headerActions = document.querySelector('.header-actions');
        if (!headerActions) return;

        var bell = document.createElement('button');
        bell.id = 'notifBell';
        bell.className = 'notif-bell';
        bell.title = typeof currentLang !== 'undefined' && currentLang === 'zh' ? '通知' : 'Notifications';
        bell.innerHTML = '🔔<span class="notif-bell-dot" id="notifBellDot"></span>';
        headerActions.insertBefore(bell, headerActions.firstChild);

        var panel = document.createElement('div');
        panel.id = 'notifPanel';
        panel.className = 'notif-panel';
        panel.innerHTML = '<h3><span>' + ((typeof currentLang !== 'undefined' && currentLang === 'zh') ? '通知' : 'Notifications') + '</span><button class="notif-mark-read" id="notifMarkAll">' + ((typeof currentLang !== 'undefined' && currentLang === 'zh') ? '全部已读' : 'Mark all read') + '</button></h3><div id="notifList"></div>';
        document.body.appendChild(panel);

        bell.addEventListener('click', function (e) {
            e.stopPropagation();
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) fetchNotifications();
        });
        document.addEventListener('click', function (e) {
            if (!panel.contains(e.target) && e.target !== bell) panel.classList.remove('open');
        });

        document.getElementById('notifMarkAll').addEventListener('click', function () {
            apiFetch(apiUrl('/api/notifications/mark-read'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'all' }) })
                .then(function () { fetchNotifications(); updateNotifBadge(); })
                .catch(function () {});
        });

        updateNotifBadge();
        setInterval(updateNotifBadge, 60000);
    }

    function updateNotifBadge() {
        apiFetch(apiUrl('/api/notifications/unread-count'))
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var dot = document.getElementById('notifBellDot');
                if (dot) dot.classList.toggle('active', d && d.data && d.data.count > 0);
                // Hide bell entirely if not logged in
                var bell = document.getElementById('notifBell');
                if (bell && d && d.code === 40101) bell.style.display = 'none';
            })
            .catch(function () {});
    }

    function fetchNotifications() {
        apiFetch(apiUrl('/api/notifications?pageSize=20'))
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var container = document.getElementById('notifList');
                if (!container) return;
                var list = (d && d.data && d.data.list) || [];
                if (!list.length) {
                    container.innerHTML = '<div class="notif-empty">' + ((typeof currentLang !== 'undefined' && currentLang === 'zh') ? '暂无通知' : 'No notifications') + '</div>';
                    return;
                }
                container.innerHTML = list.map(function (n) {
                    return '<div class="notif-item' + (n.readFlag ? '' : ' notif-unread') + '" data-id="' + n.id + '">' +
                        '<div class="notif-title">' + escHtml(n.title) + '</div>' +
                        (n.body ? '<div class="notif-body">' + escHtml(n.body) + '</div>' : '') +
                        '<div class="notif-time">' + communityFormatDate(n.createdAt) + '</div>' +
                        '</div>';
                }).join('');
                container.querySelectorAll('.notif-item').forEach(function (el) {
                    el.addEventListener('click', function () {
                        var id = el.getAttribute('data-id');
                        apiFetch(apiUrl('/api/notifications/mark-read'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) })
                            .then(function () { updateNotifBadge(); })
                            .catch(function () {});
                        el.classList.remove('notif-unread');
                        // Navigate to related content
                        var item = list.find(function (n) { return n.id === id; });
                        if (item && item.relatedId && item.type !== 'reward') {
                            openPostDetailFromNotif(item.relatedId);
                        }
                    });
                });
            })
            .catch(function () {});
    }

    function openPostDetailFromNotif(postId) {
        // Navigate to topic detail if needed, then open post
        if (typeof window.openPostDetail === 'function') {
            window.openPostDetail(postId);
        } else if (typeof window.showForgePage === 'function') {
            window.showForgePage('topics');
        }
    }

    // ==================== Batch Download Button ====================
    function injectBatchDownloadBtn() {
        var section = document.getElementById('resultSection');
        if (!section) return;
        var existing = document.getElementById('batchDownloadBtn');
        if (existing) return;
        var btn = document.createElement('button');
        btn.id = 'batchDownloadBtn';
        btn.className = 'batch-dl-btn hidden';
        btn.textContent = typeof currentLang !== 'undefined' && currentLang === 'zh'
            ? '↓ 打包下载'
            : '↓ Download ZIP';
        btn.addEventListener('click', function () {
            var files = [];
            if (window._batchOutputFiles) files = window._batchOutputFiles;
            else if (window._lastOutputRel) files = [window._lastOutputRel];
            if (!files.length) {
                window.showToast(typeof currentLang !== 'undefined' && currentLang === 'zh'
                    ? '没有可下载的文件' : 'No files to download', 'error');
                return;
            }
            apiFetch(apiUrl('/api/batch-download'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: files })
            }).then(function (r) {
                if (!r.ok) throw new Error('Download failed');
                return r.blob();
            }).then(function (blob) {
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'batch-' + Date.now() + '.zip';
                a.click();
                URL.revokeObjectURL(url);
            }).catch(function (e) {
                window.showToast('Download failed: ' + e.message, 'error');
            });
        });
        var downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) downloadBtn.after(btn);
    }

    // ==================== Init on Load ====================
    function init() {
        // Inject theme toggle into header
        var headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            var toggle = document.createElement('button');
            toggle.id = 'themeToggle';
            toggle.className = 'theme-toggle-btn';
            toggle.title = 'Toggle dark mode';
            toggle.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '☽';
            toggle.addEventListener('click', toggleTheme);
            headerActions.insertBefore(toggle, headerActions.firstChild);
        }

        initDragDrop();
        patchHistoryRender();
        injectBatchDownloadBtn();

        if (typeof currentUser !== 'undefined' && currentUser) {
            initNotifBell();
        }

        // Re-render prompt library when editPresetBar is available
        var checkPresetBar = setInterval(function () {
            var bar = document.getElementById('editPresetBar');
            if (bar && bar.children.length > 0) {
                clearInterval(checkPresetBar);
                renderPromptLibrary();
            }
        }, 500);
        setTimeout(function () { clearInterval(checkPresetBar); }, 10000);

        // Watch for topic detail page to inject countdowns
        var topicObserver = new MutationObserver(function () {
            var hero = document.getElementById('topicDetailHero');
            if (hero && hero.children.length > 0) {
                injectTopicCountdowns();
            }
        });
        var topicHero = document.getElementById('topicDetailHero');
        if (topicHero) topicObserver.observe(topicHero, { childList: true, subtree: true });

        // Re-check notif bell when user logs in (poll for currentUser change)
        var loginCheck = setInterval(function () {
            if (typeof currentUser !== 'undefined' && currentUser && !document.getElementById('notifBell')) {
                initNotifBell();
            }
        }, 2000);
        setTimeout(function () { clearInterval(loginCheck); }, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
