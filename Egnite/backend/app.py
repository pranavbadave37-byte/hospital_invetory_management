import json
import os
from datetime import date, datetime, timedelta
from functools import wraps

import jwt
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from . import config
    from .database import query, one, execute, transaction
except ImportError:
    import config
    from database import query, one, execute, transaction

app = Flask(__name__, static_folder=config.FRONTEND_DIR, static_url_path='')
app.config['SECRET_KEY'] = config.SECRET_KEY
CORS(app)

ROLE_PERMISSIONS = {
    'admin': {'all'},
    'doctor': {
        'patients', 'doctors', 'appointments', 'consultations', 'labTestCatalog',
        'labRequests', 'medicines', 'prescriptions', 'followUps'
    },
    'pharmacy': {'medicines', 'medicineBatches', 'stockTransactions', 'suppliers'},
    'instrument': {'instruments', 'instrumentIssues', 'instrumentMaintenance', 'sterilization', 'surgeries'},
}

COLLECTION_ROLES = {
    'users': {'admin'},
    'doctors': {'admin', 'doctor'},
    'patients': {'admin', 'doctor'},
    'appointments': {'admin', 'doctor'},
    'consultations': {'admin', 'doctor'},
    'labTestCatalog': {'admin', 'doctor'},
    'labRequests': {'admin', 'doctor'},
    'medicines': {'admin', 'doctor', 'pharmacy'},
    'medicineBatches': {'admin', 'pharmacy'},
    'stockTransactions': {'admin', 'pharmacy'},
    'suppliers': {'admin', 'pharmacy'},
    'instruments': {'admin', 'instrument'},
    'instrumentIssues': {'admin', 'instrument'},
    'instrumentMaintenance': {'admin', 'instrument'},
    'sterilization': {'admin', 'instrument'},
    'surgeries': {'admin', 'doctor', 'instrument'},
    'accessLogs': {'admin'},
    'failedLogins': {'admin'},
    'unauthorizedAttempts': {'admin'},
    'followUps': {'admin', 'doctor'},
}

ID_FIELDS = {
    'users': 'user_id', 'doctors': 'doctor_id', 'patients': 'patient_id',
    'appointments': 'appointment_id', 'consultations': 'consultation_id',
    'labTestCatalog': 'lab_test_id', 'labRequests': 'request_id',
    'medicines': 'medicine_id', 'medicineBatches': 'batch_id',
    'stockTransactions': 'transaction_id', 'suppliers': 'supplier_id',
    'instruments': 'instrument_id', 'instrumentIssues': 'issue_id',
    'instrumentMaintenance': 'maintenance_id', 'sterilization': 'sterilization_id',
    'surgeries': 'surgery_id', 'accessLogs': 'log_id',
}


def json_safe(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat(sep=' ') if isinstance(value, datetime) else value.isoformat()
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    return value


def ok(data=None, status=200):
    payload = {'success': True}
    if data is not None:
        payload.update(data if isinstance(data, dict) else {'data': data})
    return jsonify(json_safe(payload)), status


def fail(message, status=400):
    return jsonify({'success': False, 'message': message}), status


def parse_date(value):
    if value in (None, ''):
        return None
    if isinstance(value, date):
        return value
    return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()


def parse_datetime(value):
    if value in (None, ''):
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).replace('T', ' ')
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return datetime.fromisoformat(s)



def verify_password(stored, supplied):
    try:
        return check_password_hash(stored, supplied)
    except (ValueError, TypeError):
        # Compatibility for an existing database that may contain an old plain-text
        # demo password. Successful login immediately upgrades it to a hash.
        return stored == supplied

def token_for(user):
    payload = {
        'user_id': int(user['user_id']),
        'username': user['username'],
        'role': user['role'],
        'doctor_id': user.get('doctor_id'),
        'exp': datetime.utcnow() + timedelta(hours=config.JWT_EXPIRES_HOURS),
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm='HS256')


def current_user():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    token = header.split(' ', 1)[1].strip()
    try:
        return jwt.decode(token, config.SECRET_KEY, algorithms=['HS256'])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def auth_required(roles=None):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            user = current_user()
            if not user:
                return fail('Authentication required.', 401)
            if roles and user.get('role') not in roles and 'all' not in roles:
                return fail('You are not authorized for this operation.', 403)
            request.user = user
            return fn(*args, **kwargs)
        return wrapped
    return decorator


def collection_allowed(collection):
    user = current_user()
    if not user:
        return False
    role = user.get('role')
    allowed = COLLECTION_ROLES.get(collection, set())
    return role in allowed or role == 'admin'


def log_access(user_id, action):
    try:
        execute('''INSERT INTO ACCESS_LOG(user_id, action, login_time)
                   VALUES(:uid, :action, SYSDATE)''', {'uid': user_id, 'action': action})
    except Exception:
        pass


def load_settings():
    try:
        with open(config.SETTINGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {
            'hospitalName': 'MediCore General Hospital',
            'timezone': 'Asia/Kolkata (GMT+5:30)',
            'dateFormat': 'DD-MM-YYYY',
            'currency': 'INR (₹)',
            'lowStockThreshold': 30,
        }


def save_settings(settings):
    tmp = config.SETTINGS_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)
    os.replace(tmp, config.SETTINGS_FILE)


