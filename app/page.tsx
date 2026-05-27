'use client'

import { useEffect, useState } from 'react'
import { supabase, Inventory, Bin, Order } from '@/lib/supabase'
import { 
  Sparkles, Zap, TrendingUp, Mic, Send, BarChart3, AlertCircle, 
  Package, ArrowUpCircle, ArrowDownCircle, Boxes, Layers, ClipboardList,
  Trash2, Play, CheckCircle2, Loader2, Search, PlusCircle, LayoutDashboard
} from 'lucide-react'

export default function Home() {
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [bins, setBins] = useState<Bin[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inventory' | 'bins' | 'orders'>('inventory')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const [newProduct, setNewProduct] = useState({ sku: '', description: '', quantity: '', bin: '' })
  const [newBin, setNewBin] = useState({ bin_code: '', zone: '' })
  const [newOrder, setNewOrder] = useState({ order_id: '', customer: '', type: 'Outbound', sku: '', quantity: '', bin: '' })
  
  const [aiSuggestions, setAiSuggestions] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [pickingOptimization, setPickingOptimization] = useState<any>(null)
  const [chatPrompt, setChatPrompt] = useState('')
  const [chatResponse, setChatResponse] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [inventoryAudit, setInventoryAudit] = useState<any>(null)
  const [fetchingDescription, setFetchingDescription] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadAllData()
    
    const inventorySub = supabase
      .channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => loadInventory())
      .subscribe()
    
    const binsSub = supabase
      .channel('bins-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bins' }, () => loadBins())
      .subscribe()
    
    const ordersSub = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders())
      .subscribe()
    
    return () => {
      inventorySub.unsubscribe()
      binsSub.unsubscribe()
      ordersSub.unsubscribe()
    }
  }, [])
  
  async function loadAllData() {
    await Promise.all([loadInventory(), loadBins(), loadOrders()])
    setLoading(false)
  }
  
  async function loadInventory() {
    const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false })
    if (error) showMessage('error', 'Failed to load inventory')
    else if (data) setInventory(data)
  }
  
  async function loadBins() {
    const { data, error } = await supabase.from('bins').select('*').order('bin_code')
    if (error) showMessage('error', 'Failed to load bins')
    else if (data) setBins(data)
  }
  
  async function loadOrders() {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (error) showMessage('error', 'Failed to load orders')
    else if (data) setOrders(data)
  }
  
  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }
  
  async function fetchSkuDescription(sku: string) {
    if (!sku.trim()) return
    setFetchingDescription(true)
    try {
      const { data: existing } = await supabase
        .from('inventory')
        .select('description')
        .eq('sku', sku.toUpperCase())
        .limit(1)
      
      if (existing && existing.length > 0 && existing[0].description) {
        setNewProduct(prev => ({ ...prev, description: existing[0].description }))
        showMessage('success', `Description auto-filled: ${existing[0].description}`)
      }
    } catch (error) {
      console.error('Error fetching description:', error)
    } finally {
      setFetchingDescription(false)
    }
  }
  
  async function addProduct() {
    if (!newProduct.sku || !newProduct.bin) {
      showMessage('error', 'SKU and Bin are required')
      return
    }
    const sku = newProduct.sku.toUpperCase()
    const bin = newProduct.bin.toUpperCase()
    const newQuantity = parseInt(newProduct.quantity) || 0
    setAiLoading(true)
    
    try {
      const { data: existingProduct } = await supabase
        .from('inventory')
        .select('id, quantity, description')
        .eq('sku', sku)
        .eq('bin', bin)
        .maybeSingle()
      
      if (existingProduct) {
        const updatedQuantity = existingProduct.quantity + newQuantity
        const { error } = await supabase
          .from('inventory')
          .update({ quantity: updatedQuantity, updated_at: new Date().toISOString() })
          .eq('id', existingProduct.id)
        
        if (error) throw error
        showMessage('success', `Stock accumulated! ${sku} now has ${updatedQuantity} units in ${bin}`)
      } else {
        const { error } = await supabase.from('inventory').insert([{
          sku: sku,
          description: newProduct.description || `SKU ${sku}`,
          quantity: newQuantity,
          bin: bin
        }])
        if (error) throw error
        showMessage('success', `New product added: ${sku} with ${newQuantity} units in ${bin}`)
      }
      setNewProduct({ sku: '', description: '', quantity: '', bin: '' })
      await loadInventory()
    } catch (error: any) {
      showMessage('error', 'Failed to add product: ' + error.message)
    } finally {
      setAiLoading(false)
    }
  }
  
  async function addBin() {
    if (!newBin.bin_code) {
      showMessage('error', 'Bin code is required')
      return
    }
    const { error } = await supabase.from('bins').insert([{
      bin_code: newBin.bin_code.toUpperCase(),
      zone: newBin.zone || 'General'
    }])
    if (error) showMessage('error', 'Failed to add bin: ' + error.message)
    else {
      showMessage('success', `Bin ${newBin.bin_code.toUpperCase()} added successfully!`)
      setNewBin({ bin_code: '', zone: '' })
      await loadBins()
    }
  }
  
  async function addOrder() {
    if (!newOrder.order_id || !newOrder.customer || !newOrder.sku || !newOrder.quantity || !newOrder.bin) {
      showMessage('error', 'All fields are required')
      return
    }
    const sku = newOrder.sku.toUpperCase()
    const bin = newOrder.bin.toUpperCase()
    const quantity = parseInt(newOrder.quantity)
    
    let description = ''
    const { data: existingProduct } = await supabase
      .from('inventory')
      .select('description')
      .eq('sku', sku)
      .limit(1)
    
    if (existingProduct && existingProduct.length > 0) {
      description = existingProduct[0].description
    }
    
    const { error } = await supabase.from('orders').insert([{
      order_id: newOrder.order_id.toUpperCase(),
      customer: newOrder.customer,
      type: newOrder.type,
      sku: sku,
      description: description || `Order for ${sku}`,
      quantity: quantity,
      bin: bin,
      status: 'Open'
    }])
    
    if (error) showMessage('error', 'Failed to add order: ' + error.message)
    else {
      showMessage('success', `Order ${newOrder.order_id.toUpperCase()} created successfully!`)
      setNewOrder({ order_id: '', customer: '', type: 'Outbound', sku: '', quantity: '', bin: '' })
      setAiSuggestions(null)
      await loadOrders()
    }
  }
  
  async function updateOrderStatus(orderId: string, newStatus: string) {
    setAiLoading(true)
    try {
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .single()
      
      if (fetchError) throw fetchError
      
      if (newStatus === 'Closed') {
        if (order.type === 'Outbound') {
          const { data: stockItem } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('sku', order.sku)
            .eq('bin', order.bin)
            .maybeSingle()
          
          if (stockItem) {
            const newQuantity = Math.max(0, stockItem.quantity - order.quantity)
            await supabase
              .from('inventory')
              .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
              .eq('id', stockItem.id)
            showMessage('success', `📤 Outbound completed: ${order.quantity} units removed from ${order.bin}`)
          } else {
            showMessage('error', `Stock not found for ${order.sku} in ${order.bin}`)
          }
        } else if (order.type === 'Inbound') {
          const { data: existingStock } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('sku', order.sku)
            .eq('bin', order.bin)
            .maybeSingle()
          
          if (existingStock) {
            const newQuantity = existingStock.quantity + order.quantity
            await supabase
              .from('inventory')
              .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
              .eq('id', existingStock.id)
            showMessage('success', `📥 Inbound completed: ${order.quantity} units added to ${order.bin}`)
          } else {
            await supabase.from('inventory').insert([{
              sku: order.sku,
              description: order.description || `SKU ${order.sku}`,
              quantity: order.quantity,
              bin: order.bin
            }])
            showMessage('success', `📥 Inbound completed: ${order.quantity} new units added to ${order.bin}`)
          }
        }
        await loadInventory()
      }
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('order_id', orderId)
      
      if (updateError) throw updateError
      showMessage('success', `✅ Order ${orderId} status updated to: ${newStatus}`)
      await loadOrders()
    } catch (error: any) {
      showMessage('error', 'Failed to update order: ' + error.message)
    } finally {
      setAiLoading(false)
    }
  }
  
  async function deleteItem(table: string, id: number, identifier: string) {
    if (confirm(`Delete ${identifier}? This cannot be undone.`)) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) showMessage('error', 'Failed to delete')
      else {
        showMessage('success', 'Deleted successfully')
        await Promise.all([loadInventory(), loadBins(), loadOrders()])
      }
    }
  }
  
  async function getAiBinSuggestion() {
    if (!newOrder.sku || !newOrder.order_id) {
      showMessage('error', 'Please enter SKU and Order ID first')
      return
    }
    setAiLoading(true)
    setAiSuggestions(null)
    try {
      const { data: availableBins } = await supabase
        .from('inventory')
        .select('bin, quantity, sku, description, created_at')
        .eq('sku', newOrder.sku.toUpperCase())
        .gt('quantity', 0)
      
      if (!availableBins || availableBins.length === 0) {
        setAiSuggestions({ error: 'No stock available for this SKU' })
        setAiLoading(false)
        return
      }
      
      const binCodes = availableBins.map(b => b.bin)
      const { data: binInfo } = await supabase
        .from('bins')
        .select('bin_code, zone')
        .in('bin_code', binCodes)
      
      const enrichedBins = availableBins.map(bin => ({
        ...bin,
        zone: binInfo?.find(b => b.bin_code === bin.bin)?.zone || 'Unknown'
      }))
      
      const response = await fetch('/api/ai/suggest-bin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: newOrder.sku.toUpperCase(),
          quantity: parseInt(newOrder.quantity),
          orderId: newOrder.order_id.toUpperCase(),
          customer: newOrder.customer,
          availableBins: enrichedBins,
          priorityFactors: { rushOrder: false, customerTier: 'Standard' }
        })
      })
      
      const suggestion = await response.json()
      setAiSuggestions(suggestion)
      if (suggestion.recommendedBin) {
        setNewOrder(prev => ({ ...prev, bin: suggestion.recommendedBin }))
        showMessage('success', `AI suggested bin: ${suggestion.recommendedBin}`)
      }
    } catch (error) {
      console.error('AI suggestion error:', error)
      setAiSuggestions({ error: 'Failed to get AI suggestion' })
    } finally {
      setAiLoading(false)
    }
  }
  
  async function optimizePickingWave() {
    setAiLoading(true)
    try {
      const { data: pendingOrders } = await supabase.from('orders').select('*').eq('status', 'Open').eq('type', 'Outbound')
      const { data: allBins } = await supabase.from('bins').select('*')
      const { data: currentStock } = await supabase.from('inventory').select('sku, bin, quantity')
      
      const response = await fetch('/api/ai/picking-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: pendingOrders || [],
          pickingZones: allBins || [],
          currentStock: currentStock || [],
          currentTime: new Date().toISOString(),
          workerCount: 3
        })
      })
      const optimization = await response.json()
      setPickingOptimization(optimization)
      showMessage('success', 'Wave optimization complete!')
    } catch (error) {
      showMessage('error', 'Optimization failed')
    } finally {
      setAiLoading(false)
    }
  }
  
  async function runInventoryAudit() {
    setAiLoading(true)
    try {
      const response = await fetch('/api/ai/inventory-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory,
          orders: orders.filter(o => o.status === 'Open'),
          bins,
          thresholds: { lowStock: 10, criticalStock: 5, overstock: 100 }
        })
      })
      const audit = await response.json()
      setInventoryAudit(audit)
      showMessage('success', 'Inventory audit complete!')
    } catch (error) {
      showMessage('error', 'Audit failed')
    } finally {
      setAiLoading(false)
    }
  }
  
  async function sendChatMessage() {
    if (!chatPrompt.trim()) return
    setChatLoading(true)
    setChatResponse('')
    try {
      const lowStockItems = inventory.filter(i => i.quantity < 10)
      const topItems = [...inventory].sort((a, b) => b.quantity - a.quantity).slice(0, 5)
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: chatPrompt,
          context: {
            totalSKUs: inventory.length,
            totalQuantity: inventory.reduce((sum, i) => sum + i.quantity, 0),
            activeOrders: orders.filter(o => o.status === 'Open').length,
            lowStockItems: lowStockItems.map(i => ({ sku: i.sku, quantity: i.quantity, bin: i.bin })),
            topMovingItems: topItems,
            totalBins: bins.length
          }
        })
      })
      const data = await response.json()
      setChatResponse(data.response || 'No response from AI')
      setChatPrompt('')
    } catch (error) {
      setChatResponse('Error connecting to AI service')
    } finally {
      setChatLoading(false)
    }
  }

  const filteredInventory = inventory.filter(item => 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.bin.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <div className="text-slate-400 font-medium tracking-wide">Initializing Warehouse System...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification Container */}
      {message && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl transition-all duration-300 border backdrop-blur-md max-w-md ${
          message.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200' 
            : 'bg-rose-950/80 border-rose-500 text-rose-200'
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}
      
      {/* Universal Dashboard Top Header Bar */}
      <header className="bg-slate-900/60 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">Warehouse OS</h1>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                AI-Powered • Gemini Core Engine
              </p>
            </div>
          </div>
          
          {/* Quick Metrics KPI Board */}
          <div className="flex items-center gap-3 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner">
            <div className="px-4 py-2 text-center rounded-lg bg-slate-900 min-w-[80px]">
              <div className="text-lg font-black text-blue-400 font-mono">{inventory.length}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SKUs</div>
            </div>
            <div className="px-4 py-2 text-center rounded-lg bg-slate-900 min-w-[80px]">
              <div className="text-lg font-black text-emerald-400 font-mono">{bins.length}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bins</div>
            </div>
            <div className="px-4 py-2 text-center rounded-lg bg-slate-900 min-w-[80px]">
              <div className="text-lg font-black text-amber-400 font-mono">{orders.filter(o => o.status === 'Open').length}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active</div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Master Content Workspace Grid Grid Layout */}
      <div className="max-w-[1600px] w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        
        {/* LEFT COMPONENT COLUMN: Core Tab Routing Engine Layout */}
        <main className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 self-start">
            <button 
              onClick={() => setActiveTab('inventory')} 
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                activeTab === 'inventory' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Boxes className="w-4 h-4" /> Stock Control ({inventory.length})
            </button>
            <button 
              onClick={() => setActiveTab('bins')} 
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                activeTab === 'bins' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" /> Storage Bins ({bins.length})
            </button>
            <button 
              onClick={() => setActiveTab('orders')} 
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                activeTab === 'orders' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-4 h-4" /> Fulfillment ({orders.length})
            </button>
          </div>
          
          {/* TAB CONTENT: INVENTORY WORKSPACE CONTAINER */}
          {activeTab === 'inventory' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Product Creation Card */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-sm">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-blue-500" /> Putaway / Stock Accumulation Setup
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <input 
                      type="text" 
                      placeholder="SKU Code" 
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-600 text-slate-200 font-mono" 
                      value={newProduct.sku} 
                      onChange={(e) => {
                        setNewProduct({ ...newProduct, sku: e.target.value })
                        fetchSkuDescription(e.target.value)
                      }} 
                    />
                    {fetchingDescription && <span className="text-[11px] text-slate-500 mt-1 block animate-pulse">Searching catalog...</span>}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Product Narrative" 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-600 text-slate-200" 
                    value={newProduct.description} 
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} 
                  />
                  <input 
                    type="number" 
                    placeholder="Quantity" 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-600 text-slate-200" 
                    value={newProduct.quantity} 
                    onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })} 
                  />
                  <select 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-300" 
                    value={newProduct.bin} 
                    onChange={(e) => setNewProduct({ ...newProduct, bin: e.target.value })}
                  >
                    <option value="" className="text-slate-600">Select Storage Bin</option>
                    {bins.map(bin => (<option key={bin.id} value={bin.bin_code}>{bin.bin_code}</option>))}
                  </select>
                </div>
                <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800/60 pt-4">
                  <button 
                    onClick={addProduct} 
                    disabled={aiLoading} 
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-blue-600/10 transition-all"
                  >
                    <Package className="w-4 h-4" />
                    {aiLoading ? 'Processing Putaway...' : 'Execute Stock Update'}
                  </button>
                  <p className="text-xs text-slate-500">ℹ️ Matching SKU + Bin combinations will auto-accumulate quantity levels instantly.</p>
                </div>
              </div>
              
              {/* Warehouse Stock Grid Ledger Panel */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="font-bold text-white text-sm tracking-wide">Live Stock Master Record</h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Filter Ledger..." 
                      className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs w-full focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-200 placeholder-slate-600"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-950 text-slate-400 text-xs tracking-wider uppercase font-bold sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-3.5">SKU Reference</th>
                        <th className="px-6 py-3.5">Product Narrative</th>
                        <th className="px-6 py-3.5 text-center">Qty Available</th>
                        <th className="px-6 py-3.5">Bin Code</th>
                        <th className="px-6 py-3.5 text-right">Operations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredInventory.map(item => (
                        <tr key={item.id} className="hover:bg-slate-950/40 transition-colors group">
                          <td className="px-6 py-4 font-mono text-xs font-bold text-blue-400 tracking-wide">{item.sku}</td>
                          <td className="px-6 py-4 text-slate-300 text-xs font-medium">{item.description || '—'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                              item.quantity < 10 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {item.quantity}
                              {item.quantity < 10 && <span className="text-[10px] uppercase font-sans tracking-wide font-extrabold text-rose-500 animate-pulse">CRIT</span>}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-400">{item.bin}</td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => deleteItem('inventory', item.id, item.sku)} 
                              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-md hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredInventory.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-slate-500 text-xs font-medium">
                            No functional stock matches found inside the warehouse map.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* TAB CONTENT: STORAGE BINS MANAGEMENT PANEL */}
          {activeTab === 'bins' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-sm">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-blue-500" /> Establish Logistics Storage Bin Location
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="Coordinate Bin Code (e.g., D-04-01)" 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-600 text-slate-200 font-mono" 
                    value={newBin.bin_code} 
                    onChange={(e) => setNewBin({ ...newBin, bin_code: e.target.value })} 
                  />
                  <input 
                    type="text" 
                    placeholder="Logistics Management Zone (Receiving, Bulk Storage, Picking)" 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-600 text-slate-200" 
                    value={newBin.zone} 
                    onChange={(e) => setNewBin({ ...newBin, zone: e.target.value })} 
                  />
                </div>
                <button onClick={addBin} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-md">
                  Provision Bin Location
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {bins.map(bin => {
                  const stockInBin = inventory.filter(i => i.bin === bin.bin_code).reduce((sum, i) => sum + i.quantity, 0)
                  return (
                    <div key={bin.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-sm flex flex-col justify-between group relative hover:border-slate-700 transition-colors">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-sm text-slate-200">{bin.bin_code}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 font-medium text-slate-400">
                            {bin.zone || 'General'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-3 font-semibold flex items-center gap-1">
                          Volumetric Load: <span className="text-blue-400 font-mono font-bold">{stockInBin} Units</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                        <button 
                          onClick={() => deleteItem('bins', bin.id, bin.bin_code)} 
                          className="text-slate-500 hover:text-rose-400 text-[11px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Decommission
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* TAB CONTENT: ORDER FULLFILLMENT & ROUTING MODULE */}
          {activeTab === 'orders' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-sm">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-blue-500" /> Open Logistics Allocation Order
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input 
                    type="text" 
                    placeholder="System Order ID" 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-600 text-slate-200 font-mono" 
                    value={newOrder.order_id} 
                    onChange={(e) => setNewOrder({ ...newOrder, order_id: e.target.value })} 
                  />
                  <input 
                    type="text" 
                    placeholder="Client Account Name" 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-600 text-slate-200" 
                    value={newOrder.customer} 
                    onChange={(e) => setNewOrder({ ...newOrder, customer: e.target.value })} 
                  />
                  <select 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-300" 
                    value={newOrder.type} 
                    onChange={(e) => setNewOrder({ ...newOrder, type: e.target.value as any })}
                  >
                    <option value="Outbound">Outbound Fulfillment (Removes Stock)</option>
                    <option value="Inbound">Inbound Putaway (Adds Stock)</option>
                    <option value="Internal">Internal Stock Relocation</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="SKU Reference" 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-600 text-slate-200 font-mono" 
                    value={newOrder.sku} 
                    onChange={(e) => setNewOrder({ ...newOrder, sku: e.target.value })} 
                  />
                  <input 
                    type="number" 
                    placeholder="Volume Allocation" 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-600 text-slate-200" 
                    value={newOrder.quantity} 
                    onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })} 
                  />
                  <select 
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-300" 
                    value={newOrder.bin} 
                    onChange={(e) => setNewOrder({ ...newOrder, bin: e.target.value })}
                  >
                    <option value="">Target Bin Destination</option>
                    {bins.map(bin => (<option key={bin.id} value={bin.bin_code}>{bin.bin_code}</option>))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-slate-800/60">
                  <button onClick={addOrder} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-md">
                    Commit Document Line
                  </button>
                  
                  {newOrder.sku && newOrder.order_id && newOrder.type === 'Outbound' && (
                    <button onClick={getAiBinSuggestion} disabled={aiLoading} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-violet-600/10 transition-all">
                      <Sparkles className="w-4 h-4" />
                      {aiLoading ? 'Calculating Space Vectors...' : 'Run Automated Bin Recommendation'}
                    </button>
                  )}
                </div>
                
                {/* Embedded Inline Micro AI Recommendations response layout card */}
                {aiSuggestions && !aiSuggestions.error && (
                  <div className="mt-4 bg-gradient-to-tr from-violet-950/40 to-slate-900 rounded-xl p-5 border border-violet-800/40 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold tracking-widest uppercase text-violet-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Intelligence Vector Output
                      </span>
                      <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold font-mono">
                        CONFIDENCE: {Math.round((aiSuggestions.confidenceScore || 0.8) * 100)}%
                      </span>
                    </div>
                    <div className="text-3xl font-mono font-black text-white tracking-tight">{aiSuggestions.recommendedBin}</div>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">{aiSuggestions.reason}</p>
                    {aiSuggestions.alternativeBins?.length > 0 && (
                      <p className="text-xs text-slate-500 mt-2 font-medium">Alternative Node Paths: {aiSuggestions.alternativeBins.join(', ')}</p>
                    )}
                  </div>
                )}
                
                {aiSuggestions?.error && (
                  <div className="mt-4 bg-rose-950/40 text-rose-300 p-4 border border-rose-800/40 rounded-xl text-xs font-medium">❌ Strategy Allocation Engine Error: {aiSuggestions.error}</div>
                )}
              </div>
              
              {/* Order Manifest List Card View */}
              <div className="space-y-3">
                <div className="bg-slate-900 px-6 py-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Active Allocation Documents</h3>
                  <span className="text-[11px] text-slate-500 font-medium">Outbound tasks manage systemic stock verification metrics automatically.</span>
                </div>
                
                {orders.map(order => {
                  const currentStock = inventory.find(i => i.sku === order.sku && i.bin === order.bin)?.quantity || 0
                  const isStockDeficit = order.type === 'Outbound' && order.status === 'Open' && currentStock < order.quantity
                  
                  return (
                    <div key={order.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm hover:border-slate-700/60 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-black text-xs text-white tracking-wide bg-slate-950 px-2 py-1 rounded-md border border-slate-800 shadow-sm">{order.order_id}</span>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              order.type === 'Inbound' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {order.type === 'Inbound' ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
                              {order.type}
                            </span>
                            <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-md ${
                              order.status === 'Open' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                              order.status === 'In Transit' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {order.status}
                            </span>
                            {isStockDeficit && (
                              <span className="text-[10px] font-black tracking-wide bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Allocation Deficit
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-200 pt-1">
                            {order.customer} — <span className="font-mono font-bold text-blue-400">{order.sku}</span> x <span className="font-mono font-bold text-amber-400">{order.quantity}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">Source Coordination: <span className="font-mono text-slate-400 font-bold">{order.bin}</span></div>
                        </div>
                        
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {order.status === 'Open' && (
                            <button 
                              onClick={() => updateOrderStatus(order.order_id, 'In Transit')} 
                              disabled={isStockDeficit}
                              className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600 text-white px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-md transition-colors"
                            >
                              <Play className="w-3 h-3" /> Dispatch Task
                            </button>
                          )}
                          {order.status === 'In Transit' && (
                            <button 
                              onClick={() => updateOrderStatus(order.order_id, 'Closed')} 
                              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-md transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Close Line
                            </button>
                          )}
                          <button onClick={() => deleteItem('orders', order.id, order.order_id)} className="text-slate-500 hover:text-rose-400 text-xs font-bold p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors">
                            Purge
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
        
        {/* RIGHT COMPONENT COLUMN: Unified Real-Time AI Copilot Sidebar Engine */}
        <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-[92px] h-fit">
          
          {/* CONTROL BOX A: AI Audit Strategy Component */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl border border-slate-800 p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full group-hover:bg-blue-500/10 transition-all duration-500" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">Strategic Inventory Audit</h3>
                  <p className="text-[10px] text-slate-500">Volumetric and Threshold Verification</p>
                </div>
              </div>
              <button 
                onClick={runInventoryAudit} 
                disabled={aiLoading} 
                className="bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                {aiLoading ? 'Auditing...' : 'Execute Audit'}
              </button>
            </div>
            
            {inventoryAudit ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gross Node Value</div>
                    <div className="text-sm font-black font-mono text-white mt-0.5">${inventoryAudit.summary?.totalValue?.toLocaleString() || '0'}</div>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Distinct Matrix SKUs</div>
                    <div className="text-sm font-black font-mono text-white mt-0.5">{inventoryAudit.summary?.uniqueSKUs || inventory.length}</div>
                  </div>
                </div>
                {inventoryAudit.summary?.lowStockItems?.length > 0 && (
                  <div className="bg-amber-500/5 border border-amber-500/20 p-2.5 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <div className="font-bold mb-0.5">Critical Reorder Buffers Triggered</div>
                      <div className="font-mono text-slate-400 text-[11px]">{inventoryAudit.summary.lowStockItems.join(', ')}</div>
                    </div>
                  </div>
                )}
                <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-850/60">
                  {inventoryAudit.recommendations?.slice(0, 3).map((rec: string, i: number) => (
                    <div key={i} className="text-xs text-slate-300 leading-relaxed py-1 first:pt-0 last:pb-0 border-b last:border-0 border-slate-800/40">💡 {rec}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-xs text-slate-500 font-medium bg-slate-950/20">
                Run operational matrix assessment to retrieve AI analytics.
              </div>
            )}
          </div>

          {/* CONTROL BOX B: Picking Wave Operations Module */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl border border-slate-800 p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full group-hover:bg-emerald-500/10 transition-all duration-500" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">Algorithmic Picking Waves</h3>
                  <p className="text-[10px] text-slate-500">Heuristic Path Traversal Core</p>
                </div>
              </div>
              <button 
                onClick={optimizePickingWave} 
                disabled={aiLoading} 
                className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                {aiLoading ? 'Routing...' : 'Optimize Waves'}
              </button>
            </div>
            
            {pickingOptimization ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex justify-between items-center text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                  <span className="text-slate-400 font-semibold">Total Target Traversal Time:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">{Math.floor(pickingOptimization.totalEstimatedTime / 60)} mins</span>
                </div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {pickingOptimization.pickWaves?.slice(0, 3).map((wave: any, idx: number) => (
                    <div key={idx} className="bg-slate-950 rounded-lg p-2.5 border border-slate-850 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-white">{wave.waveId}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${wave.priority === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>{wave.priority}</span>
                      </div>
                      <div className="text-slate-400 text-[11px] truncate">Lines: {wave.orders?.join(', ')}</div>
                      <div className="text-slate-500 text-[10px] mt-1 font-semibold">Execution Vector: {Math.floor(wave.estimatedDuration / 60)} min</div>
                    </div>
                  ))}
                </div>
                {pickingOptimization.recommendations && (
                  <div className="bg-slate-950 p-2.5 border border-slate-850 rounded-lg text-[11px] text-slate-300 leading-relaxed">
                    💡 {pickingOptimization.recommendations[0]}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-xs text-slate-500 font-medium bg-slate-950/20">
                Execute picking sequence engine analysis to establish paths.
              </div>
            )}
          </div>

          {/* CONTROL BOX C: Natural Language Processing System Terminal (AI Chat) */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-lg flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Mic className="w-4 h-4 text-violet-400" />
              <h3 className="font-bold text-white text-xs uppercase tracking-wider">Natural Language Terminal</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Query system states..." 
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none text-slate-200 placeholder-slate-600" 
                  value={chatPrompt} 
                  onChange={(e) => setChatPrompt(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()} 
                />
                <button onClick={sendChatMessage} disabled={chatLoading} className="bg-violet-600 hover:bg-violet-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {chatLoading && <div className="text-xs text-slate-500 animate-pulse flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin text-violet-400" /> Computing systemic context variables...</div>}
              {chatResponse && (
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-850 text-xs text-slate-300 leading-relaxed font-medium animate-in fade-in duration-200 max-h-[160px] overflow-y-auto">
                  {chatResponse}
                </div>
              )}
            </div>
          </div>
          
        </aside>
      </div>
    </div>
  )
}
