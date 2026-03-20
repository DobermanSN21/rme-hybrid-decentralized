// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MedicalRecordVault
 * @author RME Hybrid-Terdesentralisasi (Skripsi Prototype)
 * @notice Smart contract untuk manajemen rekam medis elektronik
 *         dengan consent flow dan Role-Based Access Control (RBAC).
 *
 * Arsitektur Baru:
 *   1. Dokter mengenkripsi file rekam medis (gambar/PDF) dengan AES-256-GCM
 *   2. Ciphertext di-upload ke Pinata (IPFS) → menghasilkan CID
 *   3. Kunci AES dienkripsi dengan ECC Public Key pasien
 *   4. Dokter memanggil submitRecord() → status PENDING
 *   5. Pasien mereview dan memanggil approveRecord() atau rejectRecord()
 *   6. Saat grant access ke dokter lain, kunci AES dienkripsi ulang
 *      dengan ECC Public Key dokter tersebut
 */
contract MedicalRecordVault {

    // ================================================================
    //                          ENUMS & STRUCTS
    // ================================================================

    /// @notice Peran pengguna dalam sistem
    enum Role {
        NONE,       // Belum terdaftar
        PATIENT,    // Pasien — pemilik data, approver
        DOCTOR      // Dokter — uploader, viewer (dengan izin)
    }

    /// @notice Status rekam medis dalam consent flow
    enum RecordStatus {
        PENDING,    // Menunggu persetujuan pasien
        APPROVED,   // Disetujui pasien
        REJECTED    // Ditolak pasien
    }

    /// @notice Struktur satu entri rekam medis
    struct Record {
        string cid;             // IPFS Content Identifier
        address patientAddress; // Alamat pasien pemilik rekam medis
        address doctorAddress;  // Alamat dokter yang mengupload
        string fileType;        // MIME type: "image/jpeg", "application/pdf", dll
        string fileName;        // Nama file asli
        RecordStatus status;    // PENDING → APPROVED / REJECTED
        uint256 timestamp;      // Waktu submission (block.timestamp)
    }

    // ================================================================
    //                          STATE VARIABLES
    // ================================================================

    /// @notice Pemilik kontrak (deployer)
    address public owner;

    /// @notice Mapping alamat wallet → peran (NONE / PATIENT / DOCTOR)
    mapping(address => Role) public roles;

    /// @notice Mapping alamat wallet → ECC Public Key (hex string)
    mapping(address => string) public publicKeys;

    /// @notice Mapping pasien → array rekam medis
    mapping(address => Record[]) private patientRecords;

    /// @notice Mapping CID → (alamat penerima → encrypted AES key)
    mapping(string => mapping(address => string)) private encryptedKeys;

    /// @notice Mapping pasien → (dokter → izin akses boolean)
    mapping(address => mapping(address => bool)) public accessList;

    /// @notice Mapping pasien → daftar alamat dokter yang pernah diberi akses
    mapping(address => address[]) private authorizedDoctors;

    /// @notice Mapping pasien → daftar CID yang dimiliki (APPROVED only)
    mapping(address => string[]) private patientCids;

    // ================================================================
    //                              EVENTS
    // ================================================================

    /// @notice Dipancarkan saat user baru mendaftar
    event UserRegistered(address indexed user, Role role);

    /// @notice Dipancarkan saat dokter submit rekam medis baru (PENDING)
    event RecordSubmitted(
        address indexed patient,
        address indexed doctor,
        string cid,
        uint256 recordIndex,
        uint256 timestamp
    );

    /// @notice Dipancarkan saat pasien approve rekam medis
    event RecordApproved(
        address indexed patient,
        uint256 recordIndex,
        string cid
    );

    /// @notice Dipancarkan saat pasien reject rekam medis
    event RecordRejected(
        address indexed patient,
        uint256 recordIndex,
        string cid
    );

    /// @notice Dipancarkan saat pasien memberi akses ke dokter
    event AccessGranted(
        address indexed patient,
        address indexed doctor,
        string cid
    );

    /// @notice Dipancarkan saat pasien mencabut akses dokter
    event AccessRevoked(
        address indexed patient,
        address indexed doctor
    );

    // ================================================================
    //                            MODIFIERS
    // ================================================================

    modifier onlyUnregistered() {
        require(roles[msg.sender] == Role.NONE, "Already registered");
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
    //                      REGISTRATION FUNCTIONS
    // ================================================================

    /**
     * @notice Mendaftarkan alamat pemanggil sebagai PASIEN
     * @param _publicKey ECC Public Key (hex string)
     */
    function registerAsPatient(string calldata _publicKey) external onlyUnregistered {
        require(bytes(_publicKey).length > 0, "Public key cannot be empty");

        roles[msg.sender] = Role.PATIENT;
        publicKeys[msg.sender] = _publicKey;

        emit UserRegistered(msg.sender, Role.PATIENT);
    }

    /**
     * @notice Mendaftarkan alamat pemanggil sebagai DOKTER
     * @param _publicKey ECC Public Key (hex string)
     */
    function registerAsDoctor(string calldata _publicKey) external onlyUnregistered {
        require(bytes(_publicKey).length > 0, "Public key cannot be empty");

        roles[msg.sender] = Role.DOCTOR;
        publicKeys[msg.sender] = _publicKey;

        emit UserRegistered(msg.sender, Role.DOCTOR);
    }

    // ================================================================
    //                    RECORD SUBMISSION (Dokter)
    // ================================================================

    /**
     * @notice Dokter submit rekam medis baru untuk pasien (status PENDING)
     * @param _patient Alamat wallet pasien
     * @param _cid IPFS CID dari file terenkripsi
     * @param _encryptedKeyForPatient Kunci AES dienkripsi dengan ECC pubkey pasien
     * @param _fileType MIME type file ("image/jpeg", "application/pdf")
     * @param _fileName Nama file asli
     */
    function submitRecord(
        address _patient,
        string calldata _cid,
        string calldata _encryptedKeyForPatient,
        string calldata _fileType,
        string calldata _fileName
    ) external onlyDoctor {
        require(roles[_patient] == Role.PATIENT, "Target address is not a registered patient");
        require(bytes(_cid).length > 0, "CID cannot be empty");
        require(bytes(_encryptedKeyForPatient).length > 0, "Encrypted key cannot be empty");
        require(bytes(_fileType).length > 0, "File type cannot be empty");
        require(bytes(_fileName).length > 0, "File name cannot be empty");

        uint256 recordIndex = patientRecords[_patient].length;

        // Simpan record dengan status PENDING
        patientRecords[_patient].push(Record({
            cid: _cid,
            patientAddress: _patient,
            doctorAddress: msg.sender,
            fileType: _fileType,
            fileName: _fileName,
            status: RecordStatus.PENDING,
            timestamp: block.timestamp
        }));

        // Simpan encrypted AES key untuk pasien
        encryptedKeys[_cid][_patient] = _encryptedKeyForPatient;

        emit RecordSubmitted(_patient, msg.sender, _cid, recordIndex, block.timestamp);
    }

    // ================================================================
    //                    CONSENT MANAGEMENT (Pasien)
    // ================================================================

    /**
     * @notice Pasien menyetujui rekam medis PENDING
     * @param _recordIndex Index rekam medis dalam array patientRecords
     */
    function approveRecord(uint256 _recordIndex) external onlyPatient {
        require(_recordIndex < patientRecords[msg.sender].length, "Record index out of bounds");
        Record storage record = patientRecords[msg.sender][_recordIndex];
        require(record.status == RecordStatus.PENDING, "Record is not pending");

        record.status = RecordStatus.APPROVED;

        // Tambahkan CID ke daftar CID pasien
        patientCids[msg.sender].push(record.cid);

        // Auto-grant access ke dokter yang submit
        if (!accessList[msg.sender][record.doctorAddress]) {
            accessList[msg.sender][record.doctorAddress] = true;
            authorizedDoctors[msg.sender].push(record.doctorAddress);
        }

        // Simpan encrypted key untuk dokter juga (re-encrypted by frontend)
        // Dokter yang submit sudah memiliki AES key, tapi perlu disimpan di mapping
        // Frontend akan memanggil grantAccessForRecord setelah approve

        emit RecordApproved(msg.sender, _recordIndex, record.cid);
    }

    /**
     * @notice Pasien menolak rekam medis PENDING
     * @param _recordIndex Index rekam medis dalam array patientRecords
     */
    function rejectRecord(uint256 _recordIndex) external onlyPatient {
        require(_recordIndex < patientRecords[msg.sender].length, "Record index out of bounds");
        Record storage record = patientRecords[msg.sender][_recordIndex];
        require(record.status == RecordStatus.PENDING, "Record is not pending");

        record.status = RecordStatus.REJECTED;

        emit RecordRejected(msg.sender, _recordIndex, record.cid);
    }

    // ================================================================
    //                      ACCESS MANAGEMENT
    // ================================================================

    /**
     * @notice Memberikan akses ke dokter untuk CID tertentu
     * @param _doctor Alamat wallet dokter
     * @param _cid IPFS CID yang diberi akses
     * @param _encryptedKeyForDoctor Kunci AES dienkripsi dengan ECC pubkey dokter
     */
    function grantAccess(
        address _doctor,
        string calldata _cid,
        string calldata _encryptedKeyForDoctor
    ) external onlyPatient {
        require(roles[_doctor] == Role.DOCTOR, "Target address is not a registered doctor");
        require(bytes(_cid).length > 0, "CID cannot be empty");
        require(bytes(_encryptedKeyForDoctor).length > 0, "Encrypted key cannot be empty");

        // Verifikasi bahwa CID ini milik pasien
        require(
            bytes(encryptedKeys[_cid][msg.sender]).length > 0,
            "You do not own a record with this CID"
        );

        // Grant akses boolean
        if (!accessList[msg.sender][_doctor]) {
            accessList[msg.sender][_doctor] = true;
            authorizedDoctors[msg.sender].push(_doctor);
        }

        // Simpan encrypted key untuk dokter
        encryptedKeys[_cid][_doctor] = _encryptedKeyForDoctor;

        emit AccessGranted(msg.sender, _doctor, _cid);
    }

    /**
     * @notice Mencabut akses dokter dari semua rekam medis pasien
     * @param _doctor Alamat wallet dokter yang dicabut aksesnya
     */
    function revokeAccess(address _doctor) external onlyPatient {
        require(accessList[msg.sender][_doctor], "Doctor does not have access");

        accessList[msg.sender][_doctor] = false;

        emit AccessRevoked(msg.sender, _doctor);
    }

    // ================================================================
    //                        VIEW FUNCTIONS
    // ================================================================

    /**
     * @notice Mengambil semua rekam medis APPROVED milik pasien
     * @return Array of Record yang sudah APPROVED
     */
    function getMyRecords() external view onlyPatient returns (Record[] memory) {
        Record[] storage allRecords = patientRecords[msg.sender];

        // Hitung jumlah approved
        uint256 approvedCount = 0;
        for (uint256 i = 0; i < allRecords.length; i++) {
            if (allRecords[i].status == RecordStatus.APPROVED) {
                approvedCount++;
            }
        }

        // Buat array approved saja
        Record[] memory approved = new Record[](approvedCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRecords.length; i++) {
            if (allRecords[i].status == RecordStatus.APPROVED) {
                approved[index] = allRecords[i];
                index++;
            }
        }

        return approved;
    }

    /**
     * @notice Mengambil rekam medis PENDING milik pasien
     * @return Array of Record yang masih PENDING + index asli
     */
    function getPendingRecords() external view onlyPatient returns (Record[] memory, uint256[] memory) {
        Record[] storage allRecords = patientRecords[msg.sender];

        // Hitung jumlah pending
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < allRecords.length; i++) {
            if (allRecords[i].status == RecordStatus.PENDING) {
                pendingCount++;
            }
        }

        // Buat array pending saja + indices
        Record[] memory pending = new Record[](pendingCount);
        uint256[] memory indices = new uint256[](pendingCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRecords.length; i++) {
            if (allRecords[i].status == RecordStatus.PENDING) {
                pending[index] = allRecords[i];
                indices[index] = i;
                index++;
            }
        }

        return (pending, indices);
    }

    /**
     * @notice Mengambil rekam medis pasien (untuk dokter yang memiliki izin)
     * @param _patient Alamat wallet pasien
     * @return Array of Record APPROVED milik pasien
     */
    function getPatientRecords(
        address _patient
    ) external view onlyDoctor returns (Record[] memory) {
        require(
            accessList[_patient][msg.sender],
            "You do not have access to this patient's records"
        );

        Record[] storage allRecords = patientRecords[_patient];

        uint256 approvedCount = 0;
        for (uint256 i = 0; i < allRecords.length; i++) {
            if (allRecords[i].status == RecordStatus.APPROVED) {
                approvedCount++;
            }
        }

        Record[] memory approved = new Record[](approvedCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRecords.length; i++) {
            if (allRecords[i].status == RecordStatus.APPROVED) {
                approved[index] = allRecords[i];
                index++;
            }
        }

        return approved;
    }

    /**
     * @notice Mengambil encrypted AES key untuk CID tertentu
     * @param _cid IPFS Content Identifier
     * @return Encrypted AES key milik pemanggil
     */
    function getEncryptedKey(
        string calldata _cid
    ) external view returns (string memory) {
        string memory key = encryptedKeys[_cid][msg.sender];
        require(bytes(key).length > 0, "No encrypted key found for this CID");
        return key;
    }

    /**
     * @notice Mengambil ECC Public Key dari alamat tertentu
     * @param _account Alamat wallet
     * @return ECC Public Key (hex string)
     */
    function getPublicKey(
        address _account
    ) external view returns (string memory) {
        string memory key = publicKeys[_account];
        require(bytes(key).length > 0, "No public key registered for this address");
        return key;
    }

    /**
     * @notice Mengambil peran dari alamat tertentu
     * @param _account Alamat wallet
     * @return Role enum (NONE=0, PATIENT=1, DOCTOR=2)
     */
    function getRole(address _account) external view returns (Role) {
        return roles[_account];
    }

    /**
     * @notice Mengambil daftar dokter yang memiliki akses aktif
     * @return Array of alamat dokter aktif
     */
    function getAuthorizedDoctors() external view onlyPatient returns (address[] memory) {
        address[] memory doctors = authorizedDoctors[msg.sender];

        uint256 activeCount = 0;
        for (uint256 i = 0; i < doctors.length; i++) {
            if (accessList[msg.sender][doctors[i]]) {
                activeCount++;
            }
        }

        address[] memory activeDoctors = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < doctors.length; i++) {
            if (accessList[msg.sender][doctors[i]]) {
                activeDoctors[index] = doctors[i];
                index++;
            }
        }

        return activeDoctors;
    }

    /**
     * @notice Mengambil jumlah total rekam medis pasien (semua status)
     * @return Jumlah total rekam medis
     */
    function getRecordCount() external view onlyPatient returns (uint256) {
        return patientRecords[msg.sender].length;
    }

    /**
     * @notice Mengambil daftar CID APPROVED yang dimiliki pasien
     * @return Array of CID strings
     */
    function getMyCids() external view onlyPatient returns (string[] memory) {
        return patientCids[msg.sender];
    }

    /**
     * @notice Mengambil jumlah rekam medis PENDING
     * @return Jumlah pending records
     */
    function getPendingCount() external view onlyPatient returns (uint256) {
        Record[] storage allRecords = patientRecords[msg.sender];
        uint256 count = 0;
        for (uint256 i = 0; i < allRecords.length; i++) {
            if (allRecords[i].status == RecordStatus.PENDING) {
                count++;
            }
        }
        return count;
    }
}
