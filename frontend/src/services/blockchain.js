// services/blockchain.js
import { BrowserProvider, Contract } from "ethers";
import ContractArtifact from "../contracts/MedicalRecordVault.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

if (!CONTRACT_ADDRESS) {
    console.warn("⚠️ VITE_CONTRACT_ADDRESS not configured!");
}

const ABI = ContractArtifact.abi;

// ── Wallet Connection ────────────────────────────────────────────────

const TARGET_CHAIN_ID = "0xaa36a7";
const TARGET_CHAIN_NAME = "Sepolia";

export async function connectWallet() {
    if (!window.ethereum) {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        throw new Error(isMobile
            ? "MetaMask not detected. Please open this page inside the MetaMask app browser."
            : "MetaMask not detected. Please install the MetaMask browser extension."
        );
    }

    await window.ethereum.request({ method: "eth_requestAccounts" });

    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== TARGET_CHAIN_ID) {
        try {
            await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: TARGET_CHAIN_ID }] });
        } catch (switchErr) {
            if (switchErr.code === 4902) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{ chainId: TARGET_CHAIN_ID, chainName: "Sepolia Testnet", nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://rpc.sepolia.org"], blockExplorerUrls: ["https://sepolia.etherscan.io"] }],
                });
            } else {
                throw new Error(`Please switch MetaMask to ${TARGET_CHAIN_NAME} network manually.`);
            }
        }
    }

    const provider = new BrowserProvider(window.ethereum);
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

// ── Contract Instance ────────────────────────────────────────────────

function getContract(signer) {
    if (!CONTRACT_ADDRESS) throw new Error("Contract address not configured. Run deploy script first.");
    return new Contract(CONTRACT_ADDRESS, ABI, signer);
}

// ── Admin ────────────────────────────────────────────────────────────

export async function getContractOwner(signer) {
    const contract = getContract(signer);
    return contract.owner();
}

export async function getPendingDoctorRequests(signer) {
    const contract = getContract(signer);
    const reqs = await contract.getPendingDoctorRequests();
    return reqs.map(r => ({
        addr: r.addr,
        name: r.name,
        licenseNumber: r.licenseNumber,
        specialization: r.specialization,
        hospital: r.hospital,
        ktpNumber: r.ktpNumber,
        phoneNumber: r.phoneNumber,
        photoCid: r.photoCid,
        requestedAt: Number(r.requestedAt),
    }));
}

export async function getApprovedDoctors(signer) {
    const contract = getContract(signer);
    const docs = await contract.getApprovedDoctors();
    return docs.map(r => ({
        addr: r.addr,
        name: r.name,
        licenseNumber: r.licenseNumber,
        specialization: r.specialization,
        hospital: r.hospital,
        ktpNumber: r.ktpNumber,
        phoneNumber: r.phoneNumber,
        photoCid: r.photoCid,
        requestedAt: Number(r.requestedAt),
    }));
}

export async function approveDoctor(signer, doctorAddress) {
    const contract = getContract(signer);
    const tx = await contract.approveDoctor(doctorAddress);
    await tx.wait();
    return tx;
}

export async function rejectDoctor(signer, doctorAddress, reason) {
    const contract = getContract(signer);
    const tx = await contract.rejectDoctor(doctorAddress, reason || "");
    await tx.wait();
    return tx;
}

// ── Registration ─────────────────────────────────────────────────────

export async function registerAsPatient(signer, name, publicKey) {
    const contract = getContract(signer);
    const tx = await contract.registerAsPatient(name, publicKey);
    await tx.wait();
    return tx;
}

export async function requestDoctorVerification(signer, name, licenseNumber, specialization, hospital, ktpNumber, phoneNumber, photoCid, publicKey) {
    const contract = getContract(signer);
    const tx = await contract.requestDoctorVerification(name, licenseNumber, specialization, hospital, ktpNumber, phoneNumber, photoCid, publicKey);
    await tx.wait();
    return tx;
}

