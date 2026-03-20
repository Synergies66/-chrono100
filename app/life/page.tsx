'use client'
import { useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const sb = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Moment = {
  id: string
  title: string
  taken_at: string
  lat: number | null
  lng: number | null
  location_name: string | null
  photo_url: string
}

export default function LifePage() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')

  const handlePhotos = useCallback(async (files: FileList) => {
    setUploading(true)
    const { default: exifr } = await import('exifr')
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress(`处理中 ${i + 1}/${files.length}: ${file.name}`)

      // 读取 EXIF
      let takenAt = new Date()
      let lat = null, lng = null
      try {
        const exif = await exifr.parse(file, { gps: true, tiff: true })
        if (exif?.DateTimeOriginal) takenAt = new Date(exif.DateTimeOriginal)
        if (exif?.latitude) lat = exif.latitude
        if (exif?.longitude) lng = exif.longitude
      } catch {}

      // 上传照片
      const path = `${user.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await sb.storage.from('moments').upload(path, file)
      if (uploadError) continue

      const { data: urlData } = sb.storage.from('moments').getPublicUrl(path)

      // 保存到数据库
      const { data } = await sb.from('moments').insert({
        user_id: user.id,
        title: new Date(takenAt).toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'}) + '的记忆',
        taken_at: takenAt.toISOString(),
        lat,
        lng,
        photo_url: urlData.publicUrl,
      }).select().single()

      if (data) setMoments(prev => [...prev, data].sort(
        (a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
      ))
    }

    setUploading(false)
    setProgress('')
  }, [])

  const loadMoments = useCallback(async () => {
    const { data } = await sb.from('moments').select('*').order('taken_at', { ascending: false })
    if (data) setMoments(data)
  }, [])

  useState(() => { loadMoments() })

  const grouped = moments.reduce((acc, m) => {
    const date = new Date(m.taken_at)
    const now = new Date()
    const diff = (now.getTime() - date.getTime()) / 86400000
    const key = diff < 1 ? '今天' : diff < 2 ? '昨天' : diff < 7 ? '最近7天' : diff < 30 ? '最近30天' : date.getFullYear().toString()
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, Moment[]>)

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', paddingBottom: 40 }}>
      {/* 顶部 */}
      <div style={{ background: 'white', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e8ecf4' }}>
        <button onClick={() => history.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1d3a' }}>🕊️ Life 时间线</span>
        <label style={{ background: '#4a6cf7', color: 'white', padding: '8px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          + 上传照片
          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => e.target.files && handlePhotos(e.target.files)} />
        </label>
      </div>

      {/* 上传进度 */}
      {uploading && (
        <div style={{ background: '#4a6cf7', color: 'white', padding: '12px 20px', textAlign: 'center', fontSize: 14 }}>
          ⏳ {progress}
        </div>
      )}

      {/* 时间线 */}
      <div style={{ padding: '20px 16px' }}>
        {moments.length === 0 && !uploading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7880a0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>上传你的照片</div>
            <div style={{ fontSize: 14 }}>自动读取拍摄时间和GPS位置，生成你的人生轨迹</div>
          </div>
        )}

        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7880a0', marginBottom: 12, letterSpacing: 1 }}>{group}</div>
            {items.map(m => (
              <div key={m.id} style={{ background: 'white', borderRadius: 16, marginBottom: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(74,108,247,0.08)', display: 'flex' }}>
                <img src={m.photo_url} alt={m.title} style={{ width: 90, height: 90, objectFit: 'cover' }} />
                <div style={{ padding: '12px 14px', flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1d3a', marginBottom: 4 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: '#7880a0', marginBottom: 4 }}>
                    🕐 {new Date(m.taken_at).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {m.lat && m.lng && (
                    <div style={{ fontSize: 12, color: '#4a6cf7' }}>
                      📍 {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
