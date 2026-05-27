// app/api/ai/picking-optimization/route.ts
import { NextResponse } from 'next/server'

const GEMINI_API_KEY = 'AIzaSyAi2-btv4IJCSb3o3FGZUviJfnVu7jZZwg'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: Request) {
  try {
    const { orders, pickingZones, currentTime, workerCount } = await request.json()

    const prompt = `
You are a warehouse picking optimization AI. Create an optimized picking plan for multiple orders.

## Input Data:
- Orders to pick: ${JSON.stringify(orders, null, 2)}
- Picking Zones: ${JSON.stringify(pickingZones, null, 2)}
- Current Time: ${currentTime}
- Available Workers: ${workerCount}

## Optimize for:
1. **Travel Distance Minimization**: Group picks in same zone/aisle
2. **Deadline Adherence**: Prioritize orders with earlier promised dates
3. **Worker Workload Balance**: Distribute picks evenly
4. **Wave Efficiency**: Create efficient pick waves

## Return JSON:
{
  "pickWaves": [
    {
      "waveId": "WAVE-001",
      "priority": "HIGH",
      "orders": ["ORD-001", "ORD-003"],
      "estimatedDuration": 450,
      "assignedWorkers": 2,
      "optimizedRoute": [
        { "sequence": 1, "bin": "B-02-01", "sku": "SKU-001", "quantity": 25 },
        { "sequence": 2, "bin": "C-03-01", "sku": "SKU-003", "quantity": 10 }
      ]
    }
  ],
  "totalEstimatedTime": 900,
  "recommendations": ["Start with Wave 1", "Assign senior picker to Wave 1"],
  "bottlenecks": ["Zone B has high congestion"]
}
`

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    })

    const data = await response.json()
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    
    let optimization
    try {
      optimization = JSON.parse(aiResponse)
    } catch {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      optimization = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    }

    return NextResponse.json(optimization)

  } catch (error) {
    console.error('Picking Optimization Error:', error)
    return NextResponse.json({ error: 'Optimization failed' }, { status: 500 })
  }
}