// ── Role & Profile Queries ───────────────────────────────────────────

export async function getRole(signer, address) {
    const contract = getContract(signer);
    const role = await contract.getRole(address);
    return Number(role);
}

export async function getPublicKey(signer, address) {
    const contract = getContract(signer);
    return contract.getPublicKey(address);
}

export async function getDoctorRequest(signer, address) {
    const contract = getContract(signer);
    const r = await contract.getDoctorRequest(address);
    return {
        isPending: r[0],
        isApproved: r[1],
        isRejected: r[2],
        rejectReason: r[3],
        name: r[4],
        licenseNumber: r[5],
        specialization: r[6],
        hospital: r[7],
        ktpNumber: r[8],
        phoneNumber: r[9],
        photoCid: r[10],
    };
}

const _nameCache = {};
export async function getDisplayName(signer, address) {
    if (!address) return "";
    const key = address.toLowerCase();
    if (_nameCache[key] !== undefined) return _nameCache[key];
    try {
        const contract = getContract(signer);
        const name = await contract.getDisplayName(address);
        _nameCache[key] = name || "";
        return _nameCache[key];
    } catch {
        _nameCache[key] = "";
        return "";
    }
}

export function clearNameCache() {
    Object.keys(_nameCache).forEach(k => delete _nameCache[k]);
}

// ── Record Submission (Doctor) ────────────────────────────────────────

export async function submitRecord(signer, patientAddress, cid, encryptedKeyForPatient, fileType, fileName) {
    const contract = getContract(signer);
    const tx = await contract.submitRecord(patientAddress, cid, encryptedKeyForPatient, fileType, fileName);
    await tx.wait();
    return tx;
}

// ── Consent Management (Patient) ─────────────────────────────────────

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

// ── Record Retrieval ─────────────────────────────────────────────────

export async function getMyRecords(signer) {
    const contract = getContract(signer);
    const records = await contract.getMyRecords();
    return records.map(r => ({
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
    return records.map(r => ({
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

// ── Doctor: Submissions via Events ───────────────────────────────────

export async function getSubmittedByDoctor(signer) {
    const contract = getContract(signer);
    const address = await signer.getAddress();

    const [submitEvents, approvedEvents, rejectedEvents] = await Promise.all([
        contract.queryFilter(contract.filters.RecordSubmitted(null, address)),
        contract.queryFilter(contract.filters.RecordApproved()),
        contract.queryFilter(contract.filters.RecordRejected()),
    ]);

    const approvedCids = new Set(approvedEvents.map(e => e.args.cid));
    const rejectedCids = new Set(rejectedEvents.map(e => e.args.cid));

    return submitEvents.map(e => ({
        patientAddress: e.args.patient,
        doctorAddress: e.args.doctor,
        cid: e.args.cid,
        timestamp: Number(e.args.timestamp),
        status: approvedCids.has(e.args.cid) ? 'APPROVED' : rejectedCids.has(e.args.cid) ? 'REJECTED' : 'PENDING',
    }));
}

// ── Access Management ────────────────────────────────────────────────

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

export async function revokeAccessForCid(signer, doctorAddress, cid) {
    const contract = getContract(signer);
    const tx = await contract.revokeAccessForCid(doctorAddress, cid);
    await tx.wait();
    return tx;
}

export async function getAuthorizedDoctors(signer) {
    const contract = getContract(signer);
    return contract.getAuthorizedDoctors();
}

export async function getAccessibleCidsForDoctor(signer, doctorAddress) {
    const contract = getContract(signer);
    return contract.getAccessibleCidsForDoctor(doctorAddress);
}

export async function getPatientList(signer) {
    const contract = getContract(signer);
    const [addrs, names] = await contract.getPatientList();
    return addrs.map((addr, i) => ({ address: addr, name: names[i] || "" }));
}

// ── Encrypted Key ────────────────────────────────────────────────────

export async function getEncryptedKey(signer, cid) {
    const contract = getContract(signer);
    return contract.getEncryptedKey(cid);
}
