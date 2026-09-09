
import json
import os
def lambda_handler(event,context):
    headers=event['headers']
    private_key=headers.get("private-key")
    provided_key = headers.get("private-key")
    correct_key = os.environ.get("private_key")
    if private_key!=correct_key:
        return {
            'statusCode': 401,
            'body': "Not authorized"
        }
    body_str=event["body"]
    data=json.loads(body_str)
    age = data["age"]
    bmi = data["bmi"]
    children = data["children"]
    sex = data["sex"]
    smoker = data["smoker"]
    region = data["region"]
    result=predict_new_input(age, bmi, children, sex, smoker, region)
    return {
        'statusCode': 200,
        'body': str(result)
    }



def predict_new_input(age, bmi, children, sex, smoker, region):
    smoker = smoker.lower()
    if smoker == "yes":
        smoker_num = 1
    elif smoker == "no":
        smoker_num = 0
    else:
        return "invalid answer"

    regions = ['northwest', 'southeast', 'northeast', 'southwest']
    if region not in regions:
        return "Region not available"

    if age <= 0 or age > 120:
        return "Age cannot be negative"
    if bmi <= 0 or bmi > 100:
        return "BMI cannot be negative"
    if sex not in ["female", "male"]:
        return "gender is not real"

    bmi_smoker = bmi * smoker_num

    # sex: baseline is female (0), male is 1
    sex_male = 1 if sex == "male" else 0

    # region: baseline is northeast (all zeros)
    region_northwest = 1 if region == "northwest" else 0
    region_southeast = 1 if region == "southeast" else 0
    region_southwest = 1 if region == "southwest" else 0

    prediction = (
        249.84327744 * age +
        43.13064979 * bmi +
        427.42967705 * children +
        565.29057405 * bmi_smoker +
        -245.29519316 * sex_male +
        -175.42191295 * region_northwest +
        -785.36999684 * region_southeast +
        -823.28512076 * region_southwest +
        -2829.1327635126363
    )

    return prediction
