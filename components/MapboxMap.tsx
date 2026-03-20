'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

export interface PhotoPoint {
  id: string
  lat: number
  lng: number
  thumbnailUrl: string
  fullUrl?: string
  takenAt?: string
  title?: string
}

interface MapboxMapProps {
  photos: PhotoPoint[]
  className?: string
}

export default function MapboxMap({ photos, className = '' }: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoPoint | null>(null)

  // Filter to only photos with valid GPS
  const gpsPhotos = photos.filter(
    (p) => p.lat !== 0 && p.lng !== 0 && !isNaN(p.lat) && !isNaN(p.lng)
  )

  useEffect(() => {
    if (!mapContainer.current) return
    if (map.current) return // already initialized

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      zoom: 1,
      center: [0, 20],
      projection: 'globe' as any,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')

    map.current.on('load', () => {
      if (!map.current) return

      // Atmosphere for globe projection
      map.current.setFog({
        color: 'rgb(10, 10, 20)',
        'high-color': 'rgb(20, 30, 60)',
        'horizon-blend': 0.02,
        'space-color': 'rgb(5, 5, 15)',
        'star-intensity': 0.6,
      })

      if (gpsPhotos.length === 0) return

      // ── Track line ──
      const coordinates = gpsPhotos.map((p) => [p.lng, p.lat])

      map.current.addSource('track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        },
      })

      // Glow outer line
      map.current.addLayer({
        id: 'track-glow',
        type: 'line',
        source: 'track',
        paint: {
          'line-color': '#60a5fa',
          'line-width': 6,
          'line-opacity': 0.2,
          'line-blur': 4,
        },
      })

      // Main line
      map.current.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-opacity': 0.8,
          'line-dasharray': [0, 4, 3],
        },
      })

      // ── Photo markers ──
      gpsPhotos.forEach((photo, index) => {
        const el = document.createElement('div')
        el.className = 'photo-marker'
        el.style.cssText = `
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #3b82f6;
          overflow: hidden;
          cursor: pointer;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.6);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          background: #1e293b;
          position: relative;
        `

        // Thumbnail inside marker
        const img = document.createElement('img')
        img.src = photo.thumbnailUrl
        img.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        `
        img.onerror = () => {
          el.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#3b82f6;font-size:14px;">📷</div>`
        }
        el.appendChild(img)

        // First & last special styling
        if (index === 0) {
          el.style.border = '2px solid #22c55e'
          el.style.boxShadow = '0 0 0 3px rgba(34,197,94,0.3), 0 2px 8px rgba(0,0,0,0.6)'
        }
        if (index === gpsPhotos.length - 1) {
          el.style.border = '2px solid #f59e0b'
          el.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.3), 0 2px 8px rgba(0,0,0,0.6)'
        }

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.3)'
          el.style.zIndex = '10'
        })
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)'
          el.style.zIndex = '1'
        })

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setSelectedPhoto(photo)

          // Close existing popup
          if (popupRef.current) popupRef.current.remove()

          const popup = new mapboxgl.Popup({
            offset: 25,
            closeButton: true,
            className: 'chrono-popup',
            maxWidth: '260px',
          })
            .setLngLat([photo.lng, photo.lat])
            .setHTML(`
              <div style="background:#0f172a;border-radius:8px;overflow:hidden;border:1px solid #1e3a5f;">
                <img 
                  src="${photo.thumbnailUrl}" 
                  style="width:100%;height:160px;object-fit:cover;display:block;" 
                  onerror="this.style.display='none'"
                />
                <div style="padding:10px 12px;">
                  <div style="color:#e2e8f0;font-size:13px;font-weight:600;margin-bottom:4px;">
                    ${photo.title || '照片'}
                  </div>
                  ${photo.takenAt ? `<div style="color:#64748b;font-size:11px;">📅 ${new Date(photo.takenAt).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' })}</div>` : ''}
                  <div style="color:#64748b;font-size:11px;margin-top:2px;">
                    📍 ${photo.lat.toFixed(4)}, ${photo.lng.toFixed(4)}
                  </div>
                </div>
              </div>
            `)
            .addTo(map.current!)

          popupRef.current = popup
        })

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([photo.lng, photo.lat])
          .addTo(map.current!)

        markersRef.current.push(marker)
      })

      // Fit map to all points
      if (coordinates.length > 0) {
        const bounds = coordinates.reduce(
          (b, coord) => b.extend(coord as [number, number]),
          new mapboxgl.LngLatBounds(
            coordinates[0] as [number, number],
            coordinates[0] as [number, number]
          )
        )
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 1200 })
      }
    })

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.current?.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update sources when photos change
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return
    const source = map.current.getSource('track') as mapboxgl.GeoJSONSource
    if (!source) return
    const coordinates = gpsPhotos.map((p) => [p.lng, p.lat])
    source.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    })
  }, [gpsPhotos])

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 12,
          background: 'rgba(15,23,42,0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 8,
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 11,
          color: '#94a3b8',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          起点
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          终点
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 22, height: 2, background: '#3b82f6', display: 'inline-block', borderRadius: 1 }} />
          轨迹
        </div>
        <div style={{ marginTop: 2, color: '#475569' }}>
          {gpsPhotos.length} 个 GPS 点
        </div>
      </div>

      {/* Popup custom styles injected */}
      <style>{`
        .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          border-radius: 8px !important;
        }
        .mapboxgl-popup-tip {
          border-top-color: #1e3a5f !important;
          border-bottom-color: #1e3a5f !important;
        }
        .mapboxgl-popup-close-button {
          color: #64748b !important;
          font-size: 18px !important;
          right: 6px !important;
          top: 4px !important;
          background: rgba(15,23,42,0.8) !important;
          border-radius: 50% !important;
          width: 22px !important;
          height: 22px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          line-height: 1 !important;
          padding: 0 !important;
        }
        .mapboxgl-popup-close-button:hover {
          color: #e2e8f0 !important;
          background: rgba(30,58,95,0.9) !important;
        }
      `}</style>
    </div>
  )
}
