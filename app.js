// app.js
const DATA_FILE = 'data.csv';
const IMAGES_FOLDER = 'images/';
const PAGE_SIZE = 24;

let items = [];
let filtered = [];
let page = 1;
let wishlist = new Set(JSON.parse(localStorage.getItem('wanted') || '[]'));

// Helpers
function q(id){ return document.getElementById(id); }
function unique(values){ return [...new Set(values.filter(v => v && v.toString().trim()))].sort(); }
function isBlank(s){ return s === undefined || s === null || String(s).trim() === ''; }

function splitTags(s){
  if (!s) return [];
  return String(s).split(/[,，;；\/|]+/).map(t => t.trim()).filter(Boolean);
}

function normalizeRow(row, i){
  return {
    id: ((row['image_filename'] || row.image_filename || ('i' + i)) + '').toString().trim().replace(/^\$/, ''),
    title: (row['中文名字 Chinese Name'] || row['中文名字'] || row['日文名字 Japanese Name'] || row['日文名字'] || '').toString().trim(),
    jp_title: (row['日文名字 Japanese Name'] || row['日文名字'] || '').toString().trim(),
    type: splitTags(row['类型 Type'] || row['类型'] || row.type),
    relevant_work: splitTags(row['相关作品 Relevant Work'] || row['相关作品'] || row.relevant_work),
    relevant_character: splitTags(row['相关人物 Relevant Character'] || row['相关人物'] || row.relevant_character),
    relevant_image: splitTags(row['相关柄图 Relevant Image'] || row['相关柄图'] || row.relevant_image),
    releaser: splitTags(row['Releaser/Event 发行商'] || row['发行商'] || row.relevant_event),
    release_date: (row['发行日期 Release Year/Date'] || row['发行日期'] || '').toString().trim(),
    release_price: (row['发行价格 Release Price (JPY)'] || row['发行价格'] || '').toString().trim(),
    release_area: splitTags(row['发行地区 Release Area'] || row['发行地区'] || row.relevant_area),
    resource: (row['信息来源 Resource'] || row['信息来源'] || '').toString().trim(),
    detailed: (row['详细信息 Detailed Information'] || row['详细信息'] || '').toString().trim(),
    description: (row['详细信息 Detailed Information'] || row['description'] || '').toString().trim(),
    image_filename: (row['image_filename'] || row.image_filename || '').toString().trim()
  };
}

const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" font-size="20" text-anchor="middle" fill="#999" dy=".3em">No image</text></svg>'
);

