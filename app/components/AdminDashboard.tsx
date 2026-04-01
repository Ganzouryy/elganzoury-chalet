'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ===== TYPES =====
interface Booking {
  id: string; renter_name: string; renter_phone: string;
  check_in: string; check_out: string; nights: number;
  total_price: number; status: string; notes: string; created_at: string;
}
interface Media {
  id: string; url: string; caption_ar: string; caption_en: string;
  section: string; sort_order: number; media_type: string;
}
interface Content { key: string; value_ar: string; value_en: string; value_type: string }
interface Pricing { id: string; label_ar: string; label_en: string; price: number; period_type: string; notes_ar: string; notes_en: string }

const ADMIN_PASSWORD = 'elganzoury2025'

const SECTIONS = [
  { key:'hero', label:'Hero (الهيرو)' },
  { key:'about', label:'About (عن الشاليه)' },
  { key:'gallery', label:'Gallery (المعرض)' },
  { key:'floor_ground', label:'Ground Floor (الدور الأرضي)' },
  { key:'floor_upper', label:'Upper Floor (الدور العلوي)' },
  { key:'roof', label:'Rooftop (السطح)' },
]

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState(false)
  const [activeTab, setActiveTab] = useState('bookings')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [content, setContent] = useState<Content[]>([])
  const [pricing, setPricing] = useState<Pricing[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [bookingFilter, setBookingFilter] = useState('all')
  const [editingContent, setEditingContent] = useState<Record<string,{ar:string,en:string}>>({})
  const [editingPricing, setEditingPricing] = useState<Record<string,any>>({})
  const [uploadSection, setUploadSection] = useState('hero')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authed) {
      fetchAll()
    }
  }, [authed])

  const fetchAll = async () => {
    setLoading(true)
    const [b, m, c, p] = await Promise.all([
      supabase.from('bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('media').select('*').order('sort_order'),
      supabase.from('site_content').select('*'),
      supabase.from('pricing').select('*'),
    ])
    if (b.data) setBookings(b.data)
    if (m.data) setMedia(m.data)
    if (c.data) {
      setContent(c.data)
      const map: Record<string,{ar:string,en:string}> = {}
      c.data.forEach((item: Content) => { map[item.key] = { ar: item.value_ar, en: item.value_en } })
      setEditingContent(map)
    }
    if (p.data) {
      setPricing(p.data)
      const map: Record<string,any> = {}
      p.data.forEach((item: Pricing) => { map[item.id] = { ...item } })
      setEditingPricing(map)
    }
    setLoading(false)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const login = () => {
    if (password === ADMIN_PASSWORD) { setAuthed(true); setPwError(false) }
    else setPwError(true)
  }

  // ===== BOOKINGS =====
  const updateBookingStatus = async (id: string, status: string) => {
    await supabase.from('bookings').update({ status }).eq('id', id)
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
    showToast(`✅ Booking ${status}`)
  }

  const updateBookingNotes = async (id: string, notes: string) => {
    await supabase.from('bookings').update({ notes }).eq('id', id)
    setBookings(prev => prev.map(b => b.id === id ? { ...b, notes } : b))
    showToast('✅ Notes saved')
  }

  const deleteBooking = async (id: string) => {
    if (!confirm('Delete this booking?')) return
    await supabase.from('bookings').delete().eq('id', id)
    setBookings(prev => prev.filter(b => b.id !== id))
    showToast('🗑️ Booking deleted')
  }

  // ===== CONTENT =====
  const saveContent = async (key: string) => {
    const val = editingContent[key]
    if (!val) return
    await supabase.from('site_content').upsert({ key, value_ar: val.ar, value_en: val.en, updated_at: new Date().toISOString() })
    showToast('✅ Content saved')
  }

  const addContentKey = async () => {
    const key = prompt('Enter content key (e.g. hero_title):')
    if (!key) return
    await supabase.from('site_content').insert({ key, value_ar: '', value_en: '', value_type: 'text' })
    setEditingContent(prev => ({ ...prev, [key]: { ar: '', en: '' } }))
    showToast('✅ New content key added')
  }

  // ===== PRICING =====
  const savePricing = async (id: string) => {
    const val = editingPricing[id]
    if (!val) return
    await supabase.from('pricing').update({
      label_ar: val.label_ar, label_en: val.label_en,
      price: Number(val.price), notes_ar: val.notes_ar, notes_en: val.notes_en
    }).eq('id', id)
    showToast('✅ Pricing saved')
  }

  const addPricingTier = async () => {
    const { data } = await supabase.from('pricing').insert({
      label_ar: 'سعر جديد', label_en: 'New Price',
      price: 0, period_type: 'custom', notes_ar: '', notes_en: ''
    }).select()
    if (data?.[0]) {
      setPricing(prev => [...prev, data[0]])
      setEditingPricing(prev => ({ ...prev, [data[0].id]: { ...data[0] } }))
    }
    showToast('✅ New pricing tier added')
  }

  const deletePricing = async (id: string) => {
    if (!confirm('Delete this pricing tier?')) return
    await supabase.from('pricing').delete().eq('id', id)
    setPricing(prev => prev.filter(p => p.id !== id))
    showToast('🗑️ Pricing tier deleted')
  }

  // ===== MEDIA =====
  const uploadMedia = async (files: FileList) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${uploadSection}/${Date.now()}.${ext}`
      const { data: upload, error } = await supabase.storage.from('chalet-media').upload(path, file)
      if (error) { showToast('❌ Upload failed: ' + error.message); continue }
      const { data: urlData } = supabase.storage.from('chalet-media').getPublicUrl(path)
      const isVideo = file.type.startsWith('video/')
      const maxOrder = media.filter(m => m.section === uploadSection).length
      const { data: inserted } = await supabase.from('media').insert({
        url: urlData.publicUrl, section: uploadSection,
        media_type: isVideo ? 'video' : 'image',
        sort_order: maxOrder, caption_ar: '', caption_en: ''
      }).select()
      if (inserted?.[0]) setMedia(prev => [...prev, inserted[0]])
    }
    setUploading(false)
    showToast('✅ Upload complete')
  }

  const deleteMedia = async (id: string, url: string) => {
    if (!confirm('Delete this media?')) return
    const path = url.split('/chalet-media/')[1]
    if (path) await supabase.storage.from('chalet-media').remove([path])
    await supabase.from('media').delete().eq('id', id)
    setMedia(prev => prev.filter(m => m.id !== id))
    showToast('🗑️ Media deleted')
  }

  const updateMediaCaption = async (id: string, ar: string, en: string) => {
    await supabase.from('media').update({ caption_ar: ar, caption_en: en }).eq('id', id)
    setMedia(prev => prev.map(m => m.id === id ? { ...m, caption_ar: ar, caption_en: en } : m))
    showToast('✅ Caption saved')
  }

  const moveMedia = async (id: string, direction: 'up' | 'down') => {
    const idx = media.findIndex(m => m.id === id)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= media.length) return
    const newMedia = [...media]
    const temp = newMedia[idx].sort_order
    newMedia[idx] = { ...newMedia[idx], sort_order: newMedia[swapIdx].sort_order }
    newMedia[swapIdx] = { ...newMedia[swapIdx], sort_order: temp }
    ;[newMedia[idx], newMedia[swapIdx]] = [newMedia[swapIdx], newMedia[idx]]
    setMedia(newMedia)
    await supabase.from('media').update({ sort_order: newMedia[idx].sort_order }).eq('id', newMedia[idx].id)
    await supabase.from('media').update({ sort_order: newMedia[swapIdx].sort_order }).eq('id', newMedia[swapIdx].id)
  }

  const filteredBookings = bookings.filter(b => bookingFilter === 'all' || b.status === bookingFilter)

  const statusColor: Record<string,string> = {
    pending: '#f59e0b', confirmed: '#22c55e', cancelled: '#ef4444'
  }
  const statusLabel: Record<string,string> = {
    pending: '⏳ Pending', confirmed: '✅ Confirmed', cancelled: '❌ Cancelled'
  }

  // ===== LOGIN SCREEN =====
  if (!authed) {
    return (
      <div style={{ minHeight:'100vh', background:'#0F0F0F', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cairo',sans-serif" }}>
        <div style={{ background:'#1A1A1A', border:'1px solid #2A2A2A', borderRadius:16, padding:'48px 40px', width:'100%', maxWidth:400, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:16 }}>🔐</div>
          <h1 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:28, fontWeight:900, color:'#fff', marginBottom:8 }}>
            لوحة التحكم
          </h1>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', marginBottom:32 }}>Admin Dashboard — Elganzoury Chalet</p>
          <input
            type="password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            style={{ width:'100%', padding:'14px 16px', background:'#0F0F0F', border:`1.5px solid ${pwError ? '#ef4444' : '#2A2A2A'}`, borderRadius:8, color:'#fff', fontSize:15, outline:'none', marginBottom:12, fontFamily:"'Cairo',sans-serif" }}
          />
          {pwError && <p style={{ color:'#ef4444', fontSize:13, marginBottom:12 }}>❌ Incorrect password</p>}
          <button onClick={login} style={{ width:'100%', background:'#F97316', color:'#fff', padding:'14px', border:'none', borderRadius:8, fontSize:16, fontWeight:800, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
            دخول
          </button>
        </div>
      </div>
    )
  }

  // ===== MAIN DASHBOARD =====
  return (
    <div style={{ minHeight:'100vh', background:'#0A0A0A', fontFamily:"'Cairo',sans-serif", direction:'rtl' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', background:'#1A1A1A', border:'1px solid #F97316', color:'#fff', padding:'12px 24px', borderRadius:8, zIndex:9999, fontSize:14, fontWeight:700, boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background:'#111', borderBottom:'1px solid #1F1F1F', padding:'0 32px', display:'flex', alignItems:'center', justifyContent:'space-between', height:64, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 8px #22c55e' }} />
          <span style={{ fontFamily:"'Tajawal',sans-serif", fontSize:18, fontWeight:900, color:'#fff' }}>
            الجنزوري<span style={{ color:'#F97316' }}>.</span> Admin
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <a href="/" target="_blank" style={{ color:'#F97316', fontSize:13, fontWeight:700, textDecoration:'none' }}>← عرض الموقع</a>
          <button onClick={() => setAuthed(false)} style={{ background:'#1F1F1F', border:'1px solid #2F2F2F', color:'rgba(255,255,255,0.5)', padding:'8px 16px', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
            تسجيل خروج
          </button>
        </div>
      </div>

      <div style={{ display:'flex', minHeight:'calc(100vh - 64px)' }}>

        {/* Sidebar */}
        <div style={{ width:220, background:'#111', borderLeft:'1px solid #1F1F1F', padding:'24px 0', flexShrink:0, position:'sticky', top:64, height:'calc(100vh - 64px)', overflowY:'auto' }}>
          {[
            { id:'bookings', icon:'📋', label:'الحجوزات' },
            { id:'calendar', icon:'📅', label:'التقويم' },
            { id:'content', icon:'✏️', label:'النصوص' },
            { id:'media', icon:'🖼️', label:'الصور والفيديو' },
            { id:'pricing', icon:'💰', label:'الأسعار' },
            { id:'settings', icon:'⚙️', label:'الإعدادات' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              width:'100%', padding:'14px 24px', background: activeTab===tab.id ? 'rgba(249,115,22,0.1)' : 'transparent',
              border:'none', borderRight: activeTab===tab.id ? '3px solid #F97316' : '3px solid transparent',
              color: activeTab===tab.id ? '#F97316' : 'rgba(255,255,255,0.5)',
              fontSize:14, fontWeight:700, cursor:'pointer', textAlign:'right',
              display:'flex', alignItems:'center', gap:12, fontFamily:"'Cairo',sans-serif",
              transition:'all 0.2s',
            }}>
              <span style={{ fontSize:16 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex:1, padding:'32px', overflowY:'auto' }}>
          {loading && (
            <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.3)', fontSize:14 }}>جاري التحميل...</div>
          )}

          {/* ===== BOOKINGS TAB ===== */}
          {activeTab === 'bookings' && !loading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:26, fontWeight:900, color:'#fff', marginBottom:4 }}>الحجوزات</h2>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>{bookings.length} حجز إجمالي</p>
                </div>
                {/* Stats */}
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {[
                    { label:'معلق', count: bookings.filter(b=>b.status==='pending').length, color:'#f59e0b' },
                    { label:'مؤكد', count: bookings.filter(b=>b.status==='confirmed').length, color:'#22c55e' },
                    { label:'ملغى', count: bookings.filter(b=>b.status==='cancelled').length, color:'#ef4444' },
                  ].map(s => (
                    <div key={s.label} style={{ background:'#1A1A1A', border:`1px solid ${s.color}30`, borderRadius:10, padding:'12px 20px', textAlign:'center' }}>
                      <div style={{ fontSize:24, fontWeight:900, color:s.color, fontFamily:"'Tajawal',sans-serif" }}>{s.count}</div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Filter tabs */}
              <div style={{ display:'flex', gap:8, marginBottom:24 }}>
                {['all','pending','confirmed','cancelled'].map(f => (
                  <button key={f} onClick={() => setBookingFilter(f)} style={{
                    padding:'8px 18px', borderRadius:6, border:'1px solid',
                    borderColor: bookingFilter===f ? '#F97316' : '#2A2A2A',
                    background: bookingFilter===f ? '#F97316' : 'transparent',
                    color: bookingFilter===f ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif",
                  }}>
                    {f==='all'?'الكل':f==='pending'?'معلق':f==='confirmed'?'مؤكد':'ملغى'}
                  </button>
                ))}
              </div>

              {/* Bookings list */}
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {filteredBookings.length === 0 && (
                  <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.2)', fontSize:14 }}>لا توجد حجوزات</div>
                )}
                {filteredBookings.map(b => (
                  <div key={b.id} style={{ background:'#1A1A1A', border:'1px solid #2A2A2A', borderRadius:12, padding:24, borderRight:`4px solid ${statusColor[b.status] || '#444'}` }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:16, marginBottom:20 }}>
                      <div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>الاسم</div>
                        <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>{b.renter_name}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>الهاتف</div>
                        <a href={`https://wa.me/2${b.renter_phone}`} target="_blank" style={{ fontSize:15, fontWeight:700, color:'#25D366', textDecoration:'none' }}>{b.renter_phone}</a>
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>الوصول</div>
                        <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>{b.check_in}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>المغادرة</div>
                        <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>{b.check_out}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>الليالي</div>
                        <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>{b.nights}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>الإجمالي</div>
                        <div style={{ fontSize:15, fontWeight:700, color:'#F97316' }}>{b.total_price?.toLocaleString()} جنيه</div>
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>الحالة</div>
                        <span style={{ fontSize:13, fontWeight:700, color: statusColor[b.status], background:`${statusColor[b.status]}20`, padding:'4px 10px', borderRadius:20 }}>
                          {statusLabel[b.status]}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>تاريخ الطلب</div>
                        <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>{new Date(b.created_at).toLocaleDateString('ar-EG')}</div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div style={{ marginBottom:16 }}>
                      <textarea
                        defaultValue={b.notes || ''}
                        placeholder="ملاحظات..."
                        onBlur={e => updateBookingNotes(b.id, e.target.value)}
                        style={{ width:'100%', background:'#0F0F0F', border:'1px solid #2A2A2A', borderRadius:8, padding:'10px 14px', color:'rgba(255,255,255,0.7)', fontSize:13, fontFamily:"'Cairo',sans-serif", resize:'vertical', minHeight:60, outline:'none' }}
                      />
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                      <button onClick={() => updateBookingStatus(b.id,'confirmed')} disabled={b.status==='confirmed'} style={{ padding:'8px 18px', background:'#22c55e', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', opacity: b.status==='confirmed'?0.4:1, fontFamily:"'Cairo',sans-serif" }}>
                        ✅ تأكيد
                      </button>
                      <button onClick={() => updateBookingStatus(b.id,'pending')} disabled={b.status==='pending'} style={{ padding:'8px 18px', background:'#f59e0b', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', opacity: b.status==='pending'?0.4:1, fontFamily:"'Cairo',sans-serif" }}>
                        ⏳ معلق
                      </button>
                      <button onClick={() => updateBookingStatus(b.id,'cancelled')} disabled={b.status==='cancelled'} style={{ padding:'8px 18px', background:'#ef4444', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', opacity: b.status==='cancelled'?0.4:1, fontFamily:"'Cairo',sans-serif" }}>
                        ❌ إلغاء
                      </button>
                      <a href={`https://wa.me/2${b.renter_phone}`} target="_blank" style={{ padding:'8px 18px', background:'#25D366', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>
                        💬 واتساب
                      </a>
                      <button onClick={() => deleteBooking(b.id)} style={{ padding:'8px 18px', background:'transparent', color:'#ef4444', border:'1px solid #ef4444', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif", marginRight:'auto' }}>
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== CALENDAR TAB ===== */}
          {activeTab === 'calendar' && !loading && (
            <div>
              <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:26, fontWeight:900, color:'#fff', marginBottom:8 }}>التقويم</h2>
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:32 }}>الفترات المؤكدة تظهر محجوزة في الموقع تلقائياً</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
                {bookings.filter(b => b.status === 'confirmed').map(b => (
                  <div key={b.id} style={{ background:'#1A1A1A', border:'1px solid #22c55e30', borderRadius:12, padding:20 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:8 }}>{b.renter_name}</div>
                    <div style={{ fontSize:13, color:'#22c55e', marginBottom:4 }}>📅 {b.check_in} ← {b.check_out}</div>
                    <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>🌙 {b.nights} ليالي | 💰 {b.total_price?.toLocaleString()} جنيه</div>
                  </div>
                ))}
                {bookings.filter(b => b.status === 'confirmed').length === 0 && (
                  <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.2)', fontSize:14, gridColumn:'1/-1' }}>لا توجد حجوزات مؤكدة</div>
                )}
              </div>
            </div>
          )}

          {/* ===== CONTENT TAB ===== */}
          {activeTab === 'content' && !loading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:32 }}>
                <div>
                  <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:26, fontWeight:900, color:'#fff', marginBottom:4 }}>النصوص والمحتوى</h2>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>تحكم في كل نص عربي وإنجليزي في الموقع</p>
                </div>
                <button onClick={addContentKey} style={{ background:'#F97316', color:'#fff', padding:'10px 20px', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
                  + إضافة نص جديد
                </button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {Object.entries(editingContent).map(([key, val]) => (
                  <div key={key} style={{ background:'#1A1A1A', border:'1px solid #2A2A2A', borderRadius:12, padding:24 }}>
                    <div style={{ fontSize:12, color:'#F97316', fontWeight:700, letterSpacing:2, textTransform:'uppercase', marginBottom:16 }}>{key}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                      <div>
                        <label style={{ fontSize:11, color:'rgba(255,255,255,0.3)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>عربي 🇪🇬</label>
                        <textarea
                          value={val.ar}
                          onChange={e => setEditingContent(prev => ({ ...prev, [key]: { ...prev[key], ar: e.target.value } }))}
                          style={{ width:'100%', background:'#0F0F0F', border:'1px solid #2A2A2A', borderRadius:8, padding:'10px 14px', color:'#fff', fontSize:14, fontFamily:"'Cairo',sans-serif", resize:'vertical', minHeight:80, outline:'none', direction:'rtl' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize:11, color:'rgba(255,255,255,0.3)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>English 🇬🇧</label>
                        <textarea
                          value={val.en}
                          onChange={e => setEditingContent(prev => ({ ...prev, [key]: { ...prev[key], en: e.target.value } }))}
                          style={{ width:'100%', background:'#0F0F0F', border:'1px solid #2A2A2A', borderRadius:8, padding:'10px 14px', color:'#fff', fontSize:14, fontFamily:"'Cairo',sans-serif", resize:'vertical', minHeight:80, outline:'none', direction:'ltr' }}
                        />
                      </div>
                    </div>
                    <button onClick={() => saveContent(key)} style={{ background:'#F97316', color:'#fff', padding:'8px 20px', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
                      💾 حفظ
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== MEDIA TAB ===== */}
          {activeTab === 'media' && !loading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:32, flexWrap:'wrap', gap:16 }}>
                <div>
                  <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:26, fontWeight:900, color:'#fff', marginBottom:4 }}>الصور والفيديو</h2>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>رفع وإدارة كل صور وفيديوهات الموقع</p>
                </div>
                <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                  <select value={uploadSection} onChange={e => setUploadSection(e.target.value)} style={{ background:'#1A1A1A', border:'1px solid #2A2A2A', color:'#fff', padding:'10px 16px', borderRadius:8, fontSize:13, fontFamily:"'Cairo',sans-serif", cursor:'pointer' }}>
                    {SECTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background:'#F97316', color:'#fff', padding:'10px 20px', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif", opacity: uploading?0.6:1 }}>
                    {uploading ? '⏳ جاري الرفع...' : '📤 رفع ملفات'}
                  </button>
                  <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display:'none' }} onChange={e => e.target.files && uploadMedia(e.target.files)} />
                </div>
              </div>

              {SECTIONS.map(section => {
                const sectionMedia = media.filter(m => m.section === section.key)
                return (
                  <div key={section.key} style={{ marginBottom:48 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                      <div style={{ width:32, height:2, background:'#F97316' }} />
                      <h3 style={{ fontSize:16, fontWeight:800, color:'#F97316', textTransform:'uppercase', letterSpacing:2 }}>{section.label}</h3>
                      <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>{sectionMedia.length} ملف</span>
                    </div>
                    {sectionMedia.length === 0 ? (
                      <div style={{ background:'#1A1A1A', border:'2px dashed #2A2A2A', borderRadius:12, padding:40, textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:14 }}>
                        لا توجد ملفات — اختر هذا القسم وارفع
                      </div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
                        {sectionMedia.map((m, idx) => (
                          <div key={m.id} style={{ background:'#1A1A1A', border:'1px solid #2A2A2A', borderRadius:12, overflow:'hidden' }}>
                            {/* Preview */}
                            <div style={{ position:'relative', height:160, background:'#0F0F0F' }}>
                              {m.media_type === 'video' ? (
                                <video src={m.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} controls />
                              ) : (
                                <img src={m.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              )}
                              <div style={{ position:'absolute', top:8, left:8, display:'flex', gap:6 }}>
                                <button onClick={() => moveMedia(m.id,'up')} disabled={idx===0} style={{ width:28, height:28, background:'rgba(0,0,0,0.7)', border:'none', borderRadius:4, color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>↑</button>
                                <button onClick={() => moveMedia(m.id,'down')} disabled={idx===sectionMedia.length-1} style={{ width:28, height:28, background:'rgba(0,0,0,0.7)', border:'none', borderRadius:4, color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>↓</button>
                              </div>
                              <button onClick={() => deleteMedia(m.id, m.url)} style={{ position:'absolute', top:8, right:8, width:28, height:28, background:'rgba(239,68,68,0.9)', border:'none', borderRadius:4, color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                            </div>
                            {/* Captions */}
                            <div style={{ padding:12 }}>
                              <input
                                defaultValue={m.caption_ar}
                                placeholder="وصف عربي..."
                                onBlur={e => updateMediaCaption(m.id, e.target.value, m.caption_en)}
                                style={{ width:'100%', background:'#0F0F0F', border:'1px solid #2A2A2A', borderRadius:6, padding:'6px 10px', color:'#fff', fontSize:12, fontFamily:"'Cairo',sans-serif", outline:'none', marginBottom:6, direction:'rtl' }}
                              />
                              <input
                                defaultValue={m.caption_en}
                                placeholder="English caption..."
                                onBlur={e => updateMediaCaption(m.id, m.caption_ar, e.target.value)}
                                style={{ width:'100%', background:'#0F0F0F', border:'1px solid #2A2A2A', borderRadius:6, padding:'6px 10px', color:'#fff', fontSize:12, fontFamily:"'Cairo',sans-serif", outline:'none', direction:'ltr' }}
                              />
                              <div style={{ fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:6, wordBreak:'break-all' }}>
                                {m.media_type === 'video' ? '🎥 Video' : '🖼️ Image'} | Order: {m.sort_order}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ===== PRICING TAB ===== */}
          {activeTab === 'pricing' && !loading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:32 }}>
                <div>
                  <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:26, fontWeight:900, color:'#fff', marginBottom:4 }}>الأسعار</h2>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>تحكم في أسعار الإيجار — تُحدَّث فوراً على الموقع</p>
                </div>
                <button onClick={addPricingTier} style={{ background:'#F97316', color:'#fff', padding:'10px 20px', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
                  + إضافة سعر جديد
                </button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                {Object.entries(editingPricing).map(([id, val]) => (
                  <div key={id} style={{ background:'#1A1A1A', border:'1px solid #2A2A2A', borderRadius:12, padding:28 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:20 }}>
                      <div>
                        <label style={{ fontSize:11, color:'rgba(255,255,255,0.3)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>الاسم عربي</label>
                        <input value={val.label_ar || ''} onChange={e => setEditingPricing(prev => ({ ...prev, [id]: { ...prev[id], label_ar: e.target.value } }))}
                          style={{ ...inputDark, direction:'rtl' }} />
                      </div>
                      <div>
                        <label style={{ fontSize:11, color:'rgba(255,255,255,0.3)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>English Name</label>
                        <input value={val.label_en || ''} onChange={e => setEditingPricing(prev => ({ ...prev, [id]: { ...prev[id], label_en: e.target.value } }))}
                          style={{ ...inputDark, direction:'ltr' }} />
                      </div>
                      <div>
                        <label style={{ fontSize:11, color:'rgba(255,255,255,0.3)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>السعر (جنيه/ليلة)</label>
                        <input type="number" value={val.price || 0} onChange={e => setEditingPricing(prev => ({ ...prev, [id]: { ...prev[id], price: e.target.value } }))}
                          style={{ ...inputDark, direction:'ltr', color:'#F97316', fontWeight:800, fontSize:18 }} />
                      </div>
                      <div>
                        <label style={{ fontSize:11, color:'rgba(255,255,255,0.3)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>النوع</label>
                        <input value={val.period_type || ''} onChange={e => setEditingPricing(prev => ({ ...prev, [id]: { ...prev[id], period_type: e.target.value } }))}
                          style={inputDark} />
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
                      <div>
                        <label style={{ fontSize:11, color:'rgba(255,255,255,0.3)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>ملاحظة عربية</label>
                        <input value={val.notes_ar || ''} onChange={e => setEditingPricing(prev => ({ ...prev, [id]: { ...prev[id], notes_ar: e.target.value } }))}
                          style={{ ...inputDark, direction:'rtl' }} />
                      </div>
                      <div>
                        <label style={{ fontSize:11, color:'rgba(255,255,255,0.3)', display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>English Note</label>
                        <input value={val.notes_en || ''} onChange={e => setEditingPricing(prev => ({ ...prev, [id]: { ...prev[id], notes_en: e.target.value } }))}
                          style={{ ...inputDark, direction:'ltr' }} />
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:12 }}>
                      <button onClick={() => savePricing(id)} style={{ background:'#F97316', color:'#fff', padding:'8px 20px', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
                        💾 حفظ
                      </button>
                      <button onClick={() => deletePricing(id)} style={{ background:'transparent', color:'#ef4444', padding:'8px 20px', border:'1px solid #ef4444', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== SETTINGS TAB ===== */}
          {activeTab === 'settings' && !loading && (
            <div>
              <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:26, fontWeight:900, color:'#fff', marginBottom:32 }}>الإعدادات</h2>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
                {[
                  { key:'whatsapp_number', label:'رقم واتساب', icon:'📱' },
                  { key:'instapay_number', label:'رقم InstaPay', icon:'💳' },
                  { key:'max_guests', label:'الحد الأقصى للضيوف', icon:'👥' },
                  { key:'pool_distance', label:'مسافة حمام السباحة', icon:'🏊' },
                ].map(({ key, label, icon }) => {
                  const val = editingContent[key] || { ar: '', en: '' }
                  return (
                    <div key={key} style={{ background:'#1A1A1A', border:'1px solid #2A2A2A', borderRadius:12, padding:24 }}>
                      <div style={{ fontSize:24, marginBottom:12 }}>{icon}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#F97316', marginBottom:16 }}>{label}</div>
                      <input value={val.ar} onChange={e => setEditingContent(prev => ({ ...prev, [key]: { ...prev[key], ar: e.target.value } }))}
                        placeholder="عربي..." style={{ ...inputDark, marginBottom:8, direction:'rtl' }} />
                      <input value={val.en} onChange={e => setEditingContent(prev => ({ ...prev, [key]: { ...prev[key], en: e.target.value } }))}
                        placeholder="English..." style={{ ...inputDark, marginBottom:12, direction:'ltr' }} />
                      <button onClick={() => saveContent(key)} style={{ background:'#F97316', color:'#fff', padding:'8px 20px', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
                        💾 حفظ
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Danger zone */}
              <div style={{ marginTop:48, background:'#1A1A1A', border:'1px solid #ef444430', borderRadius:12, padding:28 }}>
                <h3 style={{ fontSize:16, fontWeight:800, color:'#ef4444', marginBottom:8 }}>⚠️ منطقة الخطر</h3>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:20 }}>هذه الإجراءات لا يمكن التراجع عنها</p>
                <button onClick={async () => {
                  if (confirm('حذف كل الحجوزات الملغاة؟')) {
                    await supabase.from('bookings').delete().eq('status','cancelled')
                    await fetchAll()
                    showToast('🗑️ تم حذف الحجوزات الملغاة')
                  }
                }} style={{ background:'transparent', color:'#ef4444', padding:'10px 20px', border:'1px solid #ef4444', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
                  🗑️ حذف كل الحجوزات الملغاة
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const inputDark: React.CSSProperties = {
  width:'100%', background:'#0F0F0F', border:'1px solid #2A2A2A', borderRadius:8,
  padding:'10px 14px', color:'#fff', fontSize:14, fontFamily:"'Cairo',sans-serif", outline:'none',
}
