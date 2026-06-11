// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/MedicalRecordVault.sol";

/**
 * @title MedicalRecordVaultTest
 * @notice Foundry test suite untuk smart contract MedicalRecordVault
 *         Mencakup: registrasi pasien, verifikasi dokter, rekam medis,
 *         consent flow, manajemen akses, dan kontrol otorisasi.
 */
contract MedicalRecordVaultTest is Test {

    // ── Events (redeclared agar bisa digunakan di vm.expectEmit) ─────
    event UserRegistered(address indexed user, MedicalRecordVault.Role role);
    event DoctorRequestSubmitted(address indexed doctor, string name, string licenseNumber);
    event DoctorApproved(address indexed doctor, string name);
    event DoctorRejected(address indexed doctor, string reason);
    event RecordSubmitted(address indexed patient, address indexed doctor, string cid, uint256 recordIndex, uint256 timestamp);
    event RecordApproved(address indexed patient, uint256 recordIndex, string cid);
    event RecordRejected(address indexed patient, uint256 recordIndex, string cid);
    event AccessGranted(address indexed patient, address indexed doctor, string cid);
    event AccessRevoked(address indexed patient, address indexed doctor);
    event AccessRevokedForCid(address indexed patient, address indexed doctor, string cid);

    // ================================================================
    //                        SETUP & FIXTURES
    // ================================================================

    MedicalRecordVault vault;

    address admin   = makeAddr("admin");
    address patient  = makeAddr("patient");
    address patient2 = makeAddr("patient2");
    address doctor   = makeAddr("doctor");
    address doctor2  = makeAddr("doctor2");
    address stranger = makeAddr("stranger");

    string constant PATIENT_NAME    = "Budi Santoso";
    string constant PATIENT2_NAME   = "Siti Rahayu";
    string constant DOCTOR_NAME     = "dr. Ahmad Fauzi Sp.PD";
    string constant DOCTOR2_NAME    = "dr. Dewi Kusuma Sp.A";

    string constant PATIENT_PUBKEY  = "04aabbccdd1122334455667788990011aabbccdd1122334455667788990011aabb";
    string constant PATIENT2_PUBKEY = "04bbccddee2233445566778899001122bbccddee2233445566778899001122bbcc";
    string constant DOCTOR_PUBKEY   = "04ccddeeff3344556677889900112233ccddeeff3344556677889900112233ccdd";
    string constant DOCTOR2_PUBKEY  = "04ddeeff001122334455667788990011ddeeff001122334455667788990011ddee";

    string constant LICENSE_NUMBER  = "503/1234/SIP/2024";
    string constant SPECIALIZATION  = "Penyakit Dalam";
    string constant HOSPITAL        = "RS Cipto Mangunkusumo";
    string constant KTP_NUMBER      = "3201740412990001";
    string constant PHONE_NUMBER    = "081234567890";
    string constant PHOTO_CID       = "";

    string constant CID_1           = "QmTestCIDaabbccdd1122334455667788990011aabbccdd";
    string constant CID_2           = "QmTestCIDeeff00112233445566778899001122eeff00";
    string constant ENC_KEY_PATIENT = "ephPub:iv:ciphertext:tag_patient";
    string constant ENC_KEY_DOCTOR  = "ephPub:iv:ciphertext:tag_doctor";

    function setUp() public {
        vm.prank(admin);
        vault = new MedicalRecordVault();
    }

    // ── Helpers ──────────────────────────────────────────────────────

    function _registerPatient(address addr, string memory name, string memory pubkey) internal {
        vm.prank(addr);
        vault.registerAsPatient(name, pubkey);
    }

    function _requestDoctor(address addr) internal {
        vm.prank(addr);
        vault.requestDoctorVerification(
            DOCTOR_NAME, LICENSE_NUMBER, SPECIALIZATION,
            HOSPITAL, KTP_NUMBER, PHONE_NUMBER, PHOTO_CID, DOCTOR_PUBKEY
        );
    }

    function _requestDoctor2(address addr) internal {
        vm.prank(addr);
        vault.requestDoctorVerification(
            DOCTOR2_NAME, LICENSE_NUMBER, SPECIALIZATION,
            HOSPITAL, KTP_NUMBER, PHONE_NUMBER, PHOTO_CID, DOCTOR2_PUBKEY
        );
    }

    function _approveDoctor(address addr) internal {
        vm.prank(admin);
        vault.approveDoctor(addr);
    }

    function _submitRecord(address doc, address pat, string memory cid) internal {
        vm.prank(doc);
        vault.submitRecord(pat, cid, ENC_KEY_PATIENT, "image/jpeg", "xray.jpg", "Catatan dokter");
    }

    // ================================================================
    //                      1. DEPLOYMENT
    // ================================================================

    function test_Deployment_OwnerIsAdmin() public view {
        assertEq(vault.owner(), admin);
    }

    function test_Deployment_AdminRoleIsNone() public view {
        assertEq(uint256(vault.getRole(admin)), 0);
    }

    // ================================================================
    //                   2. REGISTRASI PASIEN
    // ================================================================

    function test_Patient_RegisterSuccess() public {
        _registerPatient(patient, PATIENT_NAME, PATIENT_PUBKEY);
        assertEq(uint256(vault.getRole(patient)), 1); // PATIENT
    }

    function test_Patient_NameStored() public {
        _registerPatient(patient, PATIENT_NAME, PATIENT_PUBKEY);
        assertEq(vault.getDisplayName(patient), PATIENT_NAME);
    }

    function test_Patient_PublicKeyStored() public {
        _registerPatient(patient, PATIENT_NAME, PATIENT_PUBKEY);
        assertEq(vault.getPublicKey(patient), PATIENT_PUBKEY);
    }

    function test_Patient_EmitsUserRegistered() public {
        vm.expectEmit(true, false, false, true);
        emit UserRegistered(patient, MedicalRecordVault.Role.PATIENT);
        _registerPatient(patient, PATIENT_NAME, PATIENT_PUBKEY);
    }

    function test_Patient_RejectDuplicateRegistration() public {
        _registerPatient(patient, PATIENT_NAME, PATIENT_PUBKEY);
        vm.prank(patient);
        vm.expectRevert("Already registered");
        vault.registerAsPatient(PATIENT_NAME, PATIENT_PUBKEY);
    }

    function test_Patient_RejectEmptyName() public {
        vm.prank(patient);
        vm.expectRevert("Name cannot be empty");
        vault.registerAsPatient("", PATIENT_PUBKEY);
    }

    function test_Patient_RejectEmptyPublicKey() public {
        vm.prank(patient);
        vm.expectRevert("Public key cannot be empty");
        vault.registerAsPatient(PATIENT_NAME, "");
    }

    function test_Patient_RejectIfPendingDoctorRequest() public {
        _requestDoctor(patient);
        vm.prank(patient);
        vm.expectRevert("Doctor verification already pending");
        vault.registerAsPatient(PATIENT_NAME, PATIENT_PUBKEY);
    }

    // ================================================================
    //               3. PERMOHONAN VERIFIKASI DOKTER
    // ================================================================

    function test_DoctorRequest_SubmitSuccess() public {
        _requestDoctor(doctor);
        (bool isPending,,,,,,,,,, ) = vault.getDoctorRequest(doctor);
        assertTrue(isPending);
    }

    function test_DoctorRequest_DataStored() public {
        _requestDoctor(doctor);
        (,, , , string memory name, string memory license, string memory spec,,,,) =
            vault.getDoctorRequest(doctor);
        assertEq(name, DOCTOR_NAME);
        assertEq(license, LICENSE_NUMBER);
        assertEq(spec, SPECIALIZATION);
    }

    function test_DoctorRequest_EmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit DoctorRequestSubmitted(doctor, DOCTOR_NAME, LICENSE_NUMBER);
        _requestDoctor(doctor);
    }

    function test_DoctorRequest_RoleStillNone() public {
        _requestDoctor(doctor);
        assertEq(uint256(vault.getRole(doctor)), 0);
    }

    function test_DoctorRequest_RejectIfAlreadyRegistered() public {
        _registerPatient(doctor, PATIENT_NAME, PATIENT_PUBKEY);
        vm.prank(doctor);
        vm.expectRevert("Already registered");
        vault.requestDoctorVerification(
            DOCTOR_NAME, LICENSE_NUMBER, SPECIALIZATION,
            HOSPITAL, KTP_NUMBER, PHONE_NUMBER, PHOTO_CID, DOCTOR_PUBKEY
        );
    }

    function test_DoctorRequest_RejectIfAlreadyPending() public {
        _requestDoctor(doctor);
        vm.prank(doctor);
        vm.expectRevert("Doctor verification already pending");
        vault.requestDoctorVerification(
            DOCTOR_NAME, LICENSE_NUMBER, SPECIALIZATION,
            HOSPITAL, KTP_NUMBER, PHONE_NUMBER, PHOTO_CID, DOCTOR_PUBKEY
        );
    }

    function test_DoctorRequest_RejectEmptyName() public {
        vm.prank(doctor);
        vm.expectRevert("Name cannot be empty");
        vault.requestDoctorVerification(
            "", LICENSE_NUMBER, SPECIALIZATION,
            HOSPITAL, KTP_NUMBER, PHONE_NUMBER, PHOTO_CID, DOCTOR_PUBKEY
        );
    }

    function test_DoctorRequest_RejectEmptyLicense() public {
        vm.prank(doctor);
        vm.expectRevert("License number cannot be empty");
        vault.requestDoctorVerification(
            DOCTOR_NAME, "", SPECIALIZATION,
            HOSPITAL, KTP_NUMBER, PHONE_NUMBER, PHOTO_CID, DOCTOR_PUBKEY
        );
    }

    function test_DoctorRequest_RejectEmptyPublicKey() public {
        vm.prank(doctor);
        vm.expectRevert("Public key cannot be empty");
        vault.requestDoctorVerification(
            DOCTOR_NAME, LICENSE_NUMBER, SPECIALIZATION,
            HOSPITAL, KTP_NUMBER, PHONE_NUMBER, PHOTO_CID, ""
        );
    }

    // ================================================================
    //                  4. ADMIN: APPROVE DOKTER
    // ================================================================

    function test_ApproveDoctor_RoleBecomesDoctor() public {
        _requestDoctor(doctor);
        _approveDoctor(doctor);
        assertEq(uint256(vault.getRole(doctor)), 2); // DOCTOR
    }

    function test_ApproveDoctor_PublicKeyStored() public {
        _requestDoctor(doctor);
        _approveDoctor(doctor);
        assertEq(vault.getPublicKey(doctor), DOCTOR_PUBKEY);
    }

    function test_ApproveDoctor_NameStored() public {
        _requestDoctor(doctor);
        _approveDoctor(doctor);
        assertEq(vault.getDisplayName(doctor), DOCTOR_NAME);
    }

    function test_ApproveDoctor_StatusUpdated() public {
        _requestDoctor(doctor);
        _approveDoctor(doctor);
        (, bool isApproved,,,,,,,,, ) = vault.getDoctorRequest(doctor);
        assertTrue(isApproved);
    }

    function test_ApproveDoctor_EmitsEvents() public {
        _requestDoctor(doctor);
        vm.expectEmit(true, false, false, true);
        emit DoctorApproved(doctor, DOCTOR_NAME);
        _approveDoctor(doctor);
    }

    function test_ApproveDoctor_RejectNonAdmin() public {
        _requestDoctor(doctor);
        vm.prank(stranger);
        vm.expectRevert("Not admin");
        vault.approveDoctor(doctor);
    }

    function test_ApproveDoctor_RejectNoPendingRequest() public {
        vm.prank(admin);
        vm.expectRevert("No pending request for this address");
        vault.approveDoctor(doctor);
    }

    // ================================================================
    //                   5. ADMIN: REJECT DOKTER
    // ================================================================

    function test_RejectDoctor_StatusUpdated() public {
        _requestDoctor(doctor);
        vm.prank(admin);
        vault.rejectDoctor(doctor, "Data tidak valid");
        (,, bool isRejected, string memory reason,,,,,,,) = vault.getDoctorRequest(doctor);
        assertTrue(isRejected);
        assertEq(reason, "Data tidak valid");
    }

    function test_RejectDoctor_RoleStillNone() public {
        _requestDoctor(doctor);
        vm.prank(admin);
        vault.rejectDoctor(doctor, "Alasan penolakan");
        assertEq(uint256(vault.getRole(doctor)), 0);
    }

    function test_RejectDoctor_EmitsEvent() public {
        _requestDoctor(doctor);
        vm.expectEmit(true, false, false, true);
        emit DoctorRejected(doctor, "Alasan penolakan");
        vm.prank(admin);
        vault.rejectDoctor(doctor, "Alasan penolakan");
    }

    function test_RejectDoctor_RejectNonAdmin() public {
        _requestDoctor(doctor);
        vm.prank(stranger);
        vm.expectRevert("Not admin");
        vault.rejectDoctor(doctor, "reason");
    }

    function test_RejectDoctor_RejectNoPendingRequest() public {
        vm.prank(admin);
        vm.expectRevert("No pending request for this address");
        vault.rejectDoctor(doctor, "reason");
    }

    // ================================================================
    //                 6. SUBMIT REKAM MEDIS (DOKTER)
    // ================================================================

    modifier withPatientAndDoctor() {
        _registerPatient(patient, PATIENT_NAME, PATIENT_PUBKEY);
        _requestDoctor(doctor);
        _approveDoctor(doctor);
        _;
    }

    function test_SubmitRecord_Success() public withPatientAndDoctor {
        _submitRecord(doctor, patient, CID_1);
        vm.prank(patient);
        (MedicalRecordVault.Record[] memory pending,) = vault.getPendingRecords();
        assertEq(pending.length, 1);
        assertEq(pending[0].cid, CID_1);
        assertEq(uint256(pending[0].status), 0); // PENDING
    }

    function test_SubmitRecord_DoctorAddressStored() public withPatientAndDoctor {
        _submitRecord(doctor, patient, CID_1);
        vm.prank(patient);
        (MedicalRecordVault.Record[] memory pending,) = vault.getPendingRecords();
        assertEq(pending[0].doctorAddress, doctor);
    }

    function test_SubmitRecord_NotesStored() public withPatientAndDoctor {
        vm.prank(doctor);
        vault.submitRecord(patient, CID_1, ENC_KEY_PATIENT, "image/jpeg", "xray.jpg", "Diagnosis awal");
        vm.prank(patient);
        (MedicalRecordVault.Record[] memory pending,) = vault.getPendingRecords();
        assertEq(pending[0].notes, "Diagnosis awal");
    }

    function test_SubmitRecord_EncryptedKeyStoredForPatient() public withPatientAndDoctor {
        _submitRecord(doctor, patient, CID_1);
        vm.prank(patient);
        string memory key = vault.getEncryptedKey(CID_1);
        assertEq(key, ENC_KEY_PATIENT);
    }

    function test_SubmitRecord_EmitsEvent() public withPatientAndDoctor {
        vm.expectEmit(true, true, false, false);
        emit RecordSubmitted(patient, doctor, CID_1, 0, block.timestamp);
        _submitRecord(doctor, patient, CID_1);
    }

    function test_SubmitRecord_MultipleRecords() public withPatientAndDoctor {
        _submitRecord(doctor, patient, CID_1);
        _submitRecord(doctor, patient, CID_2);
        vm.prank(patient);
        (MedicalRecordVault.Record[] memory pending,) = vault.getPendingRecords();
        assertEq(pending.length, 2);
    }

    function test_SubmitRecord_RejectNonDoctor() public withPatientAndDoctor {
        vm.prank(patient);
        vm.expectRevert("Only doctors can perform this action");
        vault.submitRecord(patient, CID_1, ENC_KEY_PATIENT, "image/jpeg", "xray.jpg", "");
    }

    function test_SubmitRecord_RejectNonPatientTarget() public withPatientAndDoctor {
        vm.prank(doctor);
        vm.expectRevert("Target is not a registered patient");
        vault.submitRecord(stranger, CID_1, ENC_KEY_PATIENT, "image/jpeg", "xray.jpg", "");
    }

    function test_SubmitRecord_RejectEmptyCid() public withPatientAndDoctor {
        vm.prank(doctor);
        vm.expectRevert("CID cannot be empty");
        vault.submitRecord(patient, "", ENC_KEY_PATIENT, "image/jpeg", "xray.jpg", "");
    }

    function test_SubmitRecord_RejectEmptyEncKey() public withPatientAndDoctor {
        vm.prank(doctor);
        vm.expectRevert("Encrypted key cannot be empty");
        vault.submitRecord(patient, CID_1, "", "image/jpeg", "xray.jpg", "");
    }

    function test_SubmitRecord_RejectEmptyFileType() public withPatientAndDoctor {
        vm.prank(doctor);
        vm.expectRevert("File type cannot be empty");
        vault.submitRecord(patient, CID_1, ENC_KEY_PATIENT, "", "xray.jpg", "");
    }

    function test_SubmitRecord_RejectEmptyFileName() public withPatientAndDoctor {
        vm.prank(doctor);
        vm.expectRevert("File name cannot be empty");
        vault.submitRecord(patient, CID_1, ENC_KEY_PATIENT, "image/jpeg", "", "");
    }

    // ================================================================
    //                    7. CONSENT FLOW (PASIEN)
    // ================================================================

    modifier withPendingRecord() {
        _registerPatient(patient, PATIENT_NAME, PATIENT_PUBKEY);
        _requestDoctor(doctor);
        _approveDoctor(doctor);
        _submitRecord(doctor, patient, CID_1);
        _;
    }

    function test_ApproveRecord_StatusBecomesApproved() public withPendingRecord {
        vm.prank(patient);
        vault.approveRecord(0);
        vm.prank(patient);
        MedicalRecordVault.Record[] memory records = vault.getMyRecords();
        assertEq(records.length, 1);
        assertEq(uint256(records[0].status), 1); // APPROVED
    }

    function test_ApproveRecord_PendingBecomesEmpty() public withPendingRecord {
        vm.prank(patient);
        vault.approveRecord(0);
        vm.prank(patient);
        (MedicalRecordVault.Record[] memory pending,) = vault.getPendingRecords();
        assertEq(pending.length, 0);
    }

    function test_ApproveRecord_AutoGrantsAccessToDoctor() public withPendingRecord {
        vm.prank(patient);
        vault.approveRecord(0);
        assertTrue(vault.accessList(patient, doctor));
    }

    function test_ApproveRecord_DoctorInAuthorizedList() public withPendingRecord {
        vm.prank(patient);
        vault.approveRecord(0);
        vm.prank(patient);
        address[] memory authorized = vault.getAuthorizedDoctors();
        assertEq(authorized.length, 1);
        assertEq(authorized[0], doctor);
    }

    function test_ApproveRecord_EmitsEvent() public withPendingRecord {
        vm.expectEmit(true, false, false, true);
        emit RecordApproved(patient, 0, CID_1);
        vm.prank(patient);
        vault.approveRecord(0);
    }

    function test_ApproveRecord_PendingCountDecreases() public withPendingRecord {
        vm.prank(patient);
        assertEq(vault.getPendingCount(), 1);
        vm.prank(patient);
        vault.approveRecord(0);
        vm.prank(patient);
        assertEq(vault.getPendingCount(), 0);
    }

    function test_RejectRecord_StatusBecomesRejected() public withPendingRecord {
        vm.prank(patient);
        vault.rejectRecord(0);
        vm.prank(patient);
        MedicalRecordVault.Record[] memory approved = vault.getMyRecords();
        assertEq(approved.length, 0);
    }

    function test_RejectRecord_EmitsEvent() public withPendingRecord {
        vm.expectEmit(true, false, false, true);
        emit RecordRejected(patient, 0, CID_1);
        vm.prank(patient);
        vault.rejectRecord(0);
    }

    function test_ConsentFlow_RejectNonPatient() public withPendingRecord {
        vm.prank(doctor);
        vm.expectRevert("Only patients can perform this action");
        vault.approveRecord(0);
    }

    function test_ConsentFlow_RejectOutOfBoundsIndex() public withPendingRecord {
        vm.prank(patient);
        vm.expectRevert("Record index out of bounds");
        vault.approveRecord(99);
    }

    function test_ConsentFlow_RejectDoubleApprove() public withPendingRecord {
        vm.prank(patient);
        vault.approveRecord(0);
        vm.prank(patient);
        vm.expectRevert("Record is not pending");
        vault.approveRecord(0);
    }

    function test_ConsentFlow_RejectDoubleReject() public withPendingRecord {
        vm.prank(patient);
        vault.rejectRecord(0);
        vm.prank(patient);
        vm.expectRevert("Record is not pending");
        vault.rejectRecord(0);
    }

    function test_ConsentFlow_MixedApproveAndReject() public withPatientAndDoctor {
        _submitRecord(doctor, patient, CID_1);
        _submitRecord(doctor, patient, CID_2);
        vm.prank(patient);
        vault.approveRecord(0);
        vm.prank(patient);
        vault.rejectRecord(1);
        vm.prank(patient);
        MedicalRecordVault.Record[] memory approved = vault.getMyRecords();
        assertEq(approved.length, 1);
        assertEq(approved[0].cid, CID_1);
    }

    // ================================================================
    //                    8. MANAJEMEN AKSES
    // ================================================================

    modifier withApprovedRecord() {
        _registerPatient(patient, PATIENT_NAME, PATIENT_PUBKEY);
        _requestDoctor(doctor);
        _approveDoctor(doctor);
        _requestDoctor2(doctor2);
        _approveDoctor(doctor2);
        _submitRecord(doctor, patient, CID_1);
        vm.prank(patient);
        vault.approveRecord(0);
        _;
    }

    function test_GrantAccess_DoctorHasAccess() public withApprovedRecord {
        vm.prank(patient);
        vault.grantAccess(doctor2, CID_1, ENC_KEY_DOCTOR);
        assertTrue(vault.accessList(patient, doctor2));
    }

    function test_GrantAccess_EncKeyStoredForDoctor() public withApprovedRecord {
        vm.prank(patient);
        vault.grantAccess(doctor2, CID_1, ENC_KEY_DOCTOR);
        vm.prank(doctor2);
        string memory key = vault.getEncryptedKey(CID_1);
        assertEq(key, ENC_KEY_DOCTOR);
    }

    function test_GrantAccess_EmitsEvent() public withApprovedRecord {
        vm.expectEmit(true, true, false, true);
        emit AccessGranted(patient, doctor2, CID_1);
        vm.prank(patient);
        vault.grantAccess(doctor2, CID_1, ENC_KEY_DOCTOR);
    }

    function test_GrantAccess_Doctor2InAuthorizedList() public withApprovedRecord {
        vm.prank(patient);
        vault.grantAccess(doctor2, CID_1, ENC_KEY_DOCTOR);
        vm.prank(patient);
        address[] memory authorized = vault.getAuthorizedDoctors();
        assertEq(authorized.length, 2);
    }

    function test_GrantAccess_RejectNonDoctor() public withApprovedRecord {
        vm.prank(patient);
        vm.expectRevert("Target is not a registered doctor");
        vault.grantAccess(stranger, CID_1, ENC_KEY_DOCTOR);
    }

    function test_GrantAccess_RejectCidNotOwned() public withApprovedRecord {
        vm.prank(patient);
        vm.expectRevert("You do not own this record");
        vault.grantAccess(doctor2, "QmFakeCID999", ENC_KEY_DOCTOR);
    }

    function test_RevokeAccess_DoctorLosesAccess() public withApprovedRecord {
        vm.prank(patient);
        vault.grantAccess(doctor2, CID_1, ENC_KEY_DOCTOR);
        vm.prank(patient);
        vault.revokeAccess(doctor2);
        assertFalse(vault.accessList(patient, doctor2));
    }

    function test_RevokeAccess_EncKeyDeleted() public withApprovedRecord {
        vm.prank(patient);
        vault.grantAccess(doctor2, CID_1, ENC_KEY_DOCTOR);
        vm.prank(patient);
        vault.revokeAccess(doctor2);
        vm.prank(doctor2);
        vm.expectRevert("No encrypted key found for this CID");
        vault.getEncryptedKey(CID_1);
    }

    function test_RevokeAccess_EmitsEvent() public withApprovedRecord {
        vm.prank(patient);
        vault.grantAccess(doctor2, CID_1, ENC_KEY_DOCTOR);
        vm.expectEmit(true, true, false, false);
        emit AccessRevoked(patient, doctor2);
        vm.prank(patient);
        vault.revokeAccess(doctor2);
    }

    function test_RevokeAccess_RejectNoExistingAccess() public withApprovedRecord {
        vm.prank(patient);
        vm.expectRevert("Doctor does not have access");
        vault.revokeAccess(doctor2);
    }

    function test_RevokeAccessForCid_SpecificCid() public withApprovedRecord {
        _submitRecord(doctor, patient, CID_2);
        vm.prank(patient);
        vault.approveRecord(1);
        vm.prank(patient);
        vault.grantAccess(doctor2, CID_1, ENC_KEY_DOCTOR);
        vm.prank(patient);
        vault.grantAccess(doctor2, CID_2, ENC_KEY_DOCTOR);
        vm.prank(patient);
        vault.revokeAccessForCid(doctor2, CID_1);
        vm.prank(doctor2);
        vm.expectRevert("No encrypted key found for this CID");
        vault.getEncryptedKey(CID_1);
    }

    // ================================================================
    //               9. KONTROL AKSES & OTORISASI
    // ================================================================

    function test_Authorization_DoctorWithoutAccessCannotViewRecords() public withApprovedRecord {
        // doctor2 sudah disetujui di withApprovedRecord tapi belum diberi akses oleh patient
        vm.prank(doctor2);
        vm.expectRevert("You do not have access to this patient's records");
        vault.getPatientRecords(patient);
    }

    function test_Authorization_DoctorWithAccessCanViewRecords() public withApprovedRecord {
        vm.prank(doctor);
        MedicalRecordVault.Record[] memory records = vault.getPatientRecords(patient);
        assertEq(records.length, 1);
        assertEq(records[0].cid, CID_1);
    }

    function test_Authorization_DoctorLosesAccessAfterRevoke() public withApprovedRecord {
        vm.prank(patient);
        vault.revokeAccess(doctor);
        vm.prank(doctor);
        vm.expectRevert("You do not have access to this patient's records");
        vault.getPatientRecords(patient);
    }

    function test_Authorization_OnlyApprovedRecordsVisibleToDoctor() public withPatientAndDoctor {
        _submitRecord(doctor, patient, CID_1);
        vm.prank(patient);
        vault.approveRecord(0);
        _submitRecord(doctor, patient, CID_2);
        // CID_2 still pending — doctor should not see it
        vm.prank(doctor);
        MedicalRecordVault.Record[] memory records = vault.getPatientRecords(patient);
        assertEq(records.length, 1);
        assertEq(records[0].cid, CID_1);
    }

    function test_Authorization_StrangerCannotApproveRecord() public withPendingRecord {
        vm.prank(stranger);
        vm.expectRevert("Only patients can perform this action");
        vault.approveRecord(0);
    }

    function test_Authorization_PatientCannotSubmitRecord() public withPendingRecord {
        vm.prank(patient);
        vm.expectRevert("Only doctors can perform this action");
        vault.submitRecord(patient, CID_2, ENC_KEY_PATIENT, "image/jpeg", "file.jpg", "");
    }

    function test_Authorization_StrangerCannotApproveDoctorRequest() public {
        _requestDoctor(doctor);
        vm.prank(stranger);
        vm.expectRevert("Not admin");
        vault.approveDoctor(doctor);
    }

    // ================================================================
    //                   10. VIEW FUNCTIONS
    // ================================================================

    function test_GetRole_ReturnsNoneForUnregistered() public view {
        assertEq(uint256(vault.getRole(stranger)), 0);
    }

    function test_GetRole_ReturnsPatient() public {
        _registerPatient(patient, PATIENT_NAME, PATIENT_PUBKEY);
        assertEq(uint256(vault.getRole(patient)), 1);
    }

    function test_GetRole_ReturnsDoctor() public {
        _requestDoctor(doctor);
        _approveDoctor(doctor);
        assertEq(uint256(vault.getRole(doctor)), 2);
    }

    function test_GetPublicKey_RevertsForUnregistered() public {
        vm.expectRevert("No public key registered for this address");
        vault.getPublicKey(stranger);
    }

    function test_GetDisplayName_EmptyForUnregistered() public view {
        assertEq(vault.getDisplayName(stranger), "");
    }

    function test_GetMyRecords_OnlyReturnsApproved() public withPatientAndDoctor {
        _submitRecord(doctor, patient, CID_1);
        vm.prank(patient);
        vault.approveRecord(0);
        _submitRecord(doctor, patient, CID_2);
        // CID_2 is pending — getMyRecords should not include it
        vm.prank(patient);
        MedicalRecordVault.Record[] memory records = vault.getMyRecords();
        assertEq(records.length, 1);
        assertEq(records[0].cid, CID_1);
    }

    function test_GetPendingRecords_ReturnsCorrectIndices() public withPatientAndDoctor {
        _submitRecord(doctor, patient, CID_1);
        _submitRecord(doctor, patient, CID_2);
        vm.prank(patient);
        vault.approveRecord(0);
        vm.prank(patient);
        (, uint256[] memory indices) = vault.getPendingRecords();
        assertEq(indices.length, 1);
        assertEq(indices[0], 1);
    }

    function test_GetDoctorSubmittedRecords_AllStatuses() public withPatientAndDoctor {
        _submitRecord(doctor, patient, CID_1);
        vm.prank(patient);
        vault.approveRecord(0);
        _submitRecord(doctor, patient, CID_2);
        vm.prank(doctor);
        MedicalRecordVault.Record[] memory submitted = vault.getDoctorSubmittedRecords();
        assertEq(submitted.length, 2);
    }

    function test_GetPatientList_ReturnsNameCorrectly() public withPatientAndDoctor {
        _submitRecord(doctor, patient, CID_1);
        vm.prank(doctor);
        (address[] memory addrs, string[] memory names) = vault.getPatientList();
        assertEq(addrs.length, 1);
        assertEq(addrs[0], patient);
        assertEq(names[0], PATIENT_NAME);
    }

    function test_GetMyCids_AfterApproval() public withPendingRecord {
        vm.prank(patient);
        vault.approveRecord(0);
        vm.prank(patient);
        string[] memory cids = vault.getMyCids();
        assertEq(cids.length, 1);
        assertEq(cids[0], CID_1);
    }

    function test_GetPendingDoctorRequests_AdminOnly() public {
        _requestDoctor(doctor);
        vm.prank(admin);
        MedicalRecordVault.DoctorRequestView[] memory reqs = vault.getPendingDoctorRequests();
        assertEq(reqs.length, 1);
        assertEq(reqs[0].name, DOCTOR_NAME);
    }

    function test_GetPendingDoctorRequests_RejectNonAdmin() public {
        _requestDoctor(doctor);
        vm.prank(stranger);
        vm.expectRevert("Not admin");
        vault.getPendingDoctorRequests();
    }

    function test_GetApprovedDoctors_AfterApproval() public {
        _requestDoctor(doctor);
        _approveDoctor(doctor);
        vm.prank(admin);
        MedicalRecordVault.DoctorRequestView[] memory approved = vault.getApprovedDoctors();
        assertEq(approved.length, 1);
        assertEq(approved[0].name, DOCTOR_NAME);
    }
}