// Escaping helpers
window.escapeHtml = function(s){
  if (!s) return '';
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
};
window.escapeAttr = function(s){ return s ? String(s).replace(/"/g,'&quot;') : ''; };
window.imgUrl = function(it){ if (!it || !it.image_filename) return PLACEHOLDER; return IMAGES_FOLDER + it.image_filename; };

// Load CSV and initialize UI
fetch(DATA_FILE).then(r => r.text()).then(txt => {
if (typeof Papa !== 'undefined') {
const parsed = Papa.parse(txt.trim(), { header: true, skipEmptyLines: true });
const parsedRows = parsed.data || [];
// keep the original raw rows and header order for details rendering / CSV export
window._originalRows = parsedRows;
window.CSV_HEADERS = (parsed.meta && parsed.meta.fields) ? parsed.meta.fields.slice() : Object.keys(parsedRows[0] || {});
const normalized = parsedRows.map((row, i) => {
const n = normalizeRow(row, i);
n.__rowIndex = i; // record CSV row order (0-based): higher -> newer
return n;
});
items = normalized; window.items = items; filtered = items.slice();
if (typeof window.populateFilters === 'function') window.populateFilters();
if (typeof window.applyFilters === 'function') window.applyFilters();
} else {
// fallback: parse manually (empty)
const parsedRows = [];
window._originalRows = parsedRows;
window.CSV_HEADERS = [];
items = []; filtered = [];
if (typeof window.populateFilters === 'function') window.populateFilters();
if (typeof window.applyFilters === 'function') window.applyFilters();
}
}).catch(err => {
console.error('Failed to load data.csv', err);
const listEl = q('list');
if (listEl) listEl.innerHTML = '<p style="color:#b00">Could not load data.csv — upload it to the repo root.</p>';
});


window.populateFilters = function(){
  const types = unique((items||[]).flatMap(i=>i.type || []));
  const works = unique((items||[]).flatMap(i=>i.relevant_work || []));
  const chars = unique((items||[]).flatMap(i=>i.relevant_character || []));
  const imgs = unique((items||[]).flatMap(i=>i.relevant_image || []));

  const selType = q('filter-type');
  if(selType){
    selType.innerHTML = '<option value="">All Types</option>';
    types.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; selType.appendChild(o); });
  }

  // renderCheckboxes: builds summary + wrapper + tools + list each time so mobile summary persists
  function renderCheckboxes(containerId, tokens){
    const c = q(containerId);
    if(!c) return;
    c.innerHTML = '';

    // summary header for mobile
    const summary = document.createElement('div');
    summary.className = 'summary';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = c.getAttribute('aria-label') || 'Filter';
    const chev = document.createElement('button');
    chev.type = 'button'; chev.className = 'chev'; chev.setAttribute('aria-expanded','true'); chev.textContent = '▾';
    summary.appendChild(label); summary.appendChild(chev);

    const wrapper = document.createElement('div'); wrapper.className = 'multi-filter-list';

    // tools
    const tools = document.createElement('div'); tools.className = 'controls';
    const allBtn = document.createElement('button'); allBtn.type='button'; allBtn.textContent='Select all';
    const clearBtn = document.createElement('button'); clearBtn.type='button'; clearBtn.textContent='Clear'; clearBtn.disabled = true;
    tools.appendChild(allBtn); tools.appendChild(clearBtn);

    // list
    const list = document.createElement('div'); list.style.maxHeight='220px'; list.style.overflow='auto';

    function updateClearState(){
      const anyChecked = Array.from(list.querySelectorAll('input[type=checkbox]')).some(ch => ch.checked);
      clearBtn.disabled = !anyChecked;
    }

    tokens.forEach(tok=>{
      const id = containerId + '_opt_' + tok.replace(/\s+/g,'_').replace(/[^\w-]/g,'');
      const labelEl = document.createElement('label');
      labelEl.style.display = 'block'; labelEl.style.fontSize = '13px'; labelEl.style.cursor = 'pointer';
      labelEl.innerHTML = `<input type="checkbox" id="${id}" value="${window.escapeHtml ? window.escapeHtml(tok) : tok}"> ${window.escapeHtml ? window.escapeHtml(tok) : tok}`;
      list.appendChild(labelEl);
      const ch = labelEl.querySelector('input');
      ch.addEventListener('change', ()=>{ updateClearState(); applyFilters(); });
    });

    wrapper.appendChild(tools); wrapper.appendChild(list);
    c.appendChild(summary); c.appendChild(wrapper);

    allBtn.onclick = ()=>{
      list.querySelectorAll('input[type=checkbox]').forEach(ch=>ch.checked=true);
      updateClearState(); applyFilters();
    };
    clearBtn.onclick = ()=>{
      list.querySelectorAll('input[type=checkbox]').forEach(ch=>ch.checked=false);
      updateClearState(); applyFilters();
    };

    function setCollapsed(collapsed){
      if (collapsed){ c.classList.add('collapsed'); chev.textContent = '▸'; chev.setAttribute('aria-expanded','false'); }
      else { c.classList.remove('collapsed'); chev.textContent = '▾'; chev.setAttribute('aria-expanded','true'); }
    }
    setCollapsed(true);
    summary.addEventListener('click', ()=> setCollapsed(!c.classList.contains('collapsed')));
    updateClearState();
  }

  renderCheckboxes('filter-type-container', types);
  renderCheckboxes('filter-work-container', works);
  renderCheckboxes('filter-character-container', chars);
  renderCheckboxes('filter-image-container', imgs);
};
(function(){
// update badge inside a .multi-filter .summary to show number of checked options
function updateFilterBadge(container) {
const c = (typeof container === 'string') ? q(container) : container;
if (!c) return;
const summary = c.querySelector('.summary');
if (!summary) return;
let badge = summary.querySelector('.filter-badge');
if (!badge) {
badge = document.createElement('span');
badge.className = 'filter-badge';
const chev = summary.querySelector('.chev');
if (chev) summary.insertBefore(badge, chev);
else summary.appendChild(badge);
}
const count = c.querySelectorAll('input[type="checkbox"]:checked').length;
badge.textContent = count > 0 ? String(count) : '';
badge.style.display = count > 0 ? 'inline-block' : 'none';
}

// Update global Clear button enabled/visual state
function updateClearAllState() {
const totalChecked = document.querySelectorAll('.multi-filter input[type="checkbox"]:checked').length;
const clearAllBtn = q('clear-all-filters');
if (!clearAllBtn) return;
// disable when 0, enable otherwise
clearAllBtn.disabled = (totalChecked === 0);
// toggle ghost class so it appears gray when disabled and blue when active
clearAllBtn.classList.toggle('ghost', totalChecked === 0);
// keep ARIA in sync
clearAllBtn.setAttribute('aria-disabled', clearAllBtn.disabled ? 'true' : 'false');
}

// attach listeners for all filters (idempotent)
function attachFilterBadges() {
document.querySelectorAll('.multi-filter').forEach(c => {
// initialize badge immediately
updateFilterBadge(c);
// add change listeners once
if (c._badgeInit) return;
c.querySelectorAll('input[type="checkbox"]').forEach(ch => {
ch.addEventListener('change', () => {
updateFilterBadge(c);
updateClearAllState();          // update global button whenever a checkbox changes
});
});
c._badgeInit = true;
});
// update clear all state after attaching
updateClearAllState();
}

// Clear all filters and update badges + apply filters
function clearAllFilters() {
document.querySelectorAll('.multi-filter input[type="checkbox"]').forEach(ch => { ch.checked = false; });
document.querySelectorAll('.multi-filter').forEach(c => updateFilterBadge(c));
updateClearAllState();             // ensure the Clear button is disabled again
if (typeof window.applyFilters === 'function') window.applyFilters();
}

// wire the global button (if present)
const clearAllBtn = q('clear-all-filters');
if (clearAllBtn) {
clearAllBtn.addEventListener('click', clearAllFilters);
// set initial state (in case page loaded with some filters checked)
updateClearAllState();
}

// initial attach (in case filters already present)
attachFilterBadges();

// watch for dynamic changes (populateFilters may rebuild .multi-filter contents)
// debounce to avoid thrashing
let _badgeDeb;
const obs = new MutationObserver(() => {
clearTimeout(_badgeDeb);
_badgeDeb = setTimeout(() => {
attachFilterBadges();
updateClearAllState();
}, 120);
});
obs.observe(document.body, { childList: true, subtree: true });

// Expose helpers for debugging (optional)
window._attachFilterBadges = attachFilterBadges;
window._clearAllFilters = clearAllFilters;
window._updateClearAllState = updateClearAllState;
})();

