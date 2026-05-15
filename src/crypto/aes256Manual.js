'use strict';
// ============================================================
// AES-256-CBC + HMAC-SHA256 — Implementasi Manual
// ============================================================
// Referensi: FIPS 197 (AES), FIPS 198 (HMAC)
//
// Mode: AES-256-CBC (Cipher Block Chaining)
// Integritas: HMAC-SHA256 (Encrypt-then-MAC)
// Key size: 32 byte (256 bit)
// Block size: 16 byte (128 bit)
// IV size: 16 byte (random per enkripsi)
//
// Alur enkripsi:
//   1. Key Schedule: ekspansi 32-byte key → 15 round keys (60 words)
//   2. Padding PKCS7: tambah padding agar plaintext kelipatan 16 byte
//   3. CBC Encrypt: C[i] = AES_Block_Encrypt(P[i] XOR C[i-1])
//   4. Tag = HMAC-SHA256(key, IV || ciphertext)
//
// Alur dekripsi:
//   1. Verifikasi HMAC tag
//   2. CBC Decrypt: P[i] = AES_Block_Decrypt(C[i]) XOR C[i-1]
//   3. Hapus PKCS7 padding
// ============================================================

const { sha256 } = require('./sha256Manual');
const { randomBytes } = require('crypto');

// ============================================================
// AES S-Box (FIPS 197, Appendix A)
// Substitusi non-linear: inverse multiplicative di GF(2^8)
// + affine transformation. Tabel 256 entri, hardcoded.
// ============================================================
const SBOX = new Uint8Array([
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
]);

// Inverse S-Box untuk dekripsi
const INV_SBOX = new Uint8Array([
    0x52,0x09,0x6a,0xd5,0x30,0x36,0xa5,0x38,0xbf,0x40,0xa3,0x9e,0x81,0xf3,0xd7,0xfb,
    0x7c,0xe3,0x39,0x82,0x9b,0x2f,0xff,0x87,0x34,0x8e,0x43,0x44,0xc4,0xde,0xe9,0xcb,
    0x54,0x7b,0x94,0x32,0xa6,0xc2,0x23,0x3d,0xee,0x4c,0x95,0x0b,0x42,0xfa,0xc3,0x4e,
    0x08,0x2e,0xa1,0x66,0x28,0xd9,0x24,0xb2,0x76,0x5b,0xa2,0x49,0x6d,0x8b,0xd1,0x25,
    0x72,0xf8,0xf6,0x64,0x86,0x68,0x98,0x16,0xd4,0xa4,0x5c,0xcc,0x5d,0x65,0xb6,0x92,
    0x6c,0x70,0x48,0x50,0xfd,0xed,0xb9,0xda,0x5e,0x15,0x46,0x57,0xa7,0x8d,0x9d,0x84,
    0x90,0xd8,0xab,0x00,0x8c,0xbc,0xd3,0x0a,0xf7,0xe4,0x58,0x05,0xb8,0xb3,0x45,0x06,
    0xd0,0x2c,0x1e,0x8f,0xca,0x3f,0x0f,0x02,0xc1,0xaf,0xbd,0x03,0x01,0x13,0x8a,0x6b,
    0x3a,0x91,0x11,0x41,0x4f,0x67,0xdc,0xea,0x97,0xf2,0xcf,0xce,0xf0,0xb4,0xe6,0x73,
    0x96,0xac,0x74,0x22,0xe7,0xad,0x35,0x85,0xe2,0xf9,0x37,0xe8,0x1c,0x75,0xdf,0x6e,
    0x47,0xf1,0x1a,0x71,0x1d,0x29,0xc5,0x89,0x6f,0xb7,0x62,0x0e,0xaa,0x18,0xbe,0x1b,
    0xfc,0x56,0x3e,0x4b,0xc6,0xd2,0x79,0x20,0x9a,0xdb,0xc0,0xfe,0x78,0xcd,0x5a,0xf4,
    0x1f,0xdd,0xa8,0x33,0x88,0x07,0xc7,0x31,0xb1,0x12,0x10,0x59,0x27,0x80,0xec,0x5f,
    0x60,0x51,0x7f,0xa9,0x19,0xb5,0x4a,0x0d,0x2d,0xe5,0x7a,0x9f,0x93,0xc9,0x9c,0xef,
    0xa0,0xe0,0x3b,0x4d,0xae,0x2a,0xf5,0xb0,0xc8,0xeb,0xbb,0x3c,0x83,0x53,0x99,0x61,
    0x17,0x2b,0x04,0x7e,0xba,0x77,0xd6,0x26,0xe1,0x69,0x14,0x63,0x55,0x21,0x0c,0x7d,
]);

