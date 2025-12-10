import { useState } from 'react'
import { Button } from './ui/Button'

interface CalendarExportProps {
  /** Username for exporting user's calendar */
  username?: string
  /** Individual event ID for exporting single event */
  eventId?: string
  /** Whether to show feed export option (public events) */
  showFeed?: boolean
}

export function CalendarExport({ username, eventId, showFeed = false }: CalendarExportProps) {
  const [exporting, setExporting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExportICS = async () => {
    try {
      setExporting('ics')
      setError(null)
      
      let url = '/api/calendar/'
      if (eventId) {
        url += `${eventId}/export.ics`
      } else if (username) {
        url += `user/${username}/export.ics`
      } else if (showFeed) {
        url += 'feed.ics'
      } else {
        throw new Error('No export target specified')
      }

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to export calendar')
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = eventId 
        ? `event-${eventId}.ics`
        : username 
          ? `${username}-calendar.ics`
          : 'constellate-feed.ics'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error exporting calendar:', err)
      setError(err instanceof Error ? err.message : 'Failed to export calendar')
    } finally {
      setExporting(null)
    }
  }

  const handleExportGoogle = async () => {
    if (!eventId) {
      setError('Google Calendar export only available for individual events')
      return
    }

    try {
      setExporting('google')
      setError(null)
      
      const response = await fetch(`/api/calendar/${eventId}/export/google`)
      if (!response.ok) {
        throw new Error('Failed to generate Google Calendar link')
      }
      
      const data = await response.json()
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } else {
        throw new Error('No URL returned from server')
      }
    } catch (err) {
      console.error('Error exporting to Google Calendar:', err)
      setError(err instanceof Error ? err.message : 'Failed to export to Google Calendar')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportICS}
          loading={exporting === 'ics'}
          disabled={exporting !== null}
          leftIcon={<span>📥</span>}
        >
          {exporting === 'ics' ? 'Exporting...' : 'Export ICS'}
        </Button>
        
        {eventId && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportGoogle}
            loading={exporting === 'google'}
            disabled={exporting !== null}
            leftIcon={<span>📅</span>}
          >
            {exporting === 'google' ? 'Opening...' : 'Add to Google'}
          </Button>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-error-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