# ---------------- Authentication ----------------
@app.post('/api/auth/login')
def login():
    body = request.get_json(silent=True) or {}
    username = str(body.get('username', '')).strip()
    password = str(body.get('password', ''))
    expected_role = body.get('role')
    if not username or not password:
        return fail('Username and password are required.', 400)

    user = one('''
        SELECT u.user_id, u.username, u.password, u.role, u.status,
               d.doctor_id, d.doctor_name,
               s.staff_name, s.department
        FROM APP_USER u
        LEFT JOIN DOCTOR d ON d.user_id = u.user_id
        LEFT JOIN STAFF s ON s.user_id = u.user_id
        WHERE LOWER(u.username) = LOWER(:username)
    ''', {'username': username})

    reason = None
    if not user:
        reason = 'No account with that username.'
    elif user['status'] and str(user['status']).lower() != 'active':
        reason = 'This account is inactive.'
    elif expected_role and user['role'] != expected_role:
        labels = {'admin': 'Admin', 'doctor': 'Doctor', 'pharmacy': 'Pharmacy Head', 'instrument': 'Instrument Head'}
        reason = f"This account is not registered for the {labels.get(expected_role, expected_role)} workspace."
    elif not verify_password(user['password'], password):
        reason = 'Incorrect password.'
    else:
        # If this account was created with a legacy plain-text demo password,
        # upgrade it after successful authentication.
        try:
            if not str(user['password']).startswith(('scrypt:', 'pbkdf2:', 'argon2:')):
                execute('UPDATE APP_USER SET password=:p WHERE user_id=:id', {'p': generate_password_hash(password), 'id': user['user_id']})
        except Exception:
            pass

    if reason:
        # The fixed Oracle schema has no FAILED_LOGIN table. The frontend is therefore
        # told about the failure but it is not persisted in Oracle.
        return fail(reason, 401)

    name = user['doctor_name'] or user['staff_name'] or user['username']
    department = user['department'] or ('Administration' if user['role'] == 'admin' else None)
    result_user = {
        'user_id': int(user['user_id']), 'username': user['username'],
        'name': name, 'role': user['role'], 'doctor_id': user['doctor_id'],
        'department': department, 'status': user['status'] or 'Active'
    }
    token = token_for(result_user)
    log_access(user['user_id'], 'Login')
    return ok({'token': token, 'user': result_user})


@app.post('/api/auth/logout')
@auth_required()
def logout():
    log_access(request.user['user_id'], 'Logout')
    return ok({'message': 'Logged out.'})


@app.get('/api/auth/me')
@auth_required()
def me():
    u = one('''
        SELECT u.user_id, u.username, u.role, u.status,
               d.doctor_id, d.doctor_name, s.staff_name, s.department,
               (SELECT MAX(login_time) FROM ACCESS_LOG al WHERE al.user_id=u.user_id) last_login
        FROM APP_USER u
        LEFT JOIN DOCTOR d ON d.user_id=u.user_id
        LEFT JOIN STAFF s ON s.user_id=u.user_id
        WHERE u.user_id=:id
    ''', {'id': request.user['user_id']})
    if not u:
        return fail('User not found.', 404)
    return ok({'user': {
        'user_id': u['user_id'], 'username': u['username'], 'role': u['role'],
        'status': u['status'], 'doctor_id': u['doctor_id'],
        'name': u['doctor_name'] or u['staff_name'] or u['username'],
        'department': u['department'], 'last_login': json_safe(u['last_login'])
    }})


# ---------------- Compatibility GET layer ----------------
def get_users():
    return query('''
        SELECT u.user_id, u.username, u.role, u.status, u.created_at,
               d.doctor_id, d.doctor_name,
               s.staff_name, s.department,
               (SELECT MAX(login_time) FROM ACCESS_LOG al WHERE al.user_id=u.user_id) last_login
        FROM APP_USER u
        LEFT JOIN DOCTOR d ON d.user_id=u.user_id
        LEFT JOIN STAFF s ON s.user_id=u.user_id
        ORDER BY u.user_id
    ''')


def get_doctors():
    return query('''
        SELECT d.doctor_id, d.user_id, d.doctor_name,
               d.specialty, d.specialty AS specialization,
               s.department, CAST(NULL AS VARCHAR2(20)) AS phone,
               NVL(u.status, 'Active') AS status
        FROM DOCTOR d
        LEFT JOIN APP_USER u ON u.user_id=d.user_id
        LEFT JOIN STAFF s ON s.user_id=d.user_id
        ORDER BY d.doctor_id
    ''')


def get_patients():
    rows = query('''SELECT patient_id, first_name, last_name, age, gender,
                           blood_group, phone, address
                    FROM PATIENT ORDER BY patient_id''')
    for p in rows:
        # Medical history does not have its own table in the supplied Oracle schema.
        # Provide a derived, read-only view so the existing patient-details UI keeps working.
        p['medical_history'] = {'diseases': [], 'allergies': [], 'surgeries': [], 'conditions': []}
    diagnoses = query('''SELECT patient_id, diagnosis FROM DIAGNOSIS
                         WHERE diagnosis IS NOT NULL ORDER BY diagnosis_id''')
    for d in diagnoses:
        for p in rows:
            if p['patient_id'] == d['patient_id']:
                p['medical_history']['conditions'].append(d['diagnosis'])
                break
    surgeries = query('''SELECT patient_id, surgery_name, surgery_date FROM SURGERY
                         WHERE surgery_name IS NOT NULL ORDER BY surgery_id''')
    for s in surgeries:
        for p in rows:
            if p['patient_id'] == s['patient_id']:
                p['medical_history']['surgeries'].append(
                    f"{s['surgery_name']} — {json_safe(s['surgery_date'])}" if s['surgery_date'] else s['surgery_name']
                )
                break
    return rows


