export const DisabilityCategories = [
  'Hemiplegia',
  'Paraplegia',
  'Quadriplegia/Tetraplegia',
  'Monoplegia',
  'Diplegia'
] as const;

export type DisabilityCategory =
  typeof DisabilityCategories[number] | 'unclear';

// Groq API Key
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

export const AIService = {
  async classifyReport(
    base64Image: string,
    mimeType: string = 'image/jpeg'
  ): Promise<DisabilityCategory> {

    // Check API key
    if (!GROQ_API_KEY || GROQ_API_KEY === 'YOUR_GROQ_API_KEY') {
      console.warn('Groq API Key not set. Returning "unclear".');

      await new Promise(resolve => setTimeout(resolve, 2000));

      return 'unclear';
    }

    try {
      // Prompt sent to the AI
      const prompt = `You are a medical document classification system.

Carefully examine the uploaded medical/disability report.

Your task is to identify the disability category explicitly supported by the medical report.

Possible categories:

- Hemiplegia
- Paraplegia
- Quadriplegia/Tetraplegia
- Monoplegia
- Diplegia
- unclear

IMPORTANT CLASSIFICATION RULES:

1. FIRST look for an explicit diagnosis or condition name in the report.

2. If the report explicitly says "diplegia", "diplegic cerebral palsy", or "spastic diplegia", classify it as:
Diplegia

3. If the report explicitly says "paraplegia" or describes paralysis of the lower body consistent with paraplegia, classify it as:
Paraplegia

4. If the report explicitly says "hemiplegia", classify it as:
Hemiplegia

5. If the report explicitly says "monoplegia", classify it as:
Monoplegia

6. If the report explicitly says "quadriplegia" or "tetraplegia", classify it as:
Quadriplegia/Tetraplegia

7. Do NOT classify something as paraplegia simply because both legs/lower limbs are affected.

8. "Diplegia" and "paraplegia" are NOT interchangeable. Pay particular attention to the exact diagnosis written by the doctor.

9. If the document is blurry, unreadable, or does not contain enough medical information to determine a category, return:
unclear

Respond with ONLY ONE of these exact values:

Hemiplegia
Paraplegia
Quadriplegia/Tetraplegia
Monoplegia
Diplegia
unclear

Do not provide an explanation.`;

      // Groq API endpoint
      const url =
        'https://api.groq.com/openai/v1/chat/completions';

      console.log('Sending image to Groq API...');
      console.log('MIME type:', mimeType);
      console.log('Base64 length:', base64Image.length);

      // Request body
      const requestBody = {
  model: 'qwen/qwen3.6-27b',

  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: prompt
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64Image}`
          }
        }
      ]
    }
  ],

  temperature: 0.1,
  max_completion_tokens: 100,
  reasoning_effort: 'none'
};

      // Send request to Groq
      const response = await fetch(url, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },

        body: JSON.stringify(requestBody)
      });

      // Convert response to JSON
      const data = await response.json();

      console.log(
        'Groq API response status:',
        response.status
      );

      console.log(
        'Groq API response:',
        JSON.stringify(data, null, 2)
      );

      // Handle API errors
      if (!response.ok) {
        const errorMsg =
          data.error?.message ||
          `HTTP ${response.status}`;

        console.error(
          'Groq API error:',
          errorMsg
        );

        throw new Error(errorMsg);
      }

      // Extract AI response
      const rawResult =
        data.choices?.[0]?.message?.content?.trim() || '';

      console.log(
        'Raw AI result:',
        rawResult
      );

      // Empty response
      if (!rawResult) {
        console.warn(
          'Empty response from Groq'
        );

        return 'unclear';
      }

      // Match AI result against our categories
      const matched =
        DisabilityCategories.find(category =>
          rawResult
            .toLowerCase()
            .includes(category.toLowerCase())
        );

      console.log(
        'Matched category:',
        matched || 'unclear'
      );

      return matched || 'unclear';

    } catch (error: any) {

      console.error(
        'Error classifying report:',
        error?.message || error
      );

      // Re-throw so the UI can show the error
      throw error;
    }
  }
};