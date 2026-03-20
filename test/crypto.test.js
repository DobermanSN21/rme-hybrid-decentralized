// test/crypto.test.js
// ============================================================
// Unit Test untuk Crypto Library (Langkah 2)
// ============================================================

const { expect } = require("chai");
const {
    // Key Management
    generateKeyPair,
    privateKeyToPublicKey,
    serializePublicKey,
    deserializePublicKey,
    isValidPublicKey,
    isValidPrivateKey,
    // AES-256-GCM
    generateAESKey,
    encryptData,
    decryptData,
    serializeAESKey,
    deserializeAESKey,
    // ECIES
    encryptWithPublicKey,
    decryptWithPrivateKey,
    serializeEncrypted,
    deserializeEncrypted,
    // IPFS Helper
    simulateUpload,
    simulateDownload,
    clearStore,
    ipfsExists,
} = require("../src/crypto");

describe("Crypto Library", function () {

    // ============================================================
    // 1. KEY MANAGEMENT TESTS
    // ============================================================
    describe("Key Management (ECC secp256k1)", function () {
        it("should generate a valid key pair", function () {
            const { privateKey, publicKey } = generateKeyPair();

            // Private key: 32 bytes = 64 hex chars
            expect(privateKey).to.be.a("string");
            expect(privateKey).to.have.lengthOf(64);

            // Public key: uncompressed = 65 bytes = 130 hex chars, starts with 04
            expect(publicKey).to.be.a("string");
            expect(publicKey).to.have.lengthOf(130);
            expect(publicKey.startsWith("04")).to.be.true;

            // Validate
            expect(isValidPrivateKey(privateKey)).to.be.true;
            expect(isValidPublicKey(publicKey)).to.be.true;
        });

        it("should serialize and deserialize public key (roundtrip)", function () {
            const { publicKey } = generateKeyPair();
            const bytes = deserializePublicKey(publicKey);
            const restored = serializePublicKey(bytes);

            expect(restored).to.equal(publicKey);
        });

        it("should generate different keys each time", function () {
            const kp1 = generateKeyPair();
            const kp2 = generateKeyPair();

            expect(kp1.privateKey).to.not.equal(kp2.privateKey);
            expect(kp1.publicKey).to.not.equal(kp2.publicKey);
        });

        it("should derive consistent public key from same private key", function () {
            const { privateKey, publicKey } = generateKeyPair();
            const derived = privateKeyToPublicKey(privateKey);

            expect(derived).to.equal(publicKey);
        });
    });

    // ============================================================
    // 2. AES-256-GCM TESTS
    // ============================================================
    describe("AES-256-GCM Encryption", function () {
        it("should encrypt and decrypt short text", function () {
            const key = generateAESKey();
            const plaintext = "Hello, RME!";

            const encrypted = encryptData(plaintext, key);
            expect(encrypted).to.have.property("iv");
            expect(encrypted).to.have.property("ciphertext");
            expect(encrypted).to.have.property("tag");

            const decrypted = decryptData(encrypted, key);
            expect(decrypted).to.equal(plaintext);
        });

        it("should encrypt and decrypt large JSON medical record", function () {
            const key = generateAESKey();
            const medicalRecord = JSON.stringify({
                patientName: "Budi Santoso",
                dateOfBirth: "1990-05-15",
                bloodType: "O+",
                diagnosis: "Hipertensi Grade 1",
                medications: [
                    { name: "Amlodipine", dose: "5mg", frequency: "1x sehari" },
                    { name: "Lisinopril", dose: "10mg", frequency: "1x sehari" },
                ],
                labResults: {
                    bloodPressure: "140/90 mmHg",
                    heartRate: "78 bpm",
                    cholesterol: { total: 220, hdl: 45, ldl: 150 },
                },
                notes: "Pasien disarankan diet rendah garam dan olahraga teratur.",
            });

            const encrypted = encryptData(medicalRecord, key);
            const decrypted = decryptData(encrypted, key);

            expect(decrypted).to.equal(medicalRecord);
            expect(JSON.parse(decrypted)).to.deep.equal(JSON.parse(medicalRecord));
        });

        it("should fail to decrypt with wrong key", function () {
            const key1 = generateAESKey();
            const key2 = generateAESKey();
            const plaintext = "Secret medical data";

            const encrypted = encryptData(plaintext, key1);

            expect(() => decryptData(encrypted, key2)).to.throw();
        });

        it("should produce different ciphertext for same plaintext (random IV)", function () {
            const key = generateAESKey();
            const plaintext = "Same data every time";

            const enc1 = encryptData(plaintext, key);
            const enc2 = encryptData(plaintext, key);

            // Different IV → different ciphertext
            expect(enc1.iv).to.not.equal(enc2.iv);
            expect(enc1.ciphertext).to.not.equal(enc2.ciphertext);

            // But both decrypt to same plaintext
            expect(decryptData(enc1, key)).to.equal(plaintext);
            expect(decryptData(enc2, key)).to.equal(plaintext);
        });

        it("should serialize and deserialize AES key (roundtrip)", function () {
            const key = generateAESKey();
            const hex = serializeAESKey(key);
            const restored = deserializeAESKey(hex);

            expect(Buffer.compare(key, restored)).to.equal(0);
            expect(hex).to.have.lengthOf(64); // 32 bytes = 64 hex chars
        });
    });

    // ============================================================
    // 3. ECIES TESTS
    // ============================================================
    describe("ECIES (ECC Encryption)", function () {
        it("should encrypt AES key and decrypt with correct private key", function () {
            const recipient = generateKeyPair();
            const aesKey = generateAESKey();
            const aesKeyHex = serializeAESKey(aesKey);

            // Encrypt AES key with recipient's public key
            const encrypted = encryptWithPublicKey(recipient.publicKey, aesKeyHex);

            expect(encrypted).to.have.property("ephemeralPublicKey");
            expect(encrypted).to.have.property("iv");
            expect(encrypted).to.have.property("ciphertext");
            expect(encrypted).to.have.property("tag");

            // Decrypt with recipient's private key
            const decrypted = decryptWithPrivateKey(recipient.privateKey, encrypted);
            expect(decrypted).to.equal(aesKeyHex);
        });

        it("should fail to decrypt with wrong private key", function () {
            const recipient = generateKeyPair();
            const wrongKey = generateKeyPair();
            const plaintext = "secret-aes-key-hex";

            const encrypted = encryptWithPublicKey(recipient.publicKey, plaintext);

            expect(() =>
                decryptWithPrivateKey(wrongKey.privateKey, encrypted)
            ).to.throw();
        });

        it("should encrypt and decrypt arbitrary string data", function () {
            const recipient = generateKeyPair();
            const message = "Kunci AES untuk rekam medis pasien Budi";

            const encrypted = encryptWithPublicKey(recipient.publicKey, message);
            const decrypted = decryptWithPrivateKey(recipient.privateKey, encrypted);

            expect(decrypted).to.equal(message);
        });

        it("should produce different ciphertext each time (ephemeral key)", function () {
            const recipient = generateKeyPair();
            const plaintext = "same-aes-key";

            const enc1 = encryptWithPublicKey(recipient.publicKey, plaintext);
            const enc2 = encryptWithPublicKey(recipient.publicKey, plaintext);

            // Different ephemeral keys
            expect(enc1.ephemeralPublicKey).to.not.equal(enc2.ephemeralPublicKey);

            // Both decrypt to same value
            expect(decryptWithPrivateKey(recipient.privateKey, enc1)).to.equal(plaintext);
            expect(decryptWithPrivateKey(recipient.privateKey, enc2)).to.equal(plaintext);
        });

        it("should serialize and deserialize encrypted data (roundtrip)", function () {
            const recipient = generateKeyPair();
            const plaintext = "test-key-data";

            const encrypted = encryptWithPublicKey(recipient.publicKey, plaintext);
            const serialized = serializeEncrypted(encrypted);
            const deserialized = deserializeEncrypted(serialized);

            // Deserialized should match original
            expect(deserialized.ephemeralPublicKey).to.equal(encrypted.ephemeralPublicKey);
            expect(deserialized.iv).to.equal(encrypted.iv);
            expect(deserialized.ciphertext).to.equal(encrypted.ciphertext);
            expect(deserialized.tag).to.equal(encrypted.tag);

            // Should still be decryptable
            const decrypted = decryptWithPrivateKey(recipient.privateKey, deserialized);
            expect(decrypted).to.equal(plaintext);
        });
    });

    // ============================================================
    // 4. END-TO-END FLOW TESTS
    // ============================================================
    describe("End-to-End Cryptographic Flow", function () {
        it("should complete full patient flow: key gen → encrypt → upload → store key", function () {
            // 1. Pasien generate key pair
            const patient = generateKeyPair();

            // 2. Pasien buat data rekam medis
            const medicalData = JSON.stringify({
                type: "lab_result",
                date: "2025-03-06",
                results: { hemoglobin: 14.5, wbc: 7200 },
            });

            // 3. Generate AES key & encrypt data
            const aesKey = generateAESKey();
            const encryptedData = encryptData(medicalData, aesKey);

            // 4. Upload encrypted data ke IPFS
            const dataForUpload = JSON.stringify(encryptedData);
            const cid = simulateUpload(dataForUpload);
            expect(cid).to.be.a("string");
            expect(cid.startsWith("Qm")).to.be.true;

            // 5. Encrypt AES key dengan public key pasien (untuk diri sendiri)
            const aesKeyHex = serializeAESKey(aesKey);
            const encryptedAesKey = encryptWithPublicKey(patient.publicKey, aesKeyHex);
            const serializedKey = serializeEncrypted(encryptedAesKey);

            // ---- Simulasi: simpan ke blockchain ----
            // vault.addRecord(cid, serializedKey)

            // 6. Verifikasi: pasien bisa decrypt AES key → decrypt data
            const deserializedKey = deserializeEncrypted(serializedKey);
            const recoveredAesKeyHex = decryptWithPrivateKey(patient.privateKey, deserializedKey);
            const recoveredAesKey = deserializeAESKey(recoveredAesKeyHex);

            // 7. Download & decrypt data
            const downloadedData = simulateDownload(cid);
            const encObj = JSON.parse(downloadedData);
            const decryptedData = decryptData(encObj, recoveredAesKey);

            expect(decryptedData).to.equal(medicalData);
        });

        it("should complete grant access flow: patient → doctor", function () {
            // Setup: patient & doctor key pairs
            const patient = generateKeyPair();
            const doctor = generateKeyPair();

            // Patient encrypts medical data
            const medicalData = JSON.stringify({ diagnosis: "Diabetes Tipe 2" });
            const aesKey = generateAESKey();
            const encryptedData = encryptData(medicalData, aesKey);
            const cid = simulateUpload(JSON.stringify(encryptedData));

            // Patient encrypts AES key for self
            const aesKeyHex = serializeAESKey(aesKey);
            const encKeyForPatient = encryptWithPublicKey(patient.publicKey, aesKeyHex);
            const serializedForPatient = serializeEncrypted(encKeyForPatient);

            // ---- GRANT ACCESS FLOW ----
            // 1. Patient decrypts own AES key
            const ownEncKey = deserializeEncrypted(serializedForPatient);
            const recoveredAesKeyHex = decryptWithPrivateKey(patient.privateKey, ownEncKey);

            // 2. Patient re-encrypts AES key with doctor's public key
            const encKeyForDoctor = encryptWithPublicKey(doctor.publicKey, recoveredAesKeyHex);
            const serializedForDoctor = serializeEncrypted(encKeyForDoctor);

            // ---- Simulasi: vault.grantAccess(doctor, cid, serializedForDoctor) ----

            // 3. Doctor decrypts AES key using own private key
            const doctorEncKey = deserializeEncrypted(serializedForDoctor);
            const doctorAesKeyHex = decryptWithPrivateKey(doctor.privateKey, doctorEncKey);
            const doctorAesKey = deserializeAESKey(doctorAesKeyHex);

            // 4. Doctor downloads & decrypts medical data
            const downloadedData = simulateDownload(cid);
            const encObj = JSON.parse(downloadedData);
            const decryptedData = decryptData(encObj, doctorAesKey);

            expect(decryptedData).to.equal(medicalData);
            expect(JSON.parse(decryptedData)).to.deep.equal({ diagnosis: "Diabetes Tipe 2" });
        });

        it("should prevent access with wrong doctor private key", function () {
            const patient = generateKeyPair();
            const doctor = generateKeyPair();
            const wrongDoctor = generateKeyPair();

            // Patient encrypts data & AES key
            const aesKey = generateAESKey();
            const aesKeyHex = serializeAESKey(aesKey);

            // Re-encrypt for correct doctor
            const encKeyForDoctor = encryptWithPublicKey(doctor.publicKey, aesKeyHex);

            // Wrong doctor tries to decrypt → should fail
            expect(() =>
                decryptWithPrivateKey(wrongDoctor.privateKey, encKeyForDoctor)
            ).to.throw();
        });
    });

    // ============================================================
    // 5. IPFS HELPER TESTS
    // ============================================================
    describe("IPFS Helper (Simulation)", function () {
        beforeEach(function () {
            clearStore();
        });

        it("should upload and download data correctly", function () {
            const data = JSON.stringify({ test: "medical record data" });
            const cid = simulateUpload(data);

            expect(cid).to.be.a("string");
            expect(cid.startsWith("Qm")).to.be.true;
            expect(ipfsExists(cid)).to.be.true;

            const downloaded = simulateDownload(cid);
            expect(downloaded).to.equal(data);
        });

        it("should throw error for unknown CID", function () {
            expect(() => simulateDownload("QmUnknownCID123")).to.throw("CID not found");
        });
    });
});
