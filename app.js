// Configuration
const DATA_FILE = 'data.csv';
const IMAGES_FOLDER = 'images/';
const PAGE_SIZE = 24;

let items = [];
let filtered = [];
let page = 1;
let wishlist = new Set(JSON.parse(localStorage.getItem('wanted')||'[]'));

// Helpers
function q(id){return document.getElementById(id)}
function unique(values){return [...new Set(values.filter(v => v && v.trim()))].sort()}
function isBlank(s){return s===undefined||s===null||String(s).trim()===''}

// Placeholder image (svg data URI)
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" font-size="20" text-anchor="middle" fill="#999" dy=".3em">No image</text></svg>'
);

// Load CSV and initialize UI (uses your header names, Chinese title prioritized)
fetch(DATA_FILE).then(r=>r.text()).then(txt=>{
const parsed = Papa.parse(txt.trim(), {header:true,skipEmptyLines:true});
items = parsed.data.map((row,i)=>({
id: (row['image_filename'] || ('i'+i)).trim(),
title: ((row['中文名字 Chinese Name'] || row['中文名字'] || row['日文名字 Japanese Name'] || row['日文名字']) || '').trim(),
jp_title: (row['日文名字 Japanese Name'] || row['日文名字'] || '').trim(),
type: (row['类型 Type'] || row['类型'] || row['Type'] || '').trim(),
relevant_work: (row['相关作品 Relevant Work'] || row['相关作品'] || '').trim(),
relevant_character: (row['相关人物 Relevant Character'] || row['相关人物'] || '').trim(),
relevant_image: (row['相关柄图 Relevant Image'] || row['相关柄图'] || '').trim(),
releaser: (row['Releaser/Event 发行商'] || row['发行商'] || '').trim(),
release_date: (row['发行日期 Release Year/Date'] || row['发行日期'] || '').trim(),
release_price: (row['发行价格 Release Price (JPY)'] || row['发行价格'] || '').trim(),
release_area: (row['发行地区 Release Area'] || row['发行地区'] || '').trim(),
resource: (row['信息来源 Resource'] || row['信息来源'] || '').trim(),
detailed: (row['详细信息 Detailed Information'] || row['详细信息'] || '').trim(),
description: (row['详细信息 Detailed Information'] || row['description'] || '').trim(),
image_filename: (row['image_filename'] || '').trim()
}));
window.populateFilters();
window.applyFilters();
}).catch(err=>{
console.error('Failed to load data.csv',err);
document.getElementById('list').innerHTML = '<p style="color:#b00">Could not load data.csv — upload it to the repo root.</p>';
});

window.populateFilters = function(){
const types = unique(items.map(i=>i.type));
const works = unique(items.map(i=>i.relevant_work));
const chars = unique(items.map(i=>i.relevant_character));
const imgs = unique(items.map(i=>i.relevant_image));
const fill = (id, arr)=>{
const sel = q(id);
arr.forEach(v=>{
const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o);
});
}
fill('filter-type', types); fill('filter-work', works); fill('filter-character', chars); fill('filter-image', imgs);
}

// UI events
['filter-type','filter-work','filter-character','filter-image','search','sort'].forEach(id=>{
const el = q(id);
el.addEventListener('change',()=>{ page=1; window.applyFilters() });
if(id==='search') el.addEventListener('input',()=>{ page=1; window.applyFilters() });
});
q('prev').addEventListener('click',()=>{ if(page>1){page--;window.renderPage()}});
q('next').addEventListener('click',()=>{ const max = Math.ceil(filtered.length/PAGE_SIZE); if(page<max){page++;window.renderPage()}});

// Wishlist/export/import
q('open-wishlist').addEventListener('click', ()=>{ window.showWishlist && window.showWishlist(); });
q('export-wishlist').addEventListener('click', ()=> {
const arr = Array.from(wishlist);
const data = JSON.stringify(arr, null, 2);
const a = document.createElement('a');
a.href = URL.createObjectURL(new Blob([data],{type:'application/json'}));
a.download = 'wanted.json'; a.click();
});
q('import-wishlist').addEventListener('click', ()=> q('import-file').click());
q('import-file').addEventListener('change', e=>{
const f = e.target.files[0]; if(!f) return;
const r = new FileReader(); r.onload = ()=> {
try {
const arr = JSON.parse(r.result);
wishlist = new Set(arr);
localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist)));
alert('Imported wanted list ('+wishlist.size+' items).');
window.applyFilters();
} catch(err){ alert('Invalid JSON'); }
}; r.readAsText(f);
});