// Round constants (RCON) untuk key schedule
// RCON[i] = 2^(i-1) dalam GF(2^8)
const RCON = new Uint8Array([
    0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36,
]);

// ============================================================
// GF(2^8) Arithmetic
// Polinom irredusibel: x^8 + x^4 + x^3 + x + 1 (0x11b)
// ============================================================

// Perkalian dengan 2 (xtime) dalam GF(2^8)
function xtime(a) {
    return ((a << 1) ^ (a & 0x80 ? 0x1b : 0x00)) & 0xff;
}

// Perkalian umum a * b dalam GF(2^8)
function gmul(a, b) {
    let result = 0;
    let aa = a & 0xff;
    let bb = b & 0xff;
    while (bb > 0) {
        if (bb & 1) result ^= aa;
        aa = xtime(aa);
        bb >>= 1;
    }
    return result & 0xff;
}

// ============================================================
// AES State Operations
// State = array 16 byte dalam urutan kolom-mayor:
// index = row + 4*col  →  [col0: bytes 0-3, col1: bytes 4-7, ...]
// ============================================================

// SubBytes: ganti setiap byte state dengan nilai S-Box
function subBytes(s) {
    for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
}

// InvSubBytes: ganti setiap byte state dengan nilai Inverse S-Box
function invSubBytes(s) {
    for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
}

// ShiftRows: geser baris ke kiri secara sirkular sesuai indeks baris
// Baris 0: tidak bergeser, Baris 1: geser 1, Baris 2: geser 2, Baris 3: geser 3
function shiftRows(s) {
    let t;
    // Baris 1 (indeks 1,5,9,13): geser kiri 1
    t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
    // Baris 2 (indeks 2,6,10,14): geser kiri 2
    t = s[2]; s[2] = s[10]; s[10] = t;
    t = s[6]; s[6] = s[14]; s[14] = t;
    // Baris 3 (indeks 3,7,11,15): geser kiri 3 (= geser kanan 1)
    t = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t;
}

// InvShiftRows: kebalikan dari ShiftRows
function invShiftRows(s) {
    let t;
    // Baris 1: geser kanan 1
    t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
    // Baris 2: geser kanan 2
    t = s[2]; s[2] = s[10]; s[10] = t;
    t = s[6]; s[6] = s[14]; s[14] = t;
    // Baris 3: geser kanan 3 (= geser kiri 1)
    t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
}

// MixColumns: transformasi linear tiap kolom menggunakan matriks GF(2^8)
// Matriks: [2,3,1,1 / 1,2,3,1 / 1,1,2,3 / 3,1,1,2]
function mixColumns(s) {
    for (let c = 0; c < 4; c++) {
        const i = c * 4;
        const s0 = s[i], s1 = s[i+1], s2 = s[i+2], s3 = s[i+3];
        const x0 = xtime(s0), x1 = xtime(s1), x2 = xtime(s2), x3 = xtime(s3);
        s[i]   = x0 ^ (s1^x1) ^ s2 ^ s3;
        s[i+1] = s0 ^ x1 ^ (s2^x2) ^ s3;
        s[i+2] = s0 ^ s1 ^ x2 ^ (s3^x3);
        s[i+3] = (s0^x0) ^ s1 ^ s2 ^ x3;
    }
}

// InvMixColumns: kebalikan MixColumns
// Matriks: [14,11,13,9 / 9,14,11,13 / 13,9,14,11 / 11,13,9,14]
function invMixColumns(s) {
    for (let c = 0; c < 4; c++) {
        const i = c * 4;
        const s0 = s[i], s1 = s[i+1], s2 = s[i+2], s3 = s[i+3];
        s[i]   = gmul(0x0e,s0) ^ gmul(0x0b,s1) ^ gmul(0x0d,s2) ^ gmul(0x09,s3);
        s[i+1] = gmul(0x09,s0) ^ gmul(0x0e,s1) ^ gmul(0x0b,s2) ^ gmul(0x0d,s3);
        s[i+2] = gmul(0x0d,s0) ^ gmul(0x09,s1) ^ gmul(0x0e,s2) ^ gmul(0x0b,s3);
        s[i+3] = gmul(0x0b,s0) ^ gmul(0x0d,s1) ^ gmul(0x09,s2) ^ gmul(0x0e,s3);
    }
}

