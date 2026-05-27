import { NextResponse } from 'next/server'

const GEMINI_API_KEY = 'AIzaSyAi2-btv4IJCSb3o3FGZUviJfnVu7jZZwg'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: Request) {
  try {
    const { prompt, context } = await request.json()

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Warehouse context: SKUs: ${context?.totalSKUs}. Answer: ${prompt}` }] }],
        generationConfig: { temperature: 0.7 }
      })
    })

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to respond'

    return NextResponse.json({ response: aiResponse })

  } catch (error) {
    return NextResponse.json({ error: 'Chat error' }, { status: 500 })
  }
}