def get_appointments():
    return query('''SELECT appointment_id, patient_id, doctor_id,
                           appointment_date, appointment_time, status
                    FROM APPOINTMENT ORDER BY appointment_date, appointment_time''')


def get_consultations():
    rows = query('''
        SELECT c.consultation_id, c.patient_id, c.doctor_id, c.appointment_id,
               NVL(a.appointment_date, SYSDATE) AS consultation_date,
               c.symptoms, c.diagnosis, c.treatment, c.doctor_notes
        FROM CONSULTATION c
        LEFT JOIN APPOINTMENT a ON a.appointment_id=c.appointment_id
        ORDER BY c.consultation_id
    ''')
    vitals = query('''SELECT vital_id, consultation_id, temperature, blood_pressure,
                             heart_rate, weight, height FROM VITALS''')
    diagnoses = query('''SELECT diagnosis_id, consultation_id, diagnosis, treatment
                         FROM DIAGNOSIS ORDER BY diagnosis_id''')
    rx = query('''SELECT p.prescription_id, p.consult_id AS consultation_id,
                         pd.medicine_id, pd.dosage, pd.frequency, pd.duration
                  FROM PRESCRIPTION p
                  JOIN PRESCRIPTION_DETAILS pd ON pd.prescription_id=p.prescription_id''')
    labs = query('''SELECT consultation_id FROM LAB_REQUEST''')
    vmap = {v['consultation_id']: v for v in vitals}
    dmap = {}
    for d in diagnoses:
        dmap.setdefault(d['consultation_id'], []).append(d)
    rxmap = {}
    for r in rx:
        rxmap.setdefault(r['consultation_id'], []).append({
            'medicine_id': r['medicine_id'], 'dosage': r['dosage'],
            'frequency': r['frequency'], 'duration': r['duration']
        })
    labset = {x['consultation_id'] for x in labs}
    for c in rows:
        v = vmap.get(c['consultation_id'])
        c['vitals'] = {
            'temperature': v['temperature'] if v else None,
            'blood_pressure': v['blood_pressure'] if v else None,
            'heart_rate': v['heart_rate'] if v else None,
            'respiratory_rate': None,  # not present in supplied VITALS table
            'weight': v['weight'] if v else None,
            'height': v['height'] if v else None,
        }
        c['prescription_items'] = rxmap.get(c['consultation_id'], [])
        c['lab_test_required'] = c['consultation_id'] in labset
        c['follow_up_required'] = False  # no FOLLOW_UP table in supplied schema
        c['status'] = 'Completed'
        ds = dmap.get(c['consultation_id'], [])
        if not c['diagnosis'] and ds:
            c['diagnosis'] = ds[-1]['diagnosis']
    return rows


def get_lab_requests():
    return query('''
        SELECT lr.request_id, lr.consultation_id, lr.lab_test_id,
               lr.request_date, lr.result,
               c.patient_id,
               CASE WHEN lr.result IS NULL OR TRIM(lr.result) IS NULL
                    THEN 'Requested' ELSE 'Completed' END AS status
        FROM LAB_REQUEST lr
        JOIN CONSULTATION c ON c.consultation_id=lr.consultation_id
        ORDER BY lr.request_id DESC
    ''')


def get_medicines():
    return query('''
        SELECT m.medicine_id, m.medicine_name, m.category, m.manufacturer,
               m.price, m.min_stock_level,
               NVL(SUM(mb.quantity),0) AS quantity,
               MIN(mb.expiry_date) AS expiry_date
        FROM MEDICINE m
        LEFT JOIN MEDICINE_BATCH mb ON mb.medicine_id=m.medicine_id
        GROUP BY m.medicine_id, m.medicine_name, m.category, m.manufacturer,
                 m.price, m.min_stock_level
        ORDER BY m.medicine_id
    ''')


def get_batches():
    return query('''
        SELECT batch_id, medicine_id, batch_number, quantity,
               manufacture_dt, manufacture_dt AS manufacturing_date,
               expiry_date, storage_loc, storage_loc AS storage_location
        FROM MEDICINE_BATCH ORDER BY batch_id
    ''')


def get_stock_transactions():
    return query('''SELECT transaction_id, medicine_id, batch_id,
                           transaction_type, quantity, transaction_date, reason
                    FROM STOCK_TRANSACTION ORDER BY transaction_date, transaction_id''')


def get_instruments():
    return query('''
        SELECT instrument_id, instrument_name, category, manufacturer, department,
               quantity, available_qty, available_qty AS available_quantity,
               status, condition_status
        FROM INSTRUMENT ORDER BY instrument_id
    ''')


def get_maintenance():
    return query('''
        SELECT maintenance_id, instrument_id, maintenance_date,
               issue_description, maintenance_cost, next_maintenance,
               next_maintenance AS next_maintenance_date, status
        FROM INSTRUMENT_MAINT ORDER BY maintenance_id DESC
    ''')


def get_instrument_issues():
    return query('''
        SELECT i.issue_id, i.instrument_id, i.issued_to, i.department,
               i.issue_date, i.expected_return,
               i.expected_return AS expected_return_date,
               i.return_date, i.status,
               r.condition_after AS condition_after_return,
               r.remarks
        FROM INSTRUMENT_ISSUE i
        LEFT JOIN INSTRUMENT_RETURN r ON r.issue_id=i.issue_id
        ORDER BY i.issue_id DESC
    ''')


def get_sterilization():
    return query('''SELECT sterilization_id, instrument_id, sterilization_date,
                           method, next_sterilization_dt, status
                    FROM STERILIZATION ORDER BY sterilization_date DESC''')


