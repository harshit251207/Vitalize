export const DisabilityCategories = [
  'Hemiplegia',
  'Paraplegia',
  'Quadriplegia/Tetraplegia',
  'Monoplegia',
  'Diplegia'
] as const;

export type DisabilityCategory = typeof DisabilityCategories[number] | 'unclear';

// Gemini API Key
const GEMINI_API_KEY = 'put gemini key here';

export const AIService = {
  async classifyReport(base64Image: string, mimeType: string = 'image/jpeg'): Promise<DisabilityCategory> {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      console.warn('API Key not set. Returning "unclear".');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return 'unclear';
    }

    try {
      const prompt = `You are a medical document analyzer. Look at this medical/disability report image carefully.

STEP 1: Extract and read ALL text visible in the image using OCR.
STEP 2: From the extracted text, identify any mentions of paralysis, motor impairment, or mobility disability.
STEP 3: Based on the medical information found, classify the patient's condition into EXACTLY ONE of these categories:

- Hemiplegia (one side of the body is paralyzed - left or right)
- Paraplegia (both legs are paralyzed, lower body)
- Quadriplegia/Tetraplegia (all four limbs are affected)
- Monoplegia (only one limb is affected)
- Diplegia (both legs affected, often symmetrically, common in cerebral palsy)

IMPORTANT RULES:
- If you can read text and find medical information, classify it into one of the 5 categories above.
- If the image is blurry, unreadable, or does not contain medical/disability information, respond with exactly "unclear".
- Respond with ONLY the category name or "unclear". No explanation, no extra text.`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      
      console.log('Sending image to Gemini API...');
      console.log('MIME type:', mimeType);
      console.log('Base64 length:', base64Image.length);

      const requestBody = {
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 50,
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      console.log('Gemini API response status:', response.status);
      console.log('Gemini API response:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP ${response.status}`;
        console.error('Gemini API error:', errorMsg);
        throw new Error(errorMsg);
      }

      const rawResult = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      console.log('Raw AI result:', rawResult);

      if (!rawResult) {
        console.warn('Empty response from Gemini');
        return 'unclear';
      }

      // Try to match against known categories (case-insensitive)
      const matched = DisabilityCategories.find(c => 
        rawResult.toLowerCase().includes(c.toLowerCase())
      );
      
      console.log('Matched category:', matched || 'unclear');
      return matched || 'unclear';

    } catch (error: any) {
      console.error('Error classifying report:', error?.message || error);
      // Re-throw so the caller can show a useful error message
      throw error;
    }
  }
};