window.removeFromWishlist = function(id){
wishlist.delete(id); localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist))); window.applyFilters(); window.closeModal && window.closeModal();
}

window.applyFilters = function(){
const type = q('filter-type').value;
const work = q('filter-work').value;
const character = q('filter-character').value;
const imageLabel = q('filter-image').value;
const search = q('search').value.trim().toLowerCase();
filtered = items.filter(it=>{
if(type && it.type !== type) return false;
if(work && it.relevant_work !== work) return false;
if(character && it.relevant_character !== character) return false;
if(imageLabel && it.relevant_image !== imageLabel) return false;
if(search){
const s = ((it.title||'')+' '+(it.jp_title||'')+' '+(it.description||'')+' '+(it.relevant_character||'')+' '+(it.relevant_work||'')+' '+(it.detailed||'')).toLowerCase();
if(!s.includes(search)) return false;
}
return true;
});
const sort = q('sort').value;
filtered.sort((a,b)=>{
const va = (a[sort]||'').toString(); const vb = (b[sort]||'').toString();
if(sort==='release_date'){
const da = Date.parse(va)||0; const db = Date.parse(vb)||0;
return db - da;
}
return va.localeCompare(vb);
});
page = 1;
window.renderPage && window.renderPage();
}

window.renderPage = function(){
const start = (page-1)*PAGE_SIZE;
const slice = filtered.slice(start, start+PAGE_SIZE);
const list = q('list'); list.innerHTML = '';
slice.forEach(it=>{
const card = document.createElement('div'); card.className='card';
card.innerHTML = <img class="thumb" src="${window.escapeAttr(window.imgUrl(it))}" alt="">       <div class="card-body">         <strong>${window.escapeHtml(it.title||it.jp_title||it.id)}</strong>         <div class="meta">${window.escapeHtml(it.type)} • ${window.escapeHtml(it.relevant_work)} • ${window.escapeHtml(it.relevant_character)}</div>         <div class="buttons">           <button onclick="window.openDetail('${it.id}')">Details</button>           <button class="${wishlist.has(it.id)?'wishlist-btn':''}" onclick="window.toggleWishlist('${it.id}', this)">${wishlist.has(it.id)?'Wanted':'Add'}</button>         </div>       </div>;
list.appendChild(card);
});
const max = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
q('page-info').textContent = Page ${page} / ${max} — ${filtered.length} results;
}

window.toggleWishlist = function(id, btn){
if(wishlist.has(id)){ wishlist.delete(id); if(btn) btn.classList.remove('wishlist-btn'); if(btn) btn.textContent='Add' }
else { wishlist.add(id); if(btn) btn.classList.add('wishlist-btn'); if(btn) btn.textContent='Wanted' }
localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist)));
}

window.showWishlist = function(){
const ids = Array.from(wishlist);
const list = items.filter(it=>ids.includes(it.id));
if(list.length===0) return window.openModal && window.openModal('<p>No items in your Wanted list yet.</p>');
const html = list.map(it=><div style="display:flex;gap:10px;margin-bottom:10px">     <img src="${window.escapeAttr(window.imgUrl(it))}" alt="" style="width:90px;height:90px;object-fit:cover;border-radius:6px">     <div>       <strong>${window.escapeHtml(it.title||it.jp_title||it.id)}</strong><div class="small">${window.escapeHtml(it.type)} • ${window.escapeHtml(it.relevant_work)}</div>       <div style="margin-top:6px"><button class="ghost" onclick="window.removeFromWishlist('${it.id}')">Remove</button></div>     </div></div>).join('');
window.openModal && window.openModal(html);
}

window.openModal = function(html){ q('modal-content').innerHTML = html; q('modal').style.display='flex'; q('modal').setAttribute('aria-hidden','false');}
window.closeModal = function(){ q('modal').style.display='none'; q('modal').setAttribute('aria-hidden','true'); }

window.escapeHtml = function(s){ if(!s) return ''; return String(s).replace(/[&<>"]/g, c=>({ '&':'&','<':'<','>':'>','"':'"' }[c])); }
window.escapeAttr = function(s){ return s?String(s).replace(/"/g,'"'):''; }
window.imgUrl = function(it){
if(!it || !it.image_filename) return PLACEHOLDER;
return IMAGES_FOLDER + it.image_filename;
}