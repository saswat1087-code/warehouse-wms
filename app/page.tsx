'use client'

import { useEffect, useState } from 'react'
import { supabase, Inventory, Bin, Order } from '@/lib/supabase'
import { Sparkles, Zap, TrendingUp, Mic, Send, BarChart3, AlertCircle } from 'lucide-react'

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
  const [showAiPanel, setShowAiPanel] = useState(true)
  const [pickingOptimization, setPickingOptimization] = useState<any>(null)
  const [chatPrompt, setChatPrompt] = useState('')
  const [chatResponse, setChatResponse] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [inventoryAudit, setInventoryAudit] = useState<any>(null)

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
    setTimeout(() => setMessage(null), 3000)
  }
  
  async function addProduct() {
    if (!newProduct.sku || !newProduct.bin) {
      showMessage('error', 'SKU and Bin are required')
      return
    }
    
    const { error } = await supabase.from('inventory').insert([{
      sku: newProduct.sku.toUpperCase(),
      description: newProduct.description,
      quantity: parseInt(newProduct.quantity) || 0,
      bin: newProduct.bin.toUpperCase()
    }])
    
    if (error) showMessage('error', 'Failed to add product: ' + error.message)
    else {
      showMessage('success', 'Product added successfully!')
      setNewProduct({ sku: '', description: '', quantity: '', bin: '' })
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
      showMessage('success', 'Bin added successfully!')
      setNewBin({ bin_code: '', zone: '' })
    }
  }
  
  async function addOrder() {
    if (!newOrder.order_id || !newOrder.customer || !newOrder.sku || !newOrder.quantity || !newOrder.bin) {
      showMessage('error', 'All fields are required')
      return
    }
    
    const { error } = await supabase.from('orders').insert([{
      order_id: newOrder.order_id.toUpperCase(),
      customer: newOrder.customer,
      type: newOrder.type,
      sku: newOrder.sku.toUpperCase(),
      quantity: parseInt(newOrder.quantity),
      bin: newOrder.bin.toUpperCase(),
      status: 'Open'
    }])
    
    if (error) showMessage('error', 'Failed to add order: ' + error.message)
    else {
      showMessage('success', 'Order created successfully!')
      setNewOrder({ order_id: '', customer: '', type: 'Outbound', sku: '', quantity: '', bin: '' })
      setAiSuggestions(null)
    }
  }
  
  async function updateOrderStatus(orderId: string, newStatus: string) {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('order_id', orderId)
    if (error) showMessage('error', 'Failed to update order')
    else showMessage('success', `Order ${orderId} updated to ${newStatus}`)
  }
  
  async function deleteItem(table: string, id: number, identifier: string) {
    if (confirm(`Delete ${identifier}? This cannot be undone.`)) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) showMessage('error', 'Failed to delete')
      else showMessage('success', 'Deleted successfully')
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
        .select('bin, quantity, sku, description')
        .eq('sku', newOrder.sku.toUpperCase())
        .gt('quantity', 0)
      
      if (!availableBins || availableBins.length === 0) {
        setAiSuggestions({ error: 'No stock available for this SKU' })
        setAiLoading(false)
        return
      }
      
      const response = await fetch('/api/ai/suggest-bin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: newOrder.sku.toUpperCase(),
          quantity: parseInt(newOrder.quantity),
          orderId: newOrder.order_id.toUpperCase(),
          customer: newOrder.customer,
          availableBins: availableBins
        })
      })
      
      const suggestion = await response.json()
      setAiSuggestions(suggestion)
      
      if (suggestion.recommendedBin) {
        setNewOrder(prev => ({ ...prev, bin: suggestion.recommendedBin }))
      }
      
    } catch (error) {
      setAiSuggestions({ error: 'Failed to get AI suggestion' })
    } finally {
      setAiLoading(false)
    }
  }
  
  async function optimizePickingWave() {
    setAiLoading(true)
    
    try {
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'Open')
        .eq('type', 'Outbound')
      
      const { data: allBins } = await supabase.from('bins').select('*')
      
      const response = await fetch('/api/ai/picking-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: pendingOrders || [],
          pickingZones: allBins || [],
          currentTime: new Date().toISOString(),
          workerCount: 3
        })
      })
      
      const optimization = await response.json()
      setPickingOptimization(optimization)
      
    } catch (error) {
      console.error('Optimization error:', error)
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
          inventory: inventory.slice(0, 100),
          orders: orders.filter(o => o.status === 'Open'),
          bins: bins
        })
      })
      
      const audit = await response.json()
      setInventoryAudit(audit)
      
    } catch (error) {
      console.error('Audit error:', error)
    } finally {
      setAiLoading(false)
    }
  }
  
  async function sendChatMessage() {
    if (!chatPrompt.trim()) return
    
    setChatLoading(true)
    setChatResponse('')
    
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: chatPrompt,
          context: {
            totalSKUs: inventory.length,
            totalQuantity: inventory.reduce((sum, i) => sum + i.quantity, 0),
            activeOrders: orders.filter(o => o.status === 'Open').length,
            openTasks: 0
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
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3">📦</div>
          <div className="text-gray-600 animate-pulse">Loading Warehouse System...</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm ${
          message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message.text}
        </div>
      )}
      
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏭</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Warehouse OS</h1>
                <p className="text-xs text-gray-500">AI-Powered by Gemini 1.5 Flash</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {inventory.length} SKUs | {bins.length} Bins | {orders.length} Orders
            </div>
          </div>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 font-medium transition-all ${activeTab === 'inventory' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>📦 Inventory ({inventory.length})</button>
          <button onClick={() => setActiveTab('bins')} className={`px-4 py-2 font-medium transition-all ${activeTab === 'bins' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>🗄️ Bins ({bins.length})</button>
          <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 font-medium transition-all ${activeTab === 'orders' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>📝 Orders ({orders.length})</button>
        </div>
        
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold mb-3">Add New Product</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input type="text" placeholder="SKU" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} />
                <input type="text" placeholder="Description" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} />
                <input type="number" placeholder="Quantity" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newProduct.quantity} onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })} />
                <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newProduct.bin} onChange={(e) => setNewProduct({ ...newProduct, bin: e.target.value })}>
                  <option value="">Select Bin</option>
                  {bins.map(bin => (<option key={bin.id} value={bin.bin_code}>{bin.bin_code}</option>))}
                </select>
              </div>
              <button onClick={addProduct} className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Product</button>
            </div>
            
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-emerald-900">AI Inventory Audit</h3>
                </div>
                <button onClick={runInventoryAudit} disabled={aiLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {aiLoading ? 'Analyzing...' : 'Run Audit'}
                </button>
              </div>
              
              {inventoryAudit && (
                <div className="mt-3 space-y-2">
                  {inventoryAudit.summary?.lowStockItems?.length > 0 && (
                    <div className="bg-yellow-50 p-2 rounded text-sm">
                      <AlertCircle className="w-4 h-4 inline text-yellow-600 mr-1" />
                      Low Stock: {inventoryAudit.summary.lowStockItems.join(', ')}
                    </div>
                  )}
                  {inventoryAudit.recommendations?.map((rec: string, i: number) => (
                    <div key={i} className="text-sm text-gray-700">💡 {rec}</div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr><th className="text-left px-4 py-3">SKU</th><th className="text-left px-4 py-3">Description</th><th className="text-left px-4 py-3">Quantity</th><th className="text-left px-4 py-3">Bin</th><th className="text-left px-4 py-3">Actions</th></tr>
                </thead>
                <tbody>
                  {inventory.map(item => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                      <td className="px-4 py-3">{item.description || '-'}</td>
                      <td className="px-4 py-3 font-semibold">{item.quantity}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.bin}</td>
                      <td className="px-4 py-3"><button onClick={() => deleteItem('inventory', item.id, item.sku)} className="text-red-500 hover:text-red-700 text-xs">Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab === 'bins' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold mb-3">Add New Bin</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="text" placeholder="Bin Code" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newBin.bin_code} onChange={(e) => setNewBin({ ...newBin, bin_code: e.target.value })} />
                <input type="text" placeholder="Zone" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newBin.zone} onChange={(e) => setNewBin({ ...newBin, zone: e.target.value })} />
              </div>
              <button onClick={addBin} className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Bin</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {bins.map(bin => (
                <div key={bin.id} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="font-mono font-bold text-sm">{bin.bin_code}</div>
                  <div className="text-xs text-gray-500 mt-1">Zone: {bin.zone || 'General'}</div>
                  <button onClick={() => deleteItem('bins', bin.id, bin.bin_code)} className="mt-2 text-red-500 hover:text-red-700 text-xs">Delete</button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold mb-3">Create Order</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="text" placeholder="Order ID" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newOrder.order_id} onChange={(e) => setNewOrder({ ...newOrder, order_id: e.target.value })} />
                <input type="text" placeholder="Customer" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newOrder.customer} onChange={(e) => setNewOrder({ ...newOrder, customer: e.target.value })} />
                <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newOrder.type} onChange={(e) => setNewOrder({ ...newOrder, type: e.target.value as any })}>
                  <option value="Inbound">📥 Inbound</option>
                  <option value="Outbound">📤 Outbound</option>
                  <option value="Internal">🔄 Internal</option>
                </select>
                <input type="text" placeholder="SKU" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newOrder.sku} onChange={(e) => setNewOrder({ ...newOrder, sku: e.target.value })} />
                <input type="number" placeholder="Quantity" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newOrder.quantity} onChange={(e) => setNewOrder({ ...newOrder, quantity: e.target.value })} />
                <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={newOrder.bin} onChange={(e) => setNewOrder({ ...newOrder, bin: e.target.value })}>
                  <option value="">Select Bin</option>
                  {bins.map(bin => (<option key={bin.id} value={bin.bin_code}>{bin.bin_code}</option>))}
                </select>
              </div>
              <div className="flex gap-3 mt-3">
                <button onClick={addOrder} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Create Order</button>
                
                {/* AI Smart Bin Picker Button */}
                {newOrder.sku && newOrder.order_id && newOrder.type === 'Outbound' && (
                  <button onClick={getAiBinSuggestion} disabled={aiLoading} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {aiLoading ? 'Analyzing...' : '✨ Get AI Bin Recommendation'}
                  </button>
                )}
              </div>
              
              {/* AI Recommendation Display */}
              {aiSuggestions && !aiSuggestions.error && (
                <div className="mt-3 bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-purple-900">🤖 AI Recommendation</span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      Confidence: {Math.round((aiSuggestions.confidenceScore || 0.8) * 100)}%
                    </span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-purple-700 mt-1">{aiSuggestions.recommendedBin}</div>
                  <p className="text-xs text-gray-600 mt-1">{aiSuggestions.reason}</p>
                  {aiSuggestions.estimatedPickTime && (
                    <p className="text-xs text-gray-500 mt-1">⏱️ Est. pick time: {aiSuggestions.estimatedPickTime} seconds</p>
                  )}
                </div>
              )}
              
              {aiSuggestions?.error && (
                <div className="mt-3 bg-red-50 text-red-600 p-3 rounded-lg text-sm">❌ {aiSuggestions.error}</div>
              )}
            </div>
            
            {/* AI Wave Optimization Panel */}
            <div className="p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">AI Wave Optimization</h3>
                </div>
                <button onClick={optimizePickingWave} disabled={aiLoading} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {aiLoading ? 'Optimizing...' : 'Optimize Now'}
                </button>
              </div>
              
              {pickingOptimization && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm bg-white p-2 rounded">
                    <span>📊 Total Est. Time:</span>
                    <span className="font-mono font-bold">{Math.floor(pickingOptimization.totalEstimatedTime / 60)} minutes</span>
                  </div>
                  {pickingOptimization.pickWaves?.map((wave: any, idx: number) => (
                    <div key={idx} className="bg-white rounded-lg p-2 text-sm border border-green-100">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold">{wave.waveId}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${wave.priority === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{wave.priority}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Orders: {wave.orders?.join(', ')}</div>
                    </div>
                  ))}
                  {pickingOptimization.recommendations && (
                    <div className="bg-blue-50 p-2 rounded text-xs">💡 {pickingOptimization.recommendations[0]}</div>
                  )}
                </div>
              )}
            </div>
            
            {/* AI Chat Assistant */}
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
              <div className="flex items-center gap-2 mb-3">
                <Mic className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-indigo-900">AI Warehouse Assistant</h3>
                <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">Ask me anything</span>
              </div>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="e.g., 'Show me low stock items' or 'How to optimize picking?'" 
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" 
                  value={chatPrompt} 
                  onChange={(e) => setChatPrompt(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()} 
                />
                <button onClick={sendChatMessage} disabled={chatLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1">
                  <Send className="w-4 h-4" /> Send
                </button>
              </div>
              
              {chatLoading && <div className="mt-2 text-sm text-gray-500 animate-pulse">🤖 AI is thinking...</div>}
              {chatResponse && (
                <div className="mt-3 bg-white rounded-lg p-3 border border-indigo-100">
                  <p className="text-sm text-gray-700">{chatResponse}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              {orders.map(order => (
                <div key={order.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold">{order.order_id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${order.type === 'Inbound' ? 'bg-green-100 text-green-800' : order.type === 'Outbound' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{order.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'Open' ? 'bg-yellow-100 text-yellow-800' : order.status === 'In Transit' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>{order.status}</span>
                      </div>
                      <div className="text-sm mt-1"><span className="font-medium">{order.customer}</span> - {order.sku} x {order.quantity}</div>
                      <div className="text-xs text-gray-500 mt-1">Bin: {order.bin}</div>
                    </div>
                    <div className="flex gap-2">
                      {order.status === 'Open' && <button onClick={() => updateOrderStatus(order.order_id, 'In Transit')} className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded">Start Transit</button>}
                      {order.status === 'In Transit' && <button onClick={() => updateOrderStatus(order.order_id, 'Closed')} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded">Complete</button>}
                      <button onClick={() => deleteItem('orders', order.id, order.order_id)} className="text-red-500 hover:text-red-700 text-xs px-3 py-1">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
Add Gemini AI features - Smart bin picking, wave optimization, inventory audit, and chat assistant
