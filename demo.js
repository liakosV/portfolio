const endpoint = 'https://xi52soucjpr2xwe3nz4incxhci0usfmd.lambda-url.eu-north-1.on.aws/';
const demoUrl = 'https://liakos-messenger.duckdns.org';
const statusElement = document.getElementById('demo-status');
const retryButton = document.getElementById('demo-retry');
const openLink = document.getElementById('demo-open');
let launching = false;

async function request(action) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
        const result = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
            credentials: 'omit',
            cache: 'no-store',
            signal: controller.signal,
        });
        if (!result.ok) throw new Error('The demo service is unavailable.');
        const data = await result.json();
        if (typeof data.ready !== 'boolean' || typeof data.instanceState !== 'string') {
            throw new Error('Unexpected response from the demo service.');
        }
        return data;
    } finally {
        clearTimeout(timeout);
    }
}

async function launchDemo() {
    if (launching) return;
    launching = true;
    retryButton.hidden = true;
    openLink.hidden = true;
    statusElement.textContent = 'Requesting server startup…';
    const deadline = Date.now() + 5 * 60 * 1000;

    try {
        // Only this request may start EC2. Subsequent checks are read-only.
        let data = await request('start');
        let failures = 0;
        while (true) {
            if (data.ready && data.instanceState === 'running') {
                statusElement.textContent = 'Messenger is ready. Opening the application…';
                openLink.hidden = false;
                window.location.replace(demoUrl);
                return;
            }
            if (['stopping', 'shutting-down', 'terminated', 'stopped'].includes(data.instanceState)) {
                throw new Error('The server is unavailable or stopping. Wait a moment, then try again.');
            }
            if (Date.now() >= deadline) {
                throw new Error('Startup is taking longer than expected. Please try again shortly.');
            }
            statusElement.textContent = data.instanceState === 'pending'
                ? 'The server is starting. This may take a few minutes…'
                : 'The server is running. Waiting for HTTPS and the application…';
            await new Promise(resolve => setTimeout(resolve, 10000));
            try {
                data = await request('status');
                failures = 0;
            } catch (error) {
                failures += 1;
                if (failures >= 3) throw error;
                statusElement.textContent = 'Connection interrupted. Retrying the status check…';
            }
        }
    } catch (error) {
        statusElement.textContent = error.name === 'AbortError'
            ? 'The demo service took too long to respond. Please try again.'
            : error.message;
        retryButton.hidden = false;
    } finally {
        launching = false;
    }
}

retryButton.addEventListener('click', launchDemo);
void launchDemo();
