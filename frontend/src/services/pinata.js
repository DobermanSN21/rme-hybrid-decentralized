// services/pinata.js
// ============================================================
// Pinata IPFS Service — Upload & Download encrypted files
// ============================================================
// Uses Pinata API v2 for IPFS pinning
// Docs: https://docs.pinata.cloud/
// ============================================================

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || "";
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud";

if (!PINATA_JWT) {
    console.warn(
        "⚠️ VITE_PINATA_JWT not configured!\n" +
        "Dapatkan JWT dari: https://app.pinata.cloud/developers/api-keys\n" +
        "Tambahkan ke frontend/.env:\n" +
        "  VITE_PINATA_JWT=your_jwt_here"
    );
}

/**
 * Upload encrypted file to Pinata IPFS
 * @param {Blob} encryptedBlob - Encrypted file as Blob
 * @param {string} fileName - Original file name (for metadata)
 * @returns {Promise<string>} IPFS CID
 */
export async function uploadToPinata(encryptedBlob, fileName) {
    if (!PINATA_JWT) {
        throw new Error("Pinata JWT not configured. Set VITE_PINATA_JWT di .env");
    }

    const formData = new FormData();
    formData.append("file", encryptedBlob, `encrypted_${fileName}`);

    // Metadata for Pinata
    const metadata = JSON.stringify({
        name: `RME_${fileName}_${Date.now()}`,
        keyvalues: {
            source: "rme-vault",
            originalName: fileName,
            encrypted: "true",
        },
    });
    formData.append("pinataMetadata", metadata);

    // Pin options
    const options = JSON.stringify({
        cidVersion: 1,
    });
    formData.append("pinataOptions", options);

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pinata upload failed: ${response.status} — ${error}`);
    }

    const result = await response.json();
    return result.IpfsHash; // CID
}

/**
 * Download encrypted file from Pinata IPFS gateway
 * @param {string} cid - IPFS Content Identifier
 * @returns {Promise<ArrayBuffer>} Encrypted file data
 */
export async function downloadFromPinata(cid) {
    const gatewayUrl = `${PINATA_GATEWAY}/ipfs/${cid}`;

    const response = await fetch(gatewayUrl);

    if (!response.ok) {
        throw new Error(`Pinata download failed: ${response.status}`);
    }

    return response.arrayBuffer();
}

/**
 * Check if Pinata is configured
 * @returns {boolean}
 */
export function isPinataConfigured() {
    return !!PINATA_JWT;
}
