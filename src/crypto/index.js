// src/crypto/index.js
// ============================================================
// Barrel Export — Crypto Library
// ============================================================

const keyManager = require("./keyManager");
const aesEncryption = require("./aesEncryption");
const eccEncryption = require("./eccEncryption");
const ipfsHelper = require("./ipfsHelper");

module.exports = {
    // Key Management (ECC secp256k1)
    generateKeyPair: keyManager.generateKeyPair,
    privateKeyToPublicKey: keyManager.privateKeyToPublicKey,
    serializePublicKey: keyManager.serializePublicKey,
    deserializePublicKey: keyManager.deserializePublicKey,
    isValidPublicKey: keyManager.isValidPublicKey,
    isValidPrivateKey: keyManager.isValidPrivateKey,

    // AES-256-GCM
    generateAESKey: aesEncryption.generateAESKey,
    encryptData: aesEncryption.encryptData,
    decryptData: aesEncryption.decryptData,
    serializeAESKey: aesEncryption.serializeAESKey,
    deserializeAESKey: aesEncryption.deserializeAESKey,

    // ECIES (ECC Encryption)
    encryptWithPublicKey: eccEncryption.encryptWithPublicKey,
    decryptWithPrivateKey: eccEncryption.decryptWithPrivateKey,
    serializeEncrypted: eccEncryption.serializeEncrypted,
    deserializeEncrypted: eccEncryption.deserializeEncrypted,

    // IPFS Helper
    simulateUpload: ipfsHelper.simulateUpload,
    simulateDownload: ipfsHelper.simulateDownload,
    clearStore: ipfsHelper.clearStore,
    ipfsExists: ipfsHelper.exists,
};