window.removeFromWishlist = function(id){
  wishlist.delete(id);
  localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist)));
  window.applyFilters && window.applyFilters();
  if (q('modal') && q('modal').style.display === 'flex') renderWishlistModal();
};

window.applyFilters = function(){
function checkedTokens(containerId){
const c = q(containerId);
if(!c) return [];
return Array.from(c.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.value);
}

const typeSelected = checkedTokens('filter-type-container');
const workSelected = checkedTokens('filter-work-container');
const charSelected = checkedTokens('filter-character-container');
const imgSelected = checkedTokens('filter-image-container');

const type = q('filter-type') ? q('filter-type').value : '';
const search = q('search') ? q('search').value.trim().toLowerCase() : '';

filtered = (items||[]).filter(it=>{
if(type && !(it.type||[]).includes(type)) return false;// change: match ANY selected token within each filter group (OR)
if(typeSelected.length){
  const have = (it.type||[]).map(v=>v.toLowerCase());
  if(!typeSelected.some(tok => have.includes(tok.toLowerCase()))) return false;
}
if(workSelected.length){
  const have = (it.relevant_work||[]).map(v=>v.toLowerCase());
  if(!workSelected.some(tok=>have.includes(tok.toLowerCase()))) return false;
}
if(charSelected.length){
  const have = (it.relevant_character||[]).map(v=>v.toLowerCase());
  if(!charSelected.some(tok=>have.includes(tok.toLowerCase()))) return false;
}
if(imgSelected.length){
  const have = (it.relevant_image||[]).map(v=>v.toLowerCase());
  if(!imgSelected.some(tok=>have.includes(tok.toLowerCase()))) return false;
}

if(search){
  const hay = ((it.title||'')+' '+(it.jp_title||'')+' '+(it.description||'')+' '+(it.relevant_work||'')+' '+(it.relevant_character||'')+' '+(it.detailed||'')).toLowerCase();
  if(!hay.includes(search)) return false;
}
return true;});

const sort = q('sort') ? q('sort').value : 'newly_added';
filtered.sort((a, b) => {
if (sort === 'added' || sort === 'newly_added') {
const ai = (a && a.__rowIndex != null) ? a.__rowIndex : 0;
const bi = (b && b.__rowIndex != null) ? b.__rowIndex : 0;
return bi - ai; // newest first
}
const va = (a && a[sort]) ? String(a[sort]) : '';
const vb = (b && b[sort]) ? String(b[sort]) : '';
if (sort === 'release_date') {
const da = Date.parse(va) || 0;
const db = Date.parse(vb) || 0;
return db - da;
}
return va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
});

page = 1;
window.renderPage && window.renderPage();
};
window.renderPage = function(){
  const start = (page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);
  const list = q('list'); if (!list) return; list.innerHTML = '';
  slice.forEach(it => {
    const card = document.createElement('div'); card.className = 'card'; card.dataset.id = it.id;
    const imgSrc = window.imgUrl ? window.imgUrl(it) : '';
    const typeText = (it.type || []).join(', ');
card.innerHTML = `
<img class="thumb" src="${window.escapeAttr ? window.escapeAttr(imgSrc) : imgSrc}" alt="">

<div class="card-body"> <strong>${window.escapeHtml ? window.escapeHtml(it.title||it.jp_title||it.id) : (it.title||it.jp_title||it.id)}</strong> <div class="meta">${window.escapeHtml ? window.escapeHtml(typeText) : typeText}</div> <div class="buttons"> <button class="detail-btn" aria-label="查看详情">详情</button> <button class="wishlist-toggle ${wishlist.has(it.id) ? 'in' : ''}" data-id="${window.escapeAttr ? window.escapeAttr(it.id) : it.id}" aria-pressed="${wishlist.has(it.id) ? 'true' : 'false'}" aria-label="${wishlist.has(it.id) ? 'Remove from wishlist' : 'Add to wishlist'}" title="${wishlist.has(it.id) ? 'Remove from wishlist' : 'Add to wishlist'}" > <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"> <path class="heart-shape" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/> </svg> </button> </div> </div>`; 
    list.appendChild(card);
    const wlBtn = card.querySelector('button[data-id]');
    if (wlBtn) wlBtn.addEventListener('click', () => window.toggleWishlist && window.toggleWishlist(it.id, wlBtn));
  });

  const max = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const prevBtn = q('prev'), nextBtn = q('next');
  if (prevBtn) prevBtn.disabled = (page <= 1);
  if (nextBtn) nextBtn.disabled = (page >= max);
  const pageInfo = q('page-info'); if (pageInfo) pageInfo.textContent = `Page ${page} / ${max} — ${filtered.length} results`;
};

