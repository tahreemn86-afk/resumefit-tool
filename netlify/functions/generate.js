exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { jobDescription, resumeText } = JSON.parse(event.body || '{}');

    if (!jobDescription || !resumeText) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'jobDescription and resumeText are required' })
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server is missing GEMINI_API_KEY' })
      };
    }

    const prompt = `You are an expert resume writer and ATS (Applicant Tracking System) specialist.

Given a JOB DESCRIPTION and a RESUME, do two things:
1. Give an ATS match score from 0-100 estimating how well the resume currently matches the job description's keywords and requirements.
2. Rewrite the resume's bullet points (keep it concise) so they better match the job description's language and keywords, without inventing false experience.

Respond ONLY in valid JSON, with this exact shape and no other text:
{"matchScore": <number>, "rewrittenText": "<the rewritten resume as plain text>"}

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'AI service error' }) };
    }

    const data = await geminiRes.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      parsed = { matchScore: null, rewrittenText: rawText };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(parsed)
    };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
