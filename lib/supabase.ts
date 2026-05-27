import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Inventory = {
  id: number
  sku: string
  description: string
  quantity: number
  bin: string
  created_at: string
  updated_at: string
}

export type Bin = {
  id: number
  bin_code: string
  zone: string
  status: string
  x_coordinate: number
  y_coordinate: number
  created_at: string
}

export type Order = {
  id: number
  order_id: string
  customer: string
  type: 'Inbound' | 'Outbound' | 'Internal'
  sku: string
  description: string
  quantity: number
  bin: string
  status: string
  created_at: string
}
