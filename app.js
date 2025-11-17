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

// Placeholder image (svg data URI)
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">' +
'<rect width="100%" height="100%" fill="#eee"/>' +
'<text x="50%" y="50%" font-size="20" text-anchor="middle" fill="#999" dy=".3em">No image</text>' +
'</svg>'
);

// Load CSV and initialize UI (uses your header names, Chinese title prioritized)
fetch(DATA_FILE).then(r => r.text()).then(txt => {
const parsed = Papa.parse(txt.trim(), { header: true, skipEmptyLines: true });
items = parsed.data.map((row,i) => ({
id: (row['image_filename'] || ('i'+i)).toString().trim(),
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
image_filename: (row['image_filename'] || '').toString().trim()
}));
// call globals (will be defined when this file is executed)
if (typeof window.populateFilters === 'function') window.populateFilters();
if (typeof window.applyFilters === 'function') window.applyFilters();
}).catch(err => {
console.error('Failed to load data.csv', err);
const listEl = document.getElementById('list');
if (listEl) listEl.innerHTML = '<p style="color:#b00">Could not load data.csv — upload it to the repo root.</p>';
});

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

paste the two replacement blocks again

window.openModal = function(html){
const modal = q('modal'); const content = q('modal-content');
if (!modal || !content) return;
content.innerHTML = html;
modal.style.display = 'flex';
modal.setAttribute('aria-hidden', 'false');
};

window.closeModal = function(){
const modal = q('modal');
if (!modal) return;
modal.style.display = 'none';
modal.setAttribute('aria-hidden', 'true');
};

window.escapeHtml = function(s){ if(!s) return ''; return String(s).replace(/[&<>"]/g, c=>({ '&':'&','<':'<','>':'>','"':'"' }[c])); };
window.escapeAttr = function(s){ return s ? String(s).replace(/"/g,'"') : ''; };
window.imgUrl = function(it){
if (!it || !it.image_filename) return PLACEHOLDER;
return IMAGES_FOLDER + it.image_filename;
};