// AddRoundKey: XOR state dengan round key
function addRoundKey(s, rk) {
    for (let i = 0; i < 16; i++) s[i] ^= rk[i];
}

// ============================================================
// AES-256 Key Schedule
// Input: 32-byte key → Output: 15 round keys (masing-masing 16 byte)
// AES-256: Nk=8, Nr=14, dibutuhkan 4*(Nr+1)=60 words = 15 round keys
// ============================================================
function keySchedule(key) {
    if (key.length !== 32) throw new Error('AES-256 membutuhkan key 32 byte');

    // W[0..59]: 60 words × 4 byte = 240 byte
    const W = new Uint8Array(240);
    W.set(key.slice(0, 32)); // W[0..7] = key

    for (let i = 8; i < 60; i++) {
        const prev = W.slice((i - 1) * 4, i * 4);
        const temp = new Uint8Array(prev);

        if (i % 8 === 0) {
            // RotWord: rotasi kiri 1 byte
            const t = temp[0];
            temp[0] = temp[1]; temp[1] = temp[2]; temp[2] = temp[3]; temp[3] = t;
            // SubWord: terapkan S-Box ke setiap byte
            temp[0] = SBOX[temp[0]]; temp[1] = SBOX[temp[1]];
            temp[2] = SBOX[temp[2]]; temp[3] = SBOX[temp[3]];
            // XOR dengan RCON
            temp[0] ^= RCON[i / 8];
        } else if (i % 8 === 4) {
            // SubWord saja (khusus AES-256)
            temp[0] = SBOX[temp[0]]; temp[1] = SBOX[temp[1]];
            temp[2] = SBOX[temp[2]]; temp[3] = SBOX[temp[3]];
        }

        const base = i * 4;
        const base8 = (i - 8) * 4;
        W[base]   = W[base8]   ^ temp[0];
        W[base+1] = W[base8+1] ^ temp[1];
        W[base+2] = W[base8+2] ^ temp[2];
        W[base+3] = W[base8+3] ^ temp[3];
    }

    // Ekstrak 15 round keys (masing-masing 16 byte = 4 words)
    const roundKeys = [];
    for (let r = 0; r < 15; r++) {
        roundKeys.push(W.slice(r * 16, (r + 1) * 16));
    }
    return roundKeys;
}

// ============================================================
// AES-256 Block Cipher (enkripsi & dekripsi satu blok 16 byte)
// ============================================================

function aesEncryptBlock(block, roundKeys) {
    const s = new Uint8Array(block);

    addRoundKey(s, roundKeys[0]);

    // Round 1–13: SubBytes → ShiftRows → MixColumns → AddRoundKey
    for (let r = 1; r <= 13; r++) {
        subBytes(s);
        shiftRows(s);
        mixColumns(s);
        addRoundKey(s, roundKeys[r]);
    }

    // Round 14 (final): SubBytes → ShiftRows → AddRoundKey (tanpa MixColumns)
    subBytes(s);
    shiftRows(s);
    addRoundKey(s, roundKeys[14]);

    return s;
}

function aesDecryptBlock(block, roundKeys) {
    const s = new Uint8Array(block);

    addRoundKey(s, roundKeys[14]);

    // Round 13–1: InvShiftRows → InvSubBytes → AddRoundKey → InvMixColumns
    for (let r = 13; r >= 1; r--) {
        invShiftRows(s);
        invSubBytes(s);
        addRoundKey(s, roundKeys[r]);
        invMixColumns(s);
    }

    // Round 0 (final): InvShiftRows → InvSubBytes → AddRoundKey
    invShiftRows(s);
    invSubBytes(s);
    addRoundKey(s, roundKeys[0]);

    return s;
}

// ============================================================
// PKCS7 Padding
// ============================================================

function pkcs7Pad(data) {
    const padLen = 16 - (data.length % 16);
    const padded = new Uint8Array(data.length + padLen);
    padded.set(data);
    padded.fill(padLen, data.length);
    return padded;
}