def get_surgeries():
    return query('''SELECT surgery_id, patient_id, doctor_id, surgery_name,
                           surgery_date, surgery_status
                    FROM SURGERY ORDER BY surgery_date DESC, surgery_id DESC''')


def get_access_logs():
    return query('''
        SELECT al.log_id, al.user_id,
               NVL(d.doctor_name, NVL(s.staff_name, u.username)) AS user,
               al.action, al.login_time,
               CAST('—' AS VARCHAR2(50)) AS ip_address,
               CAST('Success' AS VARCHAR2(30)) AS status
        FROM ACCESS_LOG al
        JOIN APP_USER u ON u.user_id=al.user_id
        LEFT JOIN DOCTOR d ON d.user_id=u.user_id
        LEFT JOIN STAFF s ON s.user_id=u.user_id
        ORDER BY al.login_time DESC, al.log_id DESC
    ''')


def get_collection(collection):
    if collection == 'users': return get_users()
    if collection == 'doctors': return get_doctors()
    if collection == 'patients': return get_patients()
    if collection == 'appointments': return get_appointments()
    if collection == 'consultations': return get_consultations()
    if collection == 'labRequests': return get_lab_requests()
    if collection == 'labTestCatalog': return query('SELECT lab_test_id, test_name, description, cost FROM LAB_TEST ORDER BY lab_test_id')
    if collection == 'medicines': return get_medicines()
    if collection == 'medicineBatches': return get_batches()
    if collection == 'stockTransactions': return get_stock_transactions()
    if collection == 'suppliers': return query('SELECT supplier_id, supplier_name, phone, email, address FROM SUPPLIER ORDER BY supplier_id')
    if collection == 'instruments': return get_instruments()
    if collection == 'instrumentIssues': return get_instrument_issues()
    if collection == 'instrumentMaintenance': return get_maintenance()
    if collection == 'sterilization': return get_sterilization()
    if collection == 'surgeries': return get_surgeries()
    if collection == 'accessLogs': return get_access_logs()
    if collection in ('failedLogins', 'unauthorizedAttempts', 'followUps'): return []
    raise KeyError(collection)


@app.get('/api/db/<collection>')
@auth_required()
def db_get(collection):
    if not collection_allowed(collection):
        return fail('Not authorized.', 403)
    try:
        return ok({'data': get_collection(collection)})
    except KeyError:
        return fail('Unknown collection.', 404)
    except Exception as exc:
        app.logger.exception('GET collection failed')
        return fail(str(exc), 500)


# ---------------- Generic CRUD ----------------

def clean_fields(data, allowed, aliases=None):
    aliases = aliases or {}
    out = {}
    for key, value in data.items():
        real = aliases.get(key, key)
        if real in allowed:
            out[real] = value
    return out


def execute_insert(cur, table, fields, id_field):
    if not fields:
        raise ValueError('No insertable fields provided.')
    cols = list(fields.keys())
    binds = {f'p{i}': fields[c] for i, c in enumerate(cols)}
    col_sql = ', '.join(cols)
    val_sql = ', '.join(':' + k for k in binds)
    out = cur.var(int)
    cur.execute(
        f'INSERT INTO {table}({col_sql}) VALUES({val_sql}) RETURNING {id_field} INTO :out_id',
        {**binds, 'out_id': out}
    )
    return int(out.getvalue()[0])


TABLES = {
    'patients': ('PATIENT', 'patient_id', {'first_name','last_name','age','gender','blood_group','phone','address'}, {}),
    'appointments': ('APPOINTMENT', 'appointment_id', {'patient_id','doctor_id','appointment_date','appointment_time','status'}, {}),
    'medicines': ('MEDICINE', 'medicine_id', {'medicine_name','category','manufacturer','price','min_stock_level'}, {}),
    'medicineBatches': ('MEDICINE_BATCH', 'batch_id', {'medicine_id','batch_number','quantity','manufacture_dt','expiry_date','storage_loc'}, {'manufacturing_date':'manufacture_dt','storage_location':'storage_loc'}),
    'suppliers': ('SUPPLIER', 'supplier_id', {'supplier_name','phone','email','address'}, {}),
    'instruments': ('INSTRUMENT', 'instrument_id', {'instrument_name','category','manufacturer','department','quantity','available_qty','status','condition_status'}, {'available_quantity':'available_qty'}),
    'instrumentMaintenance': ('INSTRUMENT_MAINT', 'maintenance_id', {'instrument_id','maintenance_date','issue_description','maintenance_cost','next_maintenance','status'}, {'next_maintenance_date':'next_maintenance'}),
    'sterilization': ('STERILIZATION', 'sterilization_id', {'instrument_id','sterilization_date','method','next_sterilization_dt','status'}, {}),
    'surgeries': ('SURGERY', 'surgery_id', {'patient_id','doctor_id','surgery_name','surgery_date','surgery_status'}, {}),
    'labRequests': ('LAB_REQUEST', 'request_id', {'consultation_id','lab_test_id','request_date','result'}, {}),
    'labTestCatalog': ('LAB_TEST', 'lab_test_id', {'test_name','description','cost'}, {}),
}


