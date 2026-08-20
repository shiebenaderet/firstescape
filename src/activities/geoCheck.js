// Activity type: geo-check (optional / experimental)
// A GPS geolocation puzzle: the team must physically travel to a location (a spot in the
// school, a landmark). Uses the browser Geolocation API to verify they're within range.
//
// Notes:
//  - Geolocation requires a secure context (https:// or http://localhost) and user permission.
//  - A teacher override is available for testing or devices without GPS.
//
// Config:
// {
//   prompt?: string,
//   target: { lat: number, lng: number },   // code-defined escapes
//   lat?: number, lng?: number,             // flat form (what the visual builder writes)
//   radiusMeters?: number,       // default 40
//   allowOverride?: boolean,     // show a teacher/testing override button (default true)
//   successMessage?: string
// }
// `target` and flat `lat`/`lng` are equivalent; flat wins if both are present.

import { el } from '../engine/dom.js';

function haversine(a, b) {
  const R = 6371000; // meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default {
  type: 'geo-check',
  label: 'GPS geolocation check',

  mount(host, api) {
    const cfg = api.activity.config || {};
    const radius = cfg.radiusMeters ?? 40;
    // Accept either the nested `target` (code-defined) or flat lat/lng (visual builder).
    const target = Number.isFinite(Number(cfg.lat)) && Number.isFinite(Number(cfg.lng))
      ? { lat: Number(cfg.lat), lng: Number(cfg.lng) }
      : cfg.target;
    const hasTarget = target && Number.isFinite(Number(target.lat)) && Number.isFinite(Number(target.lng));
    const status = el('div', { class: 'geo-status' }, hasTarget
      ? 'Tap “Check my location” when your team reaches the spot.'
      : '⚠️ No location has been set for this challenge yet — ask your teacher, or use the override below.');

    function solveOk(distance) {
      status.textContent = distance != null
        ? `✅ You're within range (${Math.round(distance)} m). Location confirmed!`
        : '✅ Location confirmed!';
      api.setAnswer({ confirmedAt: new Date().toISOString(), distance: distance ?? null });
      api.success(cfg.successMessage || 'You found the spot!');
      api.solve();
    }

    function check() {
      if (!hasTarget) {
        api.error('This challenge has no location set yet. Your teacher can add one, or use the override.');
        return;
      }
      if (!('geolocation' in navigator)) {
        status.textContent = '⚠️ This device can\'t check location. Use the teacher override.';
        api.error('Geolocation is not available on this device.');
        return;
      }
      status.textContent = '📡 Checking your location…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const distance = haversine(here, target);
          if (distance <= radius) solveOk(distance);
          else {
            status.textContent = `You're about ${Math.round(distance)} m away — keep going! (need to be within ${radius} m)`;
            api.error('Not there yet — get closer to the target location.');
          }
        },
        (err) => {
          status.textContent = `⚠️ Couldn't get location (${err.message}). You may need to allow location access, or use the teacher override.`;
          api.error('Location permission denied or unavailable.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    host.appendChild(el('div', { class: 'activity-body' }, [
      cfg.prompt ? el('p', { class: 'prompt' }, cfg.prompt) : null,
      el('button', { class: 'btn btn-primary', on: { click: check } }, '📍 Check my location'),
      status,
      cfg.allowOverride !== false
        ? el('button', {
            class: 'btn btn-ghost geo-override',
            title: 'For testing or devices without GPS',
            on: { click: () => solveOk(null) },
          }, 'Teacher override: mark as found')
        : null,
    ]));
  },
};
