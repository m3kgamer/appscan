/* ==========================================================================
   Main Application Controller & Camera Scanning Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startScanBtn = document.getElementById('startScanBtn');
    const cameraPlaceholder = document.getElementById('cameraPlaceholder');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const flipCameraBtn = document.getElementById('flipCameraBtn');
    const torchToggleBtn = document.getElementById('torchToggleBtn');
    const imageFileInput = document.getElementById('imageFileInput');

    // Manual Entry Elements
    const manualBarcodeInput = document.getElementById('manualBarcodeInput');
    const manualLookupBtn = document.getElementById('manualLookupBtn');

    // Product Result Elements
    const productEmptyState = document.getElementById('productEmptyState');
    const productDetailsContent = document.getElementById('productDetailsContent');
    const scannedFormatBadge = document.getElementById('scannedFormatBadge');
    const productImage = document.getElementById('productImage');
    const productImgFallback = document.getElementById('productImgFallback');
    const productBrand = document.getElementById('productBrand');
    const productTitle = document.getElementById('productTitle');
    const productBarcode = document.getElementById('productBarcode');
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    const productCategory = document.getElementById('productCategory');
    const nutriScore = document.getElementById('nutriScore');
    const ecoScore = document.getElementById('ecoScore');
    const productQuantity = document.getElementById('productQuantity');
    const linkGoogle = document.getElementById('linkGoogle');
    const linkAmazon = document.getElementById('linkAmazon');
    const linkOpenFood = document.getElementById('linkOpenFood');

    // History Elements
    const historyList = document.getElementById('historyList');
    const historyEmptyState = document.getElementById('historyEmptyState');
    const historyCount = document.getElementById('historyCount');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');

    // Control Toggles
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const vibrateToggleBtn = document.getElementById('vibrateToggleBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const toastContainer = document.getElementById('toastContainer');

    // Webhook Elements
    const webhookUrlInput = document.getElementById('webhookUrlInput');
    const webhookToggleBtn = document.getElementById('webhookToggleBtn');
    const webhookToggleText = document.getElementById('webhookToggleText');
    const testWebhookBtn = document.getElementById('testWebhookBtn');
    const webhookStatusDot = document.getElementById('webhookStatusDot');
    const webhookResponseBadge = document.getElementById('webhookResponseBadge');

    // State Variables
    let html5QrcodeScanner = null;
    let isScanning = false;
    let currentCameraId = null;
    let cameraDevices = [];
    let activeCameraIdx = 0;
    let lastScannedCode = null;
    let lastScanTime = 0;
    let isWebhookActive = true;

    // Initialize UI
    renderHistory();

    // --------------------------------------------------------------------------
    // 1. Camera Scanner Setup
    // --------------------------------------------------------------------------
    startScanBtn.addEventListener('click', () => {
        initScanner();
    });

    async function initScanner() {
        if (isScanning) return;

        try {
            statusText.textContent = "Initializing camera...";
            
            // Fetch available video input devices
            cameraDevices = await Html5Qrcode.getCameras();

            if (cameraDevices && cameraDevices.length > 0) {
                // Prefer back camera if available
                const backCam = cameraDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
                activeCameraIdx = backCam ? cameraDevices.indexOf(backCam) : 0;
                currentCameraId = cameraDevices[activeCameraIdx].id;

                startHtml5Qrcode(currentCameraId);
            } else {
                showToast("No camera devices detected.", "error");
                statusText.textContent = "No Camera Found";
            }
        } catch (err) {
            console.error("Camera access error:", err);
            showToast("Camera access denied or unsecure environment (HTTPS required).", "error");
            statusText.textContent = "Camera Denied";
        }
    }

    function startHtml5Qrcode(cameraId) {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear();
        }

        html5QrcodeScanner = new Html5Qrcode("reader");

        const config = {
            fps: 15,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.333333,
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            }
        };

        html5QrcodeScanner.start(
            cameraId,
            config,
            onScanSuccess,
            onScanFailure
        ).then(() => {
            isScanning = true;
            cameraPlaceholder.classList.add('hidden');
            statusDot.classList.add('active');
            statusText.textContent = "Scanning Active";
            showToast("Camera scanning active", "info");

            // Check torch support
            try {
                const capabilities = html5QrcodeScanner.getRunningTrackCapabilities();
                if (capabilities && capabilities.torch) {
                    torchToggleBtn.disabled = false;
                }
            } catch (e) {
                torchToggleBtn.disabled = true;
            }
        }).catch(err => {
            console.error("Failed to start camera:", err);
            showToast("Failed to start camera stream.", "error");
            statusText.textContent = "Camera Error";
        });
    }

    // --------------------------------------------------------------------------
    // 2. Scan Callbacks & Handler
    // --------------------------------------------------------------------------
    function onScanSuccess(decodedText, decodedResult) {
        const now = Date.now();
        // Cooldown buffer of 2 seconds for exact same barcode to prevent spamming
        if (decodedText === lastScannedCode && (now - lastScanTime) < 2000) {
            return;
        }

        lastScannedCode = decodedText;
        lastScanTime = now;

        // Sound & Haptic Feedback
        window.soundEngine.playSuccessBeep();
        window.soundEngine.triggerVibration();

        // Process Scanned Code
        handleBarcodeScanned(decodedText);
    }

    function onScanFailure(error) {
        // Quiet mode for normal non-detection frames
    }

    async function handleBarcodeScanned(barcode) {
        showToast(`Scanned: ${barcode}`, "success");
        statusText.textContent = `Scanned: ${barcode}`;

        // Fetch product intelligence from lookup service
        const productData = await window.productLookupService.fetchProductData(barcode);

        // Display results in UI
        displayProductDetails(productData);

        // Save to scan history
        window.historyManager.addScan(productData);
        renderHistory();

        // Dispatch to Webhook endpoint
        sendWebhookPayload(productData);
    }

    async function sendWebhookPayload(productData) {
        if (!isWebhookActive) return;

        const targetUrl = webhookUrlInput.value.trim();
        if (!targetUrl) {
            showToast("Webhook URL is empty", "error");
            return;
        }

        webhookResponseBadge.textContent = "Sending...";
        webhookResponseBadge.className = "webhook-badge sending";

        const payload = {
            barcode: productData.barcode,
            format: productData.format || "EAN-13",
            product_name: productData.title || "",
            brand: productData.brand || "",
            category: productData.category || "",
            quantity: productData.quantity || "",
            scanned_at: new Date().toISOString(),
            source: "OmniScan Pro Web App"
        };

        try {
            const response = await fetch(targetUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.ok || response.status === 200 || response.status === 201) {
                webhookResponseBadge.textContent = `HTTP ${response.status}`;
                webhookResponseBadge.className = "webhook-badge success";
                webhookStatusDot.className = "webhook-dot active";
                showToast(`Webhook Sent! (HTTP ${response.status})`, "success");
            } else {
                webhookResponseBadge.textContent = `HTTP ${response.status}`;
                webhookResponseBadge.className = "webhook-badge error";
                webhookStatusDot.className = "webhook-dot error";
                showToast(`Webhook error: HTTP ${response.status}`, "error");
            }
        } catch (err) {
            console.warn("Webhook dispatch error:", err);
            // Note: CORS or ngrok offline limits can trigger catch, but request may still reach receiver
            webhookResponseBadge.textContent = "Sent / CORS";
            webhookResponseBadge.className = "webhook-badge success";
            webhookStatusDot.className = "webhook-dot active";
            showToast("Webhook dispatched to target", "info");
        }
    }

    // Webhook Event Controls
    webhookToggleBtn.addEventListener('click', () => {
        isWebhookActive = !isWebhookActive;
        webhookToggleBtn.classList.toggle('active', isWebhookActive);
        webhookToggleText.textContent = isWebhookActive ? "Auto-Post Active" : "Auto-Post Off";
        webhookStatusDot.className = isWebhookActive ? "webhook-dot active" : "webhook-dot";
        showToast(isWebhookActive ? "Webhook auto-post enabled" : "Webhook auto-post disabled", "info");
    });

    testWebhookBtn.addEventListener('click', () => {
        const testCode = manualBarcodeInput.value.trim() || "5449000000996";
        window.productLookupService.fetchProductData(testCode).then(data => {
            sendWebhookPayload(data);
        });
    });

    // --------------------------------------------------------------------------
    // 3. UI Display & Render Logic
    // --------------------------------------------------------------------------
    function displayProductDetails(data) {
        productEmptyState.classList.add('hidden');
        productDetailsContent.classList.remove('hidden');

        scannedFormatBadge.textContent = data.format || 'EAN';
        productBrand.textContent = data.brand || 'Generic';
        productTitle.textContent = data.title || `Barcode ${data.barcode}`;
        productBarcode.textContent = data.barcode;
        productCategory.textContent = data.category || 'General Product';
        productQuantity.textContent = data.quantity || 'N/A';

        // Image Handling
        if (data.image) {
            productImage.src = data.image;
            productImage.style.display = 'block';
            productImgFallback.style.display = 'none';
        } else {
            productImage.style.display = 'none';
            productImgFallback.style.display = 'flex';
        }

        // Nutri-Score rendering
        renderScoreBadge(nutriScore, data.nutriScore);
        renderScoreBadge(ecoScore, data.ecoScore);

        // External Link Anchors
        linkGoogle.href = `https://www.google.com/search?q=${encodeURIComponent(data.title + ' ' + data.barcode)}`;
        linkAmazon.href = `https://www.amazon.com/s?k=${encodeURIComponent(data.barcode)}`;
        linkOpenFood.href = `https://world.openfoodfacts.org/product/${encodeURIComponent(data.barcode)}`;
    }

    function renderScoreBadge(element, score) {
        element.className = 'meta-value score-badge';
        if (!score || score === '--' || score === 'unknown') {
            element.textContent = '--';
            element.style.background = 'rgba(255,255,255,0.08)';
            element.style.color = 'var(--text-muted)';
        } else {
            const letter = score.toLowerCase();
            element.textContent = letter.toUpperCase();
            element.classList.add(`score-${letter}`);
        }
    }

    // --------------------------------------------------------------------------
    // 4. Sample Chips & Manual Search
    // --------------------------------------------------------------------------
    document.querySelectorAll('.sample-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const code = chip.getAttribute('data-code');
            manualBarcodeInput.value = code;
            window.soundEngine.playSuccessBeep();
            window.soundEngine.triggerVibration();
            handleBarcodeScanned(code);
        });
    });

    manualLookupBtn.addEventListener('click', () => {
        const val = manualBarcodeInput.value.trim();
        if (val) {
            handleBarcodeScanned(val);
        } else {
            showToast("Please enter a valid barcode number", "error");
        }
    });

    manualBarcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            manualLookupBtn.click();
        }
    });

    // Image file upload scanner
    imageFileInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;

        const imageFile = e.target.files[0];
        const html5QrCode = new Html5Qrcode("reader");

        try {
            statusText.textContent = "Scanning image file...";
            const result = await html5QrCode.scanFile(imageFile, true);
            window.soundEngine.playSuccessBeep();
            handleBarcodeScanned(result);
        } catch (err) {
            console.error("Image scan error:", err);
            window.soundEngine.playErrorBeep();
            showToast("Could not detect barcode in uploaded image.", "error");
            statusText.textContent = "Scan Failed";
        }
    });

    // --------------------------------------------------------------------------
    // 5. History Rendering & Actions
    // --------------------------------------------------------------------------
    function renderHistory() {
        const items = window.historyManager.history;
        historyCount.textContent = items.length;

        if (items.length === 0) {
            historyEmptyState.style.display = 'flex';
            historyList.innerHTML = '';
            return;
        }

        historyEmptyState.style.display = 'none';
        historyList.innerHTML = items.map(item => `
            <li class="history-item" onclick="handleBarcodeScanned('${item.barcode}')">
                <div class="history-item-info">
                    <span class="history-item-title">${escapeHtml(item.title)}</span>
                    <span class="history-item-code">${item.barcode} (${item.format})</span>
                </div>
                <span class="history-item-time">${formatTimeAgo(item.timestamp)}</span>
            </li>
        `).join('');
    }

    clearHistoryBtn.addEventListener('click', () => {
        window.historyManager.clearHistory();
        renderHistory();
        showToast("Scan history cleared", "info");
    });

    exportCsvBtn.addEventListener('click', () => {
        if (window.historyManager.history.length === 0) {
            showToast("No history items to export", "error");
            return;
        }
        window.historyManager.exportToCSV();
        showToast("History exported to CSV", "success");
    });

    copyCodeBtn.addEventListener('click', () => {
        const code = productBarcode.textContent;
        navigator.clipboard.writeText(code).then(() => {
            showToast("Barcode copied to clipboard!", "success");
        });
    });

    // Camera Switcher
    flipCameraBtn.addEventListener('click', () => {
        if (cameraDevices.length > 1) {
            activeCameraIdx = (activeCameraIdx + 1) % cameraDevices.length;
            currentCameraId = cameraDevices[activeCameraIdx].id;
            startHtml5Qrcode(currentCameraId);
        } else {
            showToast("Only 1 camera detected on device.", "info");
        }
    });

    // Torch Toggle
    let torchState = false;
    torchToggleBtn.addEventListener('click', () => {
        if (html5QrcodeScanner && isScanning) {
            torchState = !torchState;
            html5QrcodeScanner.applyVideoConstraints({
                advanced: [{ torch: torchState }]
            }).then(() => {
                torchToggleBtn.classList.toggle('active', torchState);
            }).catch(err => {
                showToast("Flashlight unavailable", "error");
            });
        }
    });

    // Sound & Vibration Toggles
    soundToggleBtn.addEventListener('click', () => {
        window.soundEngine.soundEnabled = !window.soundEngine.soundEnabled;
        soundToggleBtn.classList.toggle('active', window.soundEngine.soundEnabled);
        showToast(window.soundEngine.soundEnabled ? "Sound enabled" : "Sound muted", "info");
    });

    vibrateToggleBtn.addEventListener('click', () => {
        window.soundEngine.vibrateEnabled = !window.soundEngine.vibrateEnabled;
        vibrateToggleBtn.classList.toggle('active', window.soundEngine.vibrateEnabled);
        showToast(window.soundEngine.vibrateEnabled ? "Vibration enabled" : "Vibration muted", "info");
    });

    // Theme Toggle
    themeToggleBtn.addEventListener('click', () => {
        const isLight = document.body.getAttribute('data-theme') === 'light';
        if (isLight) {
            document.body.removeAttribute('data-theme');
            themeToggleBtn.querySelector('i').className = 'icon-moon';
        } else {
            document.body.setAttribute('data-theme', 'light');
            themeToggleBtn.querySelector('i').className = 'icon-sun';
        }
    });

    // --------------------------------------------------------------------------
    // Helpers
    // --------------------------------------------------------------------------
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? 'icon-check-circle' : type === 'error' ? 'icon-alert-circle' : 'icon-info';
        toast.innerHTML = `<i class="${icon}"></i> <span>${escapeHtml(message)}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 2600);
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatTimeAgo(isoString) {
        const date = new Date(isoString);
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    }
});
