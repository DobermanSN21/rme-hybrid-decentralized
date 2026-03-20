// src/crypto/aesEncryption.js
// ============================================================
// AES-256-GCM Encryption / Decryption
// ============================================================
// Menggunakan Node.js built-in crypto module.
// AES-256-GCM menyediakan:
//   - Confidentiality (enkripsi)
//   - Integrity (authentication tag)
//   - IV 12 bytes random per enkripsi
// ============================================================

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // 12 bytes — recommended for GCM
const KEY_LENGTH = 32;  // 32 bytes = 256 bits
const TAG_LENGTH = 16;  // 16 bytes authentication tag

/**
 * Generate random AES-256 key
 * @returns {Buffer} 32-byte AES key
 */
function generateAESKey() {
    return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Encrypt plaintext menggunakan AES-256-GCM
 * @param {string} plaintext - Data yang akan dienkripsi
 * @param {Buffer} aesKey - 32-byte AES key
 * @returns {{ iv: string, ciphertext: string, tag: string }}
 *   Semua nilai dalam format hex string
 */
function encryptData(plaintext, aesKey) {
    if (!plaintext || typeof plaintext !== "string") {
        throw new Error("Plaintext must be a non-empty string");
    }
    if (!Buffer.isBuffer(aesKey) || aesKey.length !== KEY_LENGTH) {
        throw new Error(`AES key must be a ${KEY_LENGTH}-byte Buffer`);
    }

    // Generate random IV untuk setiap enkripsi
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, aesKey, iv, {
        authTagLength: TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    return {
        iv: iv.toString("hex"),
        ciphertext: encrypted,
        tag: tag.toString("hex"),
    };
}

/**
 * Decrypt ciphertext menggunakan AES-256-GCM
 * @param {{ iv: string, ciphertext: string, tag: string }} encryptedObj
 * @param {Buffer} aesKey - 32-byte AES key
 * @returns {string} Plaintext hasil dekripsi
 */
function decryptData(encryptedObj, aesKey) {
    if (!encryptedObj || !encryptedObj.iv || !encryptedObj.ciphertext || !encryptedObj.tag) {
        throw new Error("Encrypted object must contain iv, ciphertext, and tag");
    }
    if (!Buffer.isBuffer(aesKey) || aesKey.length !== KEY_LENGTH) {
        throw new Error(`AES key must be a ${KEY_LENGTH}-byte Buffer`);
    }

    const iv = Buffer.from(encryptedObj.iv, "hex");
    const tag = Buffer.from(encryptedObj.tag, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, aesKey, iv, {
        authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedObj.ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

/**
 * Serialize AES key ke hex string
 * @param {Buffer} key - AES key buffer
 * @returns {string} Hex string
 */
function serializeAESKey(key) {
    return key.toString("hex");
}

/**
 * Deserialize hex string ke AES key buffer
 * @param {string} hexString - AES key dalam format hex
 * @returns {Buffer} AES key buffer
 */
function deserializeAESKey(hexString) {
    const buf = Buffer.from(hexString, "hex");
    if (buf.length !== KEY_LENGTH) {
        throw new Error(`Invalid AES key length: expected ${KEY_LENGTH} bytes, got ${buf.length}`);
    }
    return buf;
}

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
