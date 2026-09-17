"""Run once after configuring .env to create demo login accounts.
Change the passwords before using this outside a classroom/demo environment.
"""
from werkzeug.security import generate_password_hash
from database import transaction

USERS = [
    ('admin', 'admin123', 'admin', 'Hospital Administrator', 'Administration'),
    ('doctor1', 'doctor123', 'doctor', 'Dr. Aarav Sharma', 'Cardiology'),
    ('doctor2', 'doctor123', 'doctor', 'Dr. Meera Nair', 'Orthopedics'),
    ('doctor3', 'doctor123', 'doctor', 'Dr. Kabir Malhotra', 'Neurology'),
    ('pharmacyhead', 'pharma123', 'pharmacy', 'Pharmacy Head', 'Pharmacy'),
    ('instrumenthead', 'instrument123', 'instrument', 'Instrument Head', 'Instrument Management'),
]

DOCTORS = [
    ('doctor1', 'Dr. Aarav Sharma', 'Cardiology'),
    ('doctor2', 'Dr. Meera Nair', 'Orthopedics'),
    ('doctor3', 'Dr. Kabir Malhotra', 'Neurology'),
]


def scalar(cur, sql, params):
    cur.execute(sql, params)
    row = cur.fetchone()
    return row[0] if row else None


with transaction() as (_, cur):
    for username, password, role, name, dept in USERS:
        uid = scalar(cur, 'SELECT user_id FROM APP_USER WHERE LOWER(username)=LOWER(:u)', {'u': username})
        if uid is None:
            cur.execute(
                '''INSERT INTO APP_USER(username, password, role, status)
                   VALUES(:u, :p, :r, 'Active')
                   RETURNING user_id INTO :id''',
                {'u': username, 'p': generate_password_hash(password), 'r': role, 'id': cur.var(int)},
            )
            # RETURNING bind is not read from the dict reliably across driver versions;
            # query the row back by username.
            uid = scalar(cur, 'SELECT user_id FROM APP_USER WHERE LOWER(username)=LOWER(:u)', {'u': username})
        else:
            cur.execute('UPDATE APP_USER SET status=\'Active\', role=:r WHERE user_id=:id', {'r': role, 'id': uid})

        if role == 'doctor':
            did = scalar(cur, 'SELECT doctor_id FROM DOCTOR WHERE user_id=:user_id', {'user_id': uid})
            if did is None:
                cur.execute(
                        '''INSERT INTO DOCTOR(user_id, doctor_name, specialty)
                            VALUES(:p_user_id, :p_name, :p_spec)''',
                            {
                                'p_user_id': uid,
                                'p_name': name,
                                'p_spec': dept
                            },
                        )
        elif role in ('pharmacy', 'instrument'):
            sid = scalar(cur, 'SELECT staff_id FROM STAFF WHERE user_id=:user_id', {'user_id': uid})
            if sid is None:
                cur.execute(
                    '''INSERT INTO STAFF(user_id, staff_name, department)
                       VALUES(:user_id, :name, :dept)''',
                    {'user_id': uid, 'name': name, 'dept': dept},
                )

print('Demo users ready:')
print('admin / admin123')
print('doctor1 / doctor123')
print('doctor2 / doctor123')
print('doctor3 / doctor123')
print('pharmacyhead / pharma123')
print('instrumenthead / instrument123')