// Make .multi-filter collapsible on small screens (kept for compatibility)
function makeFiltersCollapsible() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(max-width:600px)');
  function apply() {
    const should = mq.matches;
    document.querySelectorAll('.multi-filter').forEach(container => {
      if (container._hasSummary) {
        if (!should) container.classList.remove('collapsed');
        return;
      }
      const summary = document.createElement('div');
      summary.className = 'summary';
      const label = document.createElement('span'); label.className = 'label';
      label.textContent = container.getAttribute('aria-label') || 'Filter';
      const chev = document.createElement('button'); chev.type='button'; chev.className='chev'; chev.setAttribute('aria-expanded','true'); chev.textContent='▾';
      summary.appendChild(label); summary.appendChild(chev);
      container.prepend(summary);
      container._hasSummary = true;

      const wrapper = document.createElement('div'); wrapper.className = 'multi-filter-list';
      while (container.children.length > 1) wrapper.appendChild(container.children[1]);
      container.appendChild(wrapper);

      function setCollapsed(collapsed) {
        if (collapsed) { container.classList.add('collapsed'); chev.textContent='▸'; chev.setAttribute('aria-expanded','false'); }
        else { container.classList.remove('collapsed'); chev.textContent='▾'; chev.setAttribute('aria-expanded','true'); }
      }
      setCollapsed(true);
      summary.addEventListener('click', ()=> setCollapsed(!container.classList.contains('collapsed')));
    });
  }
  mq.addListener(apply);
  apply();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', makeFiltersCollapsible); else makeFiltersCollapsible();

