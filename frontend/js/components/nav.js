import { Store } from '../state.js';
import { Router } from '../router.js';

const ROLE_RANK = { engineer: 1, manager: 2, admin: 3 };

const NAV_ITEMS = [
  { label: 'Home', href: '/', minRole: null },
  { label: 'My Plan', href: '/my-plan', minRole: 'engineer' },
  { label: 'My Team', href: '/my-team', minRole: 'manager' },
  { label: 'Catalog', href: '/catalog', minRole: 'engineer' },
  { label: 'Skill Explorer', href: '/skill-explorer', minRole: 'engineer' },
];

function rankOf(role) {
  return ROLE_RANK[role] ?? 0;
}

function canAccess(item, userRole) {
  if (!item.minRole) return true;
  return rankOf(userRole) >= rankOf(item.minRole);
}

function buildNavLinks(userRole, isLoggedIn) {
  const visible = NAV_ITEMS.filter(item => canAccess(item, userRole));
  return visible.map(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${item.href}`;
    a.textContent = item.label;
    a.setAttribute('data-route-link', '');
    li.appendChild(a);
    return li;
  });
}

function buildAuthItem(isLoggedIn, user) {
  const li = document.createElement('li');
  li.className = 'nav-auth';
  if (isLoggedIn) {
    const span = document.createElement('span');
    span.className = 'nav-user';
    span.textContent = user?.name ?? user?.email ?? 'Account';

    const btn = document.createElement('button');
    btn.className = 'btn-logout';
    btn.textContent = 'Logout';
    btn.addEventListener('click', () => {
      localStorage.removeItem('matrixpro_token');
      Store.set('user', null);
      Router.go('/login');
    });

    li.appendChild(span);
    li.appendChild(btn);
  }
  return li;
}

function renderNav() {
  const navLinks = document.getElementById('navLinks');
  const mobileMenu = document.getElementById('mobileMenu');
  if (!navLinks) return;

  const user = Store.get('user');
  const userRole = user?.role ?? null;
  const isLoggedIn = !!user;

  navLinks.innerHTML = '';
  mobileMenu.innerHTML = '';

  const items = buildNavLinks(userRole, isLoggedIn);
  items.forEach(li => navLinks.appendChild(li));
  navLinks.appendChild(buildAuthItem(isLoggedIn, user));

  const currentPath = Router.current();
  const allLinks = NAV_ITEMS.filter(item => canAccess(item, userRole));
  allLinks.forEach(item => {
    const a = document.createElement('a');
    a.href = `#${item.href}`;
    a.textContent = item.label;
    a.setAttribute('data-route-link', '');
    const isActive = item.href === currentPath || (item.href !== '/' && currentPath.startsWith(item.href));
    if (isActive) a.classList.add('active');
    mobileMenu.appendChild(a);
  });

  if (isLoggedIn) {
    const logoutA = document.createElement('a');
    logoutA.href = '#';
    logoutA.textContent = 'Logout';
    logoutA.addEventListener('click', e => {
      e.preventDefault();
      localStorage.removeItem('matrixpro_token');
      Store.set('user', null);
      Router.go('/login');
      closeMobileMenu();
    });
    mobileMenu.appendChild(logoutA);
  }
}

function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const hamburger = document.getElementById('navHamburger');
  menu?.classList.remove('open');
  if (hamburger) {
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.classList.remove('open');
  }
}

export function initNav(routes) {
  renderNav();

  Store.on('user', () => renderNav());

  window.addEventListener('hashchange', () => {
    renderNav();
    closeMobileMenu();
  });

  const hamburger = document.getElementById('navHamburger');
  hamburger?.addEventListener('click', () => {
    const menu = document.getElementById('mobileMenu');
    const isOpen = menu?.classList.contains('open');
    if (isOpen) {
      closeMobileMenu();
    } else {
      menu?.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      hamburger.classList.add('open');
    }
  });
}
