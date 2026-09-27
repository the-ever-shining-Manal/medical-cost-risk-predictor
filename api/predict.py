from http.server import BaseHTTPRequestHandler
import json
import os
import sys

# Add parent directory to sys.path to import predict_new_input from predict.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from predict import predict_new_input
except ImportError:
    def predict_new_input(age, bmi, children, sex, smoker, region):
        smoker = smoker.lower()
        smoker_num = 1 if smoker == "yes" else (0 if smoker == "no" else None)
        if smoker_num is None:
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
        sex_male = 1 if sex == "male" else 0
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


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, private-key')
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response = {
            "status": "online",
            "service": "Medical Cost Risk Predictor Python API",
            "version": "1.0.0"
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            data = json.loads(post_data.decode('utf-8'))
            age = float(data.get("age", 0))
            bmi = float(data.get("bmi", 0))
            children = int(data.get("children", 0))
            sex = str(data.get("sex", "")).lower()
            smoker = str(data.get("smoker", "")).lower()
            region = str(data.get("region", "")).lower()

            result = predict_new_input(age, bmi, children, sex, smoker, region)

            if isinstance(result, str):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": result}).encode('utf-8'))
                return

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            clamped = max(float(result), 1000.0)
            response = {
                "statusCode": 200,
                "prediction": round(clamped, 2),
                "monthlyCost": round(clamped / 12, 2),
                "annualFormatted": f"${clamped:,.2f}",
                "monthlyFormatted": f"${(clamped / 12):,.2f}",
                "currency": "USD"
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
