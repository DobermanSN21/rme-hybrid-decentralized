'use strict';
// ============================================================
// AES-256-CBC + HMAC-SHA256 — Menggunakan implementasi manual
// ============================================================

const {
    generateAESKey,
    encryptData,
    decryptData,
    serializeAESKey,
    deserializeAESKey,
} = require('./aes256Manual');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const TAG_LENGTH = 32; // HMAC-SHA256 = 32 byte

module.exports = {
    generateAESKey,
    encryptData,
    decryptData,
    serializeAESKey,
    deserializeAESKey,
    ALGORITHM,
    IV_LENGTH,
    KEY_LENGTH,
    TAG_LENGTH,
};
