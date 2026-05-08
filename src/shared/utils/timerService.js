// Centralized timer service for UI countdowns and ticks
export const timerService = (() => {
    const subs = new Set();
    let intervalId = null;

    function tick() {
        const now = Date.now();
        subs.forEach((cb) => {
            try { cb(now); } catch (e) { console.warn('timerService cb error', e); }
        });
    }

    function start() {
        if (intervalId) return;
        intervalId = setInterval(tick, 1000);
    }

    function stop() {
        if (!intervalId) return;
        clearInterval(intervalId);
        intervalId = null;
    }

    function subscribe(cb) {
        if (typeof cb !== 'function') throw new Error('callback required');
        subs.add(cb);
        start();
        return () => {
            subs.delete(cb);
            if (subs.size === 0) stop();
        };
    }

    return { subscribe, start, stop };
})();
