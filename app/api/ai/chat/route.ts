import { NextResponse } from 'next/server'

const GEMINI_API_KEY = 'AIzaSyAi2-btv4IJCSb3o3FGZUviJfnVu7jZZwg'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: Request) {
  try {
    const { prompt, context } = await request.json()

    const systemPrompt = `You are "Warehouse AI", an expert warehouse management assistant with 20 years of experience. You help warehouse managers optimize operations.

Current Warehouse Metrics:
- Total SKUs: ${context?.totalSKUs || 0}
- Total Inventory Units: ${context?.totalQuantity || 0}
- Active Orders: ${context?.activeOrders || 0}
- Total Bins: ${context?.totalBins || 0}
- Low Stock Items: ${JSON.stringify(context?.lowStockItems || [])}
- Top Moving SKUs: ${JSON.stringify(context?.topMovingItems || [])}

Your capabilities:
1. Analyze inventory health and suggest optimizations
2. Recommend bin reorganizations based on velocity
3. Identify potential shortages before they happen
4. Suggest picking wave strategies
5. Provide ROI calculations for proposed changes

Response Guidelines:
- Be concise but informative
- Use bullet points for multiple suggestions
- Include specific numbers when available
- If asked for action, explain the steps
- Be proactive - suggest improvements even if not asked

User Question: ${prompt}`

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 800,
          topP: 0.9
        }
      })
    })

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I apologize, I am unable to process that request at the moment.'

    return NextResponse.json({ response: aiResponse })

  } catch (error) {
    console.error('Chat Error:', error)
    return NextResponse.json({ error: 'Chat service error' }, { status: 500 })
  }
}
