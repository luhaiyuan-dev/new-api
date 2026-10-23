/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import i18next from 'i18next'
import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

import { useIsAdmin } from '@/hooks/use-admin'
import { useDebounce } from '@/hooks/use-debounce'
import { useAuthStore } from '@/stores/auth-store'

import {
  getUserBillingHistory,
  getAllBillingHistory,
  completeOrder,
  isApiSuccess,
} from '../api'
import type { TopupRecord } from '../types'

// ============================================================================
// Billing History Hook
// ============================================================================

interface UseBillingHistoryOptions {
  /** Load history only while its dialog is open. */
  enabled?: boolean
  /** Initial page number */
  initialPage?: number
  /** Initial page size */
  initialPageSize?: number
}

export function useBillingHistory(options: UseBillingHistoryOptions = {}) {
  const { enabled = true, initialPage = 1, initialPageSize = 10 } = options
  const isAdmin = useIsAdmin()
  const sessionSID = useAuthStore((state) => state.auth.session?.sid)

  const [history, setHistory] = useState<{
    sessionSID?: string
    records: TopupRecord[]
    total: number
  }>({ records: [], total: 0 })
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounce(keyword)
  const requestIdRef = useRef(0)
  const [loading, setLoading] = useState(false)
  const [completing, setCompleting] = useState(false)

  /**
   * Fetch billing history
   */
  const fetchBillingHistory = useCallback(async () => {
    if (
      !enabled ||
      !sessionSID ||
      useAuthStore.getState().auth.session?.sid !== sessionSID
    ) {
      return
    }

    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const response = isAdmin
        ? await getAllBillingHistory(page, pageSize, debouncedKeyword)
        : await getUserBillingHistory(page, pageSize, debouncedKeyword)

      if (
        requestId !== requestIdRef.current ||
        useAuthStore.getState().auth.session?.sid !== sessionSID
      ) {
        return
      }

      if (isApiSuccess(response) && response.data) {
        setHistory({
          sessionSID,
          records: response.data.items || [],
          total: response.data.total || 0,
        })
      } else {
        toast.error(
          response.message || i18next.t('Failed to load billing history')
        )
        setHistory({ sessionSID, records: [], total: 0 })
      }
    } catch (error) {
      if (
        requestId !== requestIdRef.current ||
        useAuthStore.getState().auth.session?.sid !== sessionSID
      ) {
        return
      }

      // eslint-disable-next-line no-console
      console.error('Failed to fetch billing history:', error)
      toast.error(i18next.t('Failed to load billing history'))
      setHistory({ sessionSID, records: [], total: 0 })
    } finally {
      if (
        requestId === requestIdRef.current &&
        useAuthStore.getState().auth.session?.sid === sessionSID
      ) {
        setLoading(false)
      }
    }
  }, [debouncedKeyword, enabled, isAdmin, page, pageSize, sessionSID])

  /**
   * Complete a pending order (admin only)
   */
  const handleCompleteOrder = useCallback(
    async (tradeNo: string) => {
      if (!isAdmin) {
        toast.error(i18next.t('Admin access required'))
        return false
      }

      setCompleting(true)
      try {
        const response = await completeOrder({ trade_no: tradeNo })
        if (isApiSuccess(response)) {
          toast.success(i18next.t('Order completed successfully'))
          // Refresh the list
          await fetchBillingHistory()
          return true
        } else {
          toast.error(response.message || i18next.t('Failed to complete order'))
          return false
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to complete order:', error)
        toast.error(i18next.t('Failed to complete order'))
        return false
      } finally {
        setCompleting(false)
      }
    },
    [isAdmin, fetchBillingHistory]
  )

  /**
   * Change page
   */
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  /**
   * Change page size
   */
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1) // Reset to first page when changing page size
  }, [])

  /**
   * Search by keyword
   */
  const handleSearch = useCallback((newKeyword: string) => {
    requestIdRef.current += 1
    setKeyword(newKeyword)
    setPage(1) // Reset to first page when searching
  }, [])

  // Fetch data after the search draft has settled.
  useEffect(() => {
    if (!enabled || !sessionSID) return
    if (keyword !== debouncedKeyword) return

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void fetchBillingHistory()
    })
    return () => {
      cancelled = true
      requestIdRef.current += 1
    }
  }, [debouncedKeyword, enabled, fetchBillingHistory, keyword, sessionSID])

  const historyVisible =
    enabled && !!sessionSID && history.sessionSID === sessionSID

  return {
    records: historyVisible ? history.records : [],
    total: historyVisible ? history.total : 0,
    page,
    pageSize,
    keyword,
    loading: enabled && !!sessionSID && loading,
    completing,
    isAdmin,
    handlePageChange,
    handlePageSizeChange,
    handleSearch,
    handleCompleteOrder,
    refresh: fetchBillingHistory,
  }
}
