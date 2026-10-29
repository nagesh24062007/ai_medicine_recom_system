from contextlib import asynccontextmanager
from datetime import datetime
import os
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from disease_medicine_pipeline import run_healthcare_pipeline

from database import (
    init_db,
    get_patient_by_email,
    get_patient_by_id,
    get_patient_by_mobile,
    create_patient,
    update_patient_profile,
    update_patient_password,
    save_prediction_history,
)

from auth import (
    hash_password,
    verify_password,
    validate_age_eligibility,
    validate_mobile,
    calculate_age,
    parse_dob,
    create_access_token,
    decode_access_token,
)

EMAIL_REGEX = r"^[\w\.\+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z0-9\-\.]+$"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_PATH = PROJECT_ROOT / "src"
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

sys.path.insert(0, str(SRC_PATH))

from disease_medicine_pipeline import run_healthcare_pipeline
from database import (
    init_db,
    get_patient_by_email,
    get_patient_by_id,
    get_patient_by_mobile,
    create_patient,
    update_patient_profile,
    update_patient_password,
)
from auth import (
    hash_password,
    verify_password,
    validate_age_eligibility,
    validate_mobile,
    calculate_age,
    parse_dob,
    create_access_token,
    decode_access_token,
)


def check_emergency_symptoms(symptoms: List[str]) -> Optional[str]:
    """
    Checks for high-risk emergency symptoms pattern.
    If detected, an emergency advisory is returned immediately.
    """
    normalized = {symptom.strip().lower() for symptom in symptoms}
    emergency_patterns = [
        {"chest_pain", "breathlessness", "sweating"}
    ]

    for pattern in emergency_patterns:
        if pattern.issubset(normalized):
            return (
                "Potential emergency symptoms detected. "
                "Seek emergency medical care immediately. "
                "Do not wait for an AI prediction."
            )

    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize persistent patient database on application startup
    init_db()
    yield


app = FastAPI(
    title="AI Medicine Information System",
    description=(
        "Academic healthcare decision-support system. "
        "Provides model-based results and medicine information, "
        "not a medical diagnosis or prescription."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
origins_env = os.environ.get("CORS_ORIGINS", "")
allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()


# -------------------------------------------------------------
# PYDANTIC SCHEMAS
# -------------------------------------------------------------

class SymptomRequest(BaseModel):
    symptoms: List[str] = Field(
        min_length=1,
        description="List of symptoms to evaluate",
        examples=[["itching", "skin_rash", "nodal_skin_eruptions"]],
    )


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100, description="Patient full name")
    gender: str = Field(default="Not specified", max_length=50, description="Patient gender")
    dob: str = Field(description="Date of birth in YYYY-MM-DD format", examples=["1998-05-15"])
    mobile: str = Field(min_length=10, max_length=25, description="Mobile contact number")
    email: str = Field(pattern=EMAIL_REGEX, description="Patient email address")
    medical_conditions: str = Field(default="None", max_length=1000, description="Previous medical conditions")
    password: str = Field(min_length=6, max_length=128, description="Account password")
    confirm_password: str = Field(min_length=6, max_length=128, description="Password confirmation")


class LoginRequest(BaseModel):
    email: str = Field(pattern=EMAIL_REGEX, description="Patient email address")
    password: str = Field(min_length=1, max_length=128, description="Account password")


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100, description="Patient full name")
    gender: str = Field(min_length=1, max_length=50, description="Patient gender")
    dob: str = Field(description="Date of birth in YYYY-MM-DD format", examples=["1998-05-15"])
    mobile: str = Field(min_length=10, max_length=25, description="Mobile contact number")
    medical_conditions: str = Field(default="None", max_length=1000, description="Previous medical conditions")


class ResetPasswordRequest(BaseModel):
    email: str = Field(pattern=EMAIL_REGEX, description="Patient email address")
    dob: str = Field(description="Date of birth in YYYY-MM-DD format for security verification", examples=["1998-05-15"])
    new_password: str = Field(min_length=6, max_length=128, description="New password")
    confirm_password: str = Field(min_length=6, max_length=128, description="Password confirmation")


class VerifyMobileRequest(BaseModel):
    mobile: str = Field(min_length=10, max_length=25, description="Registered mobile number")


class PatientProfile(BaseModel):
    id: int
    full_name: str
    gender: str = "Not specified"
    email: str
    dob: str
    mobile: str
    age: int
    medical_conditions: str = "None"
    created_at: str
    status: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    patient: PatientProfile


# -------------------------------------------------------------
# AUTHENTICATION DEPENDENCY
# -------------------------------------------------------------

