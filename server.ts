import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: /api/scan-receipt
app.post('/api/scan-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: `Analyze this receipt or bill image. Extract the following financial details accurately:
1. merchant: The store, restaurant, or vendor name.
2. amount: Total amount paid as a positive number.
3. currency: One of "THB", "USD", "MMK" based on currency symbol (฿, $, K, THB, Baht, USD, Kyats) or location context. Default to "THB" if in Thailand / ฿.
4. date: Date of purchase formatted as YYYY-MM-DD. If year is missing or unclear, use the current year (2026).
5. categoryId: Choose best match among ["food", "housing", "work", "travel", "shopping", "entertainment", "other"].
6. note: Brief summary of purchased items or service (under 100 characters in Myanmar or English).

If the image is not a receipt or details are completely unreadable, set isValidReceipt to false.`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValidReceipt: {
              type: Type.BOOLEAN,
              description: 'Whether the image contains a recognizable receipt or bill with valid transaction details',
            },
            merchant: {
              type: Type.STRING,
              description: 'Name of the merchant or store',
            },
            amount: {
              type: Type.NUMBER,
              description: 'Total transaction amount',
            },
            currency: {
              type: Type.STRING,
              enum: ['THB', 'USD', 'MMK'],
              description: 'Currency code',
            },
            date: {
              type: Type.STRING,
              description: 'Date in YYYY-MM-DD format',
            },
            categoryId: {
              type: Type.STRING,
              enum: ['food', 'housing', 'work', 'travel', 'shopping', 'entertainment', 'other'],
              description: 'Category identifier',
            },
            note: {
              type: Type.STRING,
              description: 'Short note or main items',
            },
          },
          required: ['isValidReceipt'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    if (!parsed.isValidReceipt || (!parsed.amount && !parsed.merchant)) {
      return res.status(200).json({
        success: false,
        message: 'ဖတ်မရပါ၊ ကိုယ်တိုင်ဖြည့်ပါ',
      });
    }

    return res.status(200).json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Scan receipt error:', error);
    return res.status(500).json({
      success: false,
      message: 'ဖတ်မရပါ၊ ကိုယ်တိုင်ဖြည့်ပါ',
      error: error?.message || 'Server OCR error',
    });
  }
});

// Vite middleware in dev or static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`MyMoney server running at http://localhost:${port}`);
});