function pkcs7Unpad(data) {
    if (data.length === 0 || data.length % 16 !== 0) {
        throw new Error('Data tidak valid untuk unpadding');
    }
    const padLen = data[data.length - 1];
    if (padLen === 0 || padLen > 16) throw new Error('Padding tidak valid');
    for (let i = data.length - padLen; i < data.length; i++) {
        if (data[i] !== padLen) throw new Error('Padding PKCS7 rusak');
    }
    return data.slice(0, data.length - padLen);
}

// ============================================================
// HMAC-SHA256
// Digunakan untuk authentication tag (Encrypt-then-MAC)
// ============================================================

function hmacSha256(key, data) {
    // Jika key > 64 byte, hash dulu
    let k = key.length > 64 ? sha256(key) : key;

    // Pad key ke 64 byte
    const kPad = new Uint8Array(64);
    kPad.set(k.slice(0, 64));

    // Inner dan outer key
    const iKey = new Uint8Array(64);
    const oKey = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
        iKey[i] = kPad[i] ^ 0x36; // ipad
        oKey[i] = kPad[i] ^ 0x5c; // opad
    }

    // HMAC = SHA256(oKey || SHA256(iKey || data))
    const innerInput = new Uint8Array(64 + data.length);
    innerInput.set(iKey);
    innerInput.set(data, 64);
    const innerHash = sha256(innerInput);

    const outerInput = new Uint8Array(64 + 32);
    outerInput.set(oKey);
    outerInput.set(innerHash, 64);
    return sha256(outerInput);
}

// ============================================================
// AES-256-CBC Encrypt / Decrypt (Public API)
// ============================================================

/**
 * Generate random AES-256 key
 * @returns {Buffer} 32 byte key
 */
function generateAESKey() {
    return randomBytes(32);
}

/**
 * Enkripsi plaintext dengan AES-256-CBC + HMAC-SHA256
 * @param {string} plaintext
 * @param {Buffer} aesKey - 32 byte key
 * @returns {{ iv: string, ciphertext: string, tag: string }} hex strings
 */
function encryptData(plaintext, aesKey) {
    if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Plaintext harus string non-kosong');
    }
    if (!Buffer.isBuffer(aesKey) || aesKey.length !== 32) {
        throw new Error('AES key harus Buffer 32 byte');
    }

    const roundKeys = keySchedule(aesKey);
    const iv = randomBytes(16);
    const paddedData = pkcs7Pad(Buffer.from(plaintext, 'utf8'));

    // CBC Encrypt
    const ciphertext = new Uint8Array(paddedData.length);
    let prev = iv;
    for (let i = 0; i < paddedData.length; i += 16) {
        const block = new Uint8Array(16);
        for (let j = 0; j < 16; j++) block[j] = paddedData[i + j] ^ prev[j];
        const enc = aesEncryptBlock(block, roundKeys);
        ciphertext.set(enc, i);
        prev = enc;
    }

    // HMAC-SHA256(key, IV || ciphertext) sebagai authentication tag
    const macInput = new Uint8Array(16 + ciphertext.length);
    macInput.set(iv);
    macInput.set(ciphertext, 16);
    const tag = hmacSha256(aesKey, macInput);

    return {
        iv: Buffer.from(iv).toString('hex'),
        ciphertext: Buffer.from(ciphertext).toString('hex'),
        tag: Buffer.from(tag).toString('hex'),
    };
}

/**
 * Dekripsi dengan AES-256-CBC + verifikasi HMAC-SHA256
 * @param {{ iv: string, ciphertext: string, tag: string }} encryptedObj
 * @param {Buffer} aesKey - 32 byte key
 * @returns {string} plaintext
 */
