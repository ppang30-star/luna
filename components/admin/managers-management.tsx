'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import { initializeManagersTable } from '@/lib/supabase/initialize-managers-table'

interface Manager {
  id?: string
  name: string
  password: string
  created_at?: string
}

export default function ManagersManagement() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [tableInitialized, setTableInitialized] = useState(false)

  // Format date safely
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const initializeTable = async () => {
    try {
      console.log('[v0] Initializing managers table...')
      const success = await initializeManagersTable()
      if (success) {
        console.log('[v0] Managers table initialized successfully')
        setTableInitialized(true)
        return true
      } else {
        console.error('[v0] Failed to initialize managers table')
        setError('Failed to initialize managers table. Please check your database connection.')
        setTableInitialized(false)
        return false
      }
    } catch (err) {
      console.error('[v0] Error initializing table:', err)
      setError('Error initializing table')
      setTableInitialized(false)
      return false
    }
  }

  const loadManagers = async () => {
    try {
      setLoading(true)
      setError(null)
      const { getManagers } = await import('@/lib/manager-price')
      const data = await getManagers?.()
      setManagers(data || [])
    } catch (err) {
      console.error('[v0] Error loading managers:', err)
      setManagers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initialize = async () => {
      // First initialize the table
      const initialized = await initializeTable()
      if (initialized) {
        // Then load managers
        await loadManagers()
      }
    }
    initialize()
  }, [])

  const handleAddManager = async () => {
    if (!tableInitialized) {
      setError('테이블 초기화 중입니다. 잠시만 기다려주세요.')
      return
    }

    if (!newName.trim() || !newPassword.trim()) {
      setError('이름과 비밀번호를 모두 입력해주세요.')
      return
    }

    if (newPassword.length < 4) {
      setError('비밀번호는 최소 4자 이상이어야 합니다.')
      return
    }

    setIsAdding(true)
    setError(null)
    try {
      const { upsertManager } = await import('@/lib/manager-price')
      const result = await upsertManager?.(newName, newPassword)
      
      if (result?.success) {
        setNewName('')
        setNewPassword('')
        await loadManagers()
      } else {
        const errorMsg = result?.error || '관리자 추가 실패'
        setError(errorMsg)
        console.error('[v0] Manager add failed:', errorMsg)
      }
    } catch (err: any) {
      const errorMsg = err?.message || String(err) || '알 수 없는 오류'
      console.error('[v0] Error adding manager:', errorMsg, err)
      setError(`관리자 추가 오류: ${errorMsg}`)
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteManager = async (name: string) => {
    if (!confirm(`관리자 "${name}"을(를) 삭제하시겠습니까?`)) return

    try {
      const { deleteManager } = await import('@/lib/manager-price')
      const result = await deleteManager?.(name)
      if (result?.success) {
        await loadManagers()
      } else {
        const errorMsg = result?.error || '관리자 삭제 실패'
        setError(errorMsg)
        console.error('[v0] Manager delete failed:', errorMsg)
      }
    } catch (err: any) {
      const errorMsg = err?.message || String(err) || '알 수 없는 오류'
      console.error('[v0] Error deleting manager:', errorMsg, err)
      setError(`관리자 삭제 오류: ${errorMsg}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Manager Card */}
      <Card>
        <CardHeader>
          <CardTitle>관리자 추가</CardTitle>
          <CardDescription>고유한 이름과 비밀번호로 새로운 관리자 계정을 생성합니다</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-600 text-sm space-y-2">
                <p className="font-medium">⚠️ {error}</p>
                
                {/* RLS Policy Error Help */}
                {error.includes('new row violates row-level security policy') || error.includes('RLS') || error.includes('Policy') ? (
                  <div className="text-xs bg-black/20 p-2 rounded border border-red-500/30 space-y-2">
                    <p className="font-semibold">✓ RLS 정책이 없습니다. Supabase 대시보드의 SQL 에디터에서 다음을 실행하세요:</p>
                    <code className="block whitespace-pre-wrap break-words text-red-400 bg-black/40 p-2 rounded">
{`ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON managers
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Allow public select" ON managers
  FOR SELECT USING (TRUE);

CREATE POLICY "Allow public update" ON managers
  FOR UPDATE USING (TRUE);

CREATE POLICY "Allow public delete" ON managers
  FOR DELETE USING (TRUE);`}
                    </code>
                  </div>
                ) : error.includes('initialize') ? (
                  <div className="text-xs bg-black/20 p-2 rounded border border-red-500/30">
                    <p className="font-semibold mb-1">✓ 테이블을 생성하려면 다음 SQL을 실행하세요:</p>
                    <code className="block whitespace-pre-wrap break-words text-red-400">
                      CREATE TABLE IF NOT EXISTS managers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'manager', created_at TIMESTAMP DEFAULT NOW());
                    </code>
                  </div>
                ) : null}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">관리자 이름</label>
                <Input
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setError(null) }}
                  placeholder="예: John, Sarah"
                  disabled={isAdding || !tableInitialized}
                  className="bg-background border-border"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">비밀번호</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(null) }}
                  placeholder="최소 4자"
                  disabled={isAdding || !tableInitialized}
                  className="bg-background border-border"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isAdding && tableInitialized) {
                      handleAddManager()
                    }
                  }}
                />
              </div>
            </div>

            <Button
              onClick={handleAddManager}
              disabled={isAdding || !tableInitialized}
              className="w-full bg-primary hover:bg-primary/90 gap-2"
            >
              <Plus className="w-4 h-4" />
              {isAdding ? '추가 중...' : tableInitialized ? '관리자 추가' : '테이블 초기화 중...'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Managers List Card */}
      <Card>
        <CardHeader>
          <CardTitle>관리자 목록</CardTitle>
          <CardDescription>총: {managers?.length || 0}명</CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">관리자 목록 로드 중...</div>
          ) : !tableInitialized ? (
            <div className="text-center py-8 text-muted-foreground">테이블을 초기화하는 중입니다. 잠시만 기다려주세요...</div>
          ) : (managers?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {(managers ?? []).map((manager) => (
                <div key={manager.name || manager.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div>
                    <p className="font-medium">{manager.name}</p>
                    <p className="text-xs text-muted-foreground">
                      등록: {formatDate(manager.created_at)}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleDeleteManager(manager.name)}
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">관리자가 없습니다. 위에서 등록하세요.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
