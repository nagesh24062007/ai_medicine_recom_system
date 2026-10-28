import type {
  ApiError,
  ApiValidationErrorDetail,
  AuthResponse,
  LoginPayload,
  PatientUser,
  PredictionSuccessResponse,
  RegisterPayload,
  UpdateProfilePayload,
  ResetPasswordPayload,
} from "./types"

const rawBase = import.meta.env.VITE_API_URL as string | undefined || "/api"
export const API_BASE = rawBase.replace(/\/+$/, "")
const REQUEST_TIMEOUT_MS = 10000

export const TOKEN_STORAGE_KEY = "ai_med_auth_token"
export const USER_STORAGE_KEY = "ai_med_user_profile"

// -------------------------------------------------------------
// TOKEN & USER SESSION HELPERS
// -------------------------------------------------------------

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAuthSession(token: string, user: PatientUser): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  } catch {
    // LocalStorage quota or access error handling
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
  } catch {
    // Ignore storage errors on cleanup
  }
}

export function getStoredUser(): PatientUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PatientUser
  } catch {
    return null
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return headers
}

// -------------------------------------------------------------
// AUTHENTICATION API SERVICES
// -------------------------------------------------------------

export async function registerPatient(
  payload: RegisterPayload,
  UpdateProfilePayload,
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data?.detail && typeof data.detail === "string"
        ? data.detail
        : data?.detail?.[0]?.msg ||
          "Registration failed. Please check your inputs."
    const error: ApiError = {
      type: "client",
      statusCode: response.status,
      message,
    }
    throw error
  }

  const authData = data as AuthResponse
  setAuthSession(authData.access_token, authData.patient)
  return authData
}

export async function loginPatient(
  payload: LoginPayload,
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    let message = "Invalid email or password. Please try again."
    if (data?.detail) {
      if (typeof data.detail === "string") {
        message = data.detail
      } else if (Array.isArray(data.detail) && data.detail.length > 0) {
        message = data.detail.map((err: any) => err.msg || err.message).join("; ")
      }
    } else if (response.status === 401) {
      message = "Invalid email or password. Please check your credentials."
    } else if (response.status === 403) {
      message = "Access restricted: age requirement not met (must be at least 18)."
    } else if (response.status >= 500) {
      message = "Server error during authentication. Please try again in a few moments."
    }
    const error: ApiError = {
      type: "client",
      statusCode: response.status,
      message,
    }
    throw error
  }

  const authData = data as AuthResponse
  setAuthSession(authData.access_token, authData.patient)
  return authData
}

export async function resetPatientPassword(
  payload: ResetPasswordPayload
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data?.detail && typeof data.detail === "string"
        ? data.detail
        : "Password reset failed. Please check your verification details."
    const error: ApiError = {
      type: "client",
      statusCode: response.status,
      message,
    }
    throw error
  }

  return data as { message: string }
}

export async function verifyMobileNumber(
  mobile: string,
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/verify-mobile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ mobile }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data?.detail && typeof data.detail === "string"
        ? data.detail
        : "Verification failed. The mobile number could not be verified."
    const error: ApiError = {
      type: "client",
      statusCode: response.status,
      message,
    }
    throw error
  }

  const authData = data as AuthResponse
  setAuthSession(authData.access_token, authData.patient)
  return authData
}

export async function fetchCurrentUser(): Promise<PatientUser> {
  const token = getAuthToken()
  if (!token) {
    throw {
      type: "client",
      statusCode: 401,
      message: "No active session found.",
    } as ApiError
  }

  const response = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession()
    }
    throw {
      type: "client",
      statusCode: response.status,
      message: "Session expired or invalid.",
    } as ApiError
  }

  const patient = (await response.json()) as PatientUser
  // Update cached profile
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(patient))
  } catch {
    // Ignore storage issues
  }
  return patient
}

export async function logoutPatient(): Promise<void> {
  try {
    const token = getAuthToken()
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: getAuthHeaders(),
      }).catch(() => {
        // Ignore network failure on logout
      })
    }
  } finally {
    clearAuthSession()
  }
}

// -------------------------------------------------------------
// PREDICTION & SYMPTOM ANALYSIS SERVICE
// -------------------------------------------------------------

export async function predictSymptoms(
  symptoms: string[],
): Promise<PredictionSuccessResponse> {
  if (!symptoms || symptoms.length === 0) {
    const error: ApiError = {
      type: "validation",
      message:
        "Please select at least one symptom before running the analysis.",
      invalidSymptoms: [],
    }
    throw error
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ symptoms }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = (await response.json()) as PredictionSuccessResponse
      return data
    }

    if (response.status === 401) {
      clearAuthSession()
      const error: ApiError = {
        type: "client",
        statusCode: 401,
        message: "Your session has expired. Please log in again to continue.",
      }
      throw error
    }

    if (response.status === 422) {
      let detail: ApiValidationErrorDetail | undefined
      try {
        const errorJson = await response.json()
        detail = errorJson.detail
      } catch {
        // Fallback if response is not JSON
      }

      const error: ApiError = {
        type: "validation",
        statusCode: 422,
        message:
          detail?.message ||
          "Some symptoms were not recognized by the machine learning model.",
        invalidSymptoms: detail?.invalid_symptoms || [],
      }
      throw error
    }

    // Other HTTP errors (500, 502, 404, etc.)
    let errorMessage = `Server returned status ${response.status} (${response.statusText}).`
    try {
      const errorJson = await response.json()
      if (errorJson.detail && typeof errorJson.detail === "string") {
        errorMessage = errorJson.detail
      }
    } catch {
      // Keep default message
    }

    const error: ApiError = {
      type: "server",
      statusCode: response.status,
      message: errorMessage,
    }
    throw error
  } catch (err: unknown) {
    clearTimeout(timeoutId)

    // If it's already an ApiError, rethrow
    if (err && typeof err === "object" && "type" in err && "message" in err) {
      throw err as ApiError
    }

    if (err instanceof DOMException && err.name === "AbortError") {
      const error: ApiError = {
        type: "connection",
        message:
          "Request timed out after 10 seconds. The backend server might be busy or unreachable.",
      }
      throw error
    }

    const error: ApiError = {
      type: "connection",
      message:
        "Unable to connect to the prediction backend service. Ensure the FastAPI server is running.",
    }
    throw error
  }
}

export async function updatePatientProfile(
  payload: UpdateProfilePayload,
): Promise<PatientUser> {
  const response = await fetch(`${API_BASE}/auth/profile`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    let message = "Failed to update profile information."
    if (data?.detail) {
      if (typeof data.detail === "string") {
        message = data.detail
      } else if (Array.isArray(data.detail) && data.detail.length > 0) {
        message = data.detail.map((err: any) => err.msg || err.message).join("; ")
      }
    }
    const error: ApiError = {
      type: "client",
      statusCode: response.status,
      message,
    }
    throw error
  }

  const updatedPatient = data as PatientUser
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedPatient))
  } catch {
    // Ignore storage issues
  }
  return updatedPatient
}