@app.post('/api/db/<collection>')
@auth_required()
def db_insert(collection):
    if not collection_allowed(collection):
        return fail('Not authorized.', 403)
    data = request.get_json(silent=True) or {}
    try:
        if collection == 'users':
            return create_user(data)
        if collection == 'appointments':
            data['appointment_date'] = parse_date(data.get('appointment_date'))
        if collection == 'medicineBatches':
            data['manufacture_dt'] = parse_date(data.get('manufacture_dt') or data.get('manufacturing_date'))
            data['expiry_date'] = parse_date(data.get('expiry_date'))
        if collection == 'instrumentMaintenance':
            data['maintenance_date'] = parse_date(data.get('maintenance_date'))
            data['next_maintenance'] = parse_date(data.get('next_maintenance') or data.get('next_maintenance_date'))
        if collection == 'sterilization':
            data['sterilization_date'] = parse_date(data.get('sterilization_date'))
            data['next_sterilization_dt'] = parse_date(data.get('next_sterilization_dt'))
        if collection == 'surgeries':
            data['surgery_date'] = parse_date(data.get('surgery_date'))
        if collection == 'labRequests':
            data['request_date'] = parse_date(data.get('request_date')) or date.today()
        if collection == 'labTestCatalog':
            pass
        if collection not in TABLES:
            if collection in ('failedLogins','unauthorizedAttempts','followUps','accessLogs','consultations','instrumentIssues','stockTransactions'):
                return fail('Use the dedicated API for this operation.', 400)
            return fail('Unknown collection.', 404)
        table, id_field, allowed, aliases = TABLES[collection]
        fields = clean_fields(data, allowed, aliases)
        # Identity IDs must be generated by Oracle, not by the browser.
        fields.pop(id_field, None)
        new_id = None
        with transaction() as (_, cur):
            new_id = execute_insert(cur, table, fields, id_field)
        row = one(f'SELECT * FROM {table} WHERE {id_field}=:id', {'id': new_id})
        return ok({'data': row}, 201)
    except Exception as exc:
        app.logger.exception('INSERT failed')
        return fail(str(exc), 400)


@app.patch('/api/db/<collection>/<int:record_id>')
@auth_required()
def db_update(collection, record_id):
    if not collection_allowed(collection):
        return fail('Not authorized.', 403)
    data = request.get_json(silent=True) or {}
    try:
        if collection == 'users':
            return update_user(record_id, data)
        if collection == 'appointments':
            if 'appointment_date' in data: data['appointment_date'] = parse_date(data['appointment_date'])
        if collection == 'medicineBatches':
            if 'manufacture_dt' in data or 'manufacturing_date' in data: data['manufacture_dt'] = parse_date(data.get('manufacture_dt') or data.get('manufacturing_date'))
            if 'expiry_date' in data: data['expiry_date'] = parse_date(data['expiry_date'])
        if collection == 'instrumentMaintenance':
            if 'maintenance_date' in data: data['maintenance_date'] = parse_date(data['maintenance_date'])
            if 'next_maintenance' in data or 'next_maintenance_date' in data: data['next_maintenance'] = parse_date(data.get('next_maintenance') or data.get('next_maintenance_date'))
        if collection not in TABLES:
            return fail('Unknown or unsupported collection update.', 400)
        table, id_field, allowed, aliases = TABLES[collection]
        fields = clean_fields(data, allowed, aliases)
        # Frontend compatibility: these fields do not exist in MEDICINE.
        fields.pop('quantity', None) if collection == 'medicines' else None
        if not fields:
            return ok({'data': get_collection(collection)})
        assignments = ', '.join(f'{k}=:{k}' for k in fields)
        fields['id'] = record_id
        execute(f'UPDATE {table} SET {assignments} WHERE {id_field}=:id', fields)
        row = one(f'SELECT * FROM {table} WHERE {id_field}=:id', {'id': record_id})
        if not row:
            return fail('Record not found.', 404)
        return ok({'data': row})
    except Exception as exc:
        app.logger.exception('UPDATE failed')
        return fail(str(exc), 400)


@app.delete('/api/db/<collection>/<int:record_id>')
@auth_required()
def db_delete(collection, record_id):
    if not collection_allowed(collection):
        return fail('Not authorized.', 403)
    if collection not in TABLES:
        return fail('Unknown or unsupported collection delete.', 400)
    table, id_field, _, _ = TABLES[collection]
    try:
        count = execute(f'DELETE FROM {table} WHERE {id_field}=:id', {'id': record_id})
        if not count:
            return fail('Record not found.', 404)
        return ok({'message': 'Deleted.'})
    except Exception as exc:
        return fail(str(exc), 409)


@app.get('/api/db/<collection>/next-id')
@auth_required()
def next_id(collection):
    if not collection_allowed(collection):
        return fail('Not authorized.', 403)
    field = ID_FIELDS.get(collection)
    if not field:
        return ok({'next_id': 1})
    table_info = TABLES.get(collection)
    if table_info:
        table = table_info[0]
        value = one(f'SELECT NVL(MAX({field}),0)+1 AS next_id FROM {table}')['next_id']
        return ok({'next_id': int(value)})
    if collection == 'accessLogs':
        value = one('SELECT NVL(MAX(log_id),0)+1 AS next_id FROM ACCESS_LOG')['next_id']
        return ok({'next_id': int(value)})
    return ok({'next_id': 1})


