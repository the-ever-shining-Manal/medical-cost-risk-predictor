/**
 * Vercel Serverless Function: /api/predict
 * Medical Cost & Insurance Risk Prediction API
 */

// Model coefficients derived from Scikit-Learn Linear Regression training
const MODEL = {
  intercept: -2829.1327635126363,
  coef: {
    age: 249.84327744,
    bmi: 43.13064979,
    children: 427.42967705,
    bmi_smoker: 565.29057405,
    sex_male: -245.29519316,
    region_northwest: -175.42191295,
    region_southeast: -785.36999684,
    region_southwest: -823.28512076,
  }
};

function validateAndPredict({ age, bmi, children, sex, smoker, region }) {
  if (age === undefined || bmi === undefined || children === undefined || !sex || !smoker || !region) {
    throw new Error("Missing required fields: age, bmi, children, sex, smoker, region");
  }

  const numAge = Number(age);
  const numBmi = Number(bmi);
  const numChildren = Number(children);

  if (isNaN(numAge) || numAge <= 0 || numAge > 120) {
    throw new Error("Age must be a valid number between 1 and 120");
  }
  if (isNaN(numBmi) || numBmi <= 0 || numBmi > 100) {
    throw new Error("BMI must be a valid number between 1 and 100");
  }
  if (isNaN(numChildren) || numChildren < 0 || numChildren > 25) {
    throw new Error("Children count must be a non-negative integer");
  }

  const sexLower = String(sex).trim().toLowerCase();
  if (sexLower !== 'female' && sexLower !== 'male') {
    throw new Error("Sex must be 'female' or 'male'");
  }

  const smokerLower = String(smoker).trim().toLowerCase();
  if (smokerLower !== 'yes' && smokerLower !== 'no') {
    throw new Error("Smoker must be 'yes' or 'no'");
  }

  const regionLower = String(region).trim().toLowerCase();
  const validRegions = ['northeast', 'northwest', 'southeast', 'southwest'];
  if (!validRegions.includes(regionLower)) {
    throw new Error(`Region must be one of: ${validRegions.join(', ')}`);
  }

  const smokerNum = smokerLower === 'yes' ? 1 : 0;
  const bmiSmoker = numBmi * smokerNum;
  const sexMale = sexLower === 'male' ? 1 : 0;
  const regionNw = regionLower === 'northwest' ? 1 : 0;
  const regionSe = regionLower === 'southeast' ? 1 : 0;
  const regionSw = regionLower === 'southwest' ? 1 : 0;

  const ageContrib = MODEL.coef.age * numAge;
  const bmiContrib = MODEL.coef.bmi * numBmi;
  const childrenContrib = MODEL.coef.children * numChildren;
  const smokerBmiContrib = MODEL.coef.bmi_smoker * bmiSmoker;
  const sexContrib = MODEL.coef.sex_male * sexMale;
  const regionContrib =
    (MODEL.coef.region_northwest * regionNw) +
    (MODEL.coef.region_southeast * regionSe) +
    (MODEL.coef.region_southwest * regionSw);

  const rawPrediction =
    ageContrib +
    bmiContrib +
    childrenContrib +
    smokerBmiContrib +
    sexContrib +
    regionContrib +
    MODEL.intercept;

  // Actual charges cannot be strictly negative in real-world insurance
  const clampedPrediction = Math.max(rawPrediction, 1000.0);

  // Risk categorization
  let riskCategory = "Low Risk";
  let riskColor = "emerald";
  if (clampedPrediction > 28000) {
    riskCategory = "High Risk";
    riskColor = "rose";
  } else if (clampedPrediction > 14000) {
    riskCategory = "Elevated Risk";
    riskColor = "amber";
  } else if (clampedPrediction > 7000) {
    riskCategory = "Moderate Risk";
    riskColor = "blue";
  }

  return {
    rawPrediction,
    prediction: Number(clampedPrediction.toFixed(2)),
    monthlyCost: Number((clampedPrediction / 12).toFixed(2)),
    riskCategory,
    riskColor,
    factors: {
      baseIntercept: Number(MODEL.intercept.toFixed(2)),
      ageFactor: Number(ageContrib.toFixed(2)),
      bmiFactor: Number(bmiContrib.toFixed(2)),
      smokingInteractionFactor: Number(smokerBmiContrib.toFixed(2)),
      dependentsFactor: Number(childrenContrib.toFixed(2)),
      sexAdjustment: Number(sexContrib.toFixed(2)),
      regionalAdjustment: Number(regionContrib.toFixed(2)),
    }
  };
}

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, private-key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      status: 'online',
      service: 'Medical Cost Risk Predictor API',
      version: '1.0.0',
      samplePayload: {
        age: 30,
        bmi: 28,
        children: 2,
        sex: "male",
        smoker: "yes",
        region: "southeast"
      },
      instructions: "Send a POST request with JSON body containing age, bmi, children, sex, smoker, region."
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        res.status(400).json({ error: "Invalid JSON in request body" });
        return;
      }
    }

    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: "Missing JSON payload" });
      return;
    }

    // Optional forwarding to AWS Lambda API Gateway if configured
    const awsUrl = process.env.AWS_API_GATEWAY_URL;
    const awsKey = process.env.AWS_PRIVATE_KEY;

    if (awsUrl) {
      try {
        const awsResponse = await fetch(awsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(awsKey ? { 'private-key': awsKey } : {})
          },
          body: JSON.stringify(body)
        });

        if (awsResponse.ok) {
          const awsData = await awsResponse.text();
          const parsed = parseFloat(awsData);
          if (!isNaN(parsed)) {
            const localResult = validateAndPredict(body);
            res.status(200).json({
              statusCode: 200,
              prediction: Number(parsed.toFixed(2)),
              monthlyCost: Number((parsed / 12).toFixed(2)),
              riskCategory: localResult.riskCategory,
              riskColor: localResult.riskColor,
              currency: "USD",
              source: "aws_lambda",
              breakdown: localResult.factors,
              input: body
            });
            return;
          }
        }
      } catch (awsErr) {
        console.warn("AWS Gateway proxy attempt failed, falling back to local model engine:", awsErr.message);
      }
    }

    // Calculate prediction using verified mathematical model
    const result = validateAndPredict(body);

    res.status(200).json({
      statusCode: 200,
      prediction: result.prediction,
      rawPrediction: result.rawPrediction,
      monthlyCost: result.monthlyCost,
      annualFormatted: `$${result.prediction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      monthlyFormatted: `$${result.monthlyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      riskCategory: result.riskCategory,
      riskColor: result.riskColor,
      currency: "USD",
      source: "model_engine",
      breakdown: result.factors,
      input: {
        age: Number(body.age),
        bmi: Number(body.bmi),
        children: Number(body.children),
        sex: String(body.sex).toLowerCase(),
        smoker: String(body.smoker).toLowerCase(),
        region: String(body.region).toLowerCase()
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    res.status(400).json({
      statusCode: 400,
      error: err.message || "Prediction calculation failed"
    });
  }
};
