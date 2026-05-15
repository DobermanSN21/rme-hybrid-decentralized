// services/blockchain.js
// ============================================================
// Ethereum Smart Contract Interaction via ethers.js v6
// ============================================================

import { BrowserProvider, Contract } from "ethers";
import ContractArtifact from "../contracts/MedicalRecordVault.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

if (!CONTRACT_ADDRESS) {
    console.warn(
        "⚠️ VITE_CONTRACT_ADDRESS not configured!\n" +
        "Langkah setup:\n" +
        "  1. npx hardhat run scripts/deploy.js --network <network>\n" +
        "  2. Deploy script akan otomatis membuat frontend/.env\n" +
        "  3. Restart dev server: npm run dev\n" +
        "  4. Untuk Vercel: set VITE_CONTRACT_ADDRESS di Vercel dashboard"
    );
}

const ABI = ContractArtifact.abi;

// ============================================================
// Wallet Connection
// ============================================================

export async function connectWallet() {
    if (!window.ethereum) {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            throw new Error(
                "MetaMask not detected. Please open this page inside the MetaMask app browser."
            );
        }
        throw new Error(
            "MetaMask not detected. Please install the MetaMask browser extension."
        );
    }

    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    return { provider, signer, address };
}

export async function getCurrentAccount() {
    if (!window.ethereum) return null;
    const provider = new BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_accounts", []);
    if (accounts.length === 0) return null;
    const signer = await provider.getSigner();
    return { provider, signer, address: accounts[0] };
}

// ============================================================
// Contract Instance
// ============================================================

function getContract(signer) {
    if (!CONTRACT_ADDRESS) {
        throw new Error(
            "Contract address not configured.\n\n" +
            "Langkah setup:\n" +
            "1. Jalankan: npx hardhat node\n" +
            "2. Jalankan: npx hardhat run scripts/deploy.js --network localhost\n" +
            "3. Restart frontend: npm run dev\n\n" +
            "Deploy script akan otomatis membuat file .env."
        );
    }
    return new Contract(CONTRACT_ADDRESS, ABI, signer);
}

// ============================================================
// Registration
// ============================================================

export async function registerAsPatient(signer, publicKey) {
    const contract = getContract(signer);
    const tx = await contract.registerAsPatient(publicKey);
    await tx.wait();
    return tx;
}

export async function registerAsDoctor(signer, publicKey) {
    const contract = getContract(signer);
    const tx = await contract.registerAsDoctor(publicKey);
    await tx.wait();
    return tx;
}

// ============================================================
// Role & Public Key Queries
// ============================================================

export async function getRole(signer, address) {
    const contract = getContract(signer);
    const role = await contract.getRole(address);
    return Number(role); // 0=NONE, 1=PATIENT, 2=DOCTOR
}

export async function getPublicKey(signer, address) {
    const contract = getContract(signer);
    return contract.getPublicKey(address);
}

// ============================================================
// Record Submission (Doctor → Patient, PENDING)
// ============================================================

export async function submitRecord(signer, patientAddress, cid, encryptedKeyForPatient, fileType, fileName) {
    const contract = getContract(signer);
    const tx = await contract.submitRecord(patientAddress, cid, encryptedKeyForPatient, fileType, fileName);
    await tx.wait();
    return tx;
}

// ============================================================
// Consent Management (Patient)
// ============================================================

export async function approveRecord(signer, recordIndex) {
    const contract = getContract(signer);
    const tx = await contract.approveRecord(recordIndex);
    await tx.wait();
    return tx;
}

export async function rejectRecord(signer, recordIndex) {
    const contract = getContract(signer);
    const tx = await contract.rejectRecord(recordIndex);
    await tx.wait();
    return tx;
}

export async function getPendingRecords(signer) {
    const contract = getContract(signer);
    const [records, indices] = await contract.getPendingRecords();
    return records.map((r, i) => ({
        cid: r.cid,
        patientAddress: r.patientAddress,
        doctorAddress: r.doctorAddress,
        fileType: r.fileType,
        fileName: r.fileName,
        status: Number(r.status),
        timestamp: Number(r.timestamp),
        recordIndex: Number(indices[i]),
    }));
}

export async function getPendingCount(signer) {
    const contract = getContract(signer);
    return Number(await contract.getPendingCount());
}

// ============================================================
// Record Retrieval
// ============================================================

export async function getMyRecords(signer) {
    const contract = getContract(signer);
    const records = await contract.getMyRecords();
    return records.map((r) => ({
        cid: r.cid,
        patientAddress: r.patientAddress,
        doctorAddress: r.doctorAddress,
        fileType: r.fileType,
        fileName: r.fileName,
        status: Number(r.status),
        timestamp: Number(r.timestamp),
    }));
}

export async function getPatientRecords(signer, patientAddress) {
    const contract = getContract(signer);
    const records = await contract.getPatientRecords(patientAddress);
    return records.map((r) => ({
        cid: r.cid,
        patientAddress: r.patientAddress,
        doctorAddress: r.doctorAddress,
        fileType: r.fileType,
        fileName: r.fileName,
        status: Number(r.status),
        timestamp: Number(r.timestamp),
    }));
}

export async function getRecordCount(signer) {
    const contract = getContract(signer);
    return Number(await contract.getRecordCount());
}

export async function getMyCids(signer) {
    const contract = getContract(signer);
    return contract.getMyCids();
}

// ============================================================
// Access Management
// ============================================================

export async function grantAccess(signer, doctorAddress, cid, encryptedKeyForDoctor) {
    const contract = getContract(signer);
    const tx = await contract.grantAccess(doctorAddress, cid, encryptedKeyForDoctor);
    await tx.wait();
    return tx;
}

export async function revokeAccess(signer, doctorAddress) {
    const contract = getContract(signer);
    const tx = await contract.revokeAccess(doctorAddress);
    await tx.wait();
    return tx;
}

export async function getAuthorizedDoctors(signer) {
    const contract = getContract(signer);
    return contract.getAuthorizedDoctors();
}

// ============================================================
// Encrypted Key
// ============================================================

export async function getEncryptedKey(signer, cid) {
    const contract = getContract(signer);
    return contract.getEncryptedKey(cid);
}
