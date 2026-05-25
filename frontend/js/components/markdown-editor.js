const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'hr',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

const TURNDOWN_OPTIONS = {
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
  linkStyle: 'inlined',
};

let _turndown = null;
function getTurndown() {
  if (_turndown) return _turndown;
  if (typeof TurndownService === 'undefined') {
    throw new Error('Turndown not loaded');
  }
  _turndown = new TurndownService(TURNDOWN_OPTIONS);
  return _turndown;
}

function configureMarked() {
  if (typeof marked === 'undefined') return;
  marked.setOptions({ gfm: true, breaks: true, headerIds: false, mangle: false });
}
configureMarked();

export function markdownToHtml(md) {
  if (!md) return '';
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
    return escapeHtml(String(md));
  }
  const rawHtml = marked.parse(String(md));
  return DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG);
}

export function htmlToMarkdown(html) {
  if (!html) return '';
  try {
    return getTurndown().turndown(String(html)).trim();
  } catch (_e) {
    return String(html);
  }
}

export function sanitizeHtml(html) {
  if (!html) return '';
  if (typeof DOMPurify === 'undefined') return escapeHtml(String(html));
  return DOMPurify.sanitize(String(html), DOMPURIFY_CONFIG);
}

export function renderDescription(value, format) {
  if (!value) return '';
  if (format === 'legacy_html') return sanitizeHtml(value);
  return markdownToHtml(value);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const TOOLBAR = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ header: [1, 2, 3, false] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block'],
  ['link'],
  ['clean'],
];

export function mountMarkdownEditor(container, options = {}) {
  if (typeof Quill === 'undefined') {
    throw new Error('Quill not loaded');
  }

  const initialMd = options.initialMarkdown || '';
  const editorRoot = document.createElement('div');
  editorRoot.className = 'md-editor';
  container.appendChild(editorRoot);

  const editorEl = document.createElement('div');
  editorEl.className = 'md-editor__quill';
  editorRoot.appendChild(editorEl);

  const quill = new Quill(editorEl, {
    theme: 'snow',
    placeholder: options.placeholder || 'Write in Markdown — formatting toolbar above',
    modules: { toolbar: TOOLBAR },
  });

  if (initialMd) {
    quill.root.innerHTML = markdownToHtml(initialMd);
  }

  return {
    quill,
    getMarkdown() {
      return htmlToMarkdown(quill.root.innerHTML);
    },
    setMarkdown(md) {
      quill.root.innerHTML = markdownToHtml(md || '');
    },
    isEmpty() {
      return quill.getText().trim().length === 0;
    },
    focus() {
      quill.focus();
    },
    destroy() {
      editorRoot.remove();
    },
  };
}
