// services/crypto.js
// ============================================================
// Implementasi Manual: SHA-256, AES-256-CBC, ECC secp256k1, ECDH, HKDF
// ============================================================
// Semua algoritma kriptografi diimplementasikan dari nol (tanpa library eksternal).
// Referensi: FIPS 180-4 (SHA-256), FIPS 197 (AES), SEC 2 v2.0 (secp256k1)
// ============================================================

// ============================================================
// HELPER: Bytes ↔ Hex ↔ String
// ============================================================
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
    if (hex.length % 2 !== 0) throw new Error('Hex string harus genap');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function strToBytes(str) {
    return new TextEncoder().encode(str);
}

function bytesToStr(bytes) {
    return new TextDecoder().decode(bytes);
}

// ============================================================
// 1. SHA-256 — Implementasi Manual
// Referensi: FIPS 180-4
// ============================================================

const SHA256_K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

const SHA256_H0 = new Uint32Array([
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
]);

function sha256rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }
function sha256Ch(e, f, g) { return ((e & f) ^ (~e & g)) >>> 0; }
function sha256Maj(a, b, c) { return ((a & b) ^ (a & c) ^ (b & c)) >>> 0; }
function sha256S0(a) { return (sha256rotr(a,2) ^ sha256rotr(a,13) ^ sha256rotr(a,22)) >>> 0; }
function sha256S1(e) { return (sha256rotr(e,6) ^ sha256rotr(e,11) ^ sha256rotr(e,25)) >>> 0; }
function sha256s0(w) { return (sha256rotr(w,7) ^ sha256rotr(w,18) ^ (w >>> 3)) >>> 0; }
function sha256s1(w) { return (sha256rotr(w,17) ^ sha256rotr(w,19) ^ (w >>> 10)) >>> 0; }

/**
 * SHA-256 manual
 * @param {Uint8Array|string} input
 * @returns {Uint8Array} 32-byte digest
 */
function sha256(input) {
    const bytes = typeof input === 'string' ? strToBytes(input) : input;
    const msgLen = bytes.length;
    const bitLen = msgLen * 8;
    const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLen);
    padded.set(bytes);
    padded[msgLen] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
    dv.setUint32(paddedLen - 4, bitLen >>> 0, false);

    const h = new Uint32Array(SHA256_H0);
    const W = new Uint32Array(64);

    for (let bs = 0; bs < paddedLen; bs += 64) {
        for (let t = 0; t < 16; t++) W[t] = dv.getUint32(bs + t * 4, false);
        for (let t = 16; t < 64; t++) W[t] = (sha256s1(W[t-2]) + W[t-7] + sha256s0(W[t-15]) + W[t-16]) >>> 0;
        let a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
        for (let t = 0; t < 64; t++) {
            const T1 = (hh + sha256S1(e) + sha256Ch(e,f,g) + SHA256_K[t] + W[t]) >>> 0;
            const T2 = (sha256S0(a) + sha256Maj(a,b,c)) >>> 0;
            hh=g; g=f; f=e; e=(d+T1)>>>0; d=c; c=b; b=a; a=(T1+T2)>>>0;
        }
        h[0]=(h[0]+a)>>>0; h[1]=(h[1]+b)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0;
        h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+hh)>>>0;
    }
    const digest = new Uint8Array(32);
    const dvo = new DataView(digest.buffer);
    for (let i = 0; i < 8; i++) dvo.setUint32(i*4, h[i], false);
    return digest;
}

export function sha256Hex(input) {
    return bytesToHex(sha256(typeof input === 'string' ? strToBytes(input) : input));
}

// ============================================================
// 2. HMAC-SHA256 (digunakan oleh AES auth tag dan HKDF)
// ============================================================

function hmacSha256(key, data) {
    let k = key.length > 64 ? sha256(key) : key;
    const kPad = new Uint8Array(64);
    kPad.set(k.slice(0, 64));
    const iKey = new Uint8Array(64);
    const oKey = new Uint8Array(64);
    for (let i = 0; i < 64; i++) { iKey[i] = kPad[i] ^ 0x36; oKey[i] = kPad[i] ^ 0x5c; }
    const inner = new Uint8Array(64 + data.length);
    inner.set(iKey); inner.set(data, 64);
    const innerHash = sha256(inner);
    const outer = new Uint8Array(96);
    outer.set(oKey); outer.set(innerHash, 64);
    return sha256(outer);
}

