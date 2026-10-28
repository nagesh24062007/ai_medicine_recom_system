from disease_prediction import predict_disease
from medicine_pipeline import get_medicine_with_safety
from input_validation import validate_symptoms

UNRELIABLE_MESSAGE = (
    "Unable to provide a reliable prediction from the selected symptoms. "
    "Please consult a qualified healthcare professional."
)


def run_healthcare_pipeline(symptoms):
    """
    Academic healthcare decision-support pipeline.

    Flow:
        Symptoms
            ↓
        Input Validation
            ↓
        Minimum Symptoms Check (>= 3 distinct symptoms)
            ↓
        Disease Prediction + Confidence + XAI Explanation
            ↓
        Uncertainty Safeguard (Confidence >= 50%)
            ↓
        Medicine Information Retrieval + Safety Layer

    This system does not diagnose diseases or prescribe medicines.
    Medicine information is retrieved only when the prediction passes
    the configured provisional safeguards.
    """

    # STEP 1: Validate the supplied symptoms
    validation_result = validate_symptoms(symptoms)

    if not validation_result["valid"]:
        return {
            "input_symptoms": symptoms,
            "validation": validation_result,
            "prediction_status": "invalid_input",
            "message": validation_result["message"],
            "predicted_condition": None,
            "model_confidence": None,
            "xai_explanation": None,
            "medicine_information": None,
        }

    valid_symptoms = validation_result["valid_symptoms"]

    # Avoid repeated symptoms
    valid_symptoms = list(dict.fromkeys(valid_symptoms))

    # STEP 2: Minimum symptoms safeguard (require at least 3 distinct valid symptoms)
    if len(valid_symptoms) < 3:
        return {
            "input_symptoms": symptoms,
            "validation": validation_result,
            "prediction_status": "insufficient_input",
            "message": (
                "Unable to provide a reliable prediction from fewer than 3 symptoms. "
                "Please select at least 3 distinct symptoms for evaluation, "
                "or consult a qualified healthcare professional."
            ),
            "predicted_condition": None,
            "model_confidence": None,
            "xai_explanation": None,
            "medicine_information": None,
        }

    # STEP 3: Predict a condition with Logistic Regression and calculate XAI feature weights
    prediction_result = predict_disease(valid_symptoms)

    predicted_condition = prediction_result["condition"]
    confidence = float(prediction_result["confidence"])
    explanation = prediction_result.get("explanation")

    # STEP 4: Provisional uncertainty safeguard (confidence >= 0.50)
    if confidence < 0.50:
        return {
            "input_symptoms": symptoms,
            "validation": validation_result,
            "prediction_status": "uncertain",
            "message": (
                f"Model confidence ({confidence * 100:.1f}%) is below the provisional safety threshold (50%). "
                "Prediction and medicine recommendations are withheld for safety. "
                "Please consult a qualified healthcare professional."
            ),
            "predicted_condition": None,
            "model_confidence": confidence,
            "xai_explanation": explanation,
            "medicine_information": None,
        }

    # STEP 5: Retrieve medicine information only after safeguards pass
    medicine_result = get_medicine_with_safety(
        predicted_condition,
        max_results=3,
    )

    return {
        "input_symptoms": symptoms,
        "validation": validation_result,
        "prediction_status": "model_output_available",
        "message": (
            "This is an experimental model output, not a diagnosis. "
            "Do not use it to select or take medicines. Consult a "
            "qualified healthcare professional."
        ),
        "predicted_condition": predicted_condition,
        "model_confidence": confidence,
        "xai_explanation": explanation,
        "medicine_information": medicine_result,
    }
