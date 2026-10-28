from pathlib import Path
import joblib



BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

# --------------------------------------------------
# Load the model feature names
# --------------------------------------------------

features = joblib.load(
    MODELS_DIR / "disease_feature_names.pkl"
)


def validate_symptoms(symptoms):
    """
    Validate symptoms before sending them
    to the disease prediction model.

    Returns:
        Validation result with valid and invalid symptoms.
    """

    # Check whether input is a list
    if not isinstance(symptoms, list):
        return {
            "valid": False,
            "message": "Symptoms must be provided as a list.",
            "valid_symptoms": [],
            "invalid_symptoms": []
        }

    # Check whether the list is empty
    if len(symptoms) == 0:
        return {
            "valid": False,
            "message": "At least one symptom is required.",
            "valid_symptoms": [],
            "invalid_symptoms": []
        }

    valid_symptoms = []
    invalid_symptoms = []

    # Check every symptom
    for symptom in symptoms:

        if not isinstance(symptom, str):
            invalid_symptoms.append(symptom)
            continue

        symptom = symptom.strip()

        if symptom in features:
            valid_symptoms.append(symptom)
        else:
            invalid_symptoms.append(symptom)

    # If there are no valid symptoms
    if len(valid_symptoms) == 0:
        return {
            "valid": False,
            "message": "No valid symptoms were provided.",
            "valid_symptoms": [],
            "invalid_symptoms": invalid_symptoms
        }

    # If some symptoms are invalid
    if len(invalid_symptoms) > 0:
        return {
            "valid": False,
            "message": "Some symptoms are not recognized by the model.",
            "valid_symptoms": valid_symptoms,
            "invalid_symptoms": invalid_symptoms
        }

    # All symptoms are valid
    return {
        "valid": True,
        "message": "All symptoms are valid.",
        "valid_symptoms": valid_symptoms,
        "invalid_symptoms": []
    }


# --------------------------------------------------
# Test the validation function
# --------------------------------------------------

if __name__ == "__main__":

    test_symptoms = [
        "itching",
        "skin_rash",
        "abc_random_symptom"
    ]

    result = validate_symptoms(
        test_symptoms
    )

    print("=" * 60)
    print("SYMPTOM VALIDATION TEST")
    print("=" * 60)

    print("\nInput symptoms:")

    for symptom in test_symptoms:
        print("-", symptom)

    print("\nValidation result:")
    print("Valid:", result["valid"])
    print("Message:", result["message"])

    print("\nValid symptoms:")

    for symptom in result["valid_symptoms"]:
        print("-", symptom)

    print("\nInvalid symptoms:")

    if result["invalid_symptoms"]:
        for symptom in result["invalid_symptoms"]:
            print("-", symptom)
    else:
        print("None")