def get_current_patient(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """
    Validates Authorization: Bearer <token> header and returns the patient record.
    Strictly isolated: patients can only access their own records.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        patient_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    patient = get_patient_by_id(patient_id)
    if not patient or patient.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Patient account not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return patient


# -------------------------------------------------------------
# HEALTH & AUTH ENDPOINTS
# -------------------------------------------------------------

@router.get("/health")
def health_check():
    return {"status": "ok", "app": "AI Medicine System"}


@router.post("/auth/register", response_model=AuthResponse)
def register(request: RegisterRequest):
    # 1. Password confirmation match
    if request.password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    # 2. Strict DOB and minimum-age validation (must be at least 18)
    is_valid_age, age_err, age = validate_age_eligibility(request.dob)
    if not is_valid_age:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=age_err,
        )

    # 3. Mobile format validation
    is_valid_mobile, cleaned_mobile = validate_mobile(request.mobile)
    if not is_valid_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=cleaned_mobile,
        )

    # 4. Email uniqueness validation
    normalized_email = request.email.strip().lower()
    existing_patient = get_patient_by_email(normalized_email)
    if existing_patient:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    # 5. Mobile uniqueness check
    existing_mobile = get_patient_by_mobile(cleaned_mobile)
    if existing_mobile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this mobile number already exists. Please sign in or use another number.",
        )

    # 6. Secure password hashing using scrypt
    try:
        pwd_hash = hash_password(request.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    # 7. Save patient to persistent SQLite database
    now_iso = datetime.utcnow().isoformat() + "Z"
    try:
        patient = create_patient(
            full_name=request.full_name,
            dob=request.dob,
            email=normalized_email,
            mobile=cleaned_mobile,
            password_hash=pwd_hash,
            created_at=now_iso,
            gender=request.gender,
            medical_conditions=request.medical_conditions,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Registration failed: {str(exc)}",
        )

    # 8. Generate JWT access token
    token = create_access_token(
        patient_id=patient["id"],
        email=patient["email"],
        full_name=patient["full_name"],
    )

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        patient=PatientProfile(
            id=patient["id"],
            full_name=patient["full_name"],
            gender=patient.get("gender") or "Not specified",
            email=patient["email"],
            dob=patient["dob"],
            mobile=patient["mobile"],
            age=age,
            medical_conditions=patient.get("medical_conditions") or "None",
            created_at=patient["created_at"],
            status=patient["status"],
        ),
    )


@router.post("/auth/login", response_model=AuthResponse)
def login(request: LoginRequest):
    normalized_email = request.email.strip().lower()
    patient = get_patient_by_email(normalized_email)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(request.password, patient["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Check minimum age validation on login as well
    try:
        dob = parse_dob(patient["dob"])
        age = calculate_age(dob)
        if age < 18:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted. Account holder must be at least 18 years old (current age: {age}).",
            )
    except ValueError:
        age = 0

    token = create_access_token(
        patient_id=patient["id"],
        email=patient["email"],
        full_name=patient["full_name"],
    )

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        patient=PatientProfile(
            id=patient["id"],
            full_name=patient["full_name"],
            gender=patient.get("gender") or "Not specified",
            email=patient["email"],
            dob=patient["dob"],
            mobile=patient["mobile"],
            age=age,
            medical_conditions=patient.get("medical_conditions") or "None",
            created_at=patient["created_at"],
            status=patient["status"],
        ),
    )


@router.get("/auth/me", response_model=PatientProfile)
def get_me(current_patient: Dict[str, Any] = Depends(get_current_patient)):
    try:
        dob = parse_dob(current_patient["dob"])
        age = calculate_age(dob)
    except Exception:
        age = 0

    return PatientProfile(
        id=current_patient["id"],
        full_name=current_patient["full_name"],
        gender=current_patient.get("gender") or "Not specified",
        email=current_patient["email"],
        dob=current_patient["dob"],
        mobile=current_patient["mobile"],
        age=age,
        medical_conditions=current_patient.get("medical_conditions") or "None",
        created_at=current_patient["created_at"],
        status=current_patient["status"],
    )


@router.put("/auth/profile", response_model=PatientProfile)
def update_profile(
    request: UpdateProfileRequest,
    current_patient: Dict[str, Any] = Depends(get_current_patient),
):
    """
    Updates the authenticated patient's profile and medical history.
    Strictly isolated: patients can only update their own record.
    """
    # 1. Validate age eligibility
    is_valid_age, age_err, age = validate_age_eligibility(request.dob)
    if not is_valid_age:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=age_err,
        )

    # 2. Validate mobile
    is_valid_mobile, cleaned_mobile = validate_mobile(request.mobile)
    if not is_valid_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=cleaned_mobile,
        )

    # 3. Update database
    updated = update_patient_profile(
        patient_id=current_patient["id"],
        full_name=request.full_name,
        gender=request.gender,
        dob=request.dob,
        mobile=cleaned_mobile,
        medical_conditions=request.medical_conditions,
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile record.",
        )

    return PatientProfile(
        id=updated["id"],
        full_name=updated["full_name"],
        gender=updated.get("gender") or "Not specified",
        email=updated["email"],
        dob=updated["dob"],
        mobile=updated["mobile"],
        age=age,
        medical_conditions=updated.get("medical_conditions") or "None",
        created_at=updated["created_at"],
        status=updated["status"],
    )


@router.post("/auth/logout")
def logout(_current_patient: Dict[str, Any] = Depends(get_current_patient)):
    """
    Client-side session invalidation acknowledgment.
    """
    return {"message": "Logged out successfully."}


@router.post("/auth/reset-password")
def reset_password(request: ResetPasswordRequest):
    """
    Secure password reset using registered email and Date of Birth verification.
    """
    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation password do not match.",
        )

    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long.",
        )

    normalized_email = request.email.strip().lower()
    patient = get_patient_by_email(normalized_email)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification failed. The email address and date of birth do not match our records.",
        )

    if patient["dob"].strip() != request.dob.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification failed. The email address and date of birth do not match our records.",
        )

    pwd_hash = hash_password(request.new_password)
    updated = update_patient_password(patient["id"], pwd_hash)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update password. Please try again.",
        )

    return {"message": "Password updated successfully. You can now log in with your new password."}


@router.post("/auth/verify-mobile", response_model=AuthResponse)
def verify_mobile_login(request: VerifyMobileRequest):
    """
    Verifies the mobile number against registered patient records.
    If verified, returns authentication session token to access the dashboard.
    """
    is_valid_format, cleaned_mobile = validate_mobile(request.mobile)
    if not is_valid_format:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid mobile number containing 10 to 15 digits.",
        )

    patient = get_patient_by_mobile(cleaned_mobile)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification failed. The mobile number could not be verified with our records.",
        )

    try:
        dob = parse_dob(patient["dob"])
        age = calculate_age(dob)
        if age < 18:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted. Account holder must be at least 18 years old (current age: {age}).",
            )
    except ValueError:
        age = 0

    token = create_access_token(
        patient_id=patient["id"],
        email=patient["email"],
        full_name=patient["full_name"],
    )

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        patient=PatientProfile(
            id=patient["id"],
            full_name=patient["full_name"],
            gender=patient.get("gender") or "Not specified",
            email=patient["email"],
            dob=patient["dob"],
            mobile=patient["mobile"],
            age=age,
            medical_conditions=patient.get("medical_conditions") or "None",
            created_at=patient["created_at"],
            status=patient["status"],
        ),
    )


# -------------------------------------------------------------
# PROTECTED PREDICTION ENDPOINTS
# -------------------------------------------------------------

@router.post("/validate-symptoms")
def validate_symptom_input(
    request: SymptomRequest,
    _current_patient: Dict[str, Any] = Depends(get_current_patient),
):
    result = run_healthcare_pipeline(request.symptoms)
    return {"validation_result": result["validation"]}


@router.post("/predict")
def predict(
    request: SymptomRequest,
    _current_patient: Dict[str, Any] = Depends(get_current_patient),
):
    try:
        # Step 1: Check for emergency symptoms
        emergency_warning = check_emergency_symptoms(request.symptoms)

        if emergency_warning:
            return {
                "input_symptoms": request.symptoms,
                "prediction_status": "emergency_warning",
                "message": emergency_warning,
                "predicted_condition": None,
                "model_confidence": None,
                "xai_explanation": None,
                "medicine_information": None,
                "disclaimer": (
                    "Potential emergency symptoms detected. "
                    "Do not wait for an AI prediction. "
                    "Seek emergency medical care immediately."
                ),
            }

        # Step 2: Run prediction pipeline
        result = run_healthcare_pipeline(request.symptoms)

        # Step 3: Reject invalid symptoms
        if not result["validation"]["valid"]:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": result["validation"]["message"],
                    "invalid_symptoms": result["validation"]["invalid_symptoms"],
                    "validation": result["validation"],
                },
            )

        # Step 4: Prepare response
        response_data = {
            "input_symptoms": result["input_symptoms"],
            "prediction_status": result.get(
                "prediction_status",
                "model_output_available",
            ),
            "message": result.get(
                "message",
                "Model evaluation completed.",
            ),
            "predicted_condition": result.get("predicted_condition"),
            "model_confidence": result.get("model_confidence"),
            "xai_explanation": result.get("xai_explanation"),
            "medicine_information": result.get("medicine_information"),
            "disclaimer": (
                "Academic decision-support only. "
                "This is not a diagnosis or prescription. "
                "Do not use this output to select or take medicines. "
                "Consult a qualified healthcare professional."
            ),
        }

        # Step 5: Save prediction in database
        save_prediction_history(
            patient_id=int(_current_patient["id"]),
            symptoms=request.symptoms,
            predicted_condition=response_data["predicted_condition"],
            model_confidence=response_data["model_confidence"],
            result_json=response_data,
        )

        # Step 6: Return response
        return response_data

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(exc)}",
        ) from exc

# Include routers for both direct paths and /api prefixed paths
app.include_router(router)
app.include_router(router, prefix="/api", include_in_schema=False)


# -------------------------------------------------------------
# REACT FRONTEND SERVING (Production)
# -------------------------------------------------------------

if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not found")

        requested = (FRONTEND_DIST / full_path).resolve()
        if (
            full_path
            and requested.is_file()
            and requested.is_relative_to(FRONTEND_DIST.resolve())
        ):
            return FileResponse(requested)

        return FileResponse(FRONTEND_DIST / "index.html")

else:

    @app.get("/")
    def home():
        return {
            "message": "AI Medicine Information API is running",
            "docs": "/docs",
        }
