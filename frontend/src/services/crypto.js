// services/crypto.js
// ============================================================
// Browser-Compatible Crypto Library
// ============================================================
// - AES-256-GCM: Web Crypto API (window.crypto.subtle)
// - ECC/ECIES: @noble/secp256k1 + @noble/hashes
// - File encryption: encrypt/decrypt binary (images, PDF)
// ============================================================

import * as secp from "@noble/secp256k1";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

const HKDF_SALT = new TextEncoder().encode("rme-hybrid-ecies-salt");
const HKDF_INFO = new TextEncoder().encode("rme-hybrid-ecies-info");

// ============================================================
// Helper: hex <-> bytes
// ============================================================
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// ============================================================
// 1. KEY MANAGEMENT (ECC secp256k1)
// ============================================================

export function generateKeyPair() {
    let privKey;
    do {
        privKey = new Uint8Array(32);
        crypto.getRandomValues(privKey);
    } while (!secp.utils.isValidPrivateKey(privKey));

    const privateKey = bytesToHex(privKey);
    const publicKey = privateKeyToPublicKey(privateKey);
    return { privateKey, publicKey };
}

export function privateKeyToPublicKey(privateKeyHex) {
    const pubKeyBytes = secp.getPublicKey(privateKeyHex, false);
    return bytesToHex(pubKeyBytes);
}

export function isValidPublicKey(publicKeyHex) {
    try {
        const bytes = hexToBytes(publicKeyHex);
        secp.ProjectivePoint.fromHex(bytes);
        return true;
    } catch {
        return false;
    }
}

// ============================================================
// 2. AES-256-GCM (Web Crypto API) — Text
// ============================================================

export async function generateAESKey() {
    const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const raw = await crypto.subtle.exportKey("raw", key);
    return bytesToHex(new Uint8Array(raw));
}

async function importAESKey(hexKey) {
    const raw = hexToBytes(hexKey);
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
        "encrypt",
        "decrypt",
    ]);
}

export async function encryptData(plaintext, aesKeyHex) {
    const key = await importAESKey(aesKeyHex);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertextBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        encoded
    );

    const ctBytes = new Uint8Array(ciphertextBuf);
    const ciphertext = ctBytes.slice(0, ctBytes.length - 16);
    const tag = ctBytes.slice(ctBytes.length - 16);

    return {
        iv: bytesToHex(iv),
        ciphertext: bytesToHex(ciphertext),
        tag: bytesToHex(tag),
    };
}

export async function decryptData(encryptedObj, aesKeyHex) {
    const key = await importAESKey(aesKeyHex);
    const iv = hexToBytes(encryptedObj.iv);
    const ciphertext = hexToBytes(encryptedObj.ciphertext);
    const tag = hexToBytes(encryptedObj.tag);

    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext);
    combined.set(tag, ciphertext.length);

    const decryptedBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        combined
    );

    return new TextDecoder().decode(decryptedBuf);
}

// ============================================================
// 3. AES-256-GCM — File (Binary) Encryption
// ============================================================

/**
 * Encrypt a file (binary) with AES-256-GCM
 * @param {ArrayBuffer} fileBuffer - Raw file data
 * @param {string} aesKeyHex - AES key in hex
 * @returns {Promise<Blob>} Encrypted blob (IV + ciphertext+tag)
 */
export async function encryptFile(fileBuffer, aesKeyHex) {
    const key = await importAESKey(aesKeyHex);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertextBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        fileBuffer
    );

    // Pack: [12 bytes IV] + [encrypted data + auth tag]
    const packed = new Uint8Array(12 + ciphertextBuf.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(ciphertextBuf), 12);

    return new Blob([packed], { type: "application/octet-stream" });
}

/**
 * Decrypt a file (binary) with AES-256-GCM
 * @param {ArrayBuffer} encryptedBuffer - Encrypted data (IV + ciphertext+tag)
 * @param {string} aesKeyHex - AES key in hex
 * @returns {Promise<ArrayBuffer>} Decrypted file data
 */
export async function decryptFile(encryptedBuffer, aesKeyHex) {
    const key = await importAESKey(aesKeyHex);
    const data = new Uint8Array(encryptedBuffer);

    // Unpack: [12 bytes IV] + [encrypted data + auth tag]
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    return crypto.subtle.decrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        ciphertext
    );
}

// ============================================================
// 4. ECIES (Elliptic Curve Integrated Encryption Scheme)
// ============================================================

function computeSharedSecret(privateKeyHex, publicKeyHex) {
    const sharedPoint = secp.getSharedSecret(privateKeyHex, publicKeyHex, false);
    return sharedPoint.slice(1, 33);
}

function deriveKey(sharedSecret) {
    return hkdf(sha256, sharedSecret, HKDF_SALT, HKDF_INFO, 32);
}

export async function encryptWithPublicKey(recipientPublicKeyHex, plaintext) {
    let ephPrivKey;
    do {
        ephPrivKey = new Uint8Array(32);
        crypto.getRandomValues(ephPrivKey);
    } while (!secp.utils.isValidPrivateKey(ephPrivKey));

    const ephPrivKeyHex = bytesToHex(ephPrivKey);
    const ephPubKey = secp.getPublicKey(ephPrivKeyHex, false);
    const ephPubKeyHex = bytesToHex(ephPubKey);

    const sharedSecret = computeSharedSecret(ephPrivKeyHex, recipientPublicKeyHex);
    const encKeyBytes = deriveKey(sharedSecret);
    const encKeyHex = bytesToHex(encKeyBytes);

    const encrypted = await encryptData(plaintext, encKeyHex);

    return {
        ephemeralPublicKey: ephPubKeyHex,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        tag: encrypted.tag,
    };
}

export async function decryptWithPrivateKey(recipientPrivateKeyHex, encryptedData) {
    const sharedSecret = computeSharedSecret(
        recipientPrivateKeyHex,
        encryptedData.ephemeralPublicKey
    );

    const encKeyBytes = deriveKey(sharedSecret);
    const encKeyHex = bytesToHex(encKeyBytes);

    return decryptData(
        {
            iv: encryptedData.iv,
            ciphertext: encryptedData.ciphertext,
            tag: encryptedData.tag,
        },
        encKeyHex
    );
}

// Serialize/Deserialize for blockchain storage
export function serializeEncrypted(encryptedData) {
    return [
        encryptedData.ephemeralPublicKey,
        encryptedData.iv,
        encryptedData.ciphertext,
        encryptedData.tag,
    ].join(":");
}

export function deserializeEncrypted(serialized) {
    const parts = serialized.split(":");
    if (parts.length !== 4) throw new Error("Invalid serialized ECIES data");
    return {
        ephemeralPublicKey: parts[0],
        iv: parts[1],
        ciphertext: parts[2],
        tag: parts[3],
    };
}
