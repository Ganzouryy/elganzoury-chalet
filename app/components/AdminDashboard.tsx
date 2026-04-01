'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Booking { id:string; renter_name:string; renter_phone:string; check_in:string; check_out:string; nights:number; total_price:number; status:string; notes:string; created_at:string; floor:string }
interface Media { id:string; url:string; caption_ar:string; caption_en:string; section:string; sort_order:number; media_type:string }
interface Content { key:string; value_ar:string; value_en:string; value_type:string }
interface Pricing { id:string; label_ar:string; label_en:string; price:number; period_type:string; notes_ar:string; notes_en:string }

const ADMIN_PASSWORD = 'elganzoury2025'

const ALL_CONTENT_KEYS = [
  { key:'hero_subtitle', label:'Hero — النص التعريفي', section:'hero' },
  { key:'about_title', label:'About — العنوان', section:'about' },
  { key:'about_text', label:'About — النص الأول', section:'about' },
  { key:'about_text2', label:'About — النص الثاني', section:'about' },
  { key:'floors_title', label:'Floors — العنوان', section:'floors' },
  { key:'floors_subtitle', label:'Floors — النص التعريفي', section:'floors' },
  { key:'gallery_title', label:'Gallery — العنوان', section:'gallery' },
  { key:'pricing_title', label:'Pricing — العنوان', section:'pricing' },
  { key:'pricing_subtitle', label:'Pricing — النص التعريفي', section:'pricing' },
  { key:'booking_title', label:'Booking — العنوان', section:'booking' },
  { key:'payment_title', label:'Payment — العنوان', section:'payment' },
  { key:'payment_desc', label:'Payment — النص التعريفي', section:'payment' },
  { key:'location_title', label:'Location — العنوان', section:'location' },
  { key:'faq_title', label:'FAQ — العنوان', section:'faq' },
  { key:'faq_subtitle', label:'FAQ — النص التعريفي', section:'faq' },
  { key:'footer_desc', label:'Footer — وصف الشاليه', section:'footer' },
  { key:'whatsapp_number', label:'Settings — رقم واتساب', section:'settings' },
  { key:'instapay_number', label:'Settings — رقم InstaPay', section:'settings' },
  { key:'max_guests', label:'Settings — أقصى عدد ضيوف', section:'settings' },
  { key:'pool_distance', label:'Settings — مسافة حمام السباحة', section:'settings' },
]

const SECTIONS_MEDIA = [
  { key:'hero', label:'Hero — صور الخلفية' },
  { key:'about', label:'About — صورة الشاليه' },
  { key:'gallery', label:'Gallery — معرض الصور' },
  { key:'floor_ground', label:'الدور الأرضي — صور' },
  { key:'floor_upper', label:'الدور العلوي — صور' },
  { key:'roof', label:'السطح — صور' },
]

