from pathlib import Path
import joblib
import pandas as pd



BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

# ============================================================
# LOAD DISEASE MODEL
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
# EXPLAIN DISEASE PREDICTION
# ============================================================

def explain_prediction(symptoms):
    """
    Explain the model-level contribution of
    input symptoms for the predicted condition.

    Note:
        These contributions explain the model prediction.
        They do not prove medical causation or diagnosis.
    """

    # --------------------------------------------------------
    # CREATE INPUT VECTOR
    # --------------------------------------------------------

    input_data = pd.DataFrame(
        0,
        index=[0],
        columns=features
    )

    # --------------------------------------------------------
    # ACTIVATE INPUT SYMPTOMS
    # --------------------------------------------------------

    for symptom in symptoms:

        if symptom in input_data.columns:

            input_data.loc[0, symptom] = 1

    # --------------------------------------------------------
    # PREDICT CONDITION
    # --------------------------------------------------------

    prediction = model.predict(
        input_data
    )

    predicted_class = prediction[0]

    condition = encoder.inverse_transform(
        prediction
    )[0]

    # --------------------------------------------------------
    # FIND PREDICTED CLASS INDEX
    # --------------------------------------------------------

    class_index = list(
        model.classes_
    ).index(
        predicted_class
    )

    # --------------------------------------------------------
    # GET MODEL COEFFICIENTS
    # --------------------------------------------------------

    coefficients = model.coef_[
        class_index
    ]

    # --------------------------------------------------------
    # CREATE CONTRIBUTION TABLE
    # --------------------------------------------------------

    contribution_data = []

    for index, symptom in enumerate(features):

        if input_data.loc[0, symptom] == 1:

            contribution = coefficients[index]

            contribution_data.append(
                {
                    "symptom": symptom,
                    "contribution": contribution
                }
            )

    # --------------------------------------------------------
    # SORT BY ABSOLUTE CONTRIBUTION
    # --------------------------------------------------------

    contribution_data = sorted(
        contribution_data,
        key=lambda x: abs(
            x["contribution"]
        ),
        reverse=True
    )

    # --------------------------------------------------------
    # SEPARATE POSITIVE / NEGATIVE
    # --------------------------------------------------------

    positive_contributions = [
        item
        for item in contribution_data
        if item["contribution"] > 0
    ]

    negative_contributions = [
        item
        for item in contribution_data
        if item["contribution"] < 0
    ]

    # --------------------------------------------------------
    # RETURN RESULT
    # --------------------------------------------------------

    return {
        "condition": condition,
        "positive_contributions": positive_contributions,
        "negative_contributions": negative_contributions,
        "all_contributions": contribution_data
    }


# ============================================================
# TEST XAI MODULE
# ============================================================

if __name__ == "__main__":

    test_symptoms = [
        "itching",
        "skin_rash"
    ]

    result = explain_prediction(
        test_symptoms
    )

    print("=" * 60)
    print("XAI PREDICTION EXPLANATION")
    print("=" * 60)

    print("\nInput symptoms:")

    for symptom in test_symptoms:

        print(
            "-",
            symptom
        )

    print("\nPredicted condition:")

    print(
        result["condition"]
    )

    print("\nPositive contributions:")

    if result["positive_contributions"]:

        for item in result[
            "positive_contributions"
        ]:

            print(
                f"- {item['symptom']}: "
                f"{item['contribution']:.4f}"
            )

    else:

        print("None")

    print("\nNegative contributions:")

    if result["negative_contributions"]:

        for item in result[
            "negative_contributions"
        ]:

            print(
                f"- {item['symptom']}: "
                f"{item['contribution']:.4f}"
            )

    else:

        print("None")

    print("\n" + "=" * 60)

    print(
        "NOTE: These contributions explain "
        "the model prediction."
    )

    print(
        "They do not prove medical causation "
        "or diagnosis."
    )

    print("=" * 60)