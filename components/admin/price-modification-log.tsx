'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PriceAdjustmentLog {
  id: string
  menu_item_id: string
  menu_name?: string
  original_price?: number
  adjusted_price?: number
  price_change?: number
  manager_name?: string
  adjustment_date?: string
  created_at: string
}

export default function PriceModificationLog() {
  const [logs, setLogs] = useState<PriceAdjustmentLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      // Safely import and load logs
      try {
        const { getPriceAdjustmentLogs } = await import('@/lib/manager-price')
        const data = await getPriceAdjustmentLogs?.()
        setLogs(data || [])
      } catch (err) {
        console.warn('[v0] Price adjustment logs not available', err)
        setLogs([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadLogs()
    setRefreshing(false)
  }

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Delete this log entry?')) return

    try {
      const supabase = createClient()
      await supabase
        .from('price_adjustment_logs')
        .delete()
        .eq('id', logId)
      
      setLogs((prev) => prev.filter(log => log.id !== logId))
    } catch (err) {
      console.error('[v0] Error deleting log:', err)
      setError('Failed to delete log')
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleString()
    } catch {
      return dateString
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Price Modification Log</CardTitle>
            <CardDescription>Audit trail of all manager price adjustments</CardDescription>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading price modification logs...</div>
        ) : (logs?.length ?? 0) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium">Date</th>
                  <th className="text-left py-3 px-2 font-medium">Menu Item</th>
                  <th className="text-left py-3 px-2 font-medium">Manager</th>
                  <th className="text-right py-3 px-2 font-medium">Original Price</th>
                  <th className="text-right py-3 px-2 font-medium">Adjusted Price</th>
                  <th className="text-right py-3 px-2 font-medium">Change</th>
                  <th className="text-center py-3 px-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {(logs ?? []).map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-2">{formatDate(log.created_at)}</td>
                    <td className="py-3 px-2">{log.menu_name || 'Unknown'}</td>
                    <td className="py-3 px-2">{log.manager_name || 'Unknown'}</td>
                    <td className="text-right py-3 px-2">{log.original_price?.toLocaleString() || 'N/A'}</td>
                    <td className="text-right py-3 px-2">{log.adjusted_price?.toLocaleString() || 'N/A'}</td>
                    <td className="text-right py-3 px-2">
                      <span className={log.price_change && log.price_change > 0 ? 'text-green-600' : log.price_change && log.price_change < 0 ? 'text-red-600' : ''}>
                        {log.price_change ? (log.price_change > 0 ? '+' : '') + log.price_change.toLocaleString() : 'N/A'}
                      </span>
                    </td>
                    <td className="text-center py-3 px-2">
                      <Button
                        onClick={() => handleDeleteLog(log.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">No price modifications logged yet.</div>
        )}
      </CardContent>
    </Card>
  )
}
