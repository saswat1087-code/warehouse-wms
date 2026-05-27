// app/api/ai/inventory-audit/route.ts
import { NextResponse } from 'next/server'

const GEMINI_API_KEY = 'AIzaSyAi2-btv4IJCSb3o3FGZUviJfnVu7jZZwg'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: Request) {
  try {
    const { inventory, orders, bins } = await request.json()

    const prompt = `
You are an AI Inventory Auditor for a Warehouse Management System. Analyze the inventory data and provide insights.

## Current Inventory:
${JSON.stringify(inventory, null, 2)}

## Active Orders:
${JSON.stringify(orders, null, 2)}

## Bin Locations:
${JSON.stringify(bins, null, 2)}

## Provide analysis in this JSON format:
{
  "summary": {
    "totalValue": 0,
    "uniqueSKUs": 0,
    "lowStockItems": [],
    "overstockItems": [],
    "deadStock": []
  },
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ],
  "alerts": [
    "Alert 1",
    "Alert 2"
  ],
  "optimizationSuggestions": {
    "replenishment": [],
    "relocation": [],
    "consolidation": []
  }
}
`

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      })
    })

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    
    let audit
    try {
      audit = JSON.parse(aiResponse)
    } catch {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      audit = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    }

    return NextResponse.json(audit)

  } catch (error) {
    console.error('Inventory Audit Error:', error)
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 })
  }
}