window.openDetail = async function(id){
try{
// ensure we have original rows cached
const originalRows = await loadOriginalRows();
if(!window.items || !window.items.length){
window.items = (originalRows || []).map((row, i) => normalizeRow(row, i));
items = window.items;
if(typeof window.populateFilters === 'function') window.populateFilters();
if(typeof window.applyFilters === 'function') window.applyFilters();
}const cleaned = (id || '').toString().trim();
let it = window.items.find(x => (x.id||'').toString().trim() === cleaned);
if(!it) it = window.items.find(x => (x.id||'').toString().includes(cleaned) || cleaned.includes((x.id||'').toString()));
if(!it){
  const rawFound = (originalRows || []).find((r,i) => rowIdFromRaw(r,i) === cleaned);
  if(rawFound) {
    const idx = (originalRows || []).indexOf(rawFound);
    it = normalizeRow(rawFound, idx);
  }
}
if(!it){ console.warn('item not found', id); return; }

// find corresponding raw row in originalRows
const rawRow = (originalRows || []).find((r,i) => rowIdFromRaw(r,i) === (it.id || ''));

// Build ordered headers (CSV order preferred)
const headers = Array.isArray(window.CSV_HEADERS) && window.CSV_HEADERS.length
  ? window.CSV_HEADERS.slice()
  : (rawRow ? Object.keys(rawRow) : Object.keys(it));

// helpers
function humanizeKey(key){
  if(!key) return '';
  const s = key.replace(/[_\-]+/g,' ').replace(/([a-z0-9])([A-Z])/g,'\$1 \$2').toLowerCase().trim();
  return s.split(' ').map(p=>p.charAt(0).toUpperCase()+p.slice(1)).join(' ');
}
function isUrlLike(v){ return v && /^(https?:)?\/\//i.test(String(v)); }
function looksLikeImageFilenameOrUrl(v){
  if(!v) return false;
  const s = String(v).trim();
  if (s.startsWith('data:')) return true;
  if (/^(https?:)?\/\//i.test(s) && /\.(jpe?g|png|gif|webp|avif|svg)(?:[\?#].*)?$/i.test(s)) return true;
  return /\.(jpe?g|png|gif|webp|avif|svg)(?:[\?#].*)?$/i.test(s);
}
function looksLikeImageKey(k){
  return /(^|[_\s\-\/])(?:image|img|thumb|poster|cover|src|file|filename|url|photo)(?:$|[_\s\-\/])/i.test(k) || /image|img|thumb|poster|cover|src|file|filename|url|photo/i.test(k);
}

// collect non-empty rows (prefer rawRow values so newly added CSV columns show)
const rows = [];
headers.forEach(key => {
  if (!key) return;
  let val;
  if (rawRow && rawRow.hasOwnProperty(key)) val = rawRow[key];
  else if (it && it.hasOwnProperty(key)) val = it[key];
  else return;
  if (Array.isArray(val)) val = val.join(', ');
  val = val == null ? '' : String(val);
  if (!val.trim()) return;
  rows.push({ key, value: val });
});

// fallback: use normalized properties if nothing found
if(rows.length === 0){
  Object.keys(it).forEach(key => {
    const raw = it[key];
    if (raw === undefined || raw === null) return;
    const v = Array.isArray(raw) ? raw.join(', ') : String(raw);
    if (!v.trim()) return;
    rows.push({ key, value: v });
  });
}

// Build HTML: NOTE we intentionally DO NOT render the old left-side image
// nor the normalized it.detailed paragraph — we rely on CSV columns only.
let html = `<div style="max-width:900px;margin:0 auto">`;
html += `<h2 style="margin:0 0 .6rem 0">${window.escapeHtml(it.title||it.jp_title||it.id)}</h2>`;

// render rows as <dl>, letting image-like columns render images if the VALUE looks like a filename/URL
html += `<dl style="margin:0">`;
rows.forEach(r => {
const label = humanizeKey(r.key);
const v = r.value.trim();
let rendered = '';

const keyLooksImage = looksLikeImageKey(r.key);
const valueLooksImage = looksLikeImageFilenameOrUrl(v);

if (keyLooksImage && valueLooksImage) {
// Render as image; if filename-only, prefix IMAGES_FOLDER
let src = v;
if (!isUrlLike(src) && !src.startsWith('data:') && !/^[a-z]+:/i.test(src)) {
src = IMAGES_FOLDER + src;
}
rendered =`<div style="margin:6px 0"><img src="${window.escapeAttr(src)}" alt="${window.escapeAttr(label)}" style="max-width:100%;height:auto;border:1px solid #eee;border-radius:6px;"></div>`;
} else if (isUrlLike(v)) {
rendered =`<a href="${window.escapeAttr(v)}" target="_blank" rel="noopener noreferrer">${window.escapeHtml(v)}</a>`;
} else {
rendered = `<div style="white-space:pre-wrap;word-break:break-word;">${window.escapeHtml(v)}</div>`;
}

// Hide the label when the column is the image filename column (keep the image itself)
const hideLabel = /^image[_\s-]?filename$/i.test(r.key) || (label && label.toLowerCase() === 'image filename');

if (hideLabel) {
// only output the value (image or text) without a heading
html +=`<dd style="margin:4px 0 0 0">${rendered}</dd>`;
} else {
html += `<dt style="font-weight:600;margin-top:12px">${window.escapeHtml(label)}</dt><dd style="margin:4px 0 0 0">${rendered}</dd>`;
}
});
html += `</dl>`;

// wishlist toggle at the bottom
html += `<div style="margin-top:12px">`;
html += `<button class="wishlist-toggle ${wishlist.has(it.id) ? 'in' : ''}" data-id="${window.escapeAttr ? window.escapeAttr(it.id) : it.id}" aria-pressed="${wishlist.has(it.id) ? 'true' : 'false'}" aria-label="${wishlist.has(it.id) ? 'Remove from wishlist' : 'Add to wishlist'}" title="${wishlist.has(it.id) ? 'Remove from wishlist' : 'Add to wishlist'}" onclick="window.toggleWishlist && window.toggleWishlist('${window.escapeAttr ? window.escapeAttr(it.id) : it.id}', this)"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="heart-shape" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>`;
html += `</div>`;

html += `</div>`;

if(window.openModal) window.openModal(html); else alert(it.title||it.id);}catch(e){
console.error('openDetail error', e);
}
};

function goPage(delta){
  const max = Math.max(1, Math.ceil((filtered||[]).length / PAGE_SIZE));
  page = Math.min(max, Math.max(1, page + delta));
  renderPage();
}

(function(){
  const listEl = q('list');
  if(!listEl) return;
  if(listEl._detailDelegation) return;
  listEl._detailDelegation = function(e){
    const btn = e.target.closest('.detail-btn');
    if(!btn) return;
    const card = btn.closest('.card');
    const idBtn = card && card.querySelector('button[data-id]');
    const id = idBtn ? idBtn.getAttribute('data-id') : (card && card.dataset && card.dataset.id);
    if(id) window.openDetail && window.openDetail(id);
  };
  listEl.addEventListener('click', listEl._detailDelegation);
})();

window.openModal = function(html){
  const modal = q('modal'); const content = q('modal-content');
  if (!modal || !content) return;
  content.innerHTML = html; modal.style.display = 'flex'; modal.setAttribute('aria-hidden', 'false');
};
window.closeModal = function(){ const modal = q('modal'); if (!modal) return; modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); };
const closeBtn = q('close-modal');
if (closeBtn) closeBtn.addEventListener('click', () => window.closeModal && window.closeModal());

window.toggleWishlist = function(id, btn){
// locate button if not provided
const selectorBtn = btn || document.querySelector(`button.wishlist-toggle[data-id="${id}"]`);if (wishlist.has(id)){
wishlist.delete(id);
if (selectorBtn){
selectorBtn.classList.remove('in');
selectorBtn.setAttribute('aria-pressed','false');
selectorBtn.setAttribute('aria-label','Add to wishlist');
selectorBtn.setAttribute('title','Add to wishlist');
}
} else {
wishlist.add(id);
if (selectorBtn){
selectorBtn.classList.add('in');
selectorBtn.setAttribute('aria-pressed','true');
selectorBtn.setAttribute('aria-label','Remove from wishlist');
selectorBtn.setAttribute('title','Remove from wishlist');
// pop animation
selectorBtn.classList.add('pop');
setTimeout(()=>selectorBtn.classList.remove('pop'), 160);
}
}
localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist)));
// Update any other UI dependent on wishlist state
// e.g., refresh list labels if you rely on text elsewhere:
// renderPage();
};

