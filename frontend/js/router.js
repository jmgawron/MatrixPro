import { Store } from './state.js';

const ROLE_RANK = { engineer: 1, manager: 2, admin: 3 };

function rankOf(role) {
  return ROLE_RANK[role] ?? 0;
}

function parseHash() {
  const hash = window.location.hash.slice(1) || '/';
  const [path, ...queryParts] = hash.split('?');
  const query = queryParts.join('?');
  return { path, query };
}

function matchRoute(path, routes) {
  if (routes[path]) return { route: routes[path], params: {} };

  for (const pattern of Object.keys(routes)) {
    if (!pattern.includes(':')) continue;
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) continue;

    const params = {};
    let matched = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { route: routes[pattern], params };
  }

  return null;
}

function render404(container) {
  container.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'page-404';
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">404</div>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <a href="#/" class="btn btn-primary">Go Home</a>
    </div>
  `;
  container.appendChild(el);
}

let _routes = {};
let _container = null;
let _currentCleanup = null;

function navigate() {
  const { path } = parseHash();
  const matched = matchRoute(path, _routes);

  if (_currentCleanup) {
    _currentCleanup();
    _currentCleanup = null;
  }

  _container.innerHTML = '';

  if (!matched) {
    render404(_container);
    updateActiveLinks(path);
    return;
  }

  const { route, params } = matched;
  const user = Store.get('user');
  const userRole = user?.role ?? null;

  if (!route.public && !userRole) {
    window.location.hash = '#/login';
    return;
  }

  if (route.minRole && rankOf(userRole) < rankOf(route.minRole)) {
    _container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <h2>Access Denied</h2>
        <p>You don't have permission to view this page.</p>
        <a href="#/" class="btn btn-primary">Go Home</a>
      </div>
    `;
    return;
  }

  document.title = route.title ? `${route.title} — MatrixPro` : 'MatrixPro';

  const cleanup = route.mount(_container, params);
  if (typeof cleanup === 'function') _currentCleanup = cleanup;

  updateActiveLinks(path);
}

function updateActiveLinks(currentPath) {
  document.querySelectorAll('[data-route-link]').forEach(link => {
    const href = link.getAttribute('href')?.replace('#', '') ?? '';
    const isActive = href === currentPath || (href !== '/' && currentPath.startsWith(href));
    link.classList.toggle('active', isActive);
  });
}

export const Router = {
  init(routes, container) {
    _routes = routes;
    _container = container;
    window.addEventListener('hashchange', navigate);
    navigate();
  },

  go(path) {
    window.location.hash = `#${path}`;
  },

  current() {
    return parseHash().path;
  },
};
