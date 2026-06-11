/**
 * Home hero — Proposition D: Orbital Beacon logo.
 * Radar pulses, orbiting accent dots, scan sweep, and dual-theme SVG core.
 */

const ICON_SVG = `
  <svg viewBox="0 0 256 256" class="brand-logo-beacon__art brand-logo-beacon__art--dark" aria-hidden="true">
    <use href="#mp-icon-dark"/>
  </svg>
  <svg viewBox="0 0 256 256" class="brand-logo-beacon__art brand-logo-beacon__art--light" aria-hidden="true">
    <use href="#mp-icon-light"/>
  </svg>`;

const BEACON_HTML = `
  <div class="brand-logo-beacon__pulse" aria-hidden="true"></div>
  <div class="brand-logo-beacon__pulse brand-logo-beacon__pulse--2" aria-hidden="true"></div>
  <div class="brand-logo-beacon__pulse brand-logo-beacon__pulse--3" aria-hidden="true"></div>
  <div class="brand-logo-beacon__orbit brand-logo-beacon__orbit--1" aria-hidden="true"></div>
  <div class="brand-logo-beacon__orbit brand-logo-beacon__orbit--2" aria-hidden="true"></div>
  <div class="brand-logo-beacon__beacon" aria-hidden="true"></div>
  <div class="brand-logo-beacon__core">
    ${ICON_SVG}
    <div class="brand-logo-beacon__scan" aria-hidden="true"></div>
  </div>`;

/**
 * Build a standalone Orbital Beacon logo element.
 * @param {'headline' | 'showcase'} size
 * @returns {HTMLElement}
 */
export function createBrandLogoBeacon(size = 'showcase') {
  const el = document.createElement('div');
  el.className = `brand-logo-beacon brand-logo-beacon--${size}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = BEACON_HTML;
  return el;
}

/**
 * Mount Orbital Beacon into an existing host (guest showcase column).
 * @param {HTMLElement} host
 * @param {{ size?: 'headline' | 'showcase' }} [opts]
 * @returns {() => void}
 */
export function mountBrandLogoBeacon(host, { size = 'showcase' } = {}) {
  host.className = `brand-logo-beacon brand-logo-beacon--${size}`;
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = BEACON_HTML;
  return () => {
    host.innerHTML = '';
    host.className = '';
    host.removeAttribute('aria-hidden');
  };
}
