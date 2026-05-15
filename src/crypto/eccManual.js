'use strict';
// ============================================================
// ECC secp256k1 + ECDH — Implementasi Manual
// ============================================================
// Referensi: SEC 2 v2.0 (Standards for Efficient Cryptography)
//
// Kurva secp256k1: y² = x³ + 7  (mod p)
// Semua aritmatika besar menggunakan JavaScript BigInt
//
// Operasi yang diimplementasikan:
//   1. Modular arithmetic di GF(p): add, sub, mul, inverse
//   2. Point Addition (P + Q untuk P ≠ Q)
//   3. Point Doubling (P + P)
//   4. Scalar Multiplication (k * P) dengan algoritma double-and-add
//   5. Key Generation: privateKey (random scalar) → publicKey = G * privateKey
//   6. ECDH Shared Secret: sharedPoint = privateKey_A * publicKey_B
// ============================================================

const { randomBytes } = require('crypto');

// ============================================================
// Parameter kurva secp256k1
// ============================================================
const CURVE = {
    // Modulus field prima
    p: 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn,
    // Koefisien kurva: y² = x³ + ax + b → a=0, b=7
    a: 0n,
    b: 7n,
    // Titik generator G
    Gx: 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n,
    Gy: 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n,
    // Orde grup (jumlah titik pada kurva)
    n: 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n,
};

// Titik di infinity (identitas grup pada kurva eliptik)
const POINT_INFINITY = null;

// ============================================================
// GF(p) — Modular Arithmetic
// ============================================================

// (a + b) mod p
function modAdd(a, b) {
    return ((a + b) % CURVE.p + CURVE.p) % CURVE.p;
}

// (a - b) mod p
function modSub(a, b) {
    return ((a - b) % CURVE.p + CURVE.p) % CURVE.p;
}

// (a * b) mod p
function modMul(a, b) {
    return (a * b) % CURVE.p;
}

// Modular inverse: a^(-1) mod p menggunakan Fermat's Little Theorem
// Karena p prima: a^(-1) = a^(p-2) mod p
function modInv(a) {
    return modPow(((a % CURVE.p) + CURVE.p) % CURVE.p, CURVE.p - 2n, CURVE.p);
}

// Modular exponentiation: base^exp mod mod (square-and-multiply)
function modPow(base, exp, mod) {
    let result = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp & 1n) result = (result * base) % mod;
        exp >>= 1n;
        base = (base * base) % mod;
    }
    return result;
}

// ============================================================
// Operasi Titik pada Kurva Eliptik (Affine Coordinates)
// ============================================================

/**
 * Point Addition: R = P + Q  (P ≠ Q, keduanya bukan infinity)
 * Rumus:
 *   λ = (Qy - Py) / (Qx - Px)  mod p
 *   Rx = λ² - Px - Qx           mod p
 *   Ry = λ(Px - Rx) - Py        mod p
 */
function pointAdd(P, Q) {
    if (P === POINT_INFINITY) return Q;
    if (Q === POINT_INFINITY) return P;
    if (P.x === Q.x && P.y === Q.y) return pointDouble(P);
    if (P.x === Q.x) return POINT_INFINITY; // P = -Q

    const lambda = modMul(modSub(Q.y, P.y), modInv(modSub(Q.x, P.x)));
    const Rx = modSub(modSub(modMul(lambda, lambda), P.x), Q.x);
    const Ry = modSub(modMul(lambda, modSub(P.x, Rx)), P.y);
    return { x: Rx, y: Ry };
}

/**
 * Point Doubling: R = P + P = 2P
 * Rumus (untuk kurva y² = x³ + b, dengan a=0):
 *   λ = (3 * Px²) / (2 * Py)  mod p
 *   Rx = λ² - 2Px              mod p
 *   Ry = λ(Px - Rx) - Py       mod p
 */
function pointDouble(P) {
    if (P === POINT_INFINITY) return POINT_INFINITY;

    // λ = 3x² / 2y  (a=0 untuk secp256k1)
    const lambda = modMul(
        modMul(3n, modMul(P.x, P.x)),
        modInv(modMul(2n, P.y))
    );
    const Rx = modSub(modMul(lambda, lambda), modMul(2n, P.x));
    const Ry = modSub(modMul(lambda, modSub(P.x, Rx)), P.y);
    return { x: Rx, y: Ry };
}

/**
 * Scalar Multiplication: R = k * P
 * Algoritma Double-and-Add:
 *   - Mulai dari bit paling signifikan scalar k
 *   - Untuk setiap bit: selalu double, tambah P jika bit = 1
 */
function scalarMult(k, P) {
    if (k === 0n) return POINT_INFINITY;
    if (k < 0n) k = ((k % CURVE.n) + CURVE.n) % CURVE.n;

    let result = POINT_INFINITY;
    let addend = { x: P.x, y: P.y };

    while (k > 0n) {
        if (k & 1n) result = pointAdd(result, addend);
        addend = pointDouble(addend);
        k >>= 1n;
    }
    return result;
}

// Titik Generator G
const G = { x: CURVE.Gx, y: CURVE.Gy };

// ============================================================
// Konversi Bytes ↔ BigInt ↔ Hex
// ============================================================