# ---------------- User CRUD ----------------
def create_user(data):
    username = str(data.get('username', '')).strip()
    password = str(data.get('password') or 'changeme123')
    role = str(data.get('role', '')).strip().lower()
    name = str(data.get('name') or username).strip()
    department = str(data.get('department') or '').strip()
    doctor_id = data.get('doctor_id')
    if not username or role not in ('admin','doctor','pharmacy','instrument'):
        return fail('Valid username and role are required.')
    if one('SELECT user_id FROM APP_USER WHERE LOWER(username)=LOWER(:u)', {'u': username}):
        return fail('That username is already taken.', 409)
    try:
        with transaction() as (_, cur):
            cur.execute(
                '''INSERT INTO APP_USER(username,password,role,status)
                   VALUES(:u,:p,:r,'Active') RETURNING user_id INTO :id''',
                {'u': username, 'p': generate_password_hash(password), 'r': role, 'id': cur.var(int)}
            )
            # Query the just-created identity inside the same transaction.
            cur.execute('SELECT user_id FROM APP_USER WHERE LOWER(username)=LOWER(:u)', {'u': username})
            uid = int(cur.fetchone()[0])
            if role == 'doctor':
                if doctor_id:
                    cur.execute('UPDATE DOCTOR SET user_id=:uid WHERE doctor_id=:did', {'uid': uid, 'did': int(doctor_id)})
                else:
                    cur.execute('INSERT INTO DOCTOR(user_id,doctor_name,specialty) VALUES(:uid,:name,:spec)', {'uid':uid,'name':name,'spec':department or None})
            elif role in ('pharmacy','instrument'):
                cur.execute('INSERT INTO STAFF(user_id,staff_name,department) VALUES(:uid,:name,:dept)', {'uid':uid,'name':name,'dept':department or None})
        return ok({'data': {'user_id': uid, 'username': username, 'name': name, 'role': role, 'department': department, 'status': 'Active'}}, 201)
    except Exception as exc:
        return fail(str(exc), 400)


def update_user(user_id, data):
    allowed = {'username','role','status'}
    fields = clean_fields(data, allowed)
    if 'password' in data and data['password']:
        fields['password'] = generate_password_hash(str(data['password']))
    if 'username' in fields and one('SELECT user_id FROM APP_USER WHERE LOWER(username)=LOWER(:u) AND user_id<>:id', {'u':fields['username'],'id':user_id}):
        return fail('That username is already taken.', 409)
    try:
        with transaction() as (_, cur):
            if fields:
                assignments = ', '.join(f'{k}=:{k}' for k in fields)
                fields['id'] = user_id
                cur.execute(f'UPDATE APP_USER SET {assignments} WHERE user_id=:id', fields)
            if 'department' in data:
                cur.execute('UPDATE STAFF SET department=:d WHERE user_id=:id', {'d':data.get('department'),'id':user_id})
            if 'name' in data:
                cur.execute('UPDATE STAFF SET staff_name=:n WHERE user_id=:id', {'n':data.get('name'),'id':user_id})
                cur.execute('UPDATE DOCTOR SET doctor_name=:n WHERE user_id=:id', {'n':data.get('name'),'id':user_id})
            if data.get('doctor_id'):
                cur.execute('UPDATE DOCTOR SET user_id=:uid WHERE doctor_id=:did', {'uid':user_id,'did':int(data['doctor_id'])})
        user = next((u for u in get_users() if int(u['user_id']) == user_id), None)
        if not user: return fail('User not found.', 404)
        user['name'] = user.pop('doctor_name', None) or user.pop('staff_name', None) or user['username']
        return ok({'data': user})
    except Exception as exc:
        return fail(str(exc), 400)


# ---------------- Dedicated clinical transaction ----------------
@app.post('/api/consultations/complete')
@auth_required({'admin','doctor'})
def complete_consultation():
    data = request.get_json(silent=True) or {}
    required = ['patient_id', 'doctor_id', 'diagnosis']
    if any(data.get(k) in (None, '') for k in required):
        return fail('patient_id, doctor_id and diagnosis are required.')
    vit = data.get('vitals') or {}
    rx_items = data.get('prescription_items') or []
    lab_ids = [int(x) for x in (data.get('lab_test_ids') or [])]
    try:
        with transaction() as (_, cur):
            out = cur.var(int)
            cur.execute('''INSERT INTO CONSULTATION(patient_id,doctor_id,appointment_id,symptoms,diagnosis,treatment,doctor_notes)
                           VALUES(:patient_id,:doctor_id,:appointment_id,:symptoms,:diagnosis,:treatment,:notes)
                           RETURNING consultation_id INTO :out_id''', {
                'patient_id': int(data['patient_id']), 'doctor_id': int(data['doctor_id']),
                'appointment_id': int(data['appointment_id']) if data.get('appointment_id') else None,
                'symptoms': data.get('symptoms') or None, 'diagnosis': data.get('diagnosis'),
                'treatment': data.get('treatment') or None, 'notes': data.get('doctor_notes') or None,
                'out_id': out,
            })
            cid = int(out.getvalue()[0])
            cur.execute('''INSERT INTO VITALS(consultation_id,temperature,blood_pressure,heart_rate,weight,height)
                           VALUES(:cid,:temp,:bp,:hr,:wt,:ht)''', {
                'cid':cid, 'temp':vit.get('temperature'), 'bp':vit.get('blood_pressure') or None,
                'hr':vit.get('heart_rate'), 'wt':vit.get('weight'), 'ht':vit.get('height')
            })
            cur.execute('''INSERT INTO DIAGNOSIS(consultation_id,patient_id,doctor_id,diagnosis,treatment)
                           VALUES(:cid,:pid,:did,:diag,:treat)''', {
                'cid':cid,'pid':int(data['patient_id']),'did':int(data['doctor_id']),
                'diag':data.get('diagnosis'),'treat':data.get('treatment') or None
            })
            if rx_items:
                pout = cur.var(int)
                cur.execute('''INSERT INTO PRESCRIPTION(patient_id,doctor_id,consult_id,prescription_dt)
                               VALUES(:pid,:did,:cid,SYSDATE) RETURNING prescription_id INTO :pidout''', {
                    'pid':int(data['patient_id']),'did':int(data['doctor_id']),'cid':cid,'pidout':pout
                })
                prescription_id = int(pout.getvalue()[0])
                for item in rx_items:
                    cur.execute('''INSERT INTO PRESCRIPTION_DETAILS(prescription_id,medicine_id,dosage,frequency,duration)
                                   VALUES(:rid,:mid,:dos,:freq,:dur)''', {
                        'rid':prescription_id,'mid':int(item['medicine_id']),
                        'dos':item.get('dosage') or None,'freq':item.get('frequency') or None,'dur':item.get('duration') or None
                    })
            for lab_id in lab_ids:
                cur.execute('''INSERT INTO LAB_REQUEST(consultation_id,lab_test_id,request_date,result)
                               VALUES(:cid,:lid,SYSDATE,NULL)''', {'cid':cid,'lid':lab_id})
            if data.get('appointment_id'):
                cur.execute('UPDATE APPOINTMENT SET status=\'Completed\' WHERE appointment_id=:aid', {'aid':int(data['appointment_id'])})
        return ok({'data': {'consultation_id': cid}}, 201)
    except Exception as exc:
        app.logger.exception('Consultation transaction failed')
        return fail(str(exc), 400)


