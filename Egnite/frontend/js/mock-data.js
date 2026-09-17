/* ==========================================================================
   MediCore — mock data store (v2)
   Field shapes mirror Egnite/database/hospital_management_database.sql.
   Data is seeded once into localStorage so edits persist across pages
   during a browser session, without needing a real backend.
   ========================================================================== */

(function (global) {
  const STORAGE_KEY = "medicore_mock_db_v2";

  const seed = {
    /* ---------------- Core directory ---------------- */
    doctors: [
      { doctor_id: 1, doctor_name: "Dr. Aarav Sharma", specialization: "Cardiology", department: "Cardiology", phone: "9876500011", status: "Active" },
      { doctor_id: 2, doctor_name: "Dr. Meera Nair", specialization: "Orthopedics", department: "Orthopedics", phone: "9876500012", status: "Active" },
      { doctor_id: 3, doctor_name: "Dr. Kabir Malhotra", specialization: "Neurology", department: "Neurology", phone: "9876500013", status: "Active" },
      { doctor_id: 4, doctor_name: "Dr. Sanya Kapoor", specialization: "Pediatrics", department: "Pediatrics", phone: "9876500014", status: "On Leave" },
      { doctor_id: 5, doctor_name: "Dr. Rohan Deshmukh", specialization: "General Surgery", department: "Surgery", phone: "9876500015", status: "Active" },
      { doctor_id: 6, doctor_name: "Dr. Ishita Verma", specialization: "Dermatology", department: "Dermatology", phone: "9876500016", status: "Active" },
    ],

    patients: [
      { patient_id: 1, first_name: "Rahul", last_name: "Joshi", age: 34, gender: "Male", blood_group: "B+", phone: "9123456701", address: "12 MG Road, Pune",
        medical_history: { diseases: [], allergies: ["Penicillin"], surgeries: [], conditions: [] } },
      { patient_id: 2, first_name: "Priya", last_name: "Iyer", age: 28, gender: "Female", blood_group: "O+", phone: "9123456702", address: "45 Anna Nagar, Chennai",
        medical_history: { diseases: [], allergies: [], surgeries: [], conditions: [] } },
      { patient_id: 3, first_name: "Vikram", last_name: "Singh", age: 52, gender: "Male", blood_group: "A-", phone: "9123456703", address: "7 Civil Lines, Delhi",
        medical_history: { diseases: [], allergies: [], surgeries: [], conditions: ["Chronic migraine"] } },
      { patient_id: 4, first_name: "Ananya", last_name: "Rao", age: 19, gender: "Female", blood_group: "AB+", phone: "9123456704", address: "88 Jubilee Hills, Hyderabad",
        medical_history: { diseases: [], allergies: ["Dust", "Pollen"], surgeries: [], conditions: ["Mild asthma"] } },
      { patient_id: 5, first_name: "Karan", last_name: "Mehta", age: 45, gender: "Male", blood_group: "B-", phone: "9123456705", address: "23 SG Highway, Ahmedabad",
        medical_history: { diseases: [], allergies: [], surgeries: ["Appendectomy — 2019"], conditions: [] } },
      { patient_id: 6, first_name: "Neha", last_name: "Kulkarni", age: 61, gender: "Female", blood_group: "O-", phone: "9123456706", address: "5 FC Road, Pune",
        medical_history: { diseases: ["Hypertension"], allergies: [], surgeries: [], conditions: [] } },
      { patient_id: 7, first_name: "Arjun", last_name: "Reddy", age: 8, gender: "Male", blood_group: "A+", phone: "9123456707", address: "19 Banjara Hills, Hyderabad",
        medical_history: { diseases: [], allergies: [], surgeries: [], conditions: ["Recurrent bronchitis"] } },
      { patient_id: 8, first_name: "Simran", last_name: "Kaur", age: 39, gender: "Female", blood_group: "B+", phone: "9123456708", address: "2 Model Town, Ludhiana",
        medical_history: { diseases: ["Type 2 Diabetes"], allergies: [], surgeries: ["Knee arthroscopy — 2026"], conditions: [] } },
    ],

    /* ---------------- Doctor workflow ---------------- */
    appointments: [
      { appointment_id: 1, patient_id: 1, doctor_id: 1, appointment_date: "2026-09-18", appointment_time: "09:30", status: "Scheduled" },
      { appointment_id: 2, patient_id: 2, doctor_id: 1, appointment_date: "2026-09-17", appointment_time: "11:00", status: "Completed" },
      { appointment_id: 3, patient_id: 3, doctor_id: 3, appointment_date: "2026-09-17", appointment_time: "14:15", status: "Completed" },
      { appointment_id: 4, patient_id: 4, doctor_id: 2, appointment_date: "2026-09-19", appointment_time: "10:00", status: "Scheduled" },
      { appointment_id: 5, patient_id: 5, doctor_id: 2, appointment_date: "2026-09-18", appointment_time: "16:30", status: "Cancelled" },
      { appointment_id: 6, patient_id: 6, doctor_id: 1, appointment_date: "2026-09-20", appointment_time: "09:00", status: "Scheduled" },
      { appointment_id: 7, patient_id: 7, doctor_id: 3, appointment_date: "2026-09-17", appointment_time: "12:30", status: "In Progress" },
      { appointment_id: 8, patient_id: 8, doctor_id: 2, appointment_date: "2026-09-21", appointment_time: "15:00", status: "Scheduled" },
      { appointment_id: 9, patient_id: 1, doctor_id: 1, appointment_date: "2026-09-17", appointment_time: "16:00", status: "Completed" },
    ],

    // Consultation is the single source of truth for symptoms/vitals/diagnosis/
    // notes/prescription captured during a visit (mirrors `consultation` table,
    // with vitals + prescription line items embedded for a simpler mock shape).
    consultations: [
      {
        consultation_id: 1, appointment_id: 2, patient_id: 2, doctor_id: 1,
        consultation_date: "2026-09-17 11:10", symptoms: "Fever, body ache, sore throat for 2 days",
        vitals: { temperature: 100.8, blood_pressure: "118/76", heart_rate: 88, respiratory_rate: 18, weight: 58, height: 162 },
        diagnosis: "Seasonal influenza", doctor_notes: "Advised rest and fluids. Review in 5 days if fever persists.",
        prescription_items: [{ medicine_id: 1, dosage: "500mg", frequency: "TDS", duration: "5 days" }],
        lab_test_required: false, follow_up_required: false, status: "Completed",
      },
      {
        consultation_id: 2, appointment_id: 3, patient_id: 3, doctor_id: 3,
        consultation_date: "2026-09-17 14:25", symptoms: "Recurrent throbbing headache with visual aura",
        vitals: { temperature: 98.4, blood_pressure: "124/80", heart_rate: 76, respiratory_rate: 16, weight: 74, height: 175 },
        diagnosis: "Migraine with aura", doctor_notes: "Recommend trigger diary and follow-up in 2 weeks.",
        prescription_items: [{ medicine_id: 4, dosage: "50mg", frequency: "PRN", duration: "2 weeks" }],
        lab_test_required: true, follow_up_required: true, status: "Completed",
      },
      {
        consultation_id: 3, appointment_id: null, patient_id: 6, doctor_id: 1,
        consultation_date: "2026-09-15 10:00", symptoms: "Occasional dizziness, raised BP on home monitor",
        vitals: { temperature: 98.2, blood_pressure: "148/94", heart_rate: 80, respiratory_rate: 17, weight: 70, height: 160 },
        diagnosis: "Hypertension, stage 1", doctor_notes: "Start on Amlodipine, low-sodium diet, recheck BP in 30 days.",
        prescription_items: [{ medicine_id: 2, dosage: "5mg", frequency: "OD", duration: "30 days" }],
        lab_test_required: false, follow_up_required: true, status: "Completed",
      },
      {
        consultation_id: 4, appointment_id: 7, patient_id: 7, doctor_id: 3,
        consultation_date: "2026-09-17 12:40", symptoms: "Persistent cough with wheeze for 4 days",
        vitals: { temperature: 99.5, blood_pressure: "100/64", heart_rate: 102, respiratory_rate: 24, weight: 26, height: 128 },
        diagnosis: "Acute bronchitis", doctor_notes: "Start bronchodilator + short antibiotic course, review in 5 days.",
        prescription_items: [{ medicine_id: 6, dosage: "2 puffs", frequency: "QID", duration: "5 days" }, { medicine_id: 3, dosage: "250mg", frequency: "OD", duration: "5 days" }],
        lab_test_required: false, follow_up_required: false, status: "Completed",
      },
      {
        consultation_id: 5, appointment_id: 9, patient_id: 1, doctor_id: 1,
        consultation_date: "2026-09-17 16:10", symptoms: "Routine cardiac follow-up, mild chest tightness on exertion",
        vitals: { temperature: 98.6, blood_pressure: "132/86", heart_rate: 84, respiratory_rate: 16, weight: 82, height: 174 },
        diagnosis: "Stable angina — under monitoring", doctor_notes: "ECG advised, continue current medication.",
        prescription_items: [],
        lab_test_required: true, follow_up_required: true, status: "Completed",
      },
    ],

    labTestCatalog: [
      { lab_test_id: 1, test_name: "Complete Blood Count (CBC)", description: "General blood health screening", cost: 350 },
      { lab_test_id: 2, test_name: "MRI Brain", description: "Cross-sectional brain imaging", cost: 6500 },
      { lab_test_id: 3, test_name: "ECG", description: "Electrocardiogram", cost: 400 },
      { lab_test_id: 4, test_name: "Blood Sugar (Fasting)", description: "Fasting glucose level", cost: 150 },
      { lab_test_id: 5, test_name: "Lipid Profile", description: "Cholesterol & triglycerides panel", cost: 600 },
      { lab_test_id: 6, test_name: "Urine Routine", description: "Routine urinalysis", cost: 200 },
    ],

    labRequests: [
      { request_id: 1, consultation_id: 2, patient_id: 3, lab_test_id: 2, request_date: "2026-09-17", status: "Completed", result: "No structural abnormality detected." },
      { request_id: 2, consultation_id: 5, patient_id: 1, lab_test_id: 3, request_date: "2026-09-17", status: "Requested", result: "" },
    ],

    followUps: [
      { followup_id: 1, consultation_id: 2, patient_id: 3, doctor_id: 3, followup_date: "2026-10-01", reason: "Review migraine frequency & MRI result", status: "Scheduled" },
      { followup_id: 2, consultation_id: 3, patient_id: 6, doctor_id: 1, followup_date: "2026-10-15", reason: "Recheck blood pressure control", status: "Scheduled" },
      { followup_id: 3, consultation_id: 5, patient_id: 1, doctor_id: 1, followup_date: "2026-09-24", reason: "Review ECG result & symptoms", status: "Scheduled" },
    ],

    /* ---------------- Pharmacy ---------------- */
    medicines: [
      { medicine_id: 1, medicine_name: "Paracetamol 500mg", category: "Analgesic", manufacturer: "Cipla", quantity: 420, price: 1.5, expiry_date: "2027-03-31" },
      { medicine_id: 2, medicine_name: "Amlodipine 5mg", category: "Antihypertensive", manufacturer: "Sun Pharma", quantity: 180, price: 3.2, expiry_date: "2026-12-15" },
      { medicine_id: 3, medicine_name: "Azithromycin 250mg", category: "Antibiotic", manufacturer: "Dr. Reddy's", quantity: 25, price: 8.75, expiry_date: "2026-10-05" },
      { medicine_id: 4, medicine_name: "Sumatriptan 50mg", category: "Antimigraine", manufacturer: "GSK", quantity: 60, price: 22.0, expiry_date: "2027-01-20" },
      { medicine_id: 5, medicine_name: "Metformin 500mg", category: "Antidiabetic", manufacturer: "Cipla", quantity: 300, price: 2.1, expiry_date: "2027-06-30" },
      { medicine_id: 6, medicine_name: "Salbutamol Inhaler", category: "Bronchodilator", manufacturer: "Cipla", quantity: 15, price: 145.0, expiry_date: "2026-09-30" },
      { medicine_id: 7, medicine_name: "Cetirizine 10mg", category: "Antihistamine", manufacturer: "Mankind", quantity: 500, price: 0.9, expiry_date: "2027-08-11" },
      { medicine_id: 8, medicine_name: "Insulin Glargine", category: "Antidiabetic", manufacturer: "Sanofi", quantity: 8, price: 410.0, expiry_date: "2026-09-25" },
      { medicine_id: 9, medicine_name: "Omeprazole 20mg", category: "Antacid", manufacturer: "Sun Pharma", quantity: 0, price: 4.5, expiry_date: "2027-02-14" },
      { medicine_id: 10, medicine_name: "Ibuprofen 400mg", category: "Analgesic", manufacturer: "Cipla", quantity: 90, price: 1.9, expiry_date: "2026-11-18" },
      { medicine_id: 11, medicine_name: "Ranitidine 150mg", category: "Antacid", manufacturer: "GSK", quantity: 12, price: 2.4, expiry_date: "2026-08-30" },
    ],

    medicineBatches: [
      { batch_id: 1, medicine_id: 3, batch_number: "AZI-2609", quantity: 200, manufacturing_date: "2026-04-01", expiry_date: "2026-10-05", storage_location: "Rack A2" },
      { batch_id: 2, medicine_id: 8, batch_number: "INS-2591", quantity: 50, manufacturing_date: "2026-01-10", expiry_date: "2026-09-25", storage_location: "Cold Storage" },
      { batch_id: 3, medicine_id: 1, batch_number: "PARA-2703", quantity: 500, manufacturing_date: "2026-02-15", expiry_date: "2027-03-31", storage_location: "Rack B1" },
      { batch_id: 4, medicine_id: 11, batch_number: "RAN-2608", quantity: 60, manufacturing_date: "2025-09-01", expiry_date: "2026-08-30", storage_location: "Rack A5" },
    ],

    stockTransactions: [
      { transaction_id: 1, medicine_id: 3, batch_id: 1, transaction_type: "IN", quantity: 200, transaction_date: "2026-09-10", reason: "Supplier restock" },
      { transaction_id: 2, medicine_id: 8, batch_id: 2, transaction_type: "IN", quantity: 50, transaction_date: "2026-09-05", reason: "Supplier restock" },
      { transaction_id: 3, medicine_id: 9, batch_id: null, transaction_type: "OUT", quantity: 150, transaction_date: "2026-09-14", reason: "Expired stock disposed" },
      { transaction_id: 4, medicine_id: 1, batch_id: 3, transaction_type: "IN", quantity: 500, transaction_date: "2026-08-20", reason: "Supplier restock" },
      { transaction_id: 5, medicine_id: 6, batch_id: null, transaction_type: "OUT", quantity: 5, transaction_date: "2026-09-16", reason: "Dispensed to ward" },
    ],

    suppliers: [
      { supplier_id: 1, supplier_name: "MedSupply India Pvt Ltd", phone: "9988001122", email: "orders@medsupply.in", address: "Plot 14, Industrial Area, Pune" },
      { supplier_id: 2, supplier_name: "PharmaCare Distributors", phone: "9988003344", email: "sales@pharmacare.com", address: "22 Nehru Road, Mumbai" },
      { supplier_id: 3, supplier_name: "Global Meditech Supplies", phone: "9988005566", email: "contact@globalmeditech.com", address: "8 Sector 21, Gurugram" },
    ],

    /* ---------------- Instrument management ---------------- */
    instruments: [
      { instrument_id: 1, instrument_name: "Surgical Scissors", category: "Surgical", manufacturer: "Aesculap", quantity: 40, available_quantity: 28, condition_status: "Good" },
      { instrument_id: 2, instrument_name: "ECG Machine", category: "Diagnostic", manufacturer: "Philips", quantity: 6, available_quantity: 4, condition_status: "Good" },
      { instrument_id: 3, instrument_name: "Defibrillator", category: "Emergency", manufacturer: "Medtronic", quantity: 4, available_quantity: 3, condition_status: "Needs Service" },
      { instrument_id: 4, instrument_name: "Ventilator", category: "Life Support", manufacturer: "Dräger", quantity: 8, available_quantity: 5, condition_status: "Good" },
      { instrument_id: 5, instrument_name: "Surgical Forceps Set", category: "Surgical", manufacturer: "Aesculap", quantity: 60, available_quantity: 52, condition_status: "Good" },
      { instrument_id: 6, instrument_name: "Autoclave Sterilizer", category: "Sterilization", manufacturer: "Tuttnauer", quantity: 3, available_quantity: 2, condition_status: "Under Maintenance" },
      { instrument_id: 7, instrument_name: "Infusion Pump", category: "Support", manufacturer: "B. Braun", quantity: 20, available_quantity: 14, condition_status: "Good" },
      { instrument_id: 8, instrument_name: "Ultrasound Scanner", category: "Diagnostic", manufacturer: "GE Healthcare", quantity: 5, available_quantity: 5, condition_status: "Good" },
      { instrument_id: 9, instrument_name: "Patient Monitor", category: "Diagnostic", manufacturer: "Philips", quantity: 10, available_quantity: 9, condition_status: "Damaged" },
    ],

    instrumentMaintenance: [
      { maintenance_id: 1, instrument_id: 3, maintenance_date: "2026-09-12", issue_description: "Battery not holding charge", maintenance_cost: 4500, next_maintenance_date: "2026-12-12", status: "In Progress" },
      { maintenance_id: 2, instrument_id: 6, maintenance_date: "2026-09-14", issue_description: "Pressure valve replacement", maintenance_cost: 3200, next_maintenance_date: "2026-12-14", status: "In Progress" },
      { maintenance_id: 3, instrument_id: 4, maintenance_date: "2026-08-01", issue_description: "Routine calibration", maintenance_cost: 1800, next_maintenance_date: "2026-11-01", status: "Completed" },
      { maintenance_id: 4, instrument_id: 2, maintenance_date: "2026-07-20", issue_description: "Lead wire replacement", maintenance_cost: 950, next_maintenance_date: "2026-10-20", status: "Completed" },
      { maintenance_id: 5, instrument_id: 9, maintenance_date: "2026-09-18", issue_description: "Cracked display housing after fall", maintenance_cost: 2200, next_maintenance_date: "2026-09-25", status: "Scheduled" },
    ],

    // Combined issue + return tracking (mirrors instrument_issue / instrument_return)
    instrumentIssues: [
      { issue_id: 1, instrument_id: 1, issued_to: "OT-2 Surgical Team", department: "Surgery", issue_date: "2026-09-16", expected_return_date: "2026-09-19", return_date: null, condition_after_return: "", remarks: "", status: "Issued" },
      { issue_id: 2, instrument_id: 5, issued_to: "OT-2 Surgical Team", department: "Surgery", issue_date: "2026-09-16", expected_return_date: "2026-09-19", return_date: null, condition_after_return: "", remarks: "", status: "Issued" },
      { issue_id: 3, instrument_id: 1, issued_to: "OT-1 Surgical Team", department: "Surgery", issue_date: "2026-09-12", expected_return_date: "2026-09-14", return_date: "2026-09-14", condition_after_return: "Good", remarks: "Returned clean", status: "Returned" },
      { issue_id: 4, instrument_id: 4, issued_to: "ICU Ward", department: "ICU", issue_date: "2026-09-10", expected_return_date: "2026-09-13", return_date: null, condition_after_return: "", remarks: "", status: "Issued" },
      { issue_id: 5, instrument_id: 9, issued_to: "Emergency Ward", department: "Emergency", issue_date: "2026-09-08", expected_return_date: "2026-09-10", return_date: "2026-09-11", condition_after_return: "Damaged", remarks: "Dropped during transport, screen cracked", status: "Returned" },
    ],

    /* ---------------- Auth / accounts ---------------- */
    // role: "admin" | "doctor" | "pharmacy" | "instrument"
    users: [
      { user_id: 1, username: "admin", password: "admin123", name: "Hospital Administrator", role: "admin", department: "Administration", status: "Active", last_login: "" },
      { user_id: 2, username: "doctor1", password: "doctor123", name: "Dr. Aarav Sharma", role: "doctor", doctor_id: 1, department: "Cardiology", status: "Active", last_login: "" },
      { user_id: 3, username: "doctor2", password: "doctor123", name: "Dr. Meera Nair", role: "doctor", doctor_id: 2, department: "Orthopedics", status: "Active", last_login: "" },
      { user_id: 4, username: "doctor3", password: "doctor123", name: "Dr. Kabir Malhotra", role: "doctor", doctor_id: 3, department: "Neurology", status: "Active", last_login: "" },
      { user_id: 5, username: "pharmacyhead", password: "pharma123", name: "Pharmacy Head", role: "pharmacy", department: "Pharmacy", status: "Active", last_login: "" },
      { user_id: 6, username: "instrumenthead", password: "instrument123", name: "Instrument Head", role: "instrument", department: "Instrument Management", status: "Active", last_login: "" },
    ],

    roles: [
      { role_id: 1, role_name: "Admin", permissions: ["Full Access"], users_count: 1 },
      { role_id: 2, role_name: "Doctor", permissions: ["Appointments", "Patients", "Consultations"], users_count: 3 },
      { role_id: 3, role_name: "Pharmacy Head", permissions: ["Medicines", "Stock", "Pharmacy Alerts"], users_count: 1 },
      { role_id: 4, role_name: "Instrument Head", permissions: ["Instruments", "Issue/Return", "Maintenance", "Instrument Alerts"], users_count: 1 },
    ],

    accessLogs: [],
    failedLogins: [],
    unauthorizedAttempts: [],

    systemSettings: {
      hospitalName: "MediCore General Hospital",
      timezone: "Asia/Kolkata (GMT+5:30)",
      dateFormat: "DD-MM-YYYY",
      currency: "INR (₹)",
      backupFrequency: "Daily",
      lastBackup: "2026-09-17 02:00",
      maintenanceMode: false,
      emailNotifications: true,
      smsNotifications: false,
      lowStockThreshold: 30,
    },
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt storage */ }
    const fresh = clone(seed);
    persist(fresh);
    return fresh;
  }

  function persist(db) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) { /* storage unavailable (private mode etc.) — fall back to in-memory only */ }
  }

  let db = load();

  const DB = {
    get(collection) {
      return clone(db[collection] || []);
    },
    getRaw(collection) {
      return db[collection];
    },
    set(collection, records) {
      db[collection] = records;
      persist(db);
    },
    insert(collection, record) {
      if (!db[collection]) db[collection] = [];
      db[collection].push(record);
      persist(db);
      return record;
    },
    update(collection, idField, idValue, patch) {
      const list = db[collection] || [];
      const idx = list.findIndex((r) => String(r[idField]) === String(idValue));
      if (idx === -1) return null;
      list[idx] = Object.assign({}, list[idx], patch);
      persist(db);
      return list[idx];
    },
    remove(collection, idField, idValue) {
      const list = db[collection] || [];
      const idx = list.findIndex((r) => String(r[idField]) === String(idValue));
      if (idx === -1) return false;
      list.splice(idx, 1);
      persist(db);
      return true;
    },
    nextId(collection, idField) {
      const list = db[collection] || [];
      return list.reduce((max, r) => Math.max(max, Number(r[idField]) || 0), 0) + 1;
    },
    settings() {
      return clone(db.systemSettings || {});
    },
    updateSettings(patch) {
      db.systemSettings = Object.assign({}, db.systemSettings, patch);
      persist(db);
      return clone(db.systemSettings);
    },
    resetAll() {
      db = clone(seed);
      persist(db);
    },
    lookup(collection, idField) {
      const map = {};
      (db[collection] || []).forEach((r) => { map[r[idField]] = r; });
      return map;
    },
  };

  global.MediCoreDB = DB;
})(window);
