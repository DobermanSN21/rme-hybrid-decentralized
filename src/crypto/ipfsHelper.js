'use strict';
// ============================================================
// IPFS Upload / Download Simulation — Menggunakan SHA-256 manual
// ============================================================

const { sha256Hex } = require('./sha256Manual');

const store = new Map();

/**
 * Simulasi upload data ke IPFS
 * CID digenerate dari SHA-256 manual konten (mirip IPFS CIDv1)
 */
function simulateUpload(data) {
    if (!data || typeof data !== 'string') {
        throw new Error('Data harus string non-kosong');
    }
    const hash = sha256Hex(data);
    const cid = 'Qm' + hash.substring(0, 44);
    store.set(cid, data);
    return cid;
}

function simulateDownload(cid) {
    if (!store.has(cid)) throw new Error(`CID tidak ditemukan: ${cid}`);
    return store.get(cid);
}

function clearStore() {
    store.clear();
}

function exists(cid) {
    return store.has(cid);
}

module.exports = { simulateUpload, simulateDownload, clearStore, exists };
