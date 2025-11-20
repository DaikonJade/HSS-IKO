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

// Split a comma/semicolon/slash/pipe-separated tag string into normalized tokens
function splitTags(s){
if (!s) return [];
return String(s)
.split(/[,，;；/|]+/)     // split on common separators (comma, fullwidth comma, semicolon, slash, pipe)
.map(t => t.trim())
.filter(Boolean);
}

function normalizeRow(row, i){
return {
id: ((row['image_filename'] || row.image_filename || ('i' + i)) + '').toString().trim().replace(/^$/, ''), // remove leading $ if any
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

// Placeholder image (svg data URI)
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" font-size="20" text-anchor="middle" fill="#999" dy=".3em">No image</text></svg>'
);

// Escaping helpers
window.escapeHtml = function(s){ if(!s) return ''; return String(s).replace(/[&<>"]/g, c=>({ '&':'&','<':'<','>':'>','"':'"' }[c])); };
window.escapeAttr = function(s){ return s ? String(s).replace(/"/g,'"') : ''; };
window.imgUrl = function(it){
if (!it || !it.image_filename) return PLACEHOLDER;
return IMAGES_FOLDER + it.image_filename;
};

// Load CSV and initialize UI
fetch(DATA_FILE).then(r => r.text()).then(txt => {
const parsedRows = (typeof Papa !== 'undefined')
? Papa.parse(txt.trim(), { header: true, skipEmptyLines: true }).data
: [];

// Use normalizeRow consistently
const normalized = parsedRows.map((row, i) => normalizeRow(row, i));

items = normalized;
window.items = items;
filtered = items.slice();

if (typeof window.populateFilters === 'function') window.populateFilters();
if (typeof window.applyFilters === 'function') window.applyFilters();
})
.catch(err => {
console.error('Failed to load data.csv', err);
const listEl = document.getElementById('list');
if (listEl) listEl.innerHTML = '<p style="color:#b00">Could not load data.csv — upload it to the repo root.</p>';
});

window.populateFilters = function(){
// collect tokens (arrays) from items
const types = unique((items||[]).flatMap(i=>i.type || []));
const works = unique((items||[]).flatMap(i=>i.relevant_work || []));
const chars = unique((items||[]).flatMap(i=>i.relevant_character || []));
const imgs = unique((items||[]).flatMap(i=>i.relevant_image || []));

// fill the simple Type select if present
const selType = q('filter-type');
if(selType){
selType.innerHTML = '<option value="">All Types</option>';
types.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; selType.appendChild(o); });
}

// helper to render checkbox lists into a container
function renderCheckboxes(containerId, tokens){
const c = q(containerId);
if(!c) return;
c.innerHTML = '';
// tools
const tools = document.createElement('div');
tools.className = 'controls';
const allBtn = document.createElement('button'); allBtn.type='button'; allBtn.textContent='Select all';
const clearBtn = document.createElement('button'); clearBtn.type='button'; clearBtn.textContent='Clear';
allBtn.onclick = ()=>{ c.querySelectorAll('input[type=checkbox]').forEach(ch=>ch.checked=true); applyFilters(); };
clearBtn.onclick = ()=>{ c.querySelectorAll('input[type=checkbox]').forEach(ch=>ch.checked=false); applyFilters(); };
tools.appendChild(allBtn); tools.appendChild(clearBtn);
c.appendChild(tools);
const list = document.createElement('div');
list.style.maxHeight='220px'; list.style.overflow='auto';
tokens.forEach(tok=>{
  const id = containerId + '_opt_' + tok.replace(/\s+/g,'_').replace(/[^\w-]/g,'');
  const labelEl = document.createElement('label');
  labelEl.style.display = 'block';
  labelEl.style.fontSize = '13px';
  labelEl.style.cursor = 'pointer';
  labelEl.innerHTML = `<input type="checkbox" id="${id}" value="${tok}"> ${window.escapeHtml ? window.escapeHtml(tok) : tok}`;
  list.appendChild(labelEl);
  labelEl.querySelector('input').addEventListener('change', ()=>applyFilters());
});
c.appendChild(list);
  }

renderCheckboxes('filter-type-container', types);
renderCheckboxes('filter-work-container', works);
renderCheckboxes('filter-character-container', chars);
renderCheckboxes('filter-image-container', imgs);
};

window.removeFromWishlist = function(id){
wishlist.delete(id);
localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist)));
window.applyFilters && window.applyFilters();
// if modal open, refresh it
if (document.getElementById('modal') && document.getElementById('modal').style.display === 'flex') renderWishlistModal();
};

window.applyFilters = function(){
// helper to read checked tokens from a container
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
if(type && !(it.type||[]).includes(type)) return false;
  if(typeSelected.length){
  const have = (it.type||[]).map(v=>v.toLowerCase());
  if(!typeSelected.every(tok => have.includes(tok.toLowerCase()))) return false;
}
if(workSelected.length){
  const have = (it.relevant_work||[]).map(v=>v.toLowerCase());
  if(!workSelected.every(tok=>have.includes(tok.toLowerCase()))) return false;
}
if(charSelected.length){
  const have = (it.relevant_character||[]).map(v=>v.toLowerCase());
  if(!charSelected.every(tok=>have.includes(tok.toLowerCase()))) return false;
}
if(imgSelected.length){
  const have = (it.relevant_image||[]).map(v=>v.toLowerCase());
  if(!imgSelected.every(tok=>have.includes(tok.toLowerCase()))) return false;
}

if(search){
  const hay = ((it.title||'')+' '+(it.jp_title||'')+' '+(it.description||'')+' '+(it.relevant_work||'')+' '+(it.relevant_character||'')+' '+(it.detailed||'')).toLowerCase();
  if(!hay.includes(search)) return false;
}
return true;
  });

