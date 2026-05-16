// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MedicalRecordVault
 * @author RME Hybrid-Terdesentralisasi (Skripsi Prototype)
 * @notice Smart contract untuk manajemen rekam medis elektronik
 *         dengan consent flow, Role-Based Access Control (RBAC),
 *         dan verifikasi dokter oleh admin.
 */
contract MedicalRecordVault {

    // ================================================================
    //                         ENUMS & STRUCTS
    // ================================================================

    enum Role { NONE, PATIENT, DOCTOR }
    enum RecordStatus { PENDING, APPROVED, REJECTED }

    struct Record {
        string cid;
        address patientAddress;
        address doctorAddress;
        string fileType;
        string fileName;
        RecordStatus status;
        uint256 timestamp;
    }

    struct DoctorRequest {
        string name;
        string licenseNumber;   // Nomor SIP
        string specialization;
        string hospital;
        string publicKey;       // ECC key pair generated at request time
        uint256 requestedAt;
        bool isPending;
        bool isApproved;
        bool isRejected;
        string rejectReason;
    }

    // View-only struct returned by admin queries
    struct DoctorRequestView {
        address addr;
        string name;
        string licenseNumber;
        string specialization;
        string hospital;
        uint256 requestedAt;
    }

    // ================================================================
    //                        STATE VARIABLES
    // ================================================================

    address public owner;

    mapping(address => Role) public roles;
    mapping(address => string) public publicKeys;
    mapping(address => string) public displayNames;

    mapping(address => DoctorRequest) public doctorRequests;
    address[] private pendingDoctorList;
    address[] private approvedDoctorList;

    mapping(address => Record[]) private patientRecords;
    mapping(string => mapping(address => string)) private encryptedKeys;
    mapping(address => mapping(address => bool)) public accessList;
    mapping(address => address[]) private authorizedDoctors;
    mapping(address => string[]) private patientCids;

    // ================================================================
    //                             EVENTS
    // ================================================================

    event UserRegistered(address indexed user, Role role);
    event DoctorRequestSubmitted(address indexed doctor, string name, string licenseNumber);
    event DoctorApproved(address indexed doctor, string name);
    event DoctorRejected(address indexed doctor, string reason);
    event RecordSubmitted(address indexed patient, address indexed doctor, string cid, uint256 recordIndex, uint256 timestamp);
    event RecordApproved(address indexed patient, uint256 recordIndex, string cid);
    event RecordRejected(address indexed patient, uint256 recordIndex, string cid);
    event AccessGranted(address indexed patient, address indexed doctor, string cid);
    event AccessRevoked(address indexed patient, address indexed doctor);

    // ================================================================
    //                           MODIFIERS
    // ================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Not admin");
        _;
    }

    modifier onlyUnregistered() {
        require(roles[msg.sender] == Role.NONE, "Already registered");
        _;
    }

    modifier notPendingRequest() {
        require(!doctorRequests[msg.sender].isPending, "Doctor verification already pending");
        _;
    }

    modifier onlyPatient() {
        require(roles[msg.sender] == Role.PATIENT, "Only patients can perform this action");
        _;
    }

    modifier onlyDoctor() {
        require(roles[msg.sender] == Role.DOCTOR, "Only doctors can perform this action");
        _;
    }

    // ================================================================
    //                          CONSTRUCTOR
    // ================================================================

    constructor() {
        owner = msg.sender;
    }

    // ================================================================
    //                     REGISTRATION FUNCTIONS
    // ================================================================

    /**
     * @notice Mendaftarkan diri sebagai pasien
     * @param _name Nama lengkap pasien
     * @param _publicKey ECC Public Key (hex string)
     */
    function registerAsPatient(
        string calldata _name,
        string calldata _publicKey
    ) external onlyUnregistered notPendingRequest {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_publicKey).length > 0, "Public key cannot be empty");

        roles[msg.sender] = Role.PATIENT;
        publicKeys[msg.sender] = _publicKey;
        displayNames[msg.sender] = _name;

        emit UserRegistered(msg.sender, Role.PATIENT);
    }

    /**
     * @notice Dokter mengajukan permohonan verifikasi
     * @param _name Nama lengkap dokter
     * @param _licenseNumber Nomor SIP (Surat Izin Praktik)
     * @param _specialization Spesialisasi dokter
     * @param _hospital Nama rumah sakit / klinik
     * @param _publicKey ECC Public Key (hex string)
     */
    function requestDoctorVerification(
        string calldata _name,
        string calldata _licenseNumber,
        string calldata _specialization,
        string calldata _hospital,
        string calldata _publicKey
    ) external onlyUnregistered notPendingRequest {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_licenseNumber).length > 0, "License number cannot be empty");
        require(bytes(_publicKey).length > 0, "Public key cannot be empty");

        doctorRequests[msg.sender] = DoctorRequest({
            name: _name,
            licenseNumber: _licenseNumber,
            specialization: _specialization,
            hospital: _hospital,
            publicKey: _publicKey,
            requestedAt: block.timestamp,
            isPending: true,
            isApproved: false,
            isRejected: false,
            rejectReason: ""
        });

        pendingDoctorList.push(msg.sender);

        emit DoctorRequestSubmitted(msg.sender, _name, _licenseNumber);
    }

    // ================================================================
    //                     ADMIN: DOCTOR APPROVAL
    // ================================================================

    /**
     * @notice Admin menyetujui permohonan verifikasi dokter
     * @param _doctor Alamat wallet dokter
     */
    function approveDoctor(address _doctor) external onlyOwner {
        DoctorRequest storage req = doctorRequests[_doctor];
        require(req.isPending, "No pending request for this address");

        req.isPending = false;
        req.isApproved = true;

        roles[_doctor] = Role.DOCTOR;
        publicKeys[_doctor] = req.publicKey;
        displayNames[_doctor] = req.name;

        approvedDoctorList.push(_doctor);
        _removePending(_doctor);

        emit DoctorApproved(_doctor, req.name);
        emit UserRegistered(_doctor, Role.DOCTOR);
    }

    /**
     * @notice Admin menolak permohonan verifikasi dokter
     * @param _doctor Alamat wallet dokter
     * @param _reason Alasan penolakan
     */
    function rejectDoctor(address _doctor, string calldata _reason) external onlyOwner {
        DoctorRequest storage req = doctorRequests[_doctor];
        require(req.isPending, "No pending request for this address");

        req.isPending = false;
        req.isRejected = true;
        req.rejectReason = _reason;

        _removePending(_doctor);

        emit DoctorRejected(_doctor, _reason);
    }

    function _removePending(address _doctor) internal {
        for (uint256 i = 0; i < pendingDoctorList.length; i++) {
            if (pendingDoctorList[i] == _doctor) {
                pendingDoctorList[i] = pendingDoctorList[pendingDoctorList.length - 1];
                pendingDoctorList.pop();
                break;
            }
        }
    }

    // ================================================================
    //                      RECORD SUBMISSION (Dokter)
    // ================================================================

    function submitRecord(
        address _patient,
        string calldata _cid,
        string calldata _encryptedKeyForPatient,
        string calldata _fileType,
        string calldata _fileName
    ) external onlyDoctor {
        require(roles[_patient] == Role.PATIENT, "Target is not a registered patient");
        require(bytes(_cid).length > 0, "CID cannot be empty");
        require(bytes(_encryptedKeyForPatient).length > 0, "Encrypted key cannot be empty");
        require(bytes(_fileType).length > 0, "File type cannot be empty");
        require(bytes(_fileName).length > 0, "File name cannot be empty");

        uint256 recordIndex = patientRecords[_patient].length;

        patientRecords[_patient].push(Record({
            cid: _cid,
            patientAddress: _patient,
            doctorAddress: msg.sender,
            fileType: _fileType,
            fileName: _fileName,
            status: RecordStatus.PENDING,
            timestamp: block.timestamp
        }));

        encryptedKeys[_cid][_patient] = _encryptedKeyForPatient;

        emit RecordSubmitted(_patient, msg.sender, _cid, recordIndex, block.timestamp);
    }

    // ================================================================
    //                    CONSENT MANAGEMENT (Pasien)
    // ================================================================

    function approveRecord(uint256 _recordIndex) external onlyPatient {
        require(_recordIndex < patientRecords[msg.sender].length, "Record index out of bounds");
        Record storage record = patientRecords[msg.sender][_recordIndex];
        require(record.status == RecordStatus.PENDING, "Record is not pending");

        record.status = RecordStatus.APPROVED;
        patientCids[msg.sender].push(record.cid);

        if (!accessList[msg.sender][record.doctorAddress]) {
            accessList[msg.sender][record.doctorAddress] = true;
            authorizedDoctors[msg.sender].push(record.doctorAddress);
        }

        emit RecordApproved(msg.sender, _recordIndex, record.cid);
    }

    function rejectRecord(uint256 _recordIndex) external onlyPatient {
        require(_recordIndex < patientRecords[msg.sender].length, "Record index out of bounds");
        Record storage record = patientRecords[msg.sender][_recordIndex];
        require(record.status == RecordStatus.PENDING, "Record is not pending");

        record.status = RecordStatus.REJECTED;

        emit RecordRejected(msg.sender, _recordIndex, record.cid);
    }

    // ================================================================
    //                       ACCESS MANAGEMENT
    // ================================================================

    function grantAccess(
        address _doctor,
        string calldata _cid,
        string calldata _encryptedKeyForDoctor
    ) external onlyPatient {
        require(roles[_doctor] == Role.DOCTOR, "Target is not a registered doctor");
        require(bytes(_cid).length > 0, "CID cannot be empty");
        require(bytes(encryptedKeys[_cid][msg.sender]).length > 0, "You do not own this record");

        if (!accessList[msg.sender][_doctor]) {
            accessList[msg.sender][_doctor] = true;
            authorizedDoctors[msg.sender].push(_doctor);
        }

        encryptedKeys[_cid][_doctor] = _encryptedKeyForDoctor;

        emit AccessGranted(msg.sender, _doctor, _cid);
    }

    function revokeAccess(address _doctor) external onlyPatient {
        require(accessList[msg.sender][_doctor], "Doctor does not have access");
        accessList[msg.sender][_doctor] = false;
        emit AccessRevoked(msg.sender, _doctor);
    }

    // ================================================================
    //                         VIEW FUNCTIONS
    // ================================================================

    function getMyRecords() external view onlyPatient returns (Record[] memory) {
        Record[] storage all = patientRecords[msg.sender];
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].status == RecordStatus.APPROVED) count++;
        }
        Record[] memory approved = new Record[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].status == RecordStatus.APPROVED) approved[j++] = all[i];
        }
        return approved;
    }

    function getPendingRecords() external view onlyPatient returns (Record[] memory, uint256[] memory) {
        Record[] storage all = patientRecords[msg.sender];
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].status == RecordStatus.PENDING) count++;
        }
        Record[] memory pending = new Record[](count);
        uint256[] memory indices = new uint256[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].status == RecordStatus.PENDING) {
                pending[j] = all[i];
                indices[j] = i;
                j++;
            }
        }
        return (pending, indices);
    }

    function getPatientRecords(address _patient) external view onlyDoctor returns (Record[] memory) {
        require(accessList[_patient][msg.sender], "You do not have access to this patient's records");
        Record[] storage all = patientRecords[_patient];
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].status == RecordStatus.APPROVED) count++;
        }
        Record[] memory approved = new Record[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].status == RecordStatus.APPROVED) approved[j++] = all[i];
        }
        return approved;
    }

    function getEncryptedKey(string calldata _cid) external view returns (string memory) {
        string memory key = encryptedKeys[_cid][msg.sender];
        require(bytes(key).length > 0, "No encrypted key found for this CID");
        return key;
    }

    function getPublicKey(address _account) external view returns (string memory) {
        string memory key = publicKeys[_account];
        require(bytes(key).length > 0, "No public key registered for this address");
        return key;
    }

    function getRole(address _account) external view returns (Role) {
        return roles[_account];
    }

    function getAuthorizedDoctors() external view onlyPatient returns (address[] memory) {
        address[] memory all = authorizedDoctors[msg.sender];
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (accessList[msg.sender][all[i]]) count++;
        }
        address[] memory active = new address[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (accessList[msg.sender][all[i]]) active[j++] = all[i];
        }
        return active;
    }

    function getRecordCount() external view onlyPatient returns (uint256) {
        return patientRecords[msg.sender].length;
    }

    function getMyCids() external view onlyPatient returns (string[] memory) {
        return patientCids[msg.sender];
    }

    function getPendingCount() external view onlyPatient returns (uint256) {
        Record[] storage all = patientRecords[msg.sender];
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].status == RecordStatus.PENDING) count++;
        }
        return count;
    }

    /**
     * @notice Mengambil nama tampilan dari alamat manapun
     */
    function getDisplayName(address _account) external view returns (string memory) {
        return displayNames[_account];
    }

    /**
     * @notice Mengambil status permohonan verifikasi dokter
     */
    function getDoctorRequest(address _addr) external view returns (
        bool isPending,
        bool isApproved,
        bool isRejected,
        string memory rejectReason,
        string memory name,
        string memory licenseNumber,
        string memory specialization,
        string memory hospital
    ) {
        DoctorRequest storage req = doctorRequests[_addr];
        return (
            req.isPending, req.isApproved, req.isRejected, req.rejectReason,
            req.name, req.licenseNumber, req.specialization, req.hospital
        );
    }

    // ── Admin Views ─────────────────────────────────────────────────

    /**
     * @notice Daftar permohonan dokter yang menunggu persetujuan (admin only)
     */
    function getPendingDoctorRequests() external view onlyOwner returns (DoctorRequestView[] memory) {
        DoctorRequestView[] memory result = new DoctorRequestView[](pendingDoctorList.length);
        for (uint256 i = 0; i < pendingDoctorList.length; i++) {
            address addr = pendingDoctorList[i];
            DoctorRequest storage req = doctorRequests[addr];
            result[i] = DoctorRequestView({
                addr: addr,
                name: req.name,
                licenseNumber: req.licenseNumber,
                specialization: req.specialization,
                hospital: req.hospital,
                requestedAt: req.requestedAt
            });
        }
        return result;
    }

    /**
     * @notice Daftar dokter yang sudah disetujui (admin only)
     */
    function getApprovedDoctors() external view onlyOwner returns (DoctorRequestView[] memory) {
        DoctorRequestView[] memory result = new DoctorRequestView[](approvedDoctorList.length);
        for (uint256 i = 0; i < approvedDoctorList.length; i++) {
            address addr = approvedDoctorList[i];
            DoctorRequest storage req = doctorRequests[addr];
            result[i] = DoctorRequestView({
                addr: addr,
                name: req.name,
                licenseNumber: req.licenseNumber,
                specialization: req.specialization,
                hospital: req.hospital,
                requestedAt: req.requestedAt
            });
        }
        return result;
    }
}
