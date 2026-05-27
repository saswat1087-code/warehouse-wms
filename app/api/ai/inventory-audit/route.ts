import { NextResponse } from 'next/server'

const GEMINI_API_KEY = 'AIzaSyAi2-btv4IJCSb3o3FGZUviJfnVu7jZZwg'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: Request) {
  try {
    const { inventory, orders, bins } = await request.json()

    const prompt = `Audit inventory: ${inventory?.length || 0} items. Return JSON: {"summary": {"lowStockItems": []}, "recommendations": []}`

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
      })
    })

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const audit = JSON.parse(aiResponse)

    return NextResponse.json(audit)

  } catch (error) {
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 })
  }
}
