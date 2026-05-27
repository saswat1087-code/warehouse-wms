// app/api/ai/suggest-bin/route.ts
import { NextResponse } from 'next/server'

const GEMINI_API_KEY = 'AIzaSyAi2-btv4IJCSb3o3FGZUviJfnVu7jZZwg'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(request: Request) {
  try {
    const { sku, quantity, orderId, customer, availableBins } = await request.json()

    const prompt = `
You are an intelligent warehouse optimization AI. Your task is to suggest the BEST bin location for picking items for an outgoing order.

## Current Context:
- Order ID: ${orderId}
- Customer: ${customer}
- SKU: ${sku}
- Quantity Needed: ${quantity}

## Available Bins with Current Stock:
${JSON.stringify(availableBins, null, 2)}

## Decision Factors to Consider:
1. **Sufficient Stock**: The bin must have enough quantity to fulfill the order
2. **Pick Efficiency**: Prioritize bins that minimize travel distance (lower level, closer to packing station)
3. **Inventory Aging**: Prefer bins with older stock first (FIFO - First In First Out)
4. **Bin Congestion**: Avoid bins in high-traffic areas during peak hours
5. **Item Compatibility**: Ensure bin conditions match item requirements

## Your Task:
Analyze the available bins and recommend the SINGLE best bin for picking. Return your response as JSON only:

{
  "recommendedBin": "bin_code_here",
  "reason": "Detailed explanation of why this bin is optimal",
  "confidenceScore": 0.95,
  "alternativeBins": ["bin2", "bin3"],
  "estimatedPickTime": 120,
  "pickInstructions": "Specific instructions for the picker"
}

Consider:
- If multiple bins have the SKU, choose the most efficient one
- If no bin has sufficient quantity, suggest splitting the pick
- Always explain your reasoning clearly
`

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          topK: 40,
          responseMimeType: "application/json"
        }
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error('Gemini API Error:', data)
      return NextResponse.json({ error: 'AI service error' }, { status: response.status })
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    
    let suggestion
    try {
      suggestion = JSON.parse(aiResponse)
    } catch {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      suggestion = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        recommendedBin: availableBins[0]?.bin,
        reason: 'Default selection - AI response parsing failed',
        confidenceScore: 0.5,
        alternativeBins: [],
        estimatedPickTime: 180
      }
    }

    return NextResponse.json(suggestion)

  } catch (error) {
    console.error('AI Bin Suggestion Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
