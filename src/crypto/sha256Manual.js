'use strict';
// ============================================================
// SHA-256 — Implementasi Manual
// ============================================================
// Referensi: FIPS 180-4 (Secure Hash Standard)
//
// Alur algoritma:
//   1. Padding pesan: tambah bit '1', zeros, panjang 64-bit big-endian
//      hingga total panjang ≡ 0 (mod 512 bit)
//   2. Inisialisasi 8 nilai hash H[0..7] (32-bit pertama dari
//      bagian pecahan akar kuadrat bilangan prima 2,3,5,7,11,13,17,19)
//   3. Untuk setiap blok 512-bit (64 byte):
//        a. Buat message schedule W[0..63]
//           W[0..15]  = kata-kata dari blok pesan
//           W[16..63] = σ1(W[t-2]) + W[t-7] + σ0(W[t-15]) + W[t-16]
//        b. Inisialisasi variabel kerja a, b, c, d, e, f, g, h
//        c. 64 round kompresi menggunakan Ch, Maj, Σ0, Σ1
//        d. Tambahkan hasil ke hash values
//   4. Output: gabungan H[0..7] = 256-bit digest
// ============================================================

// Konstanta K[0..63]: 32-bit pertama dari bagian pecahan akar kubik
// 64 bilangan prima pertama (2, 3, 5, 7, 11, ..., 311)
const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

// Nilai awal H[0..7]: 32-bit pertama dari bagian pecahan akar kuadrat
// bilangan prima 2, 3, 5, 7, 11, 13, 17, 19
const H_INIT = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

// ============================================================
// Operasi bitwise
// ============================================================

// Rotasi kanan 32-bit
function rotr32(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
}

// Ch(e, f, g) = (e AND f) XOR (NOT e AND g)
// "Choose" — e memilih antara f dan g
function Ch(e, f, g) {
    return ((e & f) ^ (~e & g)) >>> 0;
}

// Maj(a, b, c) = (a AND b) XOR (a AND c) XOR (b AND c)
// "Majority" — output bit mayoritas dari a, b, c
function Maj(a, b, c) {
    return ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
}

// Σ0(a) = ROTR²(a) XOR ROTR¹³(a) XOR ROTR²²(a)
function Sigma0(a) {
    return (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) >>> 0;
}

// Σ1(e) = ROTR⁶(e) XOR ROTR¹¹(e) XOR ROTR²⁵(e)
function Sigma1(e) {
    return (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) >>> 0;
}

// σ0(w) = ROTR⁷(w) XOR ROTR¹⁸(w) XOR SHR³(w)  [untuk message schedule]
function sigma0(w) {
    return (rotr32(w, 7) ^ rotr32(w, 18) ^ (w >>> 3)) >>> 0;
}

// σ1(w) = ROTR¹⁷(w) XOR ROTR¹⁹(w) XOR SHR¹⁰(w) [untuk message schedule]
function sigma1(w) {
    return (rotr32(w, 17) ^ rotr32(w, 19) ^ (w >>> 10)) >>> 0;
}

// ============================================================
// Fungsi utama SHA-256
// ============================================================

/**
 * Hitung SHA-256 digest dari input
 * @param {Uint8Array|Buffer|string} input
 * @returns {Uint8Array} Digest 32 byte (256 bit)
 */
function sha256(input) {
    // Konversi input ke bytes
    let bytes;
    if (typeof input === 'string') {
        bytes = Buffer.from(input, 'utf8');
    } else if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
        bytes = input;
    } else {
        throw new Error('Input harus string, Buffer, atau Uint8Array');
    }

    const msgLen = bytes.length;
    const bitLen = msgLen * 8;

    // === Langkah 1: Padding ===
    // Panjang padded = kelipatan 64 terkecil yang >= (msgLen + 9)
    // +1 untuk byte 0x80, +8 untuk panjang 64-bit
    const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLen);
    padded.set(bytes);
    padded[msgLen] = 0x80; // Bit '1' diikuti 7 bit '0'

    // Tulis panjang pesan dalam bit sebagai 64-bit big-endian di 8 byte terakhir
    const dv = new DataView(padded.buffer);
    dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
    dv.setUint32(paddedLen - 4, bitLen >>> 0, false);

    // === Langkah 2: Inisialisasi hash state ===
    const h = new Uint32Array(H_INIT);

    // === Langkah 3: Proses setiap blok 512-bit ===
    const W = new Uint32Array(64);

    for (let blockStart = 0; blockStart < paddedLen; blockStart += 64) {
        // 3a. Buat message schedule W[0..63]
        for (let t = 0; t < 16; t++) {
            W[t] = dv.getUint32(blockStart + t * 4, false);
        }
        for (let t = 16; t < 64; t++) {
            W[t] = (sigma1(W[t - 2]) + W[t - 7] + sigma0(W[t - 15]) + W[t - 16]) >>> 0;
        }

        // 3b. Inisialisasi variabel kerja dari hash state saat ini
        let a = h[0], b = h[1], c = h[2], d = h[3];
        let e = h[4], f = h[5], g = h[6], hh = h[7];

        // 3c. 64 round kompresi
        for (let t = 0; t < 64; t++) {
            const T1 = (hh + Sigma1(e) + Ch(e, f, g) + K[t] + W[t]) >>> 0;
            const T2 = (Sigma0(a) + Maj(a, b, c)) >>> 0;
            hh = g; g = f; f = e;
            e = (d + T1) >>> 0;
            d = c; c = b; b = a;
            a = (T1 + T2) >>> 0;
        }

        // 3d. Update hash values
        h[0] = (h[0] + a) >>> 0;
        h[1] = (h[1] + b) >>> 0;
        h[2] = (h[2] + c) >>> 0;
        h[3] = (h[3] + d) >>> 0;
        h[4] = (h[4] + e) >>> 0;
        h[5] = (h[5] + f) >>> 0;
        h[6] = (h[6] + g) >>> 0;
        h[7] = (h[7] + hh) >>> 0;
    }

    // === Langkah 4: Hasilkan digest 256-bit (32 byte) ===
    const digest = new Uint8Array(32);
    const dvOut = new DataView(digest.buffer);
    for (let i = 0; i < 8; i++) {
        dvOut.setUint32(i * 4, h[i], false);
    }
    return digest;
}

/**
 * SHA-256 yang mengembalikan hex string (64 karakter)
 * @param {Uint8Array|Buffer|string} input
 * @returns {string}
 */
function sha256Hex(input) {
    return Buffer.from(sha256(input)).toString('hex');
}

module.exports = { sha256, sha256Hex };
