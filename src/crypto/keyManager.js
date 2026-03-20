// src/crypto/keyManager.js
// ============================================================
// ECC Key Pair Management (secp256k1)
// ============================================================
// Menggunakan @noble/secp256k1 — audited, zero-dependency library
// yang kompatibel dengan curve Ethereum.
// ============================================================

const secp = require("@noble/secp256k1");
const { randomBytes } = require("crypto");

/**
 * Generate ECC key pair baru (secp256k1)
 * @returns {{ privateKey: string, publicKey: string }}
 *   - privateKey: hex string (32 bytes / 64 hex chars)
 *   - publicKey: uncompressed hex string (65 bytes / 130 hex chars, prefix 04)
 */
function generateKeyPair() {
    // Generate random 32-byte private key
    let privKey;
    do {
        privKey = randomBytes(32);
    } while (!secp.utils.isValidPrivateKey(privKey));

    const privateKey = Buffer.from(privKey).toString("hex");
    const publicKey = privateKeyToPublicKey(privateKey);

    return { privateKey, publicKey };
}

/**
 * Derive public key dari private key
 * @param {string} privateKeyHex - Private key dalam format hex
 * @returns {string} Uncompressed public key dalam format hex (prefix 04)
 */
function privateKeyToPublicKey(privateKeyHex) {
    const pubKeyBytes = secp.getPublicKey(privateKeyHex, false); // false = uncompressed
    return Buffer.from(pubKeyBytes).toString("hex");
}

/**
 * Serialize public key ke hex string (untuk disimpan di blockchain)
 * @param {Uint8Array|Buffer} publicKeyBytes - Public key bytes
 * @returns {string} Hex string
 */
function serializePublicKey(publicKeyBytes) {
    return Buffer.from(publicKeyBytes).toString("hex");
}

/**
 * Deserialize hex string kembali ke bytes
 * @param {string} hexString - Public key dalam format hex
 * @returns {Uint8Array} Public key bytes
 */
function deserializePublicKey(hexString) {
    return Uint8Array.from(Buffer.from(hexString, "hex"));
}

/**
 * Validasi apakah hex string adalah public key yang valid
 * @param {string} publicKeyHex - Public key dalam format hex
 * @returns {boolean}
 */
function isValidPublicKey(publicKeyHex) {
    try {
        const bytes = deserializePublicKey(publicKeyHex);
        secp.ProjectivePoint.fromHex(bytes);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validasi apakah hex string adalah private key yang valid
 * @param {string} privateKeyHex - Private key dalam format hex
 * @returns {boolean}
 */
function isValidPrivateKey(privateKeyHex) {
    try {
        const bytes = Buffer.from(privateKeyHex, "hex");
        return secp.utils.isValidPrivateKey(bytes);
    } catch {
        return false;
    }
}

module.exports = {
    generateKeyPair,
    privateKeyToPublicKey,
    serializePublicKey,
    deserializePublicKey,
    isValidPublicKey,
    isValidPrivateKey,
};
