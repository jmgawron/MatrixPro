const _scriptPromises = new Map();
const _stylePromises = new Map();

function loadScript(src) {
  if (!_scriptPromises.has(src)) {
    _scriptPromises.set(
      src,
      new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          resolve();
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(s);
      }),
    );
  }
  return _scriptPromises.get(src);
}

function loadStylesheet(href) {
  if (!_stylePromises.has(href)) {
    _stylePromises.set(
      href,
      new Promise((resolve, reject) => {
        const existing = document.querySelector(`link[href="${href}"]`);
        if (existing) {
          resolve();
          return;
        }
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        l.onload = () => resolve();
        l.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
        document.head.appendChild(l);
      }),
    );
  }
  return _stylePromises.get(href);
}

export async function ensureMarkdownDeps() {
  await Promise.all([
    loadStylesheet('https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css'),
    loadScript('https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js'),
    loadScript('https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.js'),
    loadScript('https://cdn.jsdelivr.net/npm/dompurify@3.1.7/dist/purify.min.js'),
    loadScript('https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js'),
  ]);
}

export async function ensureEcharts() {
  await loadScript('https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.min.js');
}