// ============================================================
// 3. HKDF-SHA256 (key derivation dari ECDH shared secret)
// ============================================================

function hkdf(ikm, salt, info, length) {
    const prk = hmacSha256(salt, ikm);
    const t1Input = new Uint8Array(info.length + 1);
    t1Input.set(info); t1Input[info.length] = 0x01;
    return hmacSha256(prk, t1Input).slice(0, length);
}

// ============================================================
// 4. AES-256-CBC — Implementasi Manual
// Referensi: FIPS 197
// ============================================================

const AES_SBOX = new Uint8Array([
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

const AES_INV_SBOX = new Uint8Array([
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

const AES_RCON = new Uint8Array([0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36]);

function aesXtime(a) { return ((a << 1) ^ (a & 0x80 ? 0x1b : 0x00)) & 0xff; }
function aesGmul(a, b) {
    let r=0, aa=a&0xff, bb=b&0xff;
    while(bb>0){ if(bb&1) r^=aa; aa=aesXtime(aa); bb>>=1; }
    return r&0xff;
}

function aesKeySchedule(keyHex) {
    const key = hexToBytes(keyHex);
    if (key.length !== 32) throw new Error('AES-256 butuh key 32 byte');
    const W = new Uint8Array(240);
    W.set(key);
    for (let i = 8; i < 60; i++) {
        const prev = W.slice((i-1)*4, i*4);
        const temp = new Uint8Array(prev);
        if (i%8===0) {
            const t=temp[0]; temp[0]=temp[1]; temp[1]=temp[2]; temp[2]=temp[3]; temp[3]=t;
            temp[0]=AES_SBOX[temp[0]]; temp[1]=AES_SBOX[temp[1]];
            temp[2]=AES_SBOX[temp[2]]; temp[3]=AES_SBOX[temp[3]];
            temp[0]^=AES_RCON[i/8];
        } else if (i%8===4) {
            temp[0]=AES_SBOX[temp[0]]; temp[1]=AES_SBOX[temp[1]];
            temp[2]=AES_SBOX[temp[2]]; temp[3]=AES_SBOX[temp[3]];
        }
        const b=i*4, b8=(i-8)*4;
        W[b]=W[b8]^temp[0]; W[b+1]=W[b8+1]^temp[1];
        W[b+2]=W[b8+2]^temp[2]; W[b+3]=W[b8+3]^temp[3];
    }
    const rks = [];
    for (let r=0; r<15; r++) rks.push(W.slice(r*16,(r+1)*16));
    return rks;
}

function aesAddRK(s,rk){ for(let i=0;i<16;i++) s[i]^=rk[i]; }
function aesSub(s){ for(let i=0;i<16;i++) s[i]=AES_SBOX[s[i]]; }
function aesInvSub(s){ for(let i=0;i<16;i++) s[i]=AES_INV_SBOX[s[i]]; }
function aesShiftRows(s){ let t; t=s[1];s[1]=s[5];s[5]=s[9];s[9]=s[13];s[13]=t; t=s[2];s[2]=s[10];s[10]=t; t=s[6];s[6]=s[14];s[14]=t; t=s[15];s[15]=s[11];s[11]=s[7];s[7]=s[3];s[3]=t; }
function aesInvShiftRows(s){ let t; t=s[13];s[13]=s[9];s[9]=s[5];s[5]=s[1];s[1]=t; t=s[2];s[2]=s[10];s[10]=t; t=s[6];s[6]=s[14];s[14]=t; t=s[3];s[3]=s[7];s[7]=s[11];s[11]=s[15];s[15]=t; }
function aesMixCols(s){ for(let c=0;c<4;c++){ const i=c*4,s0=s[i],s1=s[i+1],s2=s[i+2],s3=s[i+3],x0=aesXtime(s0),x1=aesXtime(s1),x2=aesXtime(s2),x3=aesXtime(s3); s[i]=x0^(s1^x1)^s2^s3; s[i+1]=s0^x1^(s2^x2)^s3; s[i+2]=s0^s1^x2^(s3^x3); s[i+3]=(s0^x0)^s1^s2^x3; } }
function aesInvMixCols(s){ for(let c=0;c<4;c++){ const i=c*4,s0=s[i],s1=s[i+1],s2=s[i+2],s3=s[i+3]; s[i]=aesGmul(0x0e,s0)^aesGmul(0x0b,s1)^aesGmul(0x0d,s2)^aesGmul(0x09,s3); s[i+1]=aesGmul(0x09,s0)^aesGmul(0x0e,s1)^aesGmul(0x0b,s2)^aesGmul(0x0d,s3); s[i+2]=aesGmul(0x0d,s0)^aesGmul(0x09,s1)^aesGmul(0x0e,s2)^aesGmul(0x0b,s3); s[i+3]=aesGmul(0x0b,s0)^aesGmul(0x0d,s1)^aesGmul(0x09,s2)^aesGmul(0x0e,s3); } }

function aesEncBlock(block, rks) {
    const s = new Uint8Array(block);
    aesAddRK(s,rks[0]);
    for(let r=1;r<=13;r++){ aesSub(s); aesShiftRows(s); aesMixCols(s); aesAddRK(s,rks[r]); }
    aesSub(s); aesShiftRows(s); aesAddRK(s,rks[14]);
    return s;
}

function aesDecBlock(block, rks) {
    const s = new Uint8Array(block);
    aesAddRK(s,rks[14]);
    for(let r=13;r>=1;r--){ aesInvShiftRows(s); aesInvSub(s); aesAddRK(s,rks[r]); aesInvMixCols(s); }
    aesInvShiftRows(s); aesInvSub(s); aesAddRK(s,rks[0]);
    return s;
}

function pkcs7Pad(data) {
    const p = 16 - (data.length % 16);
    const out = new Uint8Array(data.length + p);
    out.set(data); out.fill(p, data.length);
    return out;
}

function pkcs7Unpad(data) {
    const p = data[data.length-1];
    if (p===0||p>16) throw new Error('Padding tidak valid');
    for(let i=data.length-p;i<data.length;i++) if(data[i]!==p) throw new Error('Padding rusak');
    return data.slice(0, data.length-p);
}

// ============================================================
// 5. ECC secp256k1 — Implementasi Manual
// Referensi: SEC 2 v2.0
// ============================================================

const ECC = {
    p: 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn,
    n: 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n,
    Gx: 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n,
    Gy: 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n,
};

function eccModPow(base, exp, mod) {
    let r=1n; base=base%mod;
    while(exp>0n){ if(exp&1n) r=(r*base)%mod; exp>>=1n; base=(base*base)%mod; }
    return r;
}
function eccModInv(a) { return eccModPow(((a%ECC.p)+ECC.p)%ECC.p, ECC.p-2n, ECC.p); }
function eccMul(a,b) { return (a*b)%ECC.p; }
function eccSub(a,b) { return ((a-b)%ECC.p+ECC.p)%ECC.p; }

function eccPointDouble(P) {
    if(!P) return null;
    const lam = eccMul(eccMul(3n,eccMul(P.x,P.x)), eccModInv(eccMul(2n,P.y)));
    const Rx = ((lam*lam)%ECC.p - 2n*P.x % ECC.p + 2n*ECC.p) % ECC.p;
    const Ry = (eccMul(lam, eccSub(P.x,Rx)) - P.y + ECC.p) % ECC.p;
    return {x:Rx,y:Ry};
}

function eccPointAdd(P, Q) {
    if(!P) return Q; if(!Q) return P;
    if(P.x===Q.x&&P.y===Q.y) return eccPointDouble(P);
    if(P.x===Q.x) return null;
    const lam = eccMul(eccSub(Q.y,P.y), eccModInv(eccSub(Q.x,P.x)));
    const Rx = (eccMul(lam,lam) - P.x - Q.x % ECC.p + 2n*ECC.p) % ECC.p;
    const Ry = (eccMul(lam,eccSub(P.x,Rx)) - P.y + ECC.p) % ECC.p;
    return {x:Rx,y:Ry};
}

function eccScalarMult(k, P) {
    let result=null, addend={x:P.x,y:P.y};
    while(k>0n){ if(k&1n) result=eccPointAdd(result,addend); addend=eccPointDouble(addend); k>>=1n; }
    return result;
}

const G_POINT = { x: ECC.Gx, y: ECC.Gy };

function bigIntToBytes32(bn) {
    const r=new Uint8Array(32);
    let v=((bn%ECC.p)+ECC.p)%ECC.p;
    for(let i=31;i>=0;i--){ r[i]=Number(v&0xffn); v>>=8n; }
    return r;
}

function bytesToBigInt(bytes) {
    let r=0n; for(const b of bytes) r=(r<<8n)|BigInt(b); return r;
}

// ============================================================
// 6. PUBLIC API — Key Management
// ============================================================

export function generateKeyPair() {
    let privBytes, privBig;
    do {
        privBytes = new Uint8Array(32);
        crypto.getRandomValues(privBytes);
        privBig = bytesToBigInt(privBytes);
    } while (privBig === 0n || privBig >= ECC.n);

    const privateKey = bytesToHex(privBytes);
    const publicKey = privateKeyToPublicKey(privateKey);
    return { privateKey, publicKey };
}

export function privateKeyToPublicKey(privateKeyHex) {
    const k = BigInt('0x' + privateKeyHex);
    const point = eccScalarMult(k, G_POINT);
    if (!point) throw new Error('Private key invalid');
    const pub = new Uint8Array(65);
    pub[0] = 0x04;
    pub.set(bigIntToBytes32(point.x), 1);
    pub.set(bigIntToBytes32(point.y), 33);
    return bytesToHex(pub);
}

export function isValidPublicKey(publicKeyHex) {
    try {
        if (!publicKeyHex || publicKeyHex.length !== 130) return false;
        const bytes = hexToBytes(publicKeyHex);
        if (bytes[0] !== 0x04) return false;
        const x = bytesToBigInt(bytes.slice(1,33));
        const y = bytesToBigInt(bytes.slice(33,65));
        return ((y*y)%ECC.p) === ((x*x*x%ECC.p + 7n)%ECC.p);
    } catch { return false; }
}

// ============================================================
// 7. PUBLIC API — AES-256-CBC (async wrapper untuk kompatibilitas)
// ============================================================

export async function generateAESKey() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
}

export async function encryptData(plaintext, aesKeyHex) {
    const rks = aesKeySchedule(aesKeyHex);
    const iv = new Uint8Array(16);
    crypto.getRandomValues(iv);
    const padded = pkcs7Pad(strToBytes(plaintext));
    const ct = new Uint8Array(padded.length);
    let prev = iv;
    for (let i=0;i<padded.length;i+=16) {
        const blk=new Uint8Array(16);
        for(let j=0;j<16;j++) blk[j]=padded[i+j]^prev[j];
        const enc=aesEncBlock(blk,rks);
        ct.set(enc,i); prev=enc;
    }
    const macIn=new Uint8Array(16+ct.length);
    macIn.set(iv); macIn.set(ct,16);
    const tag=hmacSha256(hexToBytes(aesKeyHex), macIn);
    return { iv:bytesToHex(iv), ciphertext:bytesToHex(ct), tag:bytesToHex(tag) };
}

export async function decryptData(encryptedObj, aesKeyHex) {
    const iv=hexToBytes(encryptedObj.iv);
    const ct=hexToBytes(encryptedObj.ciphertext);
    const tag=hexToBytes(encryptedObj.tag);
    const macIn=new Uint8Array(16+ct.length);
    macIn.set(iv); macIn.set(ct,16);
    const expected=hmacSha256(hexToBytes(aesKeyHex), macIn);
    let diff=0; for(let i=0;i<32;i++) diff|=tag[i]^expected[i];
    if(diff!==0) throw new Error('Autentikasi gagal: HMAC tag tidak cocok');
    const rks=aesKeySchedule(aesKeyHex);
    const plain=new Uint8Array(ct.length);
    let prev=iv;
    for(let i=0;i<ct.length;i+=16){
        const blk=ct.slice(i,i+16);
        const dec=aesDecBlock(blk,rks);
        for(let j=0;j<16;j++) plain[i+j]=dec[j]^prev[j];
        prev=blk;
    }
    return bytesToStr(pkcs7Unpad(plain));
}

export async function encryptFile(fileBuffer, aesKeyHex) {
    const rks=aesKeySchedule(aesKeyHex);
    const iv=new Uint8Array(16);
    crypto.getRandomValues(iv);
    const data=new Uint8Array(fileBuffer);
    const padded=pkcs7Pad(data);
    const ct=new Uint8Array(padded.length);
    let prev=iv;
    for(let i=0;i<padded.length;i+=16){
        const blk=new Uint8Array(16);
        for(let j=0;j<16;j++) blk[j]=padded[i+j]^prev[j];
        const enc=aesEncBlock(blk,rks);
        ct.set(enc,i); prev=enc;
    }
    const macIn=new Uint8Array(16+ct.length);
    macIn.set(iv); macIn.set(ct,16);
    const tag=hmacSha256(hexToBytes(aesKeyHex),macIn);
    const result=new Uint8Array(16+ct.length+32);
    result.set(iv,0); result.set(ct,16); result.set(tag,16+ct.length);
    return new Blob([result],{type:'application/octet-stream'});
}

export async function decryptFile(encryptedBuffer, aesKeyHex) {
    const data=new Uint8Array(encryptedBuffer);
    if(data.length<48) throw new Error('Data terenkripsi terlalu pendek');
    const iv=data.slice(0,16);
    const ct=data.slice(16,data.length-32);
    const tag=data.slice(data.length-32);
    const macIn=new Uint8Array(16+ct.length);
    macIn.set(iv); macIn.set(ct,16);
    const expected=hmacSha256(hexToBytes(aesKeyHex),macIn);
    let diff=0; for(let i=0;i<32;i++) diff|=tag[i]^expected[i];
    if(diff!==0) throw new Error('Autentikasi file gagal: tag tidak cocok');
    const rks=aesKeySchedule(aesKeyHex);
    const plain=new Uint8Array(ct.length);
    let prev=iv;
    for(let i=0;i<ct.length;i+=16){
        const blk=ct.slice(i,i+16);
        const dec=aesDecBlock(blk,rks);
        for(let j=0;j<16;j++) plain[i+j]=dec[j]^prev[j];
        prev=blk;
    }
    return pkcs7Unpad(plain).buffer;
}

// ============================================================
// 8. PUBLIC API — ECIES (ECC + ECDH + HKDF + AES)
// ============================================================

const HKDF_SALT = strToBytes('rme-hybrid-ecies-salt');
const HKDF_INFO = strToBytes('rme-hybrid-ecies-info');

function eccComputeShared(privHex, pubHex) {
    const k=BigInt('0x'+privHex);
    const bytes=hexToBytes(pubHex);
    const point={x:bytesToBigInt(bytes.slice(1,33)), y:bytesToBigInt(bytes.slice(33,65))};
    const shared=eccScalarMult(k,point);
    if(!shared) throw new Error('ECDH menghasilkan titik infinity');
    return bigIntToBytes32(shared.x);
}

function eccDeriveKey(sharedSecret) {
    return hkdf(sharedSecret, HKDF_SALT, HKDF_INFO, 32);
}

export async function encryptWithPublicKey(recipientPublicKeyHex, plaintext) {
    const { privateKey: ephPriv, publicKey: ephPub } = generateKeyPair();
    const shared = eccComputeShared(ephPriv, recipientPublicKeyHex);
    const encKeyHex = bytesToHex(eccDeriveKey(shared));
    const encrypted = await encryptData(plaintext, encKeyHex);
    return { ephemeralPublicKey: ephPub, ...encrypted };
}

export async function decryptWithPrivateKey(recipientPrivateKeyHex, encryptedData) {
    const shared = eccComputeShared(recipientPrivateKeyHex, encryptedData.ephemeralPublicKey);
    const encKeyHex = bytesToHex(eccDeriveKey(shared));
    return decryptData({ iv:encryptedData.iv, ciphertext:encryptedData.ciphertext, tag:encryptedData.tag }, encKeyHex);
}

export function serializeEncrypted(encryptedData) {
    return [encryptedData.ephemeralPublicKey, encryptedData.iv, encryptedData.ciphertext, encryptedData.tag].join(':');
}

export function deserializeEncrypted(serialized) {
    const parts = serialized.split(':');
    if (parts.length !== 4) throw new Error('Format data terenkripsi tidak valid');
    return { ephemeralPublicKey:parts[0], iv:parts[1], ciphertext:parts[2], tag:parts[3] };
}
