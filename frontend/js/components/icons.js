/**
 * MatrixPro Skill Icons — Inline SVG icon definitions
 * 55+ stroke-based icons for networking, security, and datacenter skills
 * All icons use 24×24 viewBox, stroke="currentColor", fill="none"
 */

/**
 * @type {Record<string, { paths: string, viewBox?: string }>}
 */
export const SKILL_ICONS = {

  // ─── Networking ───────────────────────────────────────────────────────────

  /** Router: box with two antennas on top, ports on front */
  router: {
    paths: `<rect x="2" y="9" width="20" height="9" rx="2"/>
<line x1="8" y1="9" x2="8" y2="18"/>
<line x1="16" y1="9" x2="16" y2="18"/>
<circle cx="5" cy="13.5" r="1"/>
<circle cx="12" cy="13.5" r="1"/>
<circle cx="19" cy="13.5" r="1"/>
<line x1="9" y1="9" x2="7" y2="4"/>
<line x1="15" y1="9" x2="17" y2="4"/>
<line x1="7" y1="4" x2="7" y2="2"/>
<line x1="17" y1="4" x2="17" y2="2"/>`,
  },

  /** Switch: rectangular device with multiple ports on front */
  switch: {
    paths: `<rect x="1" y="7" width="22" height="10" rx="2"/>
<rect x="3" y="10" width="2" height="4" rx="0.5"/>
<rect x="7" y="10" width="2" height="4" rx="0.5"/>
<rect x="11" y="10" width="2" height="4" rx="0.5"/>
<rect x="15" y="10" width="2" height="4" rx="0.5"/>
<rect x="19" y="10" width="2" height="4" rx="0.5"/>
<circle cx="21" cy="9" r="0.75" fill="currentColor"/>`,
  },

  /** Access point: circle device with wifi arcs radiating outward */
  'access-point': {
    paths: `<circle cx="12" cy="12" r="2"/>
<path d="M8.5 8.5a5 5 0 0 0 0 7"/>
<path d="M15.5 8.5a5 5 0 0 1 0 7"/>
<path d="M5.5 5.5a9 9 0 0 0 0 13"/>
<path d="M18.5 5.5a9 9 0 0 1 0 13"/>
<line x1="12" y1="14" x2="12" y2="22"/>
<line x1="9" y1="22" x2="15" y2="22"/>`,
  },

  /** Antenna: vertical pole with signal arcs and ground base */
  antenna: {
    paths: `<line x1="12" y1="22" x2="12" y2="8"/>
<path d="M9 19l3-3 3 3"/>
<path d="M8 10a5 5 0 0 1 8 0"/>
<path d="M5 7a9 9 0 0 1 14 0"/>
<line x1="5" y1="22" x2="19" y2="22"/>`,
  },

  /** Wifi: three concentric arcs radiating from a bottom dot */
  wifi: {
    paths: `<path d="M5 12.55a11 11 0 0 1 14.08 0"/>
<path d="M1.42 9a16 16 0 0 1 21.16 0"/>
<path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
<circle cx="12" cy="20" r="1" fill="currentColor"/>`,
  },

  /** Ethernet: RJ45 connector plug shape */
  ethernet: {
    paths: `<rect x="6" y="10" width="12" height="10" rx="1"/>
<rect x="9" y="13" width="2" height="4"/>
<rect x="13" y="13" width="2" height="4"/>
<path d="M9 10V7h6v3"/>
<line x1="8" y1="7" x2="8" y2="5"/>
<line x1="12" y1="7" x2="12" y2="4"/>
<line x1="16" y1="7" x2="16" y2="5"/>`,
  },

  /** Cable: two connectors joined by a curved line */
  cable: {
    paths: `<circle cx="4" cy="12" r="2"/>
<circle cx="20" cy="12" r="2"/>
<path d="M6 12 C8 8, 16 16, 18 12"/>
<line x1="2" y1="12" x2="4" y2="12"/>
<line x1="20" y1="12" x2="22" y2="12"/>`,
  },

  /** Hub: central node with spokes radiating outward */
  hub: {
    paths: `<circle cx="12" cy="12" r="3"/>
<line x1="12" y1="9" x2="12" y2="3"/>
<line x1="12" y1="15" x2="12" y2="21"/>
<line x1="9" y1="12" x2="3" y2="12"/>
<line x1="15" y1="12" x2="21" y2="12"/>
<line x1="9.88" y1="9.88" x2="5.64" y2="5.64"/>
<line x1="14.12" y1="14.12" x2="18.36" y2="18.36"/>
<line x1="14.12" y1="9.88" x2="18.36" y2="5.64"/>
<line x1="9.88" y1="14.12" x2="5.64" y2="18.36"/>`,
  },

  /** Bridge: arch bridge shape connecting two sides */
  bridge: {
    paths: `<path d="M2 18 L2 12 Q12 4 22 12 L22 18"/>
<line x1="2" y1="18" x2="22" y2="18"/>
<line x1="7" y1="18" x2="7" y2="12"/>
<line x1="12" y1="18" x2="12" y2="9"/>
<line x1="17" y1="18" x2="17" y2="12"/>`,
  },

  /** Load balancer: traffic split from one line to multiple */
  'load-balancer': {
    paths: `<circle cx="4" cy="12" r="2"/>
<circle cx="20" cy="6" r="2"/>
<circle cx="20" cy="12" r="2"/>
<circle cx="20" cy="18" r="2"/>
<line x1="6" y1="12" x2="10" y2="12"/>
<path d="M10 12 L14 6"/>
<line x1="14" y1="6" x2="18" y2="6"/>
<line x1="10" y1="12" x2="18" y2="12"/>
<path d="M10 12 L14 18"/>
<line x1="14" y1="18" x2="18" y2="18"/>`,
  },

  /** Fabric: mesh network grid of interconnected nodes */
  fabric: {
    paths: `<circle cx="5" cy="5" r="1.5"/>
<circle cx="12" cy="5" r="1.5"/>
<circle cx="19" cy="5" r="1.5"/>
<circle cx="5" cy="12" r="1.5"/>
<circle cx="12" cy="12" r="1.5"/>
<circle cx="19" cy="12" r="1.5"/>
<circle cx="5" cy="19" r="1.5"/>
<circle cx="12" cy="19" r="1.5"/>
<circle cx="19" cy="19" r="1.5"/>
<line x1="6.5" y1="5" x2="10.5" y2="5"/>
<line x1="13.5" y1="5" x2="17.5" y2="5"/>
<line x1="6.5" y1="12" x2="10.5" y2="12"/>
<line x1="13.5" y1="12" x2="17.5" y2="12"/>
<line x1="6.5" y1="19" x2="10.5" y2="19"/>
<line x1="13.5" y1="19" x2="17.5" y2="19"/>
<line x1="5" y1="6.5" x2="5" y2="10.5"/>
<line x1="12" y1="6.5" x2="12" y2="10.5"/>
<line x1="19" y1="6.5" x2="19" y2="10.5"/>
<line x1="5" y1="13.5" x2="5" y2="17.5"/>
<line x1="12" y1="13.5" x2="12" y2="17.5"/>
<line x1="19" y1="13.5" x2="19" y2="17.5"/>`,
  },

  // ─── Security ─────────────────────────────────────────────────────────────

  /** Shield: classic shield outline */
  shield: {
    paths: `<path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z"/>`,
  },

  /** Shield with lock: shield outline containing a padlock */
  'shield-lock': {
    paths: `<path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z"/>
<rect x="9" y="12" width="6" height="5" rx="1"/>
<path d="M10 12v-2a2 2 0 0 1 4 0v2"/>`,
  },

  /** Lock: padlock shape — shackle on top, body below */
  lock: {
    paths: `<rect x="5" y="11" width="14" height="11" rx="2"/>
<path d="M8 11V7a4 4 0 0 1 8 0v4"/>
<circle cx="12" cy="16" r="1" fill="currentColor"/>`,
  },

  /** Firewall: brick wall pattern */
  firewall: {
    paths: `<rect x="2" y="2" width="20" height="5" rx="1"/>
<rect x="2" y="9.5" width="20" height="5" rx="1"/>
<rect x="2" y="17" width="20" height="5" rx="1"/>
<line x1="12" y1="2" x2="12" y2="7"/>
<line x1="7" y1="9.5" x2="7" y2="14.5"/>
<line x1="17" y1="9.5" x2="17" y2="14.5"/>
<line x1="12" y1="17" x2="12" y2="22"/>`,
  },

  /** Fingerprint: concentric arcs forming fingerprint ridges */
  fingerprint: {
    paths: `<path d="M12 2a10 10 0 0 1 9.95 9"/>
<path d="M2 12A10 10 0 0 1 12 2"/>
<path d="M8.5 12a3.5 3.5 0 0 1 7 0"/>
<path d="M8 16a7 7 0 0 0 5.29 2.4"/>
<path d="M5 13.5a7 7 0 0 1 6.5-7.4"/>
<path d="M12 8.5a3.5 3.5 0 0 1 3.5 3.5"/>
<path d="M12 12v6"/>
<path d="M8.5 12c0 1.93 1.57 3.5 3.5 3.5"/>`,
  },

  /** Key: key shape with circular bow and notched blade */
  key: {
    paths: `<circle cx="8" cy="10" r="4"/>
<path d="M12 10h9"/>
<line x1="19" y1="10" x2="19" y2="13"/>
<line x1="16" y1="10" x2="16" y2="14"/>`,
  },

  /** VPN: lock symbol inside a cloud shape */
  vpn: {
    paths: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
<rect x="10" y="13" width="4" height="3.5" rx="0.5"/>
<path d="M11 13v-1.5a1 1 0 0 1 2 0V13"/>`,
  },

  /** Eye: open eye shape for visibility/monitoring */
  eye: {
    paths: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
<circle cx="12" cy="12" r="3"/>`,
  },

  /** Eye-off: eye with diagonal slash for hidden/disabled */
  'eye-off': {
    paths: `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
<line x1="1" y1="1" x2="23" y2="23"/>
<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>`,
  },

  /** Bug: beetle/insect shape for vulnerability/bug tracking */
  bug: {
    paths: `<path d="M9 9l-3-3"/>
<path d="M15 9l3-3"/>
<path d="M12 6a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0v-4a4 4 0 0 1 4-4z"/>
<path d="M8 13H5"/>
<path d="M16 13h3"/>
<path d="M8 17H5"/>
<path d="M16 17h3"/>
<path d="M9 21l1-2h4l1 2"/>`,
  },

  // ─── Routing & WAN ────────────────────────────────────────────────────────

  /** Route: path with waypoints/nodes and direction arrows */
  route: {
    paths: `<circle cx="4" cy="6" r="2"/>
<circle cx="12" cy="18" r="2"/>
<circle cx="20" cy="6" r="2"/>
<path d="M4 8 C4 12, 12 12, 12 16"/>
<path d="M20 8 C20 12, 12 12, 12 16"/>
<polyline points="9 15 12 18 15 15"/>`,
  },

  /** Globe: circle with latitude and longitude grid lines */
  globe: {
    paths: `<circle cx="12" cy="12" r="10"/>
<line x1="2" y1="12" x2="22" y2="12"/>
<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  },

  /** Cloud network: cloud with nodes/connections inside */
  'cloud-network': {
    paths: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
<circle cx="9" cy="14" r="1" fill="currentColor"/>
<circle cx="12" cy="12" r="1" fill="currentColor"/>
<circle cx="15" cy="14" r="1" fill="currentColor"/>
<line x1="10" y1="14" x2="11" y2="13"/>
<line x1="13" y1="13" x2="14" y2="14"/>
<line x1="10" y1="14" x2="14" y2="14"/>`,
  },

  /** Tunnel: two arrows passing through an arch/tube */
  tunnel: {
    paths: `<path d="M2 18 Q12 4 22 18"/>
<path d="M5 18 Q12 8 19 18"/>
<line x1="6" y1="18" x2="6" y2="15"/>
<line x1="18" y1="18" x2="18" y2="15"/>
<line x1="2" y1="21" x2="22" y2="21"/>
<line x1="7" y1="12" x2="10" y2="12"/>
<polyline points="9 10 10 12 9 14"/>
<line x1="14" y1="12" x2="17" y2="12"/>
<polyline points="15 10 14 12 15 14"/>`,
  },

  /** Cloud lock: cloud shape with lock icon inside */
  'cloud-lock': {
    paths: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
<rect x="10" y="13" width="4" height="3.5" rx="0.5"/>
<path d="M11 13v-1.5a1 1 0 0 1 2 0V13"/>`,
  },

  /** SD-WAN: branching WAN paths with overlay abstraction layer */
  sdwan: {
    paths: `<rect x="2" y="10" width="4" height="4" rx="1"/>
<rect x="18" y="4" width="4" height="4" rx="1"/>
<rect x="18" y="16" width="4" height="4" rx="1"/>
<path d="M6 12 C10 12, 14 6, 18 6"/>
<path d="M6 12 C10 12, 14 18, 18 18"/>
<path d="M8 12 L16 12" stroke-dasharray="2 2"/>
<circle cx="12" cy="12" r="1.5" fill="currentColor"/>`,
  },

  // ─── Data Center ──────────────────────────────────────────────────────────

  /** Server: stacked rectangles representing server units */
  server: {
    paths: `<rect x="2" y="2" width="20" height="8" rx="2"/>
<rect x="2" y="14" width="20" height="8" rx="2"/>
<circle cx="6" cy="6" r="1" fill="currentColor"/>
<circle cx="6" cy="18" r="1" fill="currentColor"/>
<line x1="10" y1="6" x2="18" y2="6"/>
<line x1="10" y1="18" x2="18" y2="18"/>`,
  },

  /** Rack server: server rack with multiple units */
  'rack-server': {
    paths: `<rect x="5" y="2" width="14" height="20" rx="1"/>
<rect x="7" y="5" width="10" height="3" rx="0.5"/>
<rect x="7" y="10" width="10" height="3" rx="0.5"/>
<rect x="7" y="15" width="10" height="3" rx="0.5"/>
<circle cx="15" cy="6.5" r="0.75" fill="currentColor"/>
<circle cx="15" cy="11.5" r="0.75" fill="currentColor"/>
<circle cx="15" cy="16.5" r="0.75" fill="currentColor"/>`,
  },

  /** Datacenter: building outline with server racks visible */
  datacenter: {
    paths: `<path d="M3 21V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16"/>
<line x1="3" y1="21" x2="21" y2="21"/>
<rect x="7" y="8" width="4" height="8"/>
<rect x="13" y="8" width="4" height="8"/>
<line x1="8" y1="10" x2="10" y2="10"/>
<line x1="8" y1="12" x2="10" y2="12"/>
<line x1="14" y1="10" x2="16" y2="10"/>
<line x1="14" y1="12" x2="16" y2="12"/>`,
  },

  /** Database: cylinder shape representing a database */
  database: {
    paths: `<ellipse cx="12" cy="5" rx="9" ry="3"/>
<path d="M21 5v6c0 1.66-4.03 3-9 3S3 12.66 3 11V5"/>
<path d="M21 11v6c0 1.66-4.03 3-9 3s-9-1.34-9-3v-6"/>`,
  },

  /** Storage: drive/storage array with stacked layers */
  storage: {
    paths: `<rect x="2" y="4" width="20" height="4" rx="1"/>
<rect x="2" y="10" width="20" height="4" rx="1"/>
<rect x="2" y="16" width="20" height="4" rx="1"/>
<circle cx="19" cy="6" r="1" fill="currentColor"/>
<circle cx="19" cy="12" r="1" fill="currentColor"/>
<circle cx="19" cy="18" r="1" fill="currentColor"/>`,
  },

  /** Container: Docker-style container box with layers */
  container: {
    paths: `<path d="M12 2l9 5v10l-9 5-9-5V7z"/>
<line x1="12" y1="12" x2="12" y2="22"/>
<line x1="12" y1="12" x2="21" y2="7"/>
<line x1="12" y1="12" x2="3" y2="7"/>
<path d="M7.5 4.5l4.5 2.5 4.5-2.5"/>
<path d="M7.5 9.5l4.5 2.5 4.5-2.5"/>`,
  },

  // ─── Collaboration ────────────────────────────────────────────────────────

  /** Phone: classic telephone handset */
  phone: {
    paths: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.07 6.07l1.79-1.79a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/>`,
  },

  /** Video: video camera with play indicator */
  video: {
    paths: `<polygon points="23 7 16 12 23 17 23 7"/>
<rect x="1" y="5" width="15" height="14" rx="2"/>`,
  },

  /** Headset: headphones with microphone boom */
  headset: {
    paths: `<path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
<path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
<path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>`,
  },

  /** Server phone: server with phone/communication indicator */
  'server-phone': {
    paths: `<rect x="2" y="4" width="14" height="16" rx="2"/>
<line x1="6" y1="8" x2="12" y2="8"/>
<line x1="6" y1="12" x2="12" y2="12"/>
<circle cx="9" cy="17" r="1" fill="currentColor"/>
<path d="M19 10h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2"/>
<line x1="19" y1="12" x2="22" y2="12"/>`,
  },

  /** Microphone: mic shape with sound waves */
  microphone: {
    paths: `<path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
<line x1="12" y1="19" x2="12" y2="23"/>
<line x1="8" y1="23" x2="16" y2="23"/>`,
  },

  // ─── Automation & Dev ─────────────────────────────────────────────────────

  /** Code: angle brackets with forward slash */
  code: {
    paths: `<polyline points="16 18 22 12 16 6"/>
<polyline points="8 6 2 12 8 18"/>
<line x1="14" y1="4" x2="10" y2="20"/>`,
  },

  /** Terminal: command prompt with blinking cursor */
  terminal: {
    paths: `<polyline points="4 17 10 11 4 5"/>
<line x1="12" y1="19" x2="20" y2="19"/>
<rect x="2" y="2" width="20" height="20" rx="2"/>`,
  },

  /** Infrastructure: layered stack representing IaC abstraction */
  infrastructure: {
    paths: `<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
<line x1="12" y1="2" x2="12" y2="22"/>
<line x1="2" y1="8.5" x2="22" y2="8.5"/>
<line x1="2" y1="15.5" x2="22" y2="15.5"/>`,
  },

  /** API: brackets with interlocking arrows for data exchange */
  api: {
    paths: `<path d="M4 12h16"/>
<path d="M4 6h7"/>
<path d="M4 18h7"/>
<polyline points="15 3 22 10 15 17"/>
<polyline points="9 7 2 12 9 17"/>`,
  },

  /** Git: branch node diagram representing version control */
  git: {
    paths: `<circle cx="18" cy="18" r="3"/>
<circle cx="6" cy="6" r="3"/>
<path d="M6 9v6.8"/>
<path d="M6 15.8A5.2 5.2 0 0 0 11.2 21H18"/>
<circle cx="6" cy="18" r="3"/>`,
  },

  /** Pipeline: connected stages in a CI/CD pipeline */
  pipeline: {
    paths: `<rect x="1" y="9" width="5" height="6" rx="1"/>
<rect x="9" y="9" width="5" height="6" rx="1"/>
<rect x="17" y="9" width="6" height="6" rx="1"/>
<line x1="6" y1="12" x2="9" y2="12"/>
<line x1="14" y1="12" x2="17" y2="12"/>
<polyline points="7 10 9 12 7 14"/>
<polyline points="15 10 17 12 15 14"/>`,
  },

  // ─── General ──────────────────────────────────────────────────────────────

  /** Document: page with folded corner and text lines */
  document: {
    paths: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
<polyline points="14 2 14 8 20 8"/>
<line x1="16" y1="13" x2="8" y2="13"/>
<line x1="16" y1="17" x2="8" y2="17"/>
<polyline points="10 9 9 9 8 9"/>`,
  },

  /** Users: two person silhouettes representing team/group */
  users: {
    paths: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
<circle cx="9" cy="7" r="4"/>
<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
<path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  },

  /** Search: magnifying glass */
  search: {
    paths: `<circle cx="11" cy="11" r="8"/>
<line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
  },

  /** Flask: laboratory flask/beaker shape */
  flask: {
    paths: `<path d="M9 3h6"/>
<path d="M10 3v7L5.5 17A2 2 0 0 0 7 20h10a2 2 0 0 0 1.5-3L14 10V3"/>
<path d="M7 17h10"/>`,
  },

  /** Chart: bar chart for analytics/reporting */
  chart: {
    paths: `<line x1="18" y1="20" x2="18" y2="10"/>
<line x1="12" y1="20" x2="12" y2="4"/>
<line x1="6" y1="20" x2="6" y2="14"/>
<line x1="2" y1="20" x2="22" y2="20"/>`,
  },

  /** Dashboard: grid of metric panels */
  dashboard: {
    paths: `<rect x="3" y="3" width="7" height="9" rx="1"/>
<rect x="14" y="3" width="7" height="5" rx="1"/>
<rect x="14" y="12" width="7" height="9" rx="1"/>
<rect x="3" y="16" width="7" height="5" rx="1"/>`,
  },

  /** Clipboard: clipboard board with checklist */
  clipboard: {
    paths: `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
<rect x="8" y="2" width="8" height="4" rx="1"/>
<line x1="9" y1="12" x2="15" y2="12"/>
<line x1="9" y1="16" x2="15" y2="16"/>
<polyline points="9 8 11 10 15 6"/>`,
  },

  /** Lightbulb: bulb shape with rays for ideas/innovation */
  lightbulb: {
    paths: `<line x1="9" y1="18" x2="15" y2="18"/>
<line x1="10" y1="22" x2="14" y2="22"/>
<path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>`,
  },

  /** Certificate: award/certification badge with ribbon */
  certificate: {
    paths: `<circle cx="12" cy="10" r="5"/>
<path d="M8.56 14.23l-3.11 7.73 3.83-1.15 2.17 3.62 3.11-7.73"/>
<path d="M15.44 14.23l3.11 7.73-3.83-1.15-2.17 3.62-3.11-7.73"/>
<polyline points="10 9 11 11 14 8"/>`,
  },

  /** Protocol: OSI-style stacked layers representing network protocols */
  protocol: {
    paths: `<rect x="3" y="3" width="18" height="3" rx="1"/>
<rect x="3" y="8" width="18" height="3" rx="1"/>
<rect x="3" y="13" width="18" height="3" rx="1"/>
<rect x="3" y="18" width="18" height="3" rx="1"/>
<line x1="7" y1="4.5" x2="17" y2="4.5"/>
<line x1="7" y1="9.5" x2="17" y2="9.5"/>
<line x1="7" y1="14.5" x2="17" y2="14.5"/>
<line x1="7" y1="19.5" x2="17" y2="19.5"/>`,
  },

  // ─── Additional icons to exceed 55 ────────────────────────────────────────

  /** Network: interconnected circles and lines */
  network: {
    paths: `<circle cx="12" cy="5" r="2"/>
<circle cx="4" cy="19" r="2"/>
<circle cx="20" cy="19" r="2"/>
<line x1="12" y1="7" x2="4" y2="17"/>
<line x1="12" y1="7" x2="20" y2="17"/>
<line x1="6" y1="19" x2="18" y2="19"/>`,
  },

  /** Alert: warning triangle with exclamation */
  alert: {
    paths: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
<line x1="12" y1="9" x2="12" y2="13"/>
<line x1="12" y1="17" x2="12.01" y2="17"/>`,
  },

  /** Cloud: cloud outline for cloud services */
  cloud: {
    paths: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>`,
  },

  /** Gear: settings/configuration cogwheel */
  gear: {
    paths: `<circle cx="12" cy="12" r="3"/>
<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  },

  /** Monitor: desktop monitor/display */
  monitor: {
    paths: `<rect x="2" y="3" width="20" height="14" rx="2"/>
<line x1="8" y1="21" x2="16" y2="21"/>
<line x1="12" y1="17" x2="12" y2="21"/>`,
  },

  /** Layers: stacked layers icon for OSI/abstraction */
  layers: {
    paths: `<polygon points="12 2 2 7 12 12 22 7 12 2"/>
<polyline points="2 17 12 22 22 17"/>
<polyline points="2 12 12 17 22 12"/>`,
  },

  /** Link: chain links for connectivity */
  link: {
    paths: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
  },

  /** Refresh: circular arrows for sync/update */
  refresh: {
    paths: `<polyline points="23 4 23 10 17 10"/>
<polyline points="1 20 1 14 7 14"/>
<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
  },

  /** Play: triangle play button for video/automation trigger */
  play: {
    paths: `<circle cx="12" cy="12" r="10"/>
<polygon points="10 8 16 12 10 16 10 8"/>`,
  },

  /** Package: 3D box for software packages */
  package: {
    paths: `<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
<line x1="12" y1="22.08" x2="12" y2="12"/>`,
  },

  /** Upload: upward arrow through a tray/line */
  upload: {
    paths: `<polyline points="16 16 12 12 8 16"/>
<line x1="12" y1="12" x2="12" y2="21"/>
<path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>`,
  },

  /** Download: downward arrow for receiving/downloading */
  download: {
    paths: `<polyline points="8 17 12 21 16 17"/>
<line x1="12" y1="12" x2="12" y2="21"/>
<path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>`,
  },

  /** Zap: lightning bolt for performance/speed */
  zap: {
    paths: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  },

};