const floorLabel: Record<string,string> = { upper:'الدور العلوي', ground:'الدور الأرضي', full:'الشاليه كامل' }
const statusColor: Record<string,string> = { pending:'#f59e0b', confirmed:'#22c55e', cancelled:'#ef4444' }

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState(false)
  const [activeTab, setActiveTab] = useState('bookings')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [content, setContent] = useState<Record<string,{ar:string,en:string}>>({})
  const [pricing, setPricing] = useState<Pricing[]>([])
  const [editingPricing, setEditingPricing] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success'|'error'>('success')
  const [bookingFilter, setBookingFilter] = useState('all')
  const [uploadSection, setUploadSection] = useState('hero')
  const [uploading, setUploading] = useState(false)
  const [contentSection, setContentSection] = useState('hero')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (authed) fetchAll() }, [authed])

  const fetchAll = async () => {
    setLoading(true)
    const [b,m,c,p] = await Promise.all([
      supabase.from('bookings').select('*').order('created_at',{ascending:false}),
      supabase.from('media').select('*').order('sort_order'),
      supabase.from('site_content').select('*'),
      supabase.from('pricing').select('*'),
    ])
    if (b.data) setBookings(b.data)
    if (m.data) setMedia(m.data)
    if (c.data) {
      const map: Record<string,{ar:string,en:string}> = {}
      // Initialize ALL known keys with empty values
      ALL_CONTENT_KEYS.forEach(k => { map[k.key] = { ar:'', en:'' } })
      // Override with actual DB values
      c.data.forEach((item:Content) => { map[item.key] = { ar:item.value_ar||'', en:item.value_en||'' } })
      setContent(map)
    }
    if (p.data) {
      setPricing(p.data)
      const map: Record<string,any> = {}
      p.data.forEach((item:Pricing) => { map[item.id] = { ...item } })
      setEditingPricing(map)
    }
    setLoading(false)
  }

  const showToast = (msg:string, type:'success'|'error'='success') => {
    setToast(msg); setToastType(type)
    setTimeout(()=>setToast(''), 3000)
  }

  const login = () => {
    if (password === ADMIN_PASSWORD) { setAuthed(true); setPwError(false) }
    else setPwError(true)
  }

  // BOOKINGS
  const updateBookingStatus = async (id:string, status:string) => {
    await supabase.from('bookings').update({status}).eq('id',id)
    setBookings(prev=>prev.map(b=>b.id===id?{...b,status}:b))
    showToast(`✅ تم تغيير الحالة إلى ${status==='confirmed'?'مؤكد':status==='cancelled'?'ملغى':'معلق'}`)
  }

  const updateBookingNotes = async (id:string, notes:string) => {
    await supabase.from('bookings').update({notes}).eq('id',id)
    showToast('✅ تم حفظ الملاحظات')
  }

  const deleteBooking = async (id:string) => {
    if (!confirm('حذف هذا الحجز نهائياً؟')) return
    await supabase.from('bookings').delete().eq('id',id)
    setBookings(prev=>prev.filter(b=>b.id!==id))
    showToast('🗑️ تم حذف الحجز')
  }

  // CONTENT
  const saveContent = async (key:string) => {
    const val = content[key]
    if (!val) return
    await supabase.from('site_content').upsert({ key, value_ar:val.ar, value_en:val.en, value_type:'text', updated_at:new Date().toISOString() })
    showToast('✅ تم الحفظ — سيظهر على الموقع فوراً')
  }

  const saveAllContent = async () => {
    const entries = Object.entries(content)
    for (const [key,val] of entries) {
      await supabase.from('site_content').upsert({ key, value_ar:val.ar, value_en:val.en, value_type:'text', updated_at:new Date().toISOString() })
    }
    showToast(`✅ تم حفظ ${entries.length} عنصر`)
  }

  // PRICING
  const savePricing = async (id:string) => {
    const val = editingPricing[id]
    await supabase.from('pricing').update({ label_ar:val.label_ar, label_en:val.label_en, price:Number(val.price), notes_ar:val.notes_ar||'', notes_en:val.notes_en||'' }).eq('id',id)
    showToast('✅ تم حفظ السعر — سيظهر على الموقع فوراً')
  }

  const addPricingTier = async () => {
    const {data} = await supabase.from('pricing').insert({ label_ar:'سعر جديد', label_en:'New Price', price:0, period_type:'custom', notes_ar:'', notes_en:'' }).select()
    if (data?.[0]) { setPricing(prev=>[...prev,data[0]]); setEditingPricing(prev=>({...prev,[data[0].id]:{...data[0]}})) }
    showToast('✅ تمت الإضافة')
  }

  const deletePricing = async (id:string) => {
    if (!confirm('حذف هذا السعر؟')) return
    await supabase.from('pricing').delete().eq('id',id)
    setPricing(prev=>prev.filter(p=>p.id!==id))
    showToast('🗑️ تم الحذف')
  }

  // MEDIA
  const uploadMedia = async (files:FileList) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${uploadSection}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const {error} = await supabase.storage.from('chalet-media').upload(path, file)
      if (error) { showToast('❌ فشل الرفع: '+error.message,'error'); continue }
      const {data:urlData} = supabase.storage.from('chalet-media').getPublicUrl(path)
      const isVideo = file.type.startsWith('video/')
      const maxOrder = media.filter(m=>m.section===uploadSection).length
      const {data:ins} = await supabase.from('media').insert({ url:urlData.publicUrl, section:uploadSection, media_type:isVideo?'video':'image', sort_order:maxOrder, caption_ar:'', caption_en:'' }).select()
      if (ins?.[0]) setMedia(prev=>[...prev,ins[0]])
    }
    setUploading(false)
    showToast('✅ تم الرفع — ظهر على الموقع فوراً')
  }

  const deleteMedia = async (id:string, url:string) => {
    if (!confirm('حذف هذا الملف نهائياً؟')) return
    const path = url.split('/chalet-media/')[1]
    if (path) await supabase.storage.from('chalet-media').remove([path])
    await supabase.from('media').delete().eq('id',id)
    setMedia(prev=>prev.filter(m=>m.id!==id))
    showToast('🗑️ تم الحذف')
  }

  const moveMedia = async (id:string, dir:'up'|'down') => {
    const idx = media.findIndex(m=>m.id===id)
    const swapIdx = dir==='up'?idx-1:idx+1
    if (swapIdx<0||swapIdx>=media.length) return
    const newMedia = [...media]
    const t = newMedia[idx].sort_order
    newMedia[idx] = {...newMedia[idx], sort_order:newMedia[swapIdx].sort_order}
    newMedia[swapIdx] = {...newMedia[swapIdx], sort_order:t}
    ;[newMedia[idx],newMedia[swapIdx]] = [newMedia[swapIdx],newMedia[idx]]
    setMedia(newMedia)
    await Promise.all([
      supabase.from('media').update({sort_order:newMedia[idx].sort_order}).eq('id',newMedia[idx].id),
      supabase.from('media').update({sort_order:newMedia[swapIdx].sort_order}).eq('id',newMedia[swapIdx].id),
    ])
  }

  const updateCaption = async (id:string, ar:string, en:string) => {
    await supabase.from('media').update({caption_ar:ar, caption_en:en}).eq('id',id)
    setMedia(prev=>prev.map(m=>m.id===id?{...m,caption_ar:ar,caption_en:en}:m))
    showToast('✅ تم حفظ التسمية')
  }

  const filteredBookings = bookings.filter(b=>bookingFilter==='all'||b.status===bookingFilter)
  const contentBySection = ALL_CONTENT_KEYS.filter(k=>k.section===contentSection)

  if (!authed) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0F0F0F 0%,#1A1A1A 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cairo',sans-serif" }}>
        <div style={{ background:'#1A1A1A', border:'1px solid #2A2A2A', borderRadius:20, padding:'52px 44px', width:'100%', maxWidth:420, textAlign:'center', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'linear-gradient(135deg,#F97316,#EA6A0A)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:28 }}>🔐</div>
          <h1 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:26, fontWeight:900, color:'#fff', marginBottom:6 }}>لوحة التحكم</h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', marginBottom:32 }}>Elganzoury Chalet Admin</p>
          <input type="password" placeholder="كلمة المرور" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}
            style={{ width:'100%', padding:'14px 16px', background:'#0F0F0F', border:`1.5px solid ${pwError?'#ef4444':'#2A2A2A'}`, borderRadius:10, color:'#fff', fontSize:15, outline:'none', marginBottom:12, fontFamily:"'Cairo',sans-serif", textAlign:'center' }} />
          {pwError && <p style={{ color:'#ef4444', fontSize:13, marginBottom:12 }}>❌ كلمة مرور غير صحيحة</p>}
          <button onClick={login} style={{ width:'100%', background:'linear-gradient(135deg,#F97316,#EA6A0A)', color:'#fff', padding:16, border:'none', borderRadius:10, fontSize:16, fontWeight:800, cursor:'pointer', fontFamily:"'Cairo',sans-serif", boxShadow:'0 4px 20px rgba(249,115,22,0.4)' }}>
            دخول →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0A0A0A', fontFamily:"'Cairo',sans-serif", direction:'rtl' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:24, left:'50%', transform:'translateX(-50%)', background: toastType==='success'?'#1A3A1A':'#3A1A1A', border:`1px solid ${toastType==='success'?'#22c55e':'#ef4444'}`, color:toastType==='success'?'#4ade80':'#f87171', padding:'14px 28px', borderRadius:10, zIndex:9999, fontSize:14, fontWeight:700, boxShadow:'0 8px 32px rgba(0,0,0,0.6)', whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background:'linear-gradient(90deg,#111 0%,#161616 100%)', borderBottom:'1px solid #1F1F1F', padding:'0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', height:68, position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#F97316,#EA6A0A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🏠</div>
          <div>
            <div style={{ fontFamily:"'Tajawal',sans-serif", fontSize:17, fontWeight:900, color:'#fff', lineHeight:1.1 }}>الجنزوري<span style={{color:'#F97316'}}>.</span></div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:1, textTransform:'uppercase' }}>Admin Dashboard</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:20, padding:'6px 14px' }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 8px #22c55e' }} />
            <span style={{ fontSize:12, color:'#4ade80', fontWeight:700 }}>متصل</span>
          </div>
          <a href="/" target="_blank" style={{ background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.3)', color:'#F97316', padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700, textDecoration:'none' }}>← عرض الموقع</a>
          <button onClick={()=>setAuthed(false)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid #2A2A2A', color:'rgba(255,255,255,0.4)', padding:'8px 14px', borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>خروج</button>
        </div>
      </div>

      <div style={{ display:'flex', minHeight:'calc(100vh - 68px)' }}>

        {/* Sidebar */}
        <div style={{ width:230, background:'#111', borderLeft:'1px solid #1A1A1A', padding:'20px 0', flexShrink:0, position:'sticky', top:68, height:'calc(100vh - 68px)', overflowY:'auto' }}>
          {[
            { id:'bookings', icon:'📋', label:'الحجوزات', badge: bookings.filter(b=>b.status==='pending').length },
            { id:'calendar', icon:'📅', label:'التقويم', badge:0 },
            { id:'content', icon:'✏️', label:'النصوص والمحتوى', badge:0 },
            { id:'media', icon:'🖼️', label:'الصور والفيديو', badge:0 },
            { id:'pricing', icon:'💰', label:'الأسعار', badge:0 },
            { id:'settings', icon:'⚙️', label:'الإعدادات', badge:0 },
          ].map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{ width:'100%', padding:'13px 20px', background:activeTab===tab.id?'rgba(249,115,22,0.08)':'transparent', border:'none', borderRight:activeTab===tab.id?'3px solid #F97316':'3px solid transparent', color:activeTab===tab.id?'#F97316':'rgba(255,255,255,0.4)', fontSize:14, fontWeight:700, cursor:'pointer', textAlign:'right', display:'flex', alignItems:'center', gap:10, fontFamily:"'Cairo',sans-serif", transition:'all 0.2s', position:'relative' }}>
              <span style={{ fontSize:17 }}>{tab.icon}</span>
              <span style={{ flex:1 }}>{tab.label}</span>
              {tab.badge>0 && <span style={{ background:'#ef4444', color:'#fff', borderRadius:20, padding:'1px 8px', fontSize:11, fontWeight:800 }}>{tab.badge}</span>}
            </button>
          ))}

          {/* Stats mini */}
          <div style={{ margin:'24px 16px 0', padding:16, background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.15)', borderRadius:12 }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>إحصائيات سريعة</div>
            {[
              { label:'إجمالي الحجوزات', val:bookings.length, color:'#F97316' },
              { label:'مؤكدة', val:bookings.filter(b=>b.status==='confirmed').length, color:'#22c55e' },
              { label:'معلقة', val:bookings.filter(b=>b.status==='pending').length, color:'#f59e0b' },
            ].map(s=>(
              <div key={s.label} style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{s.label}</span>
                <span style={{ fontSize:13, fontWeight:800, color:s.color }}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div style={{ flex:1, padding:'28px 32px', overflowY:'auto' }}>
          {loading && <div style={{ textAlign:'center', padding:80, color:'rgba(255,255,255,0.2)' }}>⏳ جاري التحميل...</div>}

          {/* ===== BOOKINGS ===== */}
          {activeTab==='bookings' && !loading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:24, fontWeight:900, color:'#fff', marginBottom:4 }}>الحجوزات</h2>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)' }}>{bookings.length} حجز إجمالي</p>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  {['all','pending','confirmed','cancelled'].map(f=>(
                    <button key={f} onClick={()=>setBookingFilter(f)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid', borderColor:bookingFilter===f?'#F97316':'#2A2A2A', background:bookingFilter===f?'rgba(249,115,22,0.15)':'transparent', color:bookingFilter===f?'#F97316':'rgba(255,255,255,0.4)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
                      {f==='all'?`الكل (${bookings.length})`:f==='pending'?`معلق (${bookings.filter(b=>b.status==='pending').length})`:f==='confirmed'?`مؤكد (${bookings.filter(b=>b.status==='confirmed').length})`:`ملغى (${bookings.filter(b=>b.status==='cancelled').length})`}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {filteredBookings.length===0 && <div style={{ textAlign:'center', padding:60, color:'rgba(255,255,255,0.15)', fontSize:14, background:'#111', borderRadius:16, border:'1px solid #1A1A1A' }}>لا توجد حجوزات</div>}
                {filteredBookings.map(b=>(
                  <div key={b.id} style={{ background:'#111', border:'1px solid #1F1F1F', borderRadius:14, padding:22, borderRight:`4px solid ${statusColor[b.status]||'#333'}`, transition:'all 0.2s' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:16, marginBottom:16 }}>
                      {[
                        { label:'الاسم', val:b.renter_name, bold:true },
                        { label:'الوحدة', val:floorLabel[b.floor]||b.floor, color:'#F97316' },
                        { label:'الوصول', val:b.check_in },
                        { label:'المغادرة', val:b.check_out },
                        { label:'الليالي', val:String(b.nights||'-') },
                        { label:'الإجمالي', val:b.total_price?`${b.total_price.toLocaleString()} جنيه`:'-', color:'#22c55e' },
                      ].map(item=>(
                        <div key={item.label}>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{item.label}</div>
                          <div style={{ fontSize:14, fontWeight:item.bold?800:600, color:item.color||'#fff' }}>{item.val}</div>
                        </div>
                      ))}
                      <div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>الهاتف</div>
                        <a href={`https://wa.me/2${b.renter_phone}`} target="_blank" style={{ fontSize:14, fontWeight:700, color:'#25D366', textDecoration:'none' }}>{b.renter_phone}</a>
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>الحالة</div>
                        <span style={{ fontSize:12, fontWeight:700, color:statusColor[b.status], background:`${statusColor[b.status]}20`, padding:'4px 10px', borderRadius:20 }}>
                          {b.status==='confirmed'?'✅ مؤكد':b.status==='pending'?'⏳ معلق':'❌ ملغى'}
                        </span>
                      </div>
                    </div>
                    <textarea defaultValue={b.notes||''} placeholder="ملاحظات..." onBlur={e=>updateBookingNotes(b.id,e.target.value)}
                      style={{ width:'100%', background:'#0A0A0A', border:'1px solid #1F1F1F', borderRadius:8, padding:'8px 12px', color:'rgba(255,255,255,0.6)', fontSize:12, fontFamily:"'Cairo',sans-serif", resize:'vertical', minHeight:52, outline:'none', marginBottom:14 }} />
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {['confirmed','pending','cancelled'].map(s=>(
                        <button key={s} onClick={()=>updateBookingStatus(b.id,s)} disabled={b.status===s} style={{ padding:'7px 16px', background:b.status===s?'transparent':s==='confirmed'?'rgba(34,197,94,0.15)':s==='pending'?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)', border:`1px solid ${s==='confirmed'?'#22c55e':s==='pending'?'#f59e0b':'#ef4444'}`, borderRadius:6, color:s==='confirmed'?'#22c55e':s==='pending'?'#f59e0b':'#ef4444', fontSize:12, fontWeight:700, cursor:b.status===s?'not-allowed':'pointer', opacity:b.status===s?0.4:1, fontFamily:"'Cairo',sans-serif" }}>
                          {s==='confirmed'?'✅ تأكيد':s==='pending'?'⏳ معلق':'❌ إلغاء'}
                        </button>
                      ))}
                      <a href={`https://wa.me/2${b.renter_phone}`} target="_blank" style={{ padding:'7px 16px', background:'rgba(37,211,102,0.15)', border:'1px solid #25D366', borderRadius:6, color:'#25D366', fontSize:12, fontWeight:700, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5 }}>💬 واتساب</a>
                      <button onClick={()=>deleteBooking(b.id)} style={{ padding:'7px 14px', background:'transparent', border:'1px solid #2A2A2A', borderRadius:6, color:'rgba(255,255,255,0.3)', fontSize:12, cursor:'pointer', fontFamily:"'Cairo',sans-serif", marginRight:'auto' }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== CALENDAR ===== */}
          {activeTab==='calendar' && !loading && (
            <div>
              <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:24, fontWeight:900, color:'#fff', marginBottom:8 }}>التقويم</h2>
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)', marginBottom:28 }}>الحجوزات المؤكدة تحجب التواريخ في الموقع تلقائياً</p>
              {['upper','ground','full'].map(floor=>{
                const floorBookings = bookings.filter(b=>b.status==='confirmed'&&(b.floor===floor||(floor==='full'&&b.floor==='full')))
                return (
                  <div key={floor} style={{ marginBottom:32 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                      <div style={{ width:3, height:20, background:floor==='upper'?'#F97316':floor==='ground'?'#0ea5e9':'#8b5cf6', borderRadius:2 }} />
                      <h3 style={{ fontSize:15, fontWeight:800, color:'#fff', margin:0 }}>{floorLabel[floor]}</h3>
                      <span style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>{floorBookings.length} حجز مؤكد</span>
                    </div>
                    {floorBookings.length===0 ? (
                      <div style={{ background:'#111', border:'1px dashed #1F1F1F', borderRadius:10, padding:20, textAlign:'center', color:'rgba(255,255,255,0.15)', fontSize:13 }}>لا توجد حجوزات مؤكدة</div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
                        {floorBookings.map(b=>(
                          <div key={b.id} style={{ background:'#111', border:'1px solid #1F1F1F', borderRadius:10, padding:16 }}>
                            <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:6 }}>{b.renter_name}</div>
                            <div style={{ fontSize:12, color:'#22c55e', marginBottom:4 }}>📅 {b.check_in} ← {b.check_out}</div>
                            <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>🌙 {b.nights} ليالي | 💰 {b.total_price?.toLocaleString()} جنيه</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ===== CONTENT ===== */}
          {activeTab==='content' && !loading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
                <div>
                  <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:24, fontWeight:900, color:'#fff', marginBottom:4 }}>النصوص والمحتوى</h2>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)' }}>كل تغيير يُحفظ ويظهر على الموقع فوراً</p>
                </div>
                <button onClick={saveAllContent} style={{ background:'linear-gradient(135deg,#F97316,#EA6A0A)', color:'#fff', padding:'10px 22px', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif", boxShadow:'0 4px 16px rgba(249,115,22,0.35)' }}>
                  💾 حفظ الكل
                </button>
              </div>

              {/* Section tabs */}
              <div style={{ display:'flex', gap:8, marginBottom:28, flexWrap:'wrap' }}>
                {[['hero','Hero'],['about','About'],['floors','الطوابق'],['gallery','Gallery'],['pricing','الأسعار'],['booking','الحجز'],['payment','الدفع'],['location','الموقع'],['faq','FAQ'],['footer','Footer'],['settings','الإعدادات']].map(([id,label])=>(
                  <button key={id} onClick={()=>setContentSection(id)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid', borderColor:contentSection===id?'#F97316':'#1F1F1F', background:contentSection===id?'rgba(249,115,22,0.12)':'#111', color:contentSection===id?'#F97316':'rgba(255,255,255,0.4)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {contentBySection.map(({key,label})=>(
                  <div key={key} style={{ background:'#111', border:'1px solid #1F1F1F', borderRadius:12, padding:22 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:2 }}>{label}</div>
                        <div style={{ fontSize:11, color:'#F97316', fontFamily:'monospace', opacity:0.7 }}>{key}</div>
                      </div>
                      <button onClick={()=>saveContent(key)} style={{ background:'rgba(249,115,22,0.15)', border:'1px solid rgba(249,115,22,0.3)', color:'#F97316', padding:'6px 16px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>💾 حفظ</button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                      <div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>🇪🇬 عربي</div>
                        <textarea value={content[key]?.ar||''} onChange={e=>setContent(prev=>({...prev,[key]:{...prev[key],ar:e.target.value}})) }
                          style={{ width:'100%', background:'#0A0A0A', border:'1px solid #1F1F1F', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, fontFamily:"'Cairo',sans-serif", resize:'vertical', minHeight:72, outline:'none', direction:'rtl', lineHeight:1.7 }} />
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>🇬🇧 English</div>
                        <textarea value={content[key]?.en||''} onChange={e=>setContent(prev=>({...prev,[key]:{...prev[key],en:e.target.value}})) }
                          style={{ width:'100%', background:'#0A0A0A', border:'1px solid #1F1F1F', borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, fontFamily:"'Cairo',sans-serif", resize:'vertical', minHeight:72, outline:'none', direction:'ltr', lineHeight:1.7 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== MEDIA ===== */}
          {activeTab==='media' && !loading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:16 }}>
                <div>
                  <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:24, fontWeight:900, color:'#fff', marginBottom:4 }}>الصور والفيديو</h2>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)' }}>الملفات المرفوعة تظهر على الموقع فوراً</p>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <select value={uploadSection} onChange={e=>setUploadSection(e.target.value)} style={{ background:'#111', border:'1px solid #2A2A2A', color:'#fff', padding:'10px 14px', borderRadius:8, fontSize:13, fontFamily:"'Cairo',sans-serif", cursor:'pointer' }}>
                    {SECTIONS_MEDIA.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{ background:'linear-gradient(135deg,#F97316,#EA6A0A)', color:'#fff', padding:'10px 20px', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif", opacity:uploading?0.6:1, boxShadow:'0 4px 16px rgba(249,115,22,0.35)' }}>
                    {uploading?'⏳ جاري الرفع...':'📤 رفع ملفات'}
                  </button>
                  <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display:'none' }} onChange={e=>e.target.files&&uploadMedia(e.target.files)} />
                </div>
              </div>

              {SECTIONS_MEDIA.map(section=>{
                const sMedia = media.filter(m=>m.section===section.key)
                return (
                  <div key={section.key} style={{ marginBottom:44 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                      <div style={{ width:32, height:2, background:'#F97316' }} />
                      <h3 style={{ fontSize:14, fontWeight:800, color:'#F97316', textTransform:'uppercase', letterSpacing:2 }}>{section.label}</h3>
                      <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)' }}>{sMedia.length} ملف</span>
                    </div>
                    {sMedia.length===0 ? (
                      <div style={{ background:'#111', border:'2px dashed #1F1F1F', borderRadius:12, padding:36, textAlign:'center', color:'rgba(255,255,255,0.15)', fontSize:13 }}>
                        لا توجد ملفات — اختر هذا القسم من القائمة أعلاه وارفع
                      </div>
                    ) : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
                        {sMedia.map((m,idx)=>(
                          <div key={m.id} style={{ background:'#111', border:'1px solid #1F1F1F', borderRadius:12, overflow:'hidden' }}>
                            <div style={{ position:'relative', height:150, background:'#0A0A0A' }}>
                              {m.media_type==='video'?(
                                <video src={m.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} controls />
                              ):(
                                <img src={m.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              )}
                              <div style={{ position:'absolute', top:8, left:8, display:'flex', gap:4 }}>
                                <button onClick={()=>moveMedia(m.id,'up')} disabled={idx===0} style={{ width:26, height:26, background:'rgba(0,0,0,0.8)', border:'none', borderRadius:4, color:'#fff', fontSize:12, cursor:'pointer', opacity:idx===0?0.3:1 }}>↑</button>
                                <button onClick={()=>moveMedia(m.id,'down')} disabled={idx===sMedia.length-1} style={{ width:26, height:26, background:'rgba(0,0,0,0.8)', border:'none', borderRadius:4, color:'#fff', fontSize:12, cursor:'pointer', opacity:idx===sMedia.length-1?0.3:1 }}>↓</button>
                              </div>
                              <button onClick={()=>deleteMedia(m.id,m.url)} style={{ position:'absolute', top:8, right:8, width:26, height:26, background:'rgba(239,68,68,0.9)', border:'none', borderRadius:4, color:'#fff', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900 }}>×</button>
                              <div style={{ position:'absolute', bottom:6, right:6, background:'rgba(0,0,0,0.7)', borderRadius:4, padding:'2px 6px', fontSize:10, color:'rgba(255,255,255,0.7)' }}>
                                {m.media_type==='video'?'🎥':'🖼️'}
                              </div>
                            </div>
                            <div style={{ padding:10 }}>
                              <input defaultValue={m.caption_ar} placeholder="تسمية عربية..." onBlur={e=>updateCaption(m.id,e.target.value,m.caption_en)}
                                style={{ width:'100%', background:'#0A0A0A', border:'1px solid #1F1F1F', borderRadius:5, padding:'5px 8px', color:'rgba(255,255,255,0.7)', fontSize:11, fontFamily:"'Cairo',sans-serif", outline:'none', marginBottom:5, direction:'rtl' }} />
                              <input defaultValue={m.caption_en} placeholder="English caption..." onBlur={e=>updateCaption(m.id,m.caption_ar,e.target.value)}
                                style={{ width:'100%', background:'#0A0A0A', border:'1px solid #1F1F1F', borderRadius:5, padding:'5px 8px', color:'rgba(255,255,255,0.7)', fontSize:11, fontFamily:"'Cairo',sans-serif", outline:'none', direction:'ltr' }} />
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

          {/* ===== PRICING ===== */}
          {activeTab==='pricing' && !loading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
                <div>
                  <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:24, fontWeight:900, color:'#fff', marginBottom:4 }}>الأسعار</h2>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)' }}>التغييرات تظهر على الموقع فوراً بعد الحفظ</p>
                </div>
                <button onClick={addPricingTier} style={{ background:'rgba(249,115,22,0.15)', border:'1px solid rgba(249,115,22,0.3)', color:'#F97316', padding:'10px 20px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
                  + إضافة سعر
                </button>
              </div>

              {/* Per-floor pricing guide */}
              <div style={{ background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:12, padding:18, marginBottom:24 }}>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.8, margin:0 }}>
                  💡 <strong style={{color:'#F97316'}}>أنواع الأسعار المدعومة:</strong> upper_weekday | upper_weekend | ground_weekday | ground_weekend
                  — هذه الأنواع تُستخدم تلقائياً في الموقع لحساب الأسعار بشكل صحيح لكل دور.
                </p>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {Object.entries(editingPricing).map(([id,val])=>(
                  <div key={id} style={{ background:'#111', border:'1px solid #1F1F1F', borderRadius:12, padding:24 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:16 }}>
                      {[
                        { label:'الاسم عربي 🇪🇬', field:'label_ar', dir:'rtl' },
                        { label:'English Name 🇬🇧', field:'label_en', dir:'ltr' },
                        { label:'نوع الفترة', field:'period_type', dir:'ltr' },
                      ].map(({label,field,dir})=>(
                        <div key={field}>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>{label}</div>
                          <input value={val[field]||''} onChange={e=>setEditingPricing(prev=>({...prev,[id]:{...prev[id],[field]:e.target.value}}))}
                            style={{ ...darkInput, direction:dir as any }} />
                        </div>
                      ))}
                      <div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>السعر (جنيه/ليلة)</div>
                        <input type="number" value={val.price||0} onChange={e=>setEditingPricing(prev=>({...prev,[id]:{...prev[id],price:e.target.value}}))}
                          style={{ ...darkInput, color:'#F97316', fontWeight:800, fontSize:20, direction:'ltr' }} />
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={()=>savePricing(id)} style={{ background:'linear-gradient(135deg,#F97316,#EA6A0A)', color:'#fff', padding:'8px 20px', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>💾 حفظ</button>
                      <button onClick={()=>deletePricing(id)} style={{ background:'transparent', color:'rgba(239,68,68,0.7)', border:'1px solid rgba(239,68,68,0.2)', padding:'8px 16px', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== SETTINGS ===== */}
          {activeTab==='settings' && !loading && (
            <div>
              <h2 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:24, fontWeight:900, color:'#fff', marginBottom:28 }}>الإعدادات العامة</h2>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16, marginBottom:40 }}>
                {[
                  { key:'whatsapp_number', label:'رقم واتساب', icon:'📱', desc:'رقم للتواصل والحجز' },
                  { key:'instapay_number', label:'رقم InstaPay', icon:'💳', desc:'رقم للدفع' },
                  { key:'max_guests', label:'أقصى عدد ضيوف', icon:'👥', desc:'الحد الأقصى للمجموعة' },
                  { key:'pool_distance', label:'مسافة حمام السباحة', icon:'🏊', desc:'وصف المسافة' },
                ].map(({key,label,icon,desc})=>(
                  <div key={key} style={{ background:'#111', border:'1px solid #1F1F1F', borderRadius:12, padding:22 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                      <div style={{ fontSize:22 }}>{icon}</div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{label}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>{desc}</div>
                      </div>
                    </div>
                    <input value={content[key]?.ar||''} onChange={e=>setContent(prev=>({...prev,[key]:{...prev[key],ar:e.target.value}}))}
                      placeholder="عربي..." style={{ ...darkInput, marginBottom:8, direction:'rtl' }} />
                    <input value={content[key]?.en||''} onChange={e=>setContent(prev=>({...prev,[key]:{...prev[key],en:e.target.value}}))}
                      placeholder="English..." style={{ ...darkInput, marginBottom:12, direction:'ltr' }} />
                    <button onClick={()=>saveContent(key)} style={{ background:'rgba(249,115,22,0.15)', border:'1px solid rgba(249,115,22,0.3)', color:'#F97316', padding:'7px 16px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>💾 حفظ</button>
                  </div>
                ))}
              </div>

              {/* Danger zone */}
              <div style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:12, padding:24 }}>
                <h3 style={{ fontSize:15, fontWeight:800, color:'#ef4444', marginBottom:6 }}>⚠️ منطقة الخطر</h3>
                <p style={{ fontSize:13, color:'rgba(255,255,255,0.3)', marginBottom:16 }}>هذه الإجراءات لا يمكن التراجع عنها</p>
                <button onClick={async()=>{ if(confirm('حذف كل الحجوزات الملغاة نهائياً؟')){ await supabase.from('bookings').delete().eq('status','cancelled'); await fetchAll(); showToast('🗑️ تم الحذف') }}} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'10px 20px', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
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

const darkInput: React.CSSProperties = {
  width:'100%', background:'#0A0A0A', border:'1px solid #1F1F1F', borderRadius:8,
  padding:'10px 12px', color:'#fff', fontSize:13, fontFamily:"'Cairo',sans-serif", outline:'none',
}
