import axios from 'axios';

window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
const csrfMeta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (csrfMeta) {
    window.axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfMeta;
}
window.axios.defaults.withCredentials = true;


import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const reverbAppKey = import.meta.env.VITE_REVERB_APP_KEY?.trim();

// Realtime WebSockets are disabled in desktop app to prevent connection retries to localhost:8080.
// Desktop app uses direct, high-performance HTTP polling at 1-second intervals.
if (reverbAppKey && import.meta.env.VITE_REVERB_ENABLED === 'true') {
    (window as any).Pusher = Pusher;

    (window as any).Echo = new Echo({
        broadcaster: 'reverb',
        key: reverbAppKey,
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
        wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
        enabledTransports: ['ws', 'wss'],
    });
}
