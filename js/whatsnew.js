// What's new and the version, as Solar Timeline does them. One definition: assets/releases.json.
//
// - Elements with data-version show the current release ("Alpha 0.0.1"). The header's is a button that opens
//   What's new, with a dot on it while there is a release this browser has not seen (localStorage fs.seenVersion).
// - What's new: each release, newest first, its items marked New, Better or Fix, with Show me where an item has
//   an address in the app.
// - Feedback: a new GitHub issue with the version and the page filled in. Elements with data-whatsnew open the
//   panel; data-feedback links get the address.
// - A release still 'next' shows only away from the live site, marked In progress (GitHub Pages publishes main).
const KIND = { new: 'New', better: 'Better', fix: 'Fix' };
const SEEN = 'fs.seenVersion';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const label = r => `${r.stage} ${r.version}`;
const when = d => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'In progress, not yet on the site');

let data = null, current = null;

function feedbackUrl() {
  const v = current ? label(current) : '';
  const body = `\n\n---\nVersion: ${v}\nPage: ${location.href}\nBrowser: ${navigator.userAgent}`;
  return `${data.feedback}?title=${encodeURIComponent(`Feedback (${v})`)}&body=${encodeURIComponent(body)}`;
}

function fill(dialog) {
  dialog.innerHTML = `<h2>What's new</h2><div class="wn-list">${data.releases.map(r => `
    <section class="wn-rel${r.status === 'next' ? ' next' : ''}">
      <p class="wn-rh"><b>${esc(label(r))}</b><span>${esc(when(r.date))}</span></p>
      <p class="wn-title">${esc(r.title)}</p>
      <ul>${r.items.map(it => `<li><span class="wn-kind ${esc(it.kind)}">${esc(KIND[it.kind] ?? it.kind)}</span><span>${esc(it.text)}</span>${it.go ? `<a class="wn-go" href="${esc(it.go)}">Show me</a>` : '<span></span>'}</li>`).join('')}</ul>
    </section>`).join('')}</div>
    <p class="wn-foot"><span>Ideas, bugs, a fact that is wrong?</span><a data-feedback target="_blank" rel="noopener">Send feedback</a></p>
    <form method="dialog"><button class="primary">Close</button></form>`;
  dialog.querySelectorAll('.wn-go').forEach(a => a.addEventListener('click', () => dialog.close()));
  links(dialog);
}
function links(root) {
  for (const a of root.querySelectorAll('[data-feedback]')) { a.hidden = false; a.href = feedbackUrl(); a.addEventListener('click', () => { a.href = feedbackUrl(); }); }
}

export function openWhatsNew() {
  const dialog = document.getElementById('whatsnew');
  if (!data || !dialog) return;
  fill(dialog);
  dialog.showModal();
  try { localStorage.setItem(SEEN, current.version); } catch { /* private browsing */ }
  document.querySelectorAll('[data-version].unseen').forEach(e => e.classList.remove('unseen'));
}

export async function initWhatsNew() {
  try { data = await fetch('assets/releases.json').then(r => (r.ok ? r.json() : null)); } catch { data = null; }
  if (!data?.releases?.length) return;
  if (location.hostname === data.live) data.releases = data.releases.filter(r => r.status === 'released');
  current = data.releases.find(r => r.status === 'released') ?? data.releases[0];
  let seen = null;
  try { seen = localStorage.getItem(SEEN); } catch { /* private browsing */ }
  for (const e of document.querySelectorAll('[data-version]')) {
    e.textContent = label(current);
    if (e.matches('button')) { e.title = `${label(current)}, ${when(current.date)}: what's new in each version, and a way to send feedback`; e.classList.toggle('unseen', seen !== current.version); e.addEventListener('click', openWhatsNew); }
  }
  for (const e of document.querySelectorAll('[data-whatsnew]')) { e.hidden = false; e.addEventListener('click', ev => { ev.preventDefault(); openWhatsNew(); }); }
  links(document);
  return current;
}