function decryptData(encryptedObj, aesKey) {
    if (!encryptedObj?.iv || !encryptedObj?.ciphertext || !encryptedObj?.tag) {
        throw new Error('encryptedObj harus berisi iv, ciphertext, dan tag');
    }
    if (!Buffer.isBuffer(aesKey) || aesKey.length !== 32) {
        throw new Error('AES key harus Buffer 32 byte');
    }

    const iv = Buffer.from(encryptedObj.iv, 'hex');
    const ciphertext = Buffer.from(encryptedObj.ciphertext, 'hex');
    const tag = Buffer.from(encryptedObj.tag, 'hex');

    // Verifikasi HMAC tag
    const macInput = new Uint8Array(16 + ciphertext.length);
    macInput.set(iv);
    macInput.set(ciphertext, 16);
    const expectedTag = hmacSha256(aesKey, macInput);

    // Constant-time comparison untuk mencegah timing attack
    if (tag.length !== expectedTag.length) throw new Error('Tag tidak valid');
    let diff = 0;
    for (let i = 0; i < tag.length; i++) diff |= tag[i] ^ expectedTag[i];
    if (diff !== 0) throw new Error('Autentikasi gagal: tag HMAC tidak cocok');

    // CBC Decrypt
    const roundKeys = keySchedule(aesKey);
    const plainPadded = new Uint8Array(ciphertext.length);
    let prev = iv;
    for (let i = 0; i < ciphertext.length; i += 16) {
        const block = ciphertext.slice(i, i + 16);
        const dec = aesDecryptBlock(block, roundKeys);
        for (let j = 0; j < 16; j++) plainPadded[i + j] = dec[j] ^ prev[j];
        prev = block;
    }

    return Buffer.from(pkcs7Unpad(plainPadded)).toString('utf8');
}

/**
 * Encrypt binary file dengan AES-256-CBC
 * Output format: [16 byte IV][ciphertext dengan PKCS7][32 byte HMAC tag]
 * @param {Uint8Array} fileData
 * @param {Buffer} aesKey
 * @returns {Uint8Array}
 */
function encryptFile(fileData, aesKey) {
    const roundKeys = keySchedule(aesKey);
    const iv = randomBytes(16);
    const padded = pkcs7Pad(fileData);

    const ciphertext = new Uint8Array(padded.length);
    let prev = iv;
    for (let i = 0; i < padded.length; i += 16) {
        const block = new Uint8Array(16);
        for (let j = 0; j < 16; j++) block[j] = padded[i + j] ^ prev[j];
        const enc = aesEncryptBlock(block, roundKeys);
        ciphertext.set(enc, i);
        prev = enc;
    }

    const macInput = new Uint8Array(16 + ciphertext.length);
    macInput.set(iv);
    macInput.set(ciphertext, 16);
    const tag = hmacSha256(aesKey, macInput);

    const result = new Uint8Array(16 + ciphertext.length + 32);
    result.set(iv, 0);
    result.set(ciphertext, 16);
    result.set(tag, 16 + ciphertext.length);
    return result;
}

/**
 * Decrypt binary file yang dienkripsi dengan encryptFile
 * @param {Uint8Array} encData
 * @param {Buffer} aesKey
 * @returns {Uint8Array}
 */
function decryptFile(encData, aesKey) {
    if (encData.length < 48) throw new Error('Data terenkripsi terlalu pendek');

    const iv = encData.slice(0, 16);
    const ciphertext = encData.slice(16, encData.length - 32);
    const tag = encData.slice(encData.length - 32);

    // Verifikasi HMAC
    const macInput = new Uint8Array(16 + ciphertext.length);
    macInput.set(iv);
    macInput.set(ciphertext, 16);
    const expectedTag = hmacSha256(aesKey, macInput);

    let diff = 0;
    for (let i = 0; i < 32; i++) diff |= tag[i] ^ expectedTag[i];
    if (diff !== 0) throw new Error('Autentikasi file gagal: tag tidak cocok');

    const roundKeys = keySchedule(aesKey);
    const plainPadded = new Uint8Array(ciphertext.length);
    let prev = iv;
    for (let i = 0; i < ciphertext.length; i += 16) {
        const block = ciphertext.slice(i, i + 16);
        const dec = aesDecryptBlock(block, roundKeys);
        for (let j = 0; j < 16; j++) plainPadded[i + j] = dec[j] ^ prev[j];
        prev = block;
    }

    return pkcs7Unpad(plainPadded);
}

function serializeAESKey(key) {
    return key.toString('hex');
}

function deserializeAESKey(hexString) {
    const buf = Buffer.from(hexString, 'hex');
    if (buf.length !== 32) throw new Error('Panjang AES key tidak valid');
    return buf;
}

module.exports = {
    generateAESKey,
    encryptData,
    decryptData,
    encryptFile,
    decryptFile,
    serializeAESKey,
    deserializeAESKey,
    // Exposed untuk testing
    keySchedule,
    aesEncryptBlock,
    aesDecryptBlock,
    hmacSha256,
    gmul,
    xtime,
};
