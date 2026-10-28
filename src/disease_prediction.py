from pathlib import Path
import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

# ============================================================
# LOAD SAVED DISEASE MODEL
# ============================================================

model = joblib.load(
    MODELS_DIR / "disease_logistic_regression.pkl"
)

encoder = joblib.load(
    MODELS_DIR / "disease_label_encoder.pkl"
)

features = joblib.load(
    MODELS_DIR / "disease_feature_names.pkl"
)


# ============================================================
# DISEASE PREDICTION FUNCTION
# ============================================================

def predict_disease(symptoms):
    """
    Predict a condition from a list of symptoms
    and provide a model-level XAI explanation.

    Returns:
        condition:
            Predicted condition name.

        confidence:
            Model probability estimate.

        explanation:
            Positive and negative symptom contributions.

    Note:
        Confidence is the model's probability estimate.
        It is NOT a medical diagnosis or certainty.

        XAI contributions explain the model prediction.
        They do NOT prove medical causation or diagnosis.
    """

    # --------------------------------------------------------
    # STEP 1: CREATE INPUT DATA
    # --------------------------------------------------------
    # Initially, all 132 symptoms are set to 0.

    input_data = pd.DataFrame(
        0,
        index=[0],
        columns=features
    )

    # --------------------------------------------------------
    # STEP 2: ACTIVATE USER SYMPTOMS
    # --------------------------------------------------------
    # Symptoms provided by the user are changed from 0 to 1.

    for symptom in symptoms:

        if symptom in input_data.columns:

            input_data.loc[0, symptom] = 1

    # --------------------------------------------------------
    # STEP 3: MAKE DISEASE PREDICTION
    # --------------------------------------------------------

    prediction = model.predict(
        input_data
    )

    # --------------------------------------------------------
    # STEP 4: CONVERT ENCODED VALUE
    # TO ORIGINAL CONDITION NAME
    # --------------------------------------------------------

    condition = encoder.inverse_transform(
        prediction
    )[0]

    # --------------------------------------------------------
    # STEP 5: GET MODEL PROBABILITIES
    # --------------------------------------------------------

    probabilities = model.predict_proba(
        input_data
    )[0]

    # --------------------------------------------------------
    # STEP 6: FIND PREDICTED CLASS INDEX
    # --------------------------------------------------------
    # model.classes_ contains the encoded class values.

    predicted_class = prediction[0]

    class_index = list(
        model.classes_
    ).index(
        predicted_class
    )

    # --------------------------------------------------------
    # GET CONFIDENCE / PROBABILITY
    # --------------------------------------------------------

    confidence = probabilities[
        class_index
    ]

    # ========================================================
    # XAI SECTION
    # ========================================================

    # --------------------------------------------------------
    # STEP 7: GET MODEL COEFFICIENTS
    # --------------------------------------------------------
    # Each disease class has coefficients for the
    # 132 symptom features.

    coefficients = model.coef_[
        class_index
    ]

    # --------------------------------------------------------
    # STEP 8: CALCULATE SYMPTOM CONTRIBUTIONS
    # --------------------------------------------------------

    contributions = []

    for index, symptom in enumerate(features):

        # Explain only symptoms that the user entered.

        if input_data.loc[0, symptom] == 1:

            contribution = coefficients[index]

            contributions.append(
                {
                    "symptom": symptom,
                    "contribution": float(
                        contribution
                    )
                }
            )

    # --------------------------------------------------------
    # STEP 9: SORT CONTRIBUTIONS
    # --------------------------------------------------------
    # Largest absolute contributions appear first.

    contributions = sorted(
        contributions,
        key=lambda x: abs(
            x["contribution"]
        ),
        reverse=True
    )

    # --------------------------------------------------------
    # STEP 10: SEPARATE POSITIVE CONTRIBUTIONS
    # --------------------------------------------------------

    positive_contributions = [
        item
        for item in contributions
        if item["contribution"] > 0
    ]

    # --------------------------------------------------------
    # STEP 11: SEPARATE NEGATIVE CONTRIBUTIONS
    # --------------------------------------------------------

    negative_contributions = [
        item
        for item in contributions
        if item["contribution"] < 0
    ]

    # ========================================================
    # RETURN COMPLETE RESULT
    # ========================================================

    return {
        "condition": condition,

        "confidence": confidence,

        "explanation": {
            "positive_contributions":
                positive_contributions,

            "negative_contributions":
                negative_contributions
        }
    }


# ============================================================
# TEST THE DISEASE PREDICTION + XAI
# ============================================================

if __name__ == "__main__":

    # --------------------------------------------------------
    # TEST SYMPTOMS
    # --------------------------------------------------------

    test_symptoms = [
        "itching",
        "skin_rash"
    ]

    # --------------------------------------------------------
    # RUN PREDICTION
    # --------------------------------------------------------

    result = predict_disease(
        test_symptoms
    )

    # --------------------------------------------------------
    # HEADER
    # --------------------------------------------------------

    print("=" * 60)

    print(
        "DISEASE PREDICTION + XAI TEST"
    )

    print("=" * 60)

    # --------------------------------------------------------
    # INPUT SYMPTOMS
    # --------------------------------------------------------

    print("\nInput symptoms:")

    for symptom in test_symptoms:

        print(
            "-",
            symptom
        )

    # --------------------------------------------------------
    # PREDICTED CONDITION
    # --------------------------------------------------------

    print("\nPredicted condition:")

    print(
        result["condition"]
    )

    # --------------------------------------------------------
    # MODEL CONFIDENCE
    # --------------------------------------------------------

    print("\nModel confidence:")

    print(
        f"{result['confidence'] * 100:.2f}%"
    )

    # --------------------------------------------------------
    # XAI EXPLANATION
    # --------------------------------------------------------

    print("\nXAI Explanation:")

    # --------------------------------------------------------
    # POSITIVE CONTRIBUTIONS
    # --------------------------------------------------------

    print("\nPositive contributions:")

    positive = result[
        "explanation"
    ]["positive_contributions"]

    if positive:

        for item in positive:

            print(
                f"- {item['symptom']}: "
                f"{item['contribution']:.4f}"
            )

    else:

        print("None")

    # --------------------------------------------------------
    # NEGATIVE CONTRIBUTIONS
    # --------------------------------------------------------

    print("\nNegative contributions:")

    negative = result[
        "explanation"
    ]["negative_contributions"]

    if negative:

        for item in negative:

            print(
                f"- {item['symptom']}: "
                f"{item['contribution']:.4f}"
            )

    else:

        print("None")

    # --------------------------------------------------------
    # FINAL NOTE
    # --------------------------------------------------------

    print("\n" + "=" * 60)

    print(
        "NOTE:"
    )

    print(
        "Model confidence is a probability estimate, "
        "not a medical diagnosis."
    )

    print(
        "XAI contributions explain the model prediction "
        "and do not prove medical causation."
    )

    print("=" * 60)