# ---------------- Pharmacy transactions ----------------
@app.post('/api/pharmacy/stock/in')
@auth_required({'admin','pharmacy'})
def stock_in():
    data = request.get_json(silent=True) or {}
    try:
        medicine_id = int(data['medicine_id']); quantity = int(data['quantity'])
        if quantity <= 0: raise ValueError('Quantity must be greater than zero.')
        supplier_id = int(data['supplier_id']) if data.get('supplier_id') else None
        batch_number = str(data.get('batch_number') or '').strip() or None
        mfg = parse_date(data.get('manufacture_dt') or data.get('manufacturing_date'))
        expiry = parse_date(data.get('expiry_date'))
        location = data.get('storage_loc') or data.get('storage_location') or 'Main Store'
        with transaction() as (_, cur):
            if batch_number:
                out = cur.var(int)
                cur.execute('''INSERT INTO MEDICINE_BATCH(medicine_id,batch_number,quantity,manufacture_dt,expiry_date,storage_loc)
                               VALUES(:mid,:bn,:qty,:mfg,:exp,:loc) RETURNING batch_id INTO :bid''', {
                    'mid':medicine_id,'bn':batch_number,'qty':quantity,'mfg':mfg,'exp':expiry,'loc':location,'bid':out
                })
                batch_id = int(out.getvalue()[0])
            else:
                batch_id = None
            cur.execute('''INSERT INTO STOCK_TRANSACTION(medicine_id,batch_id,transaction_type,quantity,transaction_date,reason)
                           VALUES(:mid,:bid,'IN',:qty,SYSDATE,:reason)''', {
                'mid':medicine_id,'bid':batch_id,'qty':quantity,'reason':data.get('reason') or 'Supplier restock'
            })
            if supplier_id and batch_id:
                cur.execute('''INSERT INTO MEDICINE_PURCHASE(supplier_id,batch_id,quantity,purchase_date)
                               VALUES(:sid,:bid,:qty,SYSDATE)''', {'sid':supplier_id,'bid':batch_id,'qty':quantity})
        return ok({'message':'Stock added successfully.'}, 201)
    except Exception as exc:
        return fail(str(exc), 400)


@app.post('/api/pharmacy/stock/out')
@auth_required({'admin','pharmacy'})
def stock_out():
    data = request.get_json(silent=True) or {}
    try:
        medicine_id = int(data['medicine_id']); requested = int(data['quantity'])
        if requested <= 0: raise ValueError('Quantity must be greater than zero.')
        with transaction() as (_, cur):
            cur.execute('''SELECT batch_id, quantity, expiry_date FROM MEDICINE_BATCH
                           WHERE medicine_id=:mid AND quantity>0
                           ORDER BY expiry_date NULLS LAST, batch_id
                           FOR UPDATE''', {'mid':medicine_id})
            batches = cur.fetchall()
            available = sum(int(r[1] or 0) for r in batches)
            if requested > available:
                raise ValueError(f'Only {available} unit(s) available.')
            remaining = requested
            for batch_id, qty, _ in batches:
                if remaining <= 0: break
                take = min(int(qty), remaining)
                cur.execute('UPDATE MEDICINE_BATCH SET quantity=quantity-:q WHERE batch_id=:bid', {'q':take,'bid':batch_id})
                cur.execute('''INSERT INTO STOCK_TRANSACTION(medicine_id,batch_id,transaction_type,quantity,transaction_date,reason)
                               VALUES(:mid,:bid,'OUT',:q,SYSDATE,:reason)''', {
                    'mid':medicine_id,'bid':batch_id,'q':take,'reason':data.get('reason') or 'Dispensed'
                })
                remaining -= take
        return ok({'message':'Stock removed successfully.'})
    except Exception as exc:
        return fail(str(exc), 400)


@app.get('/api/pharmacy/alerts')
@auth_required({'admin','pharmacy'})
def pharmacy_alerts():
    medicines = get_medicines()
    threshold = int(load_settings().get('lowStockThreshold', 30))
    today = date.today()
    low = [m for m in medicines if 0 < int(m['quantity'] or 0) <= threshold]
    out = [m for m in medicines if int(m['quantity'] or 0) == 0]
    expired = [m for m in medicines if m['expiry_date'] and m['expiry_date'] < today]
    expiring = [m for m in medicines if m['expiry_date'] and today <= m['expiry_date'] <= today + timedelta(days=60)]
    return ok({'low_stock':low,'out_of_stock':out,'expired':expired,'expiring':expiring})


