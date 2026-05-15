'use strict';
// ============================================================
// ECIES — Menggunakan implementasi manual ECC + AES + HKDF
// ============================================================
// Alur Enkripsi:
//   1. Generate ephemeral key pair (secp256k1 manual)
//   2. Hitung shared secret = ECDH(ephemeralPrivate, recipientPublic) [manual]
//   3. Derive encryption key = HKDF-SHA256(sharedSecret) [menggunakan @noble/hashes]
//   4. Encrypt plaintext dengan AES-256-CBC [manual]
//   5. Output = { ephemeralPublicKey, iv, ciphertext, tag }
// ============================================================

const { hkdf } = require('@noble/hashes/hkdf');
const { sha256: nobleSha256 } = require('@noble/hashes/sha256');
const { randomBytes } = require('crypto');

const { computeSharedSecret, generateKeyPair, privateKeyToPublicKey } = require('./eccManual');
const { encryptData, decryptData } = require('./aes256Manual');

const HKDF_SALT = Buffer.from('rme-hybrid-ecies-salt', 'utf8');
const HKDF_INFO = Buffer.from('rme-hybrid-ecies-info', 'utf8');

/**
 * Derive 32-byte encryption key dari ECDH shared secret menggunakan HKDF-SHA256
 */
function deriveKey(sharedSecret) {
    const derived = hkdf(nobleSha256, sharedSecret, HKDF_SALT, HKDF_INFO, 32);
    return Buffer.from(derived);
}

/**
 * Enkripsi plaintext menggunakan ECIES
 * @param {string} recipientPublicKeyHex
 * @param {string} plaintext
 * @returns {{ ephemeralPublicKey: string, iv: string, ciphertext: string, tag: string }}
 */
function encryptWithPublicKey(recipientPublicKeyHex, plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Plaintext harus string non-kosong');
    }

    // 1. Generate ephemeral key pair (manual ECC)
    const { privateKey: ephPrivKeyHex, publicKey: ephPubKeyHex } = generateKeyPair();

    // 2. Hitung shared secret via ECDH (manual)
    const sharedSecret = computeSharedSecret(ephPrivKeyHex, recipientPublicKeyHex);

    // 3. Derive encryption key via HKDF
    const encKey = deriveKey(sharedSecret);

    // 4. Encrypt dengan AES-256-CBC (manual)
    const encrypted = encryptData(plaintext, encKey);

    return {
        ephemeralPublicKey: ephPubKeyHex,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        tag: encrypted.tag,
    };
}

/**
 * Dekripsi ECIES
 * @param {string} recipientPrivateKeyHex
 * @param {{ ephemeralPublicKey: string, iv: string, ciphertext: string, tag: string }} encryptedData
 * @returns {string}
 */
function decryptWithPrivateKey(recipientPrivateKeyHex, encryptedData) {
    if (!encryptedData?.ephemeralPublicKey || !encryptedData?.iv ||
        !encryptedData?.ciphertext || !encryptedData?.tag) {
        throw new Error('Data terenkripsi tidak lengkap');
    }

    // 1. Hitung shared secret via ECDH (manual)
    const sharedSecret = computeSharedSecret(
        recipientPrivateKeyHex,
        encryptedData.ephemeralPublicKey
    );

    // 2. Derive encryption key via HKDF
    const encKey = deriveKey(sharedSecret);

    // 3. Decrypt dengan AES-256-CBC (manual)
    return decryptData(
        { iv: encryptedData.iv, ciphertext: encryptedData.ciphertext, tag: encryptedData.tag },
        encKey
    );
}

function serializeEncrypted(encryptedData) {
    return [
        encryptedData.ephemeralPublicKey,
        encryptedData.iv,
        encryptedData.ciphertext,
        encryptedData.tag,
    ].join(':');
}

function deserializeEncrypted(serialized) {
    const parts = serialized.split(':');
    if (parts.length !== 4) {
        throw new Error('Format data terenkripsi tidak valid: harus 4 bagian dipisah titik dua');
    }
    return {
        ephemeralPublicKey: parts[0],
        iv: parts[1],
        ciphertext: parts[2],
        tag: parts[3],
    };
}

module.exports = {
    encryptWithPublicKey,
    decryptWithPrivateKey,
    serializeEncrypted,
    deserializeEncrypted,
    computeSharedSecret,
    deriveKey,
};
