import os
import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, Optional

# Path to the database file - resolved absolutely
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = (PROJECT_ROOT / "data" / "patients.db").resolve()
_env_path = os.environ.get("DATABASE_PATH")
if _env_path:
    _p = Path(_env_path)
    DB_PATH = _p.resolve() if _p.is_absolute() else (PROJECT_ROOT / _p).resolve()
else:
    DB_PATH = DEFAULT_DB_PATH


def get_connection() -> sqlite3.Connection:
    """Creates a connection to the SQLite database with row factory enabled."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initializes the database schema and performs migrations if needed."""
    conn = get_connection()
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS patients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    full_name TEXT NOT NULL,
                    dob TEXT NOT NULL,
                    gender TEXT NOT NULL DEFAULT 'Not specified',
                    email TEXT UNIQUE NOT NULL,
                    mobile TEXT NOT NULL,
                    medical_conditions TEXT NOT NULL DEFAULT 'None',
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active'
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_patients_mobile ON patients(mobile);
                """
            )

            # Migration for existing databases
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(patients)")
            cols = {row["name"] if isinstance(row, sqlite3.Row) else row[1] for row in cursor.fetchall()}
            if "gender" not in cols:
                conn.execute("ALTER TABLE patients ADD COLUMN gender TEXT NOT NULL DEFAULT 'Not specified'")
            if "medical_conditions" not in cols:
                conn.execute("ALTER TABLE patients ADD COLUMN medical_conditions TEXT NOT NULL DEFAULT 'None'")
    finally:
        conn.close()


def get_patient_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Retrieves patient record by normalized lowercase trimmed email."""
    init_db()
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, full_name, dob, gender, email, mobile, medical_conditions, password_hash, created_at, status
            FROM patients
            WHERE lower(trim(email)) = lower(trim(?))
            LIMIT 1;
            """,
            (email.strip(),),
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()


def get_patient_by_id(patient_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves patient record by unique ID."""
    init_db()
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, full_name, dob, gender, email, mobile, medical_conditions, password_hash, created_at, status
            FROM patients
            WHERE id = ?
            LIMIT 1;
            """,
            (patient_id,),
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()


def create_patient(
    full_name: str,
    dob: str,
    email: str,
    mobile: str,
    password_hash: str,
    created_at: str,
    gender: str = "Not specified",
    medical_conditions: str = "None",
) -> Dict[str, Any]:
    """Inserts a new patient record and returns the patient dictionary."""
    init_db()
    conn = get_connection()
    try:
        clean_gender = gender.strip() if gender and gender.strip() else "Not specified"
        clean_conditions = medical_conditions.strip() if medical_conditions and medical_conditions.strip() else "None"
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO patients (full_name, dob, gender, email, mobile, medical_conditions, password_hash, created_at, status)
                VALUES (?, ?, ?, lower(trim(?)), ?, ?, ?, ?, 'active');
                """,
                (
                    full_name.strip(),
                    dob.strip(),
                    clean_gender,
                    email.strip(),
                    mobile.strip(),
                    clean_conditions,
                    password_hash,
                    created_at,
                ),
            )
            patient_id = cursor.lastrowid

        return {
            "id": patient_id,
            "full_name": full_name.strip(),
            "dob": dob.strip(),
            "gender": clean_gender,
            "email": email.strip().lower(),
            "mobile": mobile.strip(),
            "medical_conditions": clean_conditions,
            "created_at": created_at,
            "status": "active",
        }
    finally:
        conn.close()


def update_patient_profile(
    patient_id: int,
    full_name: str,
    gender: str,
    dob: str,
    mobile: str,
    medical_conditions: str,
) -> Optional[Dict[str, Any]]:
    """Updates the patient profile and medical conditions."""
    init_db()
    conn = get_connection()
    try:
        clean_gender = gender.strip() if gender and gender.strip() else "Not specified"
        clean_conditions = medical_conditions.strip() if medical_conditions and medical_conditions.strip() else "None"
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE patients
                SET full_name = ?, gender = ?, dob = ?, mobile = ?, medical_conditions = ?
                WHERE id = ? AND status = 'active';
                """,
                (
                    full_name.strip(),
                    clean_gender,
                    dob.strip(),
                    mobile.strip(),
                    clean_conditions,
                    patient_id,
                ),
            )
            if cursor.rowcount == 0:
                return None
        return get_patient_by_id(patient_id)
    finally:
        conn.close()


def update_patient_password(patient_id: int, new_password_hash: str) -> bool:
    """Updates the patient's password hash in the database."""
    init_db()
    conn = get_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE patients
                SET password_hash = ?
                WHERE id = ?;
                """,
                (new_password_hash, patient_id),
            )
            return cursor.rowcount > 0
    finally:
        conn.close()


def get_patient_by_mobile(mobile: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves patient record by matching mobile number, normalizing formatting.
    """
    init_db()
    cleaned = re.sub(r"[\s\-\(\)]", "", mobile.strip())
    digits_only = re.sub(r"\D", "", cleaned)
    if not digits_only or len(digits_only) < 10:
        return None

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, full_name, dob, gender, email, mobile, medical_conditions, password_hash, created_at, status
            FROM patients
            WHERE (mobile = ? OR mobile = ?) AND status = 'active'
            LIMIT 1;
            """,
            (
                cleaned,
                f"+{cleaned}" if not cleaned.startswith("+") else cleaned.lstrip("+"),
            ),
        )
        row = cursor.fetchone()
        if row:
            return dict(row)

        cursor.execute(
            """
            SELECT id, full_name, dob, gender, email, mobile, medical_conditions, password_hash, created_at, status
            FROM patients
            WHERE status = 'active';
            """
        )
        for r in cursor.fetchall():
            db_digits = re.sub(r"\D", "", r["mobile"])
            if db_digits == digits_only or (
                len(digits_only) >= 10
                and len(db_digits) >= 10
                and digits_only[-10:] == db_digits[-10:]
            ):
                return dict(r)

        return None
    finally:
        conn.close()
        
def save_prediction_history(
    patient_id: int,
    symptoms: list,
    predicted_condition: Optional[str],
    model_confidence: Any,
    result_json: Dict[str, Any],
) -> int:
    """Saves a prediction result for the logged-in patient."""
    import json
    from datetime import datetime, timezone

    conn = get_connection()
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS prediction_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id INTEGER NOT NULL,
                    symptoms TEXT NOT NULL,
                    predicted_condition TEXT,
                    model_confidence REAL,
                    result_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (patient_id) REFERENCES patients(id)
                );
                """
            )

            cursor = conn.execute(
                """
                INSERT INTO prediction_history (
                    patient_id,
                    symptoms,
                    predicted_condition,
                    model_confidence,
                    result_json,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?);
                """,
                (
                    patient_id,
                    json.dumps(symptoms),
                    predicted_condition,
                    model_confidence,
                    json.dumps(result_json, default=str),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            return cursor.lastrowid
    finally:
        conn.close()
