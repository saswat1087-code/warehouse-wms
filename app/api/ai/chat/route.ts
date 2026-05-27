// app/api/ai/chat/route.ts
import { NextResponse } from 'next/server'

const GEMINI_API_KEY = 'AIzaSyAi2-btv4IJCSb3o3FGZUviJfnVu7jZZwg'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: Request) {
  try {
    const { prompt, context } = await request.json()

    const systemPrompt = `
You are an AI Warehouse Assistant for a Warehouse Management System. You help with:
- Inventory queries and analysis
- Order management suggestions
- Bin optimization recommendations
- Picking efficiency improvements
- Warehouse operations advice

Current Warehouse Context:
- Total SKUs: ${context?.totalSKUs || 'Unknown'}
- Total Inventory: ${context?.totalQuantity || 'Unknown'} units
- Active Orders: ${context?.activeOrders || 'Unknown'}
- Open Tasks: ${context?.openTasks || 'Unknown'}

Be helpful, concise, and practical. If asked to perform an action, respond with JSON containing an "action" field.
`

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: systemPrompt + '\n\nUser: ' + prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    })

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I am unable to process that request.'

    return NextResponse.json({ response: aiResponse })

  } catch (error) {
    console.error('Chat Error:', error)
    return NextResponse.json({ error: 'Chat service error' }, { status: 500 })
  }
}
