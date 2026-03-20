// src/crypto/ipfsHelper.js
// ============================================================
// IPFS Upload / Download Simulation
// ============================================================
// Simulasi penyimpanan IPFS menggunakan in-memory store.
// CID digenerate dari hash SHA-256 konten (mirip IPFS CIDv1).
// Di produksi, ini akan diganti dengan koneksi ke IPFS node
// (via Infura IPFS, Pinata, atau local node).
// ============================================================

const crypto = require("crypto");

// In-memory store untuk simulasi
const store = new Map();

/**
 * Simulasi upload data ke IPFS
 * @param {string} data - Data yang akan di-upload (encrypted data sebagai JSON string)
 * @returns {string} CID-like identifier (Qm... format)
 */
function simulateUpload(data) {
    if (!data || typeof data !== "string") {
        throw new Error("Data must be a non-empty string");
    }

    // Generate CID dari SHA-256 hash
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    const cid = "Qm" + hash.substring(0, 44); // Simulate CIDv0-like format

    store.set(cid, data);
    return cid;
}

/**
 * Simulasi download data dari IPFS
 * @param {string} cid - Content Identifier
 * @returns {string} Data yang tersimpan
 */
function simulateDownload(cid) {
    if (!store.has(cid)) {
        throw new Error(`CID not found: ${cid}`);
    }
    return store.get(cid);
}

/**
 * Clear semua data di store (untuk testing)
 */
function clearStore() {
    store.clear();
}

/**
 * Cek apakah CID ada di store
 * @param {string} cid
 * @returns {boolean}
 */
function exists(cid) {
    return store.has(cid);
}

module.exports = {
    simulateUpload,
    simulateDownload,
    clearStore,
    exists,
};