# ---------------- Instrument transactions ----------------
@app.post('/api/instruments/issue')
@auth_required({'admin','instrument'})
def instrument_issue():
    data = request.get_json(silent=True) or {}
    try:
        instrument_id = int(data['instrument_id'])
        with transaction() as (_, cur):
            cur.execute('SELECT available_qty FROM INSTRUMENT WHERE instrument_id=:id FOR UPDATE', {'id':instrument_id})
            row = cur.fetchone()
            if not row: raise ValueError('Instrument not found.')
            available = int(row[0] or 0)
            if available < 1: raise ValueError('No units are available.')
            out = cur.var(int)
            cur.execute('''INSERT INTO INSTRUMENT_ISSUE(instrument_id,issued_to,department,issue_date,expected_return,status)
                           VALUES(:iid,:to,:dept,:issue,:expected,'Issued') RETURNING issue_id INTO :outid''', {
                'iid':instrument_id,'to':data.get('issued_to'),'dept':data.get('department') or None,
                'issue':parse_date(data.get('issue_date')) or date.today(),
                'expected':parse_date(data.get('expected_return')),'outid':out
            })
            issue_id = int(out.getvalue()[0])
            cur.execute('UPDATE INSTRUMENT SET available_qty=available_qty-1 WHERE instrument_id=:id', {'id':instrument_id})
        return ok({'issue_id':issue_id}, 201)
    except Exception as exc:
        return fail(str(exc), 400)


@app.post('/api/instruments/return')
@auth_required({'admin','instrument'})
def instrument_return():
    data = request.get_json(silent=True) or {}
    try:
        issue_id = int(data['issue_id']); condition = data.get('condition_after') or 'Good'
        with transaction() as (_, cur):
            cur.execute('SELECT instrument_id,status FROM INSTRUMENT_ISSUE WHERE issue_id=:id FOR UPDATE', {'id':issue_id})
            row = cur.fetchone()
            if not row: raise ValueError('Issue record not found.')
            if str(row[1]) == 'Returned': raise ValueError('This instrument has already been returned.')
            instrument_id = int(row[0])
            cur.execute('''INSERT INTO INSTRUMENT_RETURN(issue_id,return_date,condition_after,remarks)
                           VALUES(:iid,:dt,:cond,:remarks)''', {
                'iid':issue_id,'dt':parse_date(data.get('return_date')) or date.today(),
                'cond':condition,'remarks':data.get('remarks') or None
            })
            cur.execute('UPDATE INSTRUMENT_ISSUE SET return_date=:dt,status=\'Returned\' WHERE issue_id=:iid', {'dt':parse_date(data.get('return_date')) or date.today(),'iid':issue_id})
            if condition == 'Good':
                cur.execute('UPDATE INSTRUMENT SET available_qty=available_qty+1, condition_status=\'Good\' WHERE instrument_id=:id', {'id':instrument_id})
            else:
                cur.execute('UPDATE INSTRUMENT SET available_qty=available_qty+1, condition_status=:cond WHERE instrument_id=:id', {'id':instrument_id,'cond':condition})
        return ok({'message':'Instrument return recorded.'})
    except Exception as exc:
        return fail(str(exc), 400)


# ---------------- Settings / admin ----------------
@app.get('/api/settings')
@auth_required({'admin'})
def get_settings():
    return ok({'settings': load_settings()})


@app.put('/api/settings')
@auth_required({'admin'})
def update_settings():
    settings = load_settings()
    body = request.get_json(silent=True) or {}
    for key in ('hospitalName','timezone','dateFormat','currency','lowStockThreshold'):
        if key in body:
            settings[key] = body[key]
    save_settings(settings)
    return ok({'settings': settings})


@app.get('/api/admin/dashboard')
@auth_required({'admin'})
def admin_dashboard():
    medicines = get_medicines(); instruments = get_instruments(); users = get_users()
    threshold = int(load_settings().get('lowStockThreshold', 30))
    return ok({'stats': {
        'active_users': sum(1 for u in users if str(u['status']).lower() == 'active'),
        'total_users': len(users), 'doctors': len(get_doctors()),
        'patients': len(get_patients()), 'appointments': len(get_appointments()),
        'consultations': len(get_consultations()), 'medicines': len(medicines),
        'instruments': len(instruments),
        'low_stock': sum(1 for m in medicines if 0 < int(m['quantity'] or 0) <= threshold),
        'out_of_stock': sum(1 for m in medicines if int(m['quantity'] or 0) == 0),
        'instrument_attention': sum(1 for i in instruments if i['condition_status'] != 'Good'),
    }})


# ---------------- Health/basic routes ----------------
@app.get('/api/health')
def health():
    try:
        r = one('SELECT 1 AS value FROM DUAL')
        return ok({'message':'Backend and Oracle are connected.', 'oracle': r['value'] == 1})
    except Exception as exc:
        return fail(f'Oracle connection failed: {exc}', 500)


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def frontend(path):
    # API routes are handled above. Everything else serves the existing frontend.
    if path.startswith('api/'):
        return fail('API endpoint not found.', 404)
    target = os.path.join(config.FRONTEND_DIR, path)
    if path and os.path.isfile(target):
        return send_from_directory(config.FRONTEND_DIR, path)
    return send_from_directory(config.FRONTEND_DIR, 'index.html')


@app.errorhandler(Exception)
def unhandled(exc):
    app.logger.exception('Unhandled error')
    return fail(str(exc), 500)


if __name__ == '__main__':
    print('MediCore backend running at http://127.0.0.1:5000')
    app.run(host='127.0.0.1', port=5000, debug=True)
