import { NextResponse } from 'next/server'

const GEMINI_API_KEY = 'AIzaSyAi2-btv4IJCSb3o3FGZUviJfnVu7jZZwg'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: Request) {
  try {
    const { orders, pickingZones, currentTime, workerCount } = await request.json()

    const prompt = `Optimize picking for ${orders?.length || 0} orders. Return JSON: {"pickWaves": [], "totalEstimatedTime": 0, "recommendations": []}`

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
      })
    })

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const optimization = JSON.parse(aiResponse)

    return NextResponse.json(optimization)

  } catch (error) {
    return NextResponse.json({ error: 'Optimization failed' }, { status: 500 })
  }
}