/**
 * Returns a complete SVG element string for the given icon key.
 * @param {string} iconKey - Key from SKILL_ICONS
 * @param {number} [size=24] - Width and height in pixels
 * @returns {string} SVG element string, or empty string if key not found
 */
export function getSkillIconSVG(iconKey, size = 24) {
  const icon = SKILL_ICONS[iconKey];
  if (!icon) return '';
  const vb = icon.viewBox || '0 0 24 24';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon.paths}</svg>`;
}

/**
 * Icon categories for the picker UI, grouping keys by domain.
 * @type {Record<string, string[]>}
 */
export const ICON_CATEGORIES = {
  'Networking': [
    'router',
    'switch',
    'access-point',
    'antenna',
    'wifi',
    'ethernet',
    'cable',
    'hub',
    'bridge',
    'load-balancer',
    'fabric',
    'network',
    'link',
  ],
  'Security': [
    'shield',
    'shield-lock',
    'lock',
    'firewall',
    'fingerprint',
    'key',
    'vpn',
    'eye',
    'eye-off',
    'bug',
    'alert',
    'cloud-lock',
  ],
  'Routing & WAN': [
    'route',
    'globe',
    'cloud-network',
    'tunnel',
    'sdwan',
    'cloud',
  ],
  'Data Center': [
    'server',
    'rack-server',
    'datacenter',
    'database',
    'storage',
    'container',
    'layers',
    'package',
  ],
  'Collaboration': [
    'phone',
    'video',
    'headset',
    'server-phone',
    'microphone',
  ],
  'Automation & Dev': [
    'code',
    'terminal',
    'infrastructure',
    'api',
    'git',
    'pipeline',
    'gear',
    'refresh',
    'play',
    'upload',
    'download',
    'zap',
  ],
  'General': [
    'document',
    'users',
    'search',
    'flask',
    'chart',
    'dashboard',
    'clipboard',
    'lightbulb',
    'certificate',
    'protocol',
    'monitor',
    'alert',
  ],
};