// CSV export helpers
async function loadOriginalRows(){
  if (window._originalRows) return window._originalRows;
  const txt = await fetch('data.csv?_=' + Date.now()).then(r => r.text());
  const parsed = (typeof Papa !== 'undefined') ? Papa.parse(txt.trim(), { header: true, skipEmptyLines: true }).data : [];
  window._originalRows = parsed;
  return parsed;
}
function rowIdFromRaw(row, i){ return ((row['image_filename'] || row.image_filename || ('i' + i)) + '').toString().trim().replace(/^\$/, ''); }
function downloadBlob(blob, filename){ const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function timestampForFilename(){ const d = new Date(); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }

async function exportWishlistCSV(filename){
  if (!wishlist || wishlist.size === 0) { alert('Wishlist is empty — nothing to export.'); return; }
  const usedFilename = filename || `wishlist-${timestampForFilename()}.csv`;
  try {
    const originalRows = await loadOriginalRows();
    const idToRows = new Map();
    (originalRows || []).forEach((r,i)=>{ const id = rowIdFromRaw(r,i); if (!idToRows.has(id)) idToRows.set(id,[]); idToRows.get(id).push(r); });
    const outRows = [];
    Array.from(wishlist).forEach(id => {
      const rows = idToRows.get(id);
      if (rows && rows.length) rows.forEach(r => outRows.push(r));
      else outRows.push({ id });
    });
    let csv;
    if (typeof Papa !== 'undefined' && typeof Papa.unparse === 'function') csv = Papa.unparse(outRows);
    else {
      const keys = Array.from(outRows.reduce((s,r)=>{ Object.keys(r||{}).forEach(k=>s.add(k)); return s; }, new Set()));
      const lines = [keys.join(',')];
      outRows.forEach(r=>{ lines.push(keys.map(k=>{ const v = r[k] == null ? '' : String(r[k]).replace(/"/g,'""'); return `"${v}"`; }).join(',')); });
      csv = lines.join('\n');
    }
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, usedFilename);
  } catch (err) {
    console.error('Export failed', err);
    alert('Export failed: ' + (err && err.message ? err.message : err));
  }
}

const exportBtn = q('export-wishlist');
if (exportBtn) exportBtn.addEventListener('click', () => exportWishlistCSV());

let applyTimeout;
const searchEl = q('search');
if (searchEl) searchEl.addEventListener('input', () => { clearTimeout(applyTimeout); applyTimeout = setTimeout(() => window.applyFilters && window.applyFilters(), 250); });
const sortEl = q('sort');
if (sortEl) {
// call applyFilters whenever user picks a different sort option
sortEl.addEventListener('change', () => {
window.applyFilters && window.applyFilters();
});
// optional: respond to keyboard changes immediately in some browsers
sortEl.addEventListener('input', () => {
window.applyFilters && window.applyFilters();
});
}
function renderWishlistModal(){
const modal = q('modal');
const content = q('modal-content');
if (!modal || !content) return;

// localize modal close button
const closeBtn = q('close-modal');
if (closeBtn) closeBtn.textContent = '关闭';

// clear previous
content.innerHTML = '';

const container = document.createElement('div');

// Title
const h = document.createElement('h3');
h.textContent =`心愿单 (${wishlist.size})`;
container.appendChild(h);

// List items
if (wishlist.size === 0) {
const empty = document.createElement('div');
empty.textContent = '心愿单中空空如也~';
empty.style.padding = '8px 0';
container.appendChild(empty);
} else {
Array.from(wishlist).forEach(id => {
const it = items.find(x => x.id === id) || { id };

const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.justifyContent = 'space-between';
  row.style.gap = '8px';
  row.style.padding = '8px 0';
  row.style.borderBottom = '1px solid #eee';

  const left = document.createElement('div');
  left.style.flex = '1';
  left.textContent = it.title || it.jp_title || it.id;

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.alignItems = 'center';

  const detailsBtn = document.createElement('button');
  detailsBtn.type = 'button';
  detailsBtn.className = 'details-btn';
  detailsBtn.textContent = '详情';
  detailsBtn.style.marginRight = '10px'; // spacing between 详情 and 移出
  detailsBtn.addEventListener('click', () => {
    // keep modal open; if you prefer closing first, call window.closeModal()
    window.openDetail && window.openDetail(id);
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '移出';
  removeBtn.addEventListener('click', () => {
    window.removeFromWishlist && window.removeFromWishlist(id);
    // refresh modal contents
    renderWishlistModal();
  });

  right.appendChild(detailsBtn);
  right.appendChild(removeBtn);

  row.appendChild(left);
  row.appendChild(right);
  container.appendChild(row);
});}

// Export button row (Chinese)
const exportRow = document.createElement('div');
exportRow.style.marginTop = '12px';
const exportBtn = document.createElement('button');
exportBtn.type = 'button';
exportBtn.id = 'download-wishlist';
exportBtn.textContent = '导出心愿单';
exportBtn.addEventListener('click', () => exportWishlistCSV());
exportRow.appendChild(exportBtn);
container.appendChild(exportRow);

content.appendChild(container);

// show modal
modal.style.display = 'flex';
modal.setAttribute('aria-hidden', 'false');
}

const openWishlistBtn = q('open-wishlist');
if (openWishlistBtn) openWishlistBtn.addEventListener('click', renderWishlistModal);
// Cleanup leftover zoom overlay if present
const _oldZoom = document.getElementById('zoom-overlay'); if (_oldZoom) _oldZoom.remove();
