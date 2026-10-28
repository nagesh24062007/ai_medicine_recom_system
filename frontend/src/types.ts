export interface XAIContribution {
  symptom: string
  contribution: number
}

export interface XAIExplanation {
  positive_contributions: XAIContribution[]
  negative_contributions: XAIContribution[]
}

export interface MedicineDetails {
  name: string
  uses: string
  composition: string
  side_effects: string
  how_to_use: string
  alcohol: string
  pregnancy: string
  breast_feeding: string
  driving: string
  kidney: string
  liver: string
  manufacturer: string
}

export interface SafetyCheck {
  safety_available: boolean
  safety_information: {
    alcohol?: string
    pregnancy?: string
    breast_feeding?: string
    driving?: string
    kidney?: string
    liver?: string
    [key: string]: string | undefined
  }
  warnings: string[]
}

export interface MedicineRecord {
  medicine_information: MedicineDetails
  safety: SafetyCheck
}

export interface MedicineInformationResponse {
  condition: string
  match_found: boolean
  medicines: MedicineRecord[]
}

export interface PredictionSuccessResponse {
  input_symptoms: string[]
  prediction_status?: "model_output_available" | "insufficient_input" | "uncertain" | "emergency_warning" | string
  message?: string
  predicted_condition: string | null
  model_confidence: number | null
  xai_explanation: XAIExplanation | null
  medicine_information: MedicineInformationResponse | null
  disclaimer: string
}

export interface ApiValidationErrorDetail {
  message: string
  invalid_symptoms: string[]
  validation?: {
    valid: boolean
    message: string
    valid_symptoms: string[]
    invalid_symptoms: string[]
  }
}

export type ApiErrorType = "validation" | "connection" | "server" | "client"

export interface ApiError {
  type: ApiErrorType
  message: string
  invalidSymptoms?: string[]
  statusCode?: number
}

// -------------------------------------------------------------
// PATIENT AUTHENTICATION & NOTIFICATION TYPES
// -------------------------------------------------------------

export interface PatientUser {
  id: number
  full_name: string
  gender?: string
  email: string
  dob: string
  mobile: string
  age: number
  medical_conditions?: string
  created_at: string
  status: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  patient: PatientUser
}

export interface RegisterPayload {
  full_name: string
  gender: string
  dob: string
  mobile: string
  email: string
  medical_conditions: string
  password: string
  confirm_password: string
}

export interface UpdateProfilePayload {
  full_name: string
  gender: string
  dob: string
  mobile: string
  medical_conditions: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface ResetPasswordPayload {
  email: string
  dob: string
  new_password: string
  confirm_password: string
}

export interface NotificationItem {
  id: string
  title: string
  message: string
  timestamp: string
  isRead: boolean
  type: "system" | "guidance" | "security"
}
