// Configuration
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

// Placeholder image (svg data URI) — single-line to avoid parser issues
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" font-size="20" text-anchor="middle" fill="#999" dy=".3em">No image</text></svg>'
);

// Load CSV and initialize UI
fetch(DATA_FILE).then(r => r.text()).then(txt => {
const parsed = (typeof Papa !== 'undefined') ? Papa.parse(txt.trim(), { header: true, skipEmptyLines: true }) : { data: [] };
items = parsed.data.map((row,i) => ({
id: (row['image_filename'] || row.image_filename || ('i'+i)).toString().trim(),
title: ((row['中文名字 Chinese Name'] || row['中文名字'] || row['日文名字 Japanese Name'] || row['日文名字']) || '').toString().trim(),
jp_title: (row['日文名字 Japanese Name'] || row['日文名字'] || '').toString().trim(),
type: (row['类型 Type'] || row['类型'] || row['Type'] || '').toString().trim(),
relevant_work: (row['相关作品 Relevant Work'] || row['相关作品'] || '').toString().trim(),
relevant_character: (row['相关人物 Relevant Character'] || row['相关人物'] || '').toString().trim(),
relevant_image: (row['相关柄图 Relevant Image'] || row['相关柄图'] || '').toString().trim(),
releaser: (row['Releaser/Event 发行商'] || row['发行商'] || '').toString().trim(),
release_date: (row['发行日期 Release Year/Date'] || row['发行日期'] || '').toString().trim(),
release_price: (row['发行价格 Release Price (JPY)'] || row['发行价格'] || '').toString().trim(),
release_area: (row['发行地区 Release Area'] || row['发行地区'] || '').toString().trim(),
resource: (row['信息来源 Resource'] || row['信息来源'] || '').toString().trim(),
detailed: (row['详细信息 Detailed Information'] || row['详细信息'] || '').toString().trim(),
description: (row['详细信息 Detailed Information'] || row['description'] || '').toString().trim(),
image_filename: (row['image_filename'] || row.image_filename || '').toString().trim()
}));
if (typeof window.populateFilters === 'function') window.populateFilters();
if (typeof window.applyFilters === 'function') window.applyFilters();
}).catch(err => {
console.error('Failed to load data.csv', err);
const listEl = document.getElementById('list');
if (listEl) listEl.innerHTML = '<p style="color:#b00">Could not load data.csv — upload it to the repo root.</p>';
});

// Populate filter select lists
window.populateFilters = function(){
const types = unique(items.map(i => i.type));
const works = unique(items.map(i => i.relevant_work));
const chars = unique(items.map(i => i.relevant_character));
const imgs = unique(items.map(i => i.relevant_image));
const fill = (id, arr) => {
const sel = q(id);
if (!sel) return;
sel.innerHTML = '';
const opt = document.createElement('option'); opt.value = ''; opt.textContent = sel.getAttribute('data-all') || 'All'; sel.appendChild(opt);
arr.forEach(v => {
const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o);
});
};
fill('filter-type', types);
fill('filter-work', works);
fill('filter-character', chars);
fill('filter-image', imgs);
};

// UI events and controls
['filter-type','filter-work','filter-character','filter-image','search','sort'].forEach(id => {
const el = q(id);
if (!el) return;
el.addEventListener('change', () => { page = 1; window.applyFilters(); });
if (id === 'search') el.addEventListener('input', () => { page = 1; window.applyFilters(); });
});

const prevBtn = q('prev'), nextBtn = q('next');
if (prevBtn) prevBtn.addEventListener('click', () => { if (page > 1) { page--; window.renderPage(); }});
if (nextBtn) nextBtn.addEventListener('click', () => { const max = Math.ceil(filtered.length / PAGE_SIZE); if (page < max) { page++; window.renderPage(); }});

q('open-wishlist') && q('open-wishlist').addEventListener('click', () => { window.showWishlist && window.showWishlist(); });
q('export-wishlist') && q('export-wishlist').addEventListener('click', () => {
const arr = Array.from(wishlist);
const data = JSON.stringify(arr, null, 2);
const a = document.createElement('a');
a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
a.download = 'wanted.json'; a.click();
});
q('import-wishlist') && q('import-wishlist').addEventListener('click', () => q('import-file') && q('import-file').click());
q('import-file') && q('import-file').addEventListener('change', e => {
const f = e.target.files[0]; if (!f) return;
const r = new FileReader(); r.onload = () => {
try {
const arr = JSON.parse(r.result);
wishlist = new Set(arr);
localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist)));
alert('Imported wanted list (' + wishlist.size + ' items).');
window.applyFilters();
} catch (err) { alert('Invalid JSON'); }
}; r.readAsText(f);
});

window.removeFromWishlist = function(id){
wishlist.delete(id); localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist))); window.applyFilters(); window.closeModal && window.closeModal();
};

