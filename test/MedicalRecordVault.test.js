// test/MedicalRecordVault.test.js
// ============================================================
// Tests for MedicalRecordVault — Consent Flow Architecture
// ============================================================

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MedicalRecordVault", function () {
    let vault;
    let owner, patient, doctor, doctor2, stranger;

    const PATIENT_PUB_KEY = "04aabbccdd1122334455667788990011aabbccdd1122334455667788990011aabbccdd1122334455667788990011aabbccdd1122334455667788990011aabbccdd11";
    const DOCTOR_PUB_KEY = "04eeff00112233445566778899001122eeff00112233445566778899001122eeff00112233445566778899001122eeff00112233445566778899001122eeff001122";
    const DOCTOR2_PUB_KEY = "04112233445566778899aabbccddeeff112233445566778899aabbccddeeff112233445566778899aabbccddeeff112233445566778899aabbccddeeff112233445566";

    const SAMPLE_CID = "QmTestCID12345678901234567890123456789012";
    const SAMPLE_CID_2 = "QmTestCID22345678901234567890123456789022";
    const SAMPLE_ENC_KEY = "ephPub:iv:ciphertext:tag";
    const SAMPLE_ENC_KEY_FOR_DOCTOR = "ephPubDoc:ivDoc:cipherDoc:tagDoc";

    beforeEach(async function () {
        [owner, patient, doctor, doctor2, stranger] = await ethers.getSigners();
        const VaultFactory = await ethers.getContractFactory("MedicalRecordVault");
        vault = await VaultFactory.deploy();
        await vault.waitForDeployment();
    });

    // ================================================================
    // Registration
    // ================================================================
    describe("Registration", function () {
        it("should register a user as PATIENT", async function () {
            await vault.connect(patient).registerAsPatient(PATIENT_PUB_KEY);
            expect(await vault.getRole(patient.address)).to.equal(1);
        });

        it("should register a user as DOCTOR", async function () {
            await vault.connect(doctor).registerAsDoctor(DOCTOR_PUB_KEY);
            expect(await vault.getRole(doctor.address)).to.equal(2);
        });

        it("should emit UserRegistered event", async function () {
            await expect(vault.connect(patient).registerAsPatient(PATIENT_PUB_KEY))
                .to.emit(vault, "UserRegistered")
                .withArgs(patient.address, 1);
        });

        it("should reject duplicate registration", async function () {
            await vault.connect(patient).registerAsPatient(PATIENT_PUB_KEY);
            await expect(
                vault.connect(patient).registerAsDoctor(DOCTOR_PUB_KEY)
            ).to.be.revertedWith("Already registered");
        });

        it("should reject empty public key", async function () {
            await expect(
                vault.connect(patient).registerAsPatient("")
            ).to.be.revertedWith("Public key cannot be empty");
        });
    });

    // ================================================================
    // Record Submission (by Doctor)
    // ================================================================
    describe("Submit Record", function () {
        beforeEach(async function () {
            await vault.connect(patient).registerAsPatient(PATIENT_PUB_KEY);
            await vault.connect(doctor).registerAsDoctor(DOCTOR_PUB_KEY);
        });

        it("should allow doctor to submit a record for patient", async function () {
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
            );

            // Record should be pending
            const [pending, indices] = await vault.connect(patient).getPendingRecords();
            expect(pending.length).to.equal(1);
            expect(pending[0].cid).to.equal(SAMPLE_CID);
            expect(pending[0].doctorAddress).to.equal(doctor.address);
            expect(pending[0].fileType).to.equal("image/jpeg");
            expect(pending[0].fileName).to.equal("xray.jpg");
            expect(pending[0].status).to.equal(0); // PENDING
            expect(indices[0]).to.equal(0n);
        });

        it("should emit RecordSubmitted event", async function () {
            await expect(
                vault.connect(doctor).submitRecord(
                    patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
                )
            ).to.emit(vault, "RecordSubmitted")
                .withArgs(patient.address, doctor.address, SAMPLE_CID, 0, (v) => v > 0);
        });

        it("should store encrypted key for patient", async function () {
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
            );
            const key = await vault.connect(patient).getEncryptedKey(SAMPLE_CID);
            expect(key).to.equal(SAMPLE_ENC_KEY);
        });

        it("should reject submitRecord from non-doctor", async function () {
            await expect(
                vault.connect(patient).submitRecord(
                    patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
                )
            ).to.be.revertedWith("Only doctors can perform this action");
        });

        it("should reject submitRecord for non-patient", async function () {
            await expect(
                vault.connect(doctor).submitRecord(
                    stranger.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
                )
            ).to.be.revertedWith("Target address is not a registered patient");
        });

        it("should reject empty CID", async function () {
            await expect(
                vault.connect(doctor).submitRecord(
                    patient.address, "", SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
                )
            ).to.be.revertedWith("CID cannot be empty");
        });

        it("should reject empty file type", async function () {
            await expect(
                vault.connect(doctor).submitRecord(
                    patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "", "xray.jpg"
                )
            ).to.be.revertedWith("File type cannot be empty");
        });

        it("should allow multiple submissions", async function () {
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
            );
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID_2, SAMPLE_ENC_KEY, "application/pdf", "report.pdf"
            );

            const [pending] = await vault.connect(patient).getPendingRecords();
            expect(pending.length).to.equal(2);
        });
    });

    // ================================================================
    // Consent — Approve / Reject
    // ================================================================
    describe("Consent Flow", function () {
        beforeEach(async function () {
            await vault.connect(patient).registerAsPatient(PATIENT_PUB_KEY);
            await vault.connect(doctor).registerAsDoctor(DOCTOR_PUB_KEY);
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
            );
        });

        it("should allow patient to approve a pending record", async function () {
            await vault.connect(patient).approveRecord(0);

            const records = await vault.connect(patient).getMyRecords();
            expect(records.length).to.equal(1);
            expect(records[0].status).to.equal(1); // APPROVED

            // Pending should be empty now
            const [pending] = await vault.connect(patient).getPendingRecords();
            expect(pending.length).to.equal(0);
        });

        it("should emit RecordApproved event", async function () {
            await expect(vault.connect(patient).approveRecord(0))
                .to.emit(vault, "RecordApproved")
                .withArgs(patient.address, 0, SAMPLE_CID);
        });

        it("should auto-grant access to submitting doctor on approve", async function () {
            await vault.connect(patient).approveRecord(0);

            // Doctor should have access
            expect(await vault.accessList(patient.address, doctor.address)).to.equal(true);

            // Doctor should be in authorized doctors
            const doctors = await vault.connect(patient).getAuthorizedDoctors();
            expect(doctors).to.include(doctor.address);
        });

        it("should allow patient to reject a pending record", async function () {
            await vault.connect(patient).rejectRecord(0);

            // Approved records should be empty
            const records = await vault.connect(patient).getMyRecords();
            expect(records.length).to.equal(0);

            // Pending should also be empty
            const [pending] = await vault.connect(patient).getPendingRecords();
            expect(pending.length).to.equal(0);
        });

        it("should emit RecordRejected event", async function () {
            await expect(vault.connect(patient).rejectRecord(0))
                .to.emit(vault, "RecordRejected")
                .withArgs(patient.address, 0, SAMPLE_CID);
        });

        it("should reject approve from non-patient", async function () {
            await expect(
                vault.connect(doctor).approveRecord(0)
            ).to.be.revertedWith("Only patients can perform this action");
        });

        it("should reject approve for already approved record", async function () {
            await vault.connect(patient).approveRecord(0);
            await expect(
                vault.connect(patient).approveRecord(0)
            ).to.be.revertedWith("Record is not pending");
        });

        it("should reject approve for out-of-bounds index", async function () {
            await expect(
                vault.connect(patient).approveRecord(99)
            ).to.be.revertedWith("Record index out of bounds");
        });

        it("should handle mixed approve and reject", async function () {
            // Submit second record
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID_2, SAMPLE_ENC_KEY, "application/pdf", "report.pdf"
            );

            // Approve first, reject second
            await vault.connect(patient).approveRecord(0);
            await vault.connect(patient).rejectRecord(1);

            const records = await vault.connect(patient).getMyRecords();
            expect(records.length).to.equal(1);
            expect(records[0].cid).to.equal(SAMPLE_CID);
        });
    });

    // ================================================================
    // Access Management
    // ================================================================
    describe("Access Management", function () {
        beforeEach(async function () {
            await vault.connect(patient).registerAsPatient(PATIENT_PUB_KEY);
            await vault.connect(doctor).registerAsDoctor(DOCTOR_PUB_KEY);
            await vault.connect(doctor2).registerAsDoctor(DOCTOR2_PUB_KEY);
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
            );
            await vault.connect(patient).approveRecord(0);
        });

        it("should allow patient to grant access to another doctor", async function () {
            await vault.connect(patient).grantAccess(doctor2.address, SAMPLE_CID, SAMPLE_ENC_KEY_FOR_DOCTOR);
            expect(await vault.accessList(patient.address, doctor2.address)).to.equal(true);
        });

        it("should emit AccessGranted event", async function () {
            await expect(
                vault.connect(patient).grantAccess(doctor2.address, SAMPLE_CID, SAMPLE_ENC_KEY_FOR_DOCTOR)
            ).to.emit(vault, "AccessGranted")
                .withArgs(patient.address, doctor2.address, SAMPLE_CID);
        });

        it("should store encrypted key for doctor", async function () {
            await vault.connect(patient).grantAccess(doctor2.address, SAMPLE_CID, SAMPLE_ENC_KEY_FOR_DOCTOR);
            const key = await vault.connect(doctor2).getEncryptedKey(SAMPLE_CID);
            expect(key).to.equal(SAMPLE_ENC_KEY_FOR_DOCTOR);
        });

        it("should reject granting access to non-doctor", async function () {
            await expect(
                vault.connect(patient).grantAccess(stranger.address, SAMPLE_CID, SAMPLE_ENC_KEY_FOR_DOCTOR)
            ).to.be.revertedWith("Target address is not a registered doctor");
        });

        it("should reject granting access to CID not owned by patient", async function () {
            await expect(
                vault.connect(patient).grantAccess(doctor2.address, "QmFakeCID", SAMPLE_ENC_KEY_FOR_DOCTOR)
            ).to.be.revertedWith("You do not own a record with this CID");
        });

        it("should allow patient to revoke access", async function () {
            await vault.connect(patient).grantAccess(doctor2.address, SAMPLE_CID, SAMPLE_ENC_KEY_FOR_DOCTOR);
            await vault.connect(patient).revokeAccess(doctor2.address);
            expect(await vault.accessList(patient.address, doctor2.address)).to.equal(false);
        });

        it("should emit AccessRevoked event", async function () {
            await vault.connect(patient).grantAccess(doctor2.address, SAMPLE_CID, SAMPLE_ENC_KEY_FOR_DOCTOR);
            await expect(vault.connect(patient).revokeAccess(doctor2.address))
                .to.emit(vault, "AccessRevoked")
                .withArgs(patient.address, doctor2.address);
        });

        it("should reject revoking non-existent access", async function () {
            await expect(
                vault.connect(patient).revokeAccess(doctor2.address)
            ).to.be.revertedWith("Doctor does not have access");
        });

        it("should track authorized doctors correctly", async function () {
            await vault.connect(patient).grantAccess(doctor2.address, SAMPLE_CID, SAMPLE_ENC_KEY_FOR_DOCTOR);
            const doctors = await vault.connect(patient).getAuthorizedDoctors();
            expect(doctors.length).to.equal(2); // doctor (auto-granted) + doctor2
        });
    });

    // ================================================================
    // Record Retrieval by Doctor
    // ================================================================
    describe("Record Retrieval", function () {
        beforeEach(async function () {
            await vault.connect(patient).registerAsPatient(PATIENT_PUB_KEY);
            await vault.connect(doctor).registerAsDoctor(DOCTOR_PUB_KEY);
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
            );
            await vault.connect(patient).approveRecord(0);
        });

        it("should allow doctor with access to view patient records", async function () {
            const records = await vault.connect(doctor).getPatientRecords(patient.address);
            expect(records.length).to.equal(1);
            expect(records[0].cid).to.equal(SAMPLE_CID);
        });

        it("should reject doctor without access", async function () {
            await vault.connect(doctor2).registerAsDoctor(DOCTOR2_PUB_KEY);
            await expect(
                vault.connect(doctor2).getPatientRecords(patient.address)
            ).to.be.revertedWith("You do not have access to this patient's records");
        });

        it("should reject after access is revoked", async function () {
            await vault.connect(patient).revokeAccess(doctor.address);
            await expect(
                vault.connect(doctor).getPatientRecords(patient.address)
            ).to.be.revertedWith("You do not have access to this patient's records");
        });

        it("should return patient CIDs", async function () {
            const cids = await vault.connect(patient).getMyCids();
            expect(cids).to.include(SAMPLE_CID);
        });

        it("should only return APPROVED records to doctor", async function () {
            // Submit another record but don't approve
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID_2, SAMPLE_ENC_KEY, "application/pdf", "report.pdf"
            );

            const records = await vault.connect(doctor).getPatientRecords(patient.address);
            expect(records.length).to.equal(1); // Only the approved one
        });
    });

    // ================================================================
    // Public Key & Role
    // ================================================================
    describe("Public Key Management", function () {
        it("should return registered public key", async function () {
            await vault.connect(patient).registerAsPatient(PATIENT_PUB_KEY);
            const key = await vault.getPublicKey(patient.address);
            expect(key).to.equal(PATIENT_PUB_KEY);
        });

        it("should reject query for unregistered address", async function () {
            await expect(
                vault.getPublicKey(stranger.address)
            ).to.be.revertedWith("No public key registered for this address");
        });
    });

    describe("Role Check", function () {
        it("should return NONE for unregistered user", async function () {
            expect(await vault.getRole(stranger.address)).to.equal(0);
        });

        it("should return PATIENT for registered patient", async function () {
            await vault.connect(patient).registerAsPatient(PATIENT_PUB_KEY);
            expect(await vault.getRole(patient.address)).to.equal(1);
        });

        it("should return DOCTOR for registered doctor", async function () {
            await vault.connect(doctor).registerAsDoctor(DOCTOR_PUB_KEY);
            expect(await vault.getRole(doctor.address)).to.equal(2);
        });
    });

    // ================================================================
    // Pending Count
    // ================================================================
    describe("Pending Count", function () {
        beforeEach(async function () {
            await vault.connect(patient).registerAsPatient(PATIENT_PUB_KEY);
            await vault.connect(doctor).registerAsDoctor(DOCTOR_PUB_KEY);
        });

        it("should return 0 when no pending records", async function () {
            expect(await vault.connect(patient).getPendingCount()).to.equal(0);
        });

        it("should return correct count after submissions", async function () {
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
            );
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID_2, SAMPLE_ENC_KEY, "application/pdf", "report.pdf"
            );
            expect(await vault.connect(patient).getPendingCount()).to.equal(2);
        });

        it("should decrease after approval", async function () {
            await vault.connect(doctor).submitRecord(
                patient.address, SAMPLE_CID, SAMPLE_ENC_KEY, "image/jpeg", "xray.jpg"
            );
            await vault.connect(patient).approveRecord(0);
            expect(await vault.connect(patient).getPendingCount()).to.equal(0);
        });
    });
});
