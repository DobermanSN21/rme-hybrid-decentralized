// src/crypto/eccEncryption.js
// ============================================================
// ECIES (Elliptic Curve Integrated Encryption Scheme)
// ============================================================
// Implementasi ECIES untuk enkripsi/dekripsi kunci AES:
//
// Alur Enkripsi:
//   1. Generate ephemeral key pair (secp256k1)
//   2. Hitung shared secret = ECDH(ephemeralPrivate, recipientPublic)
//   3. Derive encryption key = HKDF-SHA256(sharedSecret)
//   4. Encrypt plaintext dengan AES-256-GCM
//   5. Output = { ephemeralPublicKey, iv, ciphertext, tag }
//
// Alur Dekripsi:
//   1. Hitung shared secret = ECDH(recipientPrivate, ephemeralPublic)
//   2. Derive encryption key = HKDF-SHA256(sharedSecret)
//   3. Decrypt ciphertext dengan AES-256-GCM
// ============================================================

const secp = require("@noble/secp256k1");
const { hkdf } = require("@noble/hashes/hkdf");
const { sha256 } = require("@noble/hashes/sha256");
const crypto = require("crypto");

const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HKDF_SALT = Buffer.from("rme-hybrid-ecies-salt", "utf8");
const HKDF_INFO = Buffer.from("rme-hybrid-ecies-info", "utf8");

/**
 * Compute ECDH shared secret
 * @param {string} privateKeyHex - Private key (hex)
 * @param {string} publicKeyHex - Public key (hex, uncompressed)
 * @returns {Uint8Array} Raw shared secret bytes
 */
function computeSharedSecret(privateKeyHex, publicKeyHex) {
    const sharedPoint = secp.getSharedSecret(privateKeyHex, publicKeyHex, false);
    // getSharedSecret returns full uncompressed point (65 bytes)
    // Use x-coordinate only (bytes 1..33) as per ECIES convention
    return sharedPoint.slice(1, 33);
}

/**
 * Derive 32-byte encryption key from shared secret using HKDF-SHA256
 * @param {Uint8Array} sharedSecret - Raw shared secret
 * @returns {Buffer} 32-byte derived key
 */
function deriveKey(sharedSecret) {
    const derived = hkdf(sha256, sharedSecret, HKDF_SALT, HKDF_INFO, 32);
    return Buffer.from(derived);
}

/**
 * Encrypt plaintext menggunakan ECIES
 * @param {string} recipientPublicKeyHex - Public key penerima (hex, uncompressed)
 * @param {string} plaintext - Data yang akan dienkripsi (e.g., hex string kunci AES)
 * @returns {{ ephemeralPublicKey: string, iv: string, ciphertext: string, tag: string }}
 *   Semua nilai dalam format hex string
 */
function encryptWithPublicKey(recipientPublicKeyHex, plaintext) {
    if (!plaintext || typeof plaintext !== "string") {
        throw new Error("Plaintext must be a non-empty string");
    }

    // 1. Generate ephemeral key pair
    let ephPrivKey;
    do {
        ephPrivKey = crypto.randomBytes(32);
    } while (!secp.utils.isValidPrivateKey(ephPrivKey));

    const ephPrivKeyHex = Buffer.from(ephPrivKey).toString("hex");
    const ephPubKey = secp.getPublicKey(ephPrivKeyHex, false); // uncompressed
    const ephPubKeyHex = Buffer.from(ephPubKey).toString("hex");

    // 2. Compute shared secret via ECDH
    const sharedSecret = computeSharedSecret(ephPrivKeyHex, recipientPublicKeyHex);

    // 3. Derive encryption key via HKDF
    const encKey = deriveKey(sharedSecret);

    // 4. Encrypt with AES-256-GCM
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, encKey, iv, {
        authTagLength: TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();

    return {
        ephemeralPublicKey: ephPubKeyHex,
        iv: iv.toString("hex"),
        ciphertext: encrypted,
        tag: tag.toString("hex"),
    };
}

/**
 * Decrypt ciphertext menggunakan ECIES
 * @param {string} recipientPrivateKeyHex - Private key penerima (hex)
 * @param {{ ephemeralPublicKey: string, iv: string, ciphertext: string, tag: string }} encryptedData
 * @returns {string} Plaintext hasil dekripsi
 */
function decryptWithPrivateKey(recipientPrivateKeyHex, encryptedData) {
    if (!encryptedData || !encryptedData.ephemeralPublicKey ||
        !encryptedData.iv || !encryptedData.ciphertext || !encryptedData.tag) {
        throw new Error("Encrypted data must contain ephemeralPublicKey, iv, ciphertext, and tag");
    }

    // 1. Compute shared secret via ECDH (same result as encryption)
    const sharedSecret = computeSharedSecret(
        recipientPrivateKeyHex,
        encryptedData.ephemeralPublicKey
    );

    // 2. Derive encryption key via HKDF
    const encKey = deriveKey(sharedSecret);

    // 3. Decrypt with AES-256-GCM
    const iv = Buffer.from(encryptedData.iv, "hex");
    const tag = Buffer.from(encryptedData.tag, "hex");

    const decipher = crypto.createDecipheriv(AES_ALGORITHM, encKey, iv, {
        authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedData.ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

/**
 * Serialize ECIES encrypted data ke single string (untuk disimpan di blockchain)
 * Format: ephemeralPublicKey:iv:ciphertext:tag (colon-separated hex)
 * @param {{ ephemeralPublicKey: string, iv: string, ciphertext: string, tag: string }} encryptedData
 * @returns {string}
 */
function serializeEncrypted(encryptedData) {
    return [
        encryptedData.ephemeralPublicKey,
        encryptedData.iv,
        encryptedData.ciphertext,
        encryptedData.tag,
    ].join(":");
}

/**
 * Deserialize string kembali ke ECIES encrypted data object
 * @param {string} serialized - Colon-separated hex string
 * @returns {{ ephemeralPublicKey: string, iv: string, ciphertext: string, tag: string }}
 */
function deserializeEncrypted(serialized) {
    const parts = serialized.split(":");
    if (parts.length !== 4) {
        throw new Error("Invalid serialized ECIES data: expected 4 colon-separated parts");
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
    // Exposed for testing only:
    computeSharedSecret,
    deriveKey,
};