// same sorting logic
const sort = q('sort') ? q('sort').value : 'title';
filtered.sort((a,b)=>{
const va = (a[sort]||'').toString(); const vb = (b[sort]||'').toString();
if(sort==='release_date'){ const da = Date.parse(va)||0; const db = Date.parse(vb)||0; return db - da; }
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
const typeText = (it.type || []).join(', ');
const workText = (it.relevant_work || []).join(', ');
const charText = (it.relevant_character || []).join(', ');
card.innerHTML =`<img class="thumb" src="${window.escapeAttr ? window.escapeAttr(imgSrc) : imgSrc}" alt="">       <div class="card-body">         <strong>${window.escapeHtml ? window.escapeHtml(it.title||it.jp_title||it.id) : (it.title||it.jp_title||it.id)}</strong>         <div class="meta">${window.escapeHtml ? window.escapeHtml(typeText) : typeText} • ${window.escapeHtml ? window.escapeHtml(workText) : workText} • ${window.escapeHtml ? window.escapeHtml(charText) : charText}</div>         <div class="buttons">           <button class="detail-btn">Details</button>           <button class="${wishlist.has(it.id)?'wishlist-btn':''}" data-id="${window.escapeAttr ? window.escapeAttr(it.id) : it.id}">${wishlist.has(it.id)?'Wanted':'Add'}</button>         </div>       </div>`;
list.appendChild(card);
const wlBtn = card.querySelector('button[data-id]');
if (wlBtn) wlBtn.addEventListener('click', () => window.toggleWishlist && window.toggleWishlist(it.id, wlBtn));
});

const max = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
const prevBtn = q('prev'), nextBtn = q('next');
if (prevBtn) prevBtn.disabled = (page <= 1);
if (nextBtn) nextBtn.disabled = (page >= max);
const pageInfo = q('page-info');
if (pageInfo) pageInfo.textContent =`Page ${page} / ${max} — ${filtered.length} results`;
};

