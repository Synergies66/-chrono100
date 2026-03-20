'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const sb = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data } = await sb.auth.getSession()
      if (data.session) {
        setSession(data.session)
        setLoading(false)
        return
      }
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        await new Promise(r => setTimeout(r, 500))
        const { data: d2 } = await sb.auth.getSession()
        setSession(d2.session)
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      setLoading(false)
    }
    init()
    sb.auth.onAuthStateChange((_e, s) => {
      if (s) setSession(s)
    })
  }, [])

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:40}}>🕊</div>

  if (session) return (
    <main style={{margin:0,padding:0,height:'100vh',overflow:'hidden'}}>
      <iframe src="/api/app-html" style={{width:'100%',height:'100vh',border:'none'}} />
    </main>
  )

  return (
    <div style={{minHeight:'100vh',background:'#f0f2f8',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'white',borderRadius:24,padding:40,maxWidth:400,width:'100%',textAlign:'center',boxShadow:'0 8px 40px rgba(61,107,232,0.12)'}}>
        <div style={{fontSize:52,marginBottom:10}}>🕊</div>
        <div style={{fontSize:28,fontWeight:800,color:'#1a1d3a',marginBottom:6}}>Chrono100</div>
        <div style={{fontSize:13,color:'#7880a8',marginBottom:32}}>记录你的一生，留给最重要的人</div>
        <button
          onClick={() => sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` }
          })}
          style={{width:'100%',padding:14,background:'white',border:'1.5px solid #e2e6f0',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <span style={{color:'#4285f4',fontWeight:900,fontSize:18}}>G</span>
          用 Google 登录
        </button>
      </div>
    </div>
  )
}