window.applyFilters = function(){
const type = q('filter-type') ? q('filter-type').value : '';
const work = q('filter-work') ? q('filter-work').value : '';
const character = q('filter-character') ? q('filter-character').value : '';
const imageLabel = q('filter-image') ? q('filter-image').value : '';
const search = q('search') ? q('search').value.trim().toLowerCase() : '';
filtered = items.filter(it => {
if (type && it.type !== type) return false;
if (work && it.relevant_work !== work) return false;
if (character && it.relevant_character !== character) return false;
if (imageLabel && it.relevant_image !== imageLabel) return false;
if (search) {
const s = ((it.title||'') + ' ' + (it.jp_title||'') + ' ' + (it.description||'') + ' ' + (it.relevant_character||'') + ' ' + (it.relevant_work||'') + ' ' + (it.detailed||'')).toLowerCase();
if (!s.includes(search)) return false;
}
return true;
});
const sort = q('sort') ? q('sort').value : 'title';
filtered.sort((a,b) => {
const va = (a[sort]||'').toString(); const vb = (b[sort]||'').toString();
if (sort === 'release_date') {
const da = Date.parse(va) || 0; const db = Date.parse(vb) || 0;
return db - da;
}
return va.localeCompare(vb);
});
page = 1;
window.renderPage && window.renderPage();
};

window.renderPage = function(){
const start = (page - 1) * PAGE_SIZE;
const slice = filtered.slice(start, start + PAGE_SIZE);
const list = q('list');
if (!list) return;
list.innerHTML = '';
slice.forEach(it => {
const card = document.createElement('div'); card.className = 'card';
card.dataset.id = it.id;
const imgSrc = window.imgUrl ? window.imgUrl(it) : '';
card.innerHTML =        <img class="thumb" src="${window.escapeAttr ? window.escapeAttr(imgSrc) : imgSrc}" alt="">       <div class="card-body">         <strong>${window.escapeHtml ? window.escapeHtml(it.title||it.jp_title||it.id) : (it.title||it.jp_title||it.id)}</strong>         <div class="meta">${window.escapeHtml ? window.escapeHtml(it.type) : it.type} • ${window.escapeHtml ? window.escapeHtml(it.relevant_work) : it.relevant_work} • ${window.escapeHtml ? window.escapeHtml(it.relevant_character) : it.relevant_character}</div>         <div class="buttons">           <button class="detail-btn">Details</button>           <button class="${wishlist.has(it.id)?'wishlist-btn':''}" data-id="${it.id}">${wishlist.has(it.id)?'Wanted':'Add'}</button>         </div>       </div>;
list.appendChild(card);
// per-card handlers (optional, delegation will handle Details)
const wlBtn = card.querySelector('button[data-id]');
if(wlBtn) wlBtn.addEventListener('click', ()=> window.toggleWishlist && window.toggleWishlist(it.id, wlBtn));
});
const max = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
const pageInfo = q('page-info');
if (pageInfo) pageInfo.textContent = Page ${page} / ${max} — ${filtered.length} results;
};

// Define openDetail (global)
window.openDetail = function(id){
if(!window.items) return;
const it = window.items.find(x => x.id === id);
if(!it) return;
const img = window.imgUrl ? window.imgUrl(it) : '';
const html =      <div style="display:flex;gap:12px;flex-wrap:wrap">       <img src="${window.escapeAttr ? window.escapeAttr(img) : img}" style="max-width:320px;width:100%;border-radius:6px" alt="">       <div style="flex:1;min-width:220px">         <h2 style="margin:0">${window.escapeHtml ? window.escapeHtml(it.title||it.jp_title||it.id) : (it.title||it.jp_title||it.id)}</h2>         <div class="small">${window.escapeHtml ? window.escapeHtml(it.type) : it.type} • ${window.escapeHtml ? window.escapeHtml(it.relevant_work) : it.relevant_work}</div>         <p style="margin-top:12px">${window.escapeHtml ? window.escapeHtml(it.detailed||it.description||'') : (it.detailed||it.description||'')}</p>         <div style="margin-top:10px">${it.resource?来源: <a href="${window.escapeAttr?window.escapeAttr(it.resource):it.resource}" target="_blank">${window.escapeHtml?window.escapeHtml(it.resource):it.resource}</a>:''}</div>         <div style="margin-top:12px"><button onclick="window.toggleWishlist && window.toggleWishlist('${it.id}', this)">${wishlist.has(it.id)?'Wanted':'Add to Wanted'}</button></div>       </div>     </div>;
if(window.openModal) window.openModal(html); else alert(it.title||it.id);
};

// Permanent delegation for Details buttons
const listEl = document.getElementById('list');
if (listEl) {
listEl.addEventListener('click', function (e) {
const btn = e.target.closest('.detail-btn');
if (!btn) return;
const card = btn.closest('.card');
const idBtn = card && card.querySelector('button[data-id]');
const id = idBtn ? idBtn.getAttribute('data-id') : (card && card.dataset && card.dataset.id);
if (id) window.openDetail && window.openDetail(id);
});
}

// Helpers for safe output
window.escapeHtml = function(s){ if(!s) return ''; return String(s).replace(/[&<>"]/g, c=>({ '&':'&','<':'<','>':'>','"':'"' }[c])); };
window.escapeAttr = function(s){ return s ? String(s).replace(/"/g,'"') : ''; };
window.imgUrl = function(it){
if (!it || !it.image_filename) return PLACEHOLDER;
return IMAGES_FOLDER + it.image_filename;
};