window.openDetail = async function(id){
try{
// lazy-load CSV if items empty
if(!window.items || !window.items.length){
const txt = await fetch('data.csv?_=' + Date.now()).then(r=>r.text());
const parsed = (typeof Papa !== 'undefined') ? Papa.parse(txt.trim(), {header:true, skipEmptyLines:true}).data : [];
window.items = parsed.map((row, i) => normalizeRow(row, i));
items = window.items;
if(typeof window.populateFilters === 'function') window.populateFilters();
if(typeof window.applyFilters === 'function') window.applyFilters();
}const cleaned = (id || '').toString().trim();
let it = window.items.find(x => (x.id||'').toString().trim() === cleaned);
if(!it){
  // fallback substring match
  it = window.items.find(x => (x.id||'').toString().includes(cleaned) || cleaned.includes((x.id||'').toString()));
}
if(!it){ console.warn('item not found', id); return; }

const typeText = (it.type || []).join(', ');
const workText = (it.relevant_work || []).join(', ');
const charText = (it.relevant_character || []).join(', ');
const img = (window.imgUrl ? window.imgUrl(it) : '') || '';

const html = `
  <div style="display:flex;gap:12px;flex-wrap:wrap">
    <img src="${window.escapeAttr ? window.escapeAttr(img) : img}" style="max-width:320px;width:100%;border-radius:6px" alt="">
    <div style="flex:1;min-width:220px">
      <h2 style="margin:0">${window.escapeHtml ? window.escapeHtml(it.title||it.jp_title||it.id) : (it.title||it.jp_title||it.id)}</h2>
      <div class="small">${window.escapeHtml ? window.escapeHtml(typeText) : typeText} • ${window.escapeHtml ? window.escapeHtml(workText) : workText}</div>
      ${ it.releaser && it.releaser.length ? `<div><strong>发行商：</strong>${window.escapeHtml ? window.escapeHtml(it.releaser.join(', ')) : it.releaser.join(', ')}</div>` : '' }
      ${ it.release_date ? `<div><strong>发行日期：</strong>${window.escapeHtml ? window.escapeHtml(it.release_date) : it.release_date}</div>` : '' }
      ${ it.release_price ? `<div><strong>发行价格：</strong>${window.escapeHtml ? window.escapeHtml(it.release_price) : it.release_price}</div>` : '' }
      ${ it.release_area && it.release_area.length ? `<div><strong>发行地区：</strong>${window.escapeHtml ? window.escapeHtml(it.release_area.join(', ')) : it.release_area.join(', ')}</div>` : '' }
      <p style="margin-top:12px">${window.escapeHtml ? window.escapeHtml(it.detailed||it.description||'') : (it.detailed||it.description||'')}</p>
      <div style="margin-top:10px">${it.resource ? `来源: <a href="${window.escapeAttr ? window.escapeAttr(it.resource) : it.resource}" target="_blank">${window.escapeHtml ? window.escapeHtml(it.resource) : it.resource}</a>` : ''}</div>
      <div style="margin-top:12px"><button onclick="window.toggleWishlist && window.toggleWishlist('${window.escapeAttr ? window.escapeAttr(it.id) : it.id}', this)">${wishlist.has(it.id)?'Wanted':'Add to Wanted'}</button></div>
    </div>
  </div>`;
if(window.openModal) window.openModal(html); else alert(it.title||it.id);}catch(e){
console.error('openDetail error', e);
}
};

function goPage(delta){
const max = Math.max(1, Math.ceil((filtered||[]).length / PAGE_SIZE));
page = Math.min(max, Math.max(1, page + delta));
renderPage();
}

// Delegated detail click handling (attach once)
(function(){
const listEl = document.getElementById('list');
if(!listEl) return;
if(listEl._detailDelegation) return; // already attached
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

const closeBtn = document.getElementById('close-modal');
if (closeBtn) {
closeBtn.addEventListener('click', function () {
if (typeof window.closeModal === 'function') {
window.closeModal();
} else {
const m = document.getElementById('modal');
if (m) { m.style.display = 'none'; m.setAttribute('aria-hidden', 'true'); }
}
});
}

window.toggleWishlist = function(id, btn){
if (wishlist.has(id)){
wishlist.delete(id);
if (btn){ btn.classList.remove('wishlist-btn'); btn.textContent = 'Add'; }
}
else {
wishlist.add(id);
if (btn){ btn.classList.add('wishlist-btn'); btn.textContent = 'Wanted'; }
}
localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist)));
// Refresh page buttons so list reflects wishlist state
renderPage();
};

// Debounced search input
let applyTimeout;
const searchEl = q('search');
if (searchEl) {
searchEl.addEventListener('input', () => {
clearTimeout(applyTimeout);
applyTimeout = setTimeout(() => window.applyFilters && window.applyFilters(), 250);
});
}

// Wishlist modal rendering and controls
function renderWishlistModal(){
const listIds = Array.from(wishlist);
const rows = listIds.map(id => {
const it = items.find(x=>x.id===id) || { id };
const title = it.title || it.jp_title || it.id;
return`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #eee"><div style="flex:1">${window.escapeHtml ? window.escapeHtml(title) : title}</div><div><button onclick="window.openDetail('${window.escapeAttr ? window.escapeAttr(id) : id}')">Details</button> <button onclick="window.removeFromWishlist('${window.escapeAttr ? window.escapeAttr(id) : id}')">Remove</button></div></div>`;
}).join('') || '<div>No items in your Wanted list.</div>';
const html =`<div><h3>Wanted list (${listIds.length})</h3>${rows}<div style="margin-top:12px"><button id="download-wanted">Export Wanted (JSON)</button></div></div>`;
window.openModal && window.openModal(html);
// attach export click (button inside modal)
setTimeout(()=>{
const dl = document.getElementById('download-wanted');
if (dl) dl.addEventListener('click', function(){
const data = JSON.stringify(Array.from(wishlist), null, 2);
const blob = new Blob([data], {type:'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = 'wanted.json';
document.body.appendChild(a); a.click(); a.remove();
URL.revokeObjectURL(url);
});
}, 50);
}

const openWishlistBtn = q('open-wishlist');
if (openWishlistBtn) openWishlistBtn.addEventListener('click', renderWishlistModal);

// Export button (same as in modal, but keep available)
// helper: load original CSV rows once per page load
async function loadOriginalRows(){
if (window._originalRows) return window.originalRows;
const txt = await fetch('data.csv?=' + Date.now()).then(r => r.text());
const parsed = (typeof Papa !== 'undefined')
? Papa.parse(txt.trim(), { header: true, skipEmptyLines: true }).data
: [];
window._originalRows = parsed;
return parsed;
}

// same id logic as normalizeRow, applied to raw CSV row + index
function rowIdFromRaw(row, i){
return ((row['image_filename'] || row.image_filename || ('i' + i)) + '').toString().trim().replace(/^$/, '');
}

function downloadBlob(blob, filename){
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
}

const exportBtn = q('export-wishlist');
if (exportBtn) exportBtn.addEventListener('click', async () => {
if (!wishlist || wishlist.size === 0) {
alert('Wishlist is empty — nothing to export.');
return;
}

try {
const originalRows = await loadOriginalRows();// Build a map from id -> rawRow(s). Use arrays in case of duplicate ids.
const idToRows = new Map();
(originalRows || []).forEach((r, i) => {
  const id = rowIdFromRaw(r, i);
  if (!idToRows.has(id)) idToRows.set(id, []);
  idToRows.get(id).push(r);
});

// Collect rows in the same order as the wishlist
const outRows = [];
Array.from(wishlist).forEach(id => {
  const rows = idToRows.get(id);
  if (rows && rows.length) {
    // if there are multiple rows with same id, include them all
    rows.forEach(r => outRows.push(r));
  } else {
    // not found in data.csv — produce a minimal fallback row
    outRows.push({ id });
  }
});

// Use Papa.unparse if available; otherwise build a simple CSV
let csv;
if (typeof Papa !== 'undefined') {
  csv = Papa.unparse(outRows);
} else {
  // simple fallback: compute headers from union of keys
  const keys = Array.from(outRows.reduce((s, r) => {
    Object.keys(r || {}).forEach(k => s.add(k));
    return s;
  }, new Set()));
  const lines = [keys.join(',')];
  outRows.forEach(r => {
    lines.push(keys.map(k => {
      const v = r[k] == null ? '' : String(r[k]).replace(/"/g, '""');
      return `"${v}"`;
    }).join(','));
  });
  csv = lines.join('\n');
}

// prepend BOM for Excel compatibility
const bom = '\uFEFF';
const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
downloadBlob(blob, 'wanted.csv');} catch (err) {
console.error('Export failed', err);
alert('Export failed: ' + (err && err.message ? err.message : err));
}
});

// Import button & file input
const importFile = q('import-file');
const importBtn = q('import-wishlist');
if (importBtn && importFile){
importBtn.addEventListener('click', ()=> importFile.click());
importFile.addEventListener('change', (e)=>{
const f = e.target.files && e.target.files[0];
if (!f) return;
const reader = new FileReader();
reader.onload = function(ev){
try{
const parsed = JSON.parse(ev.target.result);
if (!Array.isArray(parsed)) throw new Error('Expected JSON array of ids');
parsed.forEach(id => wishlist.add(String(id)));
localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist)));
renderPage();
alert('Imported ' + parsed.length + ' ids into Wanted list.');
}catch(err){
alert('Failed to import: ' + err.message);
} finally {
importFile.value = '';
}
};
reader.readAsText(f);
});
}
