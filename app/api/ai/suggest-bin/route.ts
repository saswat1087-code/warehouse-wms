import { NextResponse } from 'next/server'

const GEMINI_API_KEY = 'AIzaSyAi2-btv4IJCSb3o3FGZUviJfnVu7jZZwg'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: Request) {
  try {
    const { sku, quantity, orderId, customer, availableBins } = await request.json()

    const prompt = `You are a warehouse AI. Suggest the best bin for SKU: ${sku}, quantity: ${quantity}. Available bins: ${JSON.stringify(availableBins)}. Return JSON only: {"recommendedBin": "bin_code", "reason": "why", "confidenceScore": 0.9}`

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
      return NextResponse.json({ error: 'AI service error: ' + response.status }, { status: response.status })
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const suggestion = JSON.parse(aiResponse)

    return NextResponse.json(suggestion)

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 })
  }
}
