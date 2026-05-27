import { NextResponse } from 'next/server'

const GEMINI_API_KEY = 'AIzaSyAi2-btv4IJCSb3o3FGZUviJfnVu7jZZwg'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

// Define types
interface BinStock {
  bin: string
  quantity: number
  sku: string
  description?: string
  created_at?: string
  zone?: string
}

interface SuggestionResponse {
  recommendedBin: string
  reason: string
  confidenceScore: number
  alternativeBins: string[]
  estimatedPickTime: number
  pickInstructions: string
}

export async function POST(request: Request) {
  try {
    const { sku, quantity, orderId, customer, availableBins, priorityFactors } = await request.json()

    const prompt = `You are a senior warehouse optimization AI with expertise in inventory management and pick path optimization.

## Task
Suggest the BEST bin location for picking ${quantity} units of SKU: ${sku} for customer: ${customer} (Order: ${orderId})

## Available Bins with Current Stock:
${JSON.stringify(availableBins, null, 2)}

## Decision Factors (weighted):
1. **Sufficient Stock (40%)**: Bin must have enough quantity
2. **Pick Efficiency (25%)**: Lower level bins > higher level, bins closer to packing station
3. **FIFO Compliance (15%)**: Prefer bins with older stock (check created_at)
4. **Zone Priority (10%)**: Picking zone > Storage zone > Reserve zone
5. **Congestion Avoidance (10%)**: Avoid bins marked as high traffic during peak

## Return ONLY valid JSON (no other text):
{
  "recommendedBin": "bin_code_here",
  "reason": "Detailed 2-3 sentence explanation considering the weighted factors",
  "confidenceScore": 0.95,
  "alternativeBins": ["alt_bin_1", "alt_bin_2"],
  "estimatedPickTime": 120,
  "pickInstructions": "Specific guidance for the picker"
}`

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.2, 
          responseMimeType: "application/json",
          maxOutputTokens: 500
        }
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error('Gemini API Error:', data)
      return NextResponse.json({ error: 'AI service error: ' + response.status }, { status: response.status })
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    
    let suggestion: SuggestionResponse
    try {
      suggestion = JSON.parse(aiResponse) as SuggestionResponse
    } catch {
      // Provide default suggestion with proper typing
      const defaultBin = (availableBins && availableBins.length > 0) ? availableBins[0].bin : 'N/A'
      const altBins: string[] = (availableBins && availableBins.length > 1) 
        ? availableBins.slice(1, 3).map((b: BinStock) => b.bin) 
        : []
      
      suggestion = {
        recommendedBin: defaultBin,
        reason: 'AI response parsing failed - using first available bin',
        confidenceScore: 0.5,
        alternativeBins: altBins,
        estimatedPickTime: 180,
        pickInstructions: 'Standard pick procedure'
      }
    }

    return NextResponse.json(suggestion)

  } catch (error) {
    console.error('AI Bin Suggestion Error:', error)
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 })
  }
}
