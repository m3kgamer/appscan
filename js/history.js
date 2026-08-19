/* ==========================================================================
   Scan History Manager (LocalStorage & Data Exporter)
   ========================================================================== */

class HistoryManager {
    constructor() {
        this.storageKey = 'omniscan_history_log_v1';
        this.history = this.loadHistory();
    }

    loadHistory() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Failed to read history from localStorage:", e);
            return [];
        }
    }

    saveHistory() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.history));
        } catch (e) {
            console.error("Failed to save history to localStorage:", e);
        }
    }

    addScan(productData) {
        // Prevent duplicate adjacent entries
        if (this.history.length > 0 && this.history[0].barcode === productData.barcode) {
            // Update timestamp of existing top entry
            this.history[0].timestamp = new Date().toISOString();
            this.saveHistory();
            return this.history;
        }

        const entry = {
            id: 'scan_' + Date.now(),
            barcode: productData.barcode,
            title: productData.title,
            brand: productData.brand,
            category: productData.category,
            format: productData.format || 'EAN',
            timestamp: new Date().toISOString()
        };

        this.history.unshift(entry); // Add to beginning

        // Keep last 100 scans max
        if (this.history.length > 100) {
            this.history.pop();
        }

        this.saveHistory();
        return this.history;
    }

    clearHistory() {
        this.history = [];
        this.saveHistory();
    }

    exportToCSV() {
        if (this.history.length === 0) return null;

        const headers = ["Barcode", "Product Title", "Brand", "Category", "Format", "Scanned At"];
        const rows = this.history.map(item => [
            `"${item.barcode}"`,
            `"${(item.title || '').replace(/"/g, '""')}"`,
            `"${(item.brand || '').replace(/"/g, '""')}"`,
            `"${(item.category || '').replace(/"/g, '""')}"`,
            `"${item.format || ''}"`,
            `"${new Date(item.timestamp).toLocaleString()}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `OmniScan_History_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

window.historyManager = new HistoryManager();