function bytesToBigInt(bytes) {
    let result = 0n;
    for (const b of bytes) result = (result << 8n) | BigInt(b);
    return result;
}

function bigIntToBytes32(bn) {
    const result = new Uint8Array(32);
    let v = ((bn % CURVE.p) + CURVE.p) % CURVE.p;
    for (let i = 31; i >= 0; i--) {
        result[i] = Number(v & 0xffn);
        v >>= 8n;
    }
    return result;
}

function hexToBigInt(hex) {
    return BigInt('0x' + hex);
}

// ============================================================
// Key Management
// ============================================================

/**
 * Generate ECC key pair baru (secp256k1)
 * @returns {{ privateKey: string, publicKey: string }}
 *   privateKey: hex 64 karakter (32 byte)
 *   publicKey:  hex 130 karakter (65 byte, format uncompressed: 04 || x || y)
 */
function generateKeyPair() {
    let privBytes;
    let privBigInt;
    // Generate random scalar dalam range [1, n-1]
    do {
        privBytes = randomBytes(32);
        privBigInt = bytesToBigInt(privBytes);
    } while (privBigInt === 0n || privBigInt >= CURVE.n);

    const privateKey = Buffer.from(privBytes).toString('hex');
    const publicKey = privateKeyToPublicKey(privateKey);
    return { privateKey, publicKey };
}

/**
 * Derive public key dari private key
 * publicKey = G × privateKey
 * @param {string} privateKeyHex
 * @returns {string} Uncompressed public key hex (04 || x || y)
 */
function privateKeyToPublicKey(privateKeyHex) {
    const k = hexToBigInt(privateKeyHex);
    const point = scalarMult(k, G);
    if (point === POINT_INFINITY) throw new Error('Private key menghasilkan titik infinity');

    const xBytes = bigIntToBytes32(point.x);
    const yBytes = bigIntToBytes32(point.y);

    const pubKey = new Uint8Array(65);
    pubKey[0] = 0x04; // Prefix uncompressed
    pubKey.set(xBytes, 1);
    pubKey.set(yBytes, 33);
    return Buffer.from(pubKey).toString('hex');
}

/**
 * Parse public key hex menjadi titik {x, y}
 * @param {string} publicKeyHex - 130 karakter hex (format 04||x||y)
 * @returns {{ x: BigInt, y: BigInt }}
 */
function publicKeyToPoint(publicKeyHex) {
    const bytes = Buffer.from(publicKeyHex, 'hex');
    if (bytes.length !== 65 || bytes[0] !== 0x04) {
        throw new Error('Format public key tidak valid (harus uncompressed 04||x||y)');
    }
    return {
        x: bytesToBigInt(bytes.slice(1, 33)),
        y: bytesToBigInt(bytes.slice(33, 65)),
    };
}

/**
 * Validasi public key
 * @param {string} publicKeyHex
 * @returns {boolean}
 */
function isValidPublicKey(publicKeyHex) {
    try {
        if (!publicKeyHex || publicKeyHex.length !== 130) return false;
        const point = publicKeyToPoint(publicKeyHex);
        // Verifikasi titik ada di kurva: y² ≡ x³ + 7 (mod p)
        const lhs = modMul(point.y, point.y);
        const rhs = modAdd(modMul(modMul(point.x, point.x), point.x), 7n);
        return lhs === rhs;
    } catch {
        return false;
    }
}

/**
 * Validasi private key
 * @param {string} privateKeyHex
 * @returns {boolean}
 */
function isValidPrivateKey(privateKeyHex) {
    try {
        if (!privateKeyHex || privateKeyHex.length !== 64) return false;
        const k = hexToBigInt(privateKeyHex);
        return k > 0n && k < CURVE.n;
    } catch {
        return false;
    }
}

// ============================================================
// ECDH — Elliptic Curve Diffie-Hellman
// ============================================================

/**
 * Hitung ECDH shared secret
 * sharedPoint = privateKey × publicKey
 * Shared secret = koordinat x dari sharedPoint (32 byte)
 * @param {string} privateKeyHex
 * @param {string} publicKeyHex
 * @returns {Uint8Array} 32 byte shared secret (koordinat x)
 */
function computeSharedSecret(privateKeyHex, publicKeyHex) {
    const k = hexToBigInt(privateKeyHex);
    const point = publicKeyToPoint(publicKeyHex);
    const shared = scalarMult(k, point);
    if (shared === POINT_INFINITY) throw new Error('ECDH menghasilkan titik infinity');
    return bigIntToBytes32(shared.x);
}

// ============================================================
// Serialize / Deserialize
// ============================================================

function serializePublicKey(publicKeyBytes) {
    return Buffer.from(publicKeyBytes).toString('hex');
}

function deserializePublicKey(hexString) {
    return Uint8Array.from(Buffer.from(hexString, 'hex'));
}

module.exports = {
    generateKeyPair,
    privateKeyToPublicKey,
    publicKeyToPoint,
    isValidPublicKey,
    isValidPrivateKey,
    computeSharedSecret,
    serializePublicKey,
    deserializePublicKey,
    // Exposed untuk testing
    pointAdd,
    pointDouble,
    scalarMult,
    G,
    CURVE,
};
