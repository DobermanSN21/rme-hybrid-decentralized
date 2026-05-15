'use strict';
// ============================================================
// ECC Key Pair Management (secp256k1) — Menggunakan implementasi manual
// ============================================================

const {
    generateKeyPair,
    privateKeyToPublicKey,
    isValidPublicKey,
    isValidPrivateKey,
    serializePublicKey,
    deserializePublicKey,
} = require('./eccManual');

module.exports = {
    generateKeyPair,
    privateKeyToPublicKey,
    serializePublicKey,
    deserializePublicKey,
    isValidPublicKey,
    isValidPrivateKey,
};
