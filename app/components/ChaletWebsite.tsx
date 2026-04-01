'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface Pricing { id: string; label_ar: string; label_en: string; price: number; period_type: string }
interface Media { id: string; url: string; caption_ar: string; caption_en: string; section: string; sort_order: number; media_type: string }
interface Content { key: string; value_ar: string; value_en: string }

interface Props {
  pricing: Pricing[]
  media: Media[]
  content: Content[]
}

export default function ChaletWebsite({ pricing: initialPricing, media: initialMedia, content: initialContent }: Props) {
  const [isAR, setIsAR] = useState(true)
  const [navScrolled, setNavScrolled] = useState(false)
  const [activeFloor, setActiveFloor] = useState('ground')
  const [heroImg, setHeroImg] = useState(0)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [renterName, setRenterName] = useState('')
  const [renterPhone, setRenterPhone] = useState('')
  const [bookings, setBookings] = useState<{check_in:string,check_out:string}[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Live data state — always fetched fresh from Supabase
  const [pricing, setPricing] = useState<Pricing[]>(initialPricing)
  const [media, setMedia] = useState<Media[]>(initialMedia)
  const [content, setContent] = useState<Content[]>(initialContent)

  // Fetch ALL live data from Supabase on every page load
  useEffect(() => {
    const fetchLiveData = async () => {
      const [p, m, c, b] = await Promise.all([
        supabase.from('pricing').select('*'),
        supabase.from('media').select('*').order('sort_order'),
        supabase.from('site_content').select('*'),
        supabase.from('bookings').select('check_in,check_out').eq('status','confirmed'),
      ])
      if (p.data) setPricing(p.data)
      if (m.data) setMedia(m.data)
      if (c.data) setContent(c.data)
      if (b.data) setBookings(b.data)
    }
    fetchLiveData()
  }, [])

  const t = useCallback((key: string, fallbackAr: string, fallbackEn: string) => {
    const item = content.find(c => c.key === key)
    if (!item) return isAR ? fallbackAr : fallbackEn
    return isAR ? item.value_ar : item.value_en
  }, [content, isAR])

  const heroImages = media.filter(m => m.section === 'hero' && m.media_type === 'image')
  const galleryImages = media.filter(m => m.section === 'gallery')
  const floorImages: Record<string, Media[]> = {
    ground: media.filter(m => m.section === 'floor_ground'),
    upper: media.filter(m => m.section === 'floor_upper'),
    roof: media.filter(m => m.section === 'roof'),
  }

  const weekdayPrice = pricing.find(p => p.period_type === 'weekday')?.price || 1750
  const weekendPrice = pricing.find(p => p.period_type === 'weekend')?.price || 2000

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 60)

    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    if (heroImages.length <= 1) return
    const interval = setInterval(() => setHeroImg(i => (i + 1) % heroImages.length), 5000)
    return () => clearInterval(interval)
  }, [heroImages.length])

  const calcPrice = () => {
    if (!checkIn || !checkOut) return null
    const start = new Date(checkIn), end = new Date(checkOut)
    if (end <= start) return null
    let weekdays = 0, weekend = 0
    const cur = new Date(start)
    while (cur < end) {
      const day = cur.getDay()
      if (day === 5 || day === 6) weekend++; else weekdays++
      cur.setDate(cur.getDate() + 1)
    }
    return { weekdays, weekend, nights: weekdays + weekend, total: weekdays * weekdayPrice + weekend * weekendPrice }
  }

  const priceCalc = calcPrice()

  const isBooked = (date: Date) => {
    return bookings.some(b => {
      const start = new Date(b.check_in), end = new Date(b.check_out)
      return date >= start && date <= end
    })
  }

  const monthNamesAR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const monthNamesEN = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const dayNamesAR = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت']
  const dayNamesEN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const renderCalendar = () => {
    const first = new Date(calYear, calMonth, 1).getDay()
    const total = new Date(calYear, calMonth + 1, 0).getDate()
    const today = new Date()
    const cells = []
    for (let i = 0; i < first; i++) cells.push(<div key={`e${i}`} />)
    for (let d = 1; d <= total; d++) {
      const date = new Date(calYear, calMonth, d)
      const booked = isBooked(date)
      const isToday = date.toDateString() === today.toDateString()
      cells.push(
        <div key={d} style={{
          aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
          borderRadius:8, fontSize:14, fontWeight:700,
          background: booked ? '#ef4444' : '#22c55e',
          color: '#fff',
          outline: isToday ? '3px solid #F97316' : 'none',
          outlineOffset: 2,
          boxShadow: booked ? '0 2px 8px rgba(239,68,68,0.4)' : '0 2px 8px rgba(34,197,94,0.3)',
          cursor: booked ? 'not-allowed' : 'pointer',
          transition: 'transform 0.15s',
        }}
          onMouseEnter={e => { if (!booked) (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
        >{d}</div>
      )
    }
    return cells
  }

  const buildWALink = () => {
    let msg = isAR
      ? `مرحباً، أود حجز شاليه الجنزوري.\n\n`
      : `Hello, I'd like to book Elganzoury Chalet.\n\n`
    if (renterName) msg += (isAR ? '👤 الاسم: ' : '👤 Name: ') + renterName + '\n'
    if (renterPhone) msg += (isAR ? '📞 الهاتف: ' : '📞 Phone: ') + renterPhone + '\n'
    if (checkIn) msg += (isAR ? '📅 تاريخ الوصول: ' : '📅 Check-in: ') + checkIn + '\n'
    if (checkOut) msg += (isAR ? '📅 تاريخ المغادرة: ' : '📅 Check-out: ') + checkOut + '\n'
    if (priceCalc) {
      msg += (isAR ? '🌙 عدد الليالي: ' : '🌙 Nights: ') + priceCalc.nights + '\n'
      msg += (isAR ? '💰 الإجمالي: ' : '💰 Total: ') + priceCalc.total.toLocaleString() + (isAR ? ' جنيه' : ' EGP') + '\n'
    }
    msg += isAR
      ? `\n✅ سأقوم بإرسال لقطة شاشة الدفع عبر InstaPay.`
      : `\n✅ I will send the InstaPay payment screenshot.`
    return 'https://wa.me/201159710758?text=' + encodeURIComponent(msg)
  }

  const submitBooking = async () => {
    if (!renterName || !renterPhone || !checkIn || !checkOut) {
      alert(isAR ? 'يرجى ملء جميع الحقول' : 'Please fill all fields')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('bookings').insert({
      renter_name: renterName,
      renter_phone: renterPhone,
      check_in: checkIn,
      check_out: checkOut,
      nights: priceCalc?.nights,
      total_price: priceCalc?.total,
      status: 'pending',
    })
    setSubmitting(false)
    if (!error) {
      setSubmitted(true)
      window.open(buildWALink(), '_blank')
    }
  }

  const defaultHeroBg = [
    'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1600&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&q=80',
  ]
  const currentHeroBg = heroImages.length > 0 ? heroImages[heroImg]?.url : defaultHeroBg[heroImg % 3]

  return (
    <div style={{ direction: isAR ? 'rtl' : 'ltr', fontFamily: "'Cairo', sans-serif" }}>

      {/* ===== NAV ===== */}
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:1000,
        background: navScrolled ? 'rgba(255,255,255,0.97)' : 'transparent',
        backdropFilter: navScrolled ? 'blur(12px)' : 'none',
        boxShadow: navScrolled ? '0 2px 30px rgba(0,0,0,0.08)' : 'none',
        transition:'all 0.4s ease',
      }}>
        <div className="container" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', height:72 }}>
          <a href="#hero" style={{ fontFamily:"'Tajawal',sans-serif", fontSize:22, fontWeight:900, color: navScrolled ? '#0F0F0F' : '#fff', textDecoration:'none' }}>
            {isAR ? 'الجنزوري' : 'Elganzoury'}<span style={{ color:'#F97316' }}>.</span>
          </a>
          <div style={{ display:'flex', alignItems:'center', gap:28, flexWrap:'wrap' }}>
            {[
              ['#about', isAR?'الشاليه':'About'],
              ['#floors', isAR?'الطوابق':'Floors'],
              ['#pricing', isAR?'الأسعار':'Pricing'],
              ['#booking', isAR?'الحجز':'Booking'],
              ['#faq', isAR?'أسئلة':'FAQ'],
            ].map(([href, label]) => (
              <a key={href} href={href} style={{ color: navScrolled ? '#1A1A1A' : 'rgba(255,255,255,0.9)', textDecoration:'none', fontSize:14, fontWeight:600, transition:'color 0.3s' }}
                onMouseEnter={e=>(e.currentTarget.style.color='#F97316')}
                onMouseLeave={e=>(e.currentTarget.style.color= navScrolled ? '#1A1A1A' : 'rgba(255,255,255,0.9)')}>
                {label}
              </a>
            ))}
            <button onClick={() => setIsAR(!isAR)} style={{
              background: navScrolled ? '#FFF7ED' : 'rgba(255,255,255,0.15)',
              border: `1px solid ${navScrolled ? '#F97316' : 'rgba(255,255,255,0.35)'}`,
              color: navScrolled ? '#F97316' : '#fff', padding:'7px 18px', borderRadius:4,
              fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif",
            }}>{isAR ? 'English' : 'عربي'}</button>
            <a href="#booking" style={{
              background:'#F97316', color:'#fff', padding:'10px 24px', borderRadius:4,
              fontSize:14, fontWeight:800, textDecoration:'none',
              boxShadow:'0 4px 20px rgba(249,115,22,0.4)',
            }}>{isAR ? 'احجز الآن' : 'Book Now'}</a>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section id="hero" style={{ position:'relative', height:'100vh', minHeight:600, overflow:'hidden', display:'flex', alignItems:'center' }}>
        <div style={{ position:'absolute', inset:0, zIndex:0 }}>
          <img src={currentHeroBg} alt="hero" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(100deg,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0.48) 55%,rgba(0,0,0,0.18) 100%)' }} />
        <div className="container" style={{ position:'relative', zIndex:2, width:'100%' }}>
          <div style={{ maxWidth:700 }}>
            <SectionTag label={isAR ? 'الساحل الشمالي — مصر' : 'NORTH COAST — EGYPT'} dark />
            <h1 style={{ fontSize:'clamp(44px,7vw,88px)', fontWeight:900, color:'#fff', lineHeight:1.05, marginBottom:20, fontFamily:"'Tajawal',sans-serif" }}>
              {isAR ? <>شاليه <span style={{ color:'#F97316' }}>الجنزوري</span><br/>إطلالة البحر مباشرةً</> : <><span style={{ color:'#F97316' }}>Elganzoury</span><br/>Chalet — Sea View</>}
            </h1>
            <p style={{ fontSize:'clamp(16px,2vw,19px)', color:'rgba(255,255,255,0.82)', lineHeight:1.9, marginBottom:36, maxWidth:520 }}>
              {t('hero_subtitle','شاليه فاخر على خط البحر، بإطلالة ١٨٠ درجة من السطح في قلب الساحل الشمالي.','A premium chalet with direct sea view and 180° rooftop panorama on Egypt\'s North Coast.')}
            </p>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              <a href="#booking" style={{ background:'#F97316', color:'#fff', padding:'15px 36px', borderRadius:4, fontWeight:800, fontSize:15, textDecoration:'none', boxShadow:'0 4px 20px rgba(249,115,22,0.45)' }}>
                {isAR ? 'احجز الآن' : 'Book Now'}
              </a>
              <a href="#floors" style={{ background:'rgba(255,255,255,0.15)', color:'#fff', padding:'15px 36px', borderRadius:4, fontWeight:700, fontSize:15, border:'1px solid rgba(255,255,255,0.35)', textDecoration:'none' }}>
                {isAR ? 'تفاصيل الشاليه' : 'Explore Chalet'}
              </a>
            </div>
          </div>
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.15)', marginTop:60, paddingTop:28, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0 }}>
            {[['5',isAR?'غرف نوم':'Bedrooms'],['4',isAR?'حمامات':'Bathrooms'],['180°',isAR?'إطلالة بحرية':'Sea View'],['3',isAR?'طوابق':'Floors']].map(([num,label])=>(
              <div key={label} style={{ textAlign:'center', padding:'0 12px' }}>
                <div style={{ fontFamily:"'Tajawal',sans-serif", fontSize:'clamp(28px,4vw,44px)', fontWeight:900, color:'#F97316' }}>{num}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', fontWeight:600, marginTop:4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ABOUT ===== */}
      <section id="about" style={{ background:'#FAFAF8' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', minHeight:560 }}>
          <div style={{ padding:'clamp(48px,8vw,100px) clamp(20px,5vw,64px)', display:'flex', flexDirection:'column', justifyContent:'center' }}>
            <SectionTag label={isAR ? 'عن الشاليه' : 'ABOUT'} />
            <h2 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:900, color:'#0F0F0F', marginBottom:20, fontFamily:"'Tajawal',sans-serif" }}>
              {isAR ? 'راحة لا مثيل لها، وإطلالة لا تُنسى' : 'Unmatched Comfort, Unforgettable View'}
            </h2>
            <p style={{ fontSize:16, color:'#6A6A6A', lineHeight:1.9, marginBottom:16 }}>
              {t('about_text','يقع شاليه الجنزوري في الصف الثاني مباشرةً على خط البحر في الساحل الشمالي، وبفضل الفراغ المفتوح أمامه تُبصر البحر الأبيض المتوسط بوضوح تام.','Elganzoury Chalet sits in the second row on the North Coast shoreline. An open gap in front gives you a completely clear, unobstructed Mediterranean view.')}
            </p>
            <p style={{ fontSize:16, color:'#6A6A6A', lineHeight:1.9 }}>
              {isAR ? 'يضم ٣ طوابق — الدور الأرضي، الدور العلوي، والسطح البانورامي ١٨٠ درجة — مع حمام سباحة مشترك على بُعد دقيقة بالسيارة.' : '3 floors — ground, upper, and a spectacular 180° panoramic rooftop — with a shared pool just 1 minute by car.'}
            </p>
          </div>
          <div style={{ position:'relative', overflow:'hidden', minHeight:400 }}>
            <img src={media.find(m=>m.section==='about')?.url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80'} alt="about" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.3) 0%,transparent 60%)' }} />
            <div style={{ position:'absolute', bottom:28, right:28, background:'rgba(255,255,255,0.95)', padding:'14px 20px', borderRadius:8, display:'flex', alignItems:'center', gap:10, boxShadow:'0 8px 30px rgba(0,0,0,0.15)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#F97316"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <span style={{ fontSize:13, fontWeight:700, color:'#0F0F0F' }}>{isAR ? 'الساحل الشمالي، مصر' : 'Sahel, North Coast, Egypt'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      <div style={{ position:'relative', height:300, overflow:'hidden' }}>
        <img src="https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=1400&q=80" alt="sea" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:32, textAlign:'center' }}>
            {[['10+',isAR?'ضيوف':'Guests'],['5',isAR?'غرف نوم':'Bedrooms'],['1دق',isAR?'للحمام السباحة':'To Pool'],['180°',isAR?'من السطح':'Rooftop']].map(([n,l])=>(
              <div key={l}>
                <div style={{ fontSize:'clamp(36px,5vw,52px)', fontWeight:900, color:'#F97316', fontFamily:"'Tajawal',sans-serif" }}>{n}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', fontWeight:600, marginTop:6 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== FLOORS — REDESIGNED MAGAZINE STYLE ===== */}
      <section id="floors" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#FFFFFF' }}>
        <div className="container">
          <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto 64px' }}>
            <SectionTag label={isAR ? 'تفاصيل الطوابق' : 'FLOOR DETAILS'} center />
            <h2 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:900, color:'#0F0F0F', marginBottom:16, fontFamily:"'Tajawal',sans-serif" }}>
              {isAR ? 'اكتشف كل طابق بتفاصيله' : 'Explore Every Floor'}
            </h2>
            <p style={{ fontSize:16, color:'#6A6A6A', lineHeight:1.9 }}>
              {isAR ? 'شاليه مُصمَّم بعناية على ٣ طوابق لاستيعاب عائلتك بكل راحة واتساع.' : 'Thoughtfully designed across 3 floors to give your family all the space they need.'}
            </p>
          </div>

          {/* Floor selector — magazine tabs */}
          <div style={{ display:'flex', justifyContent:'center', gap:0, marginBottom:56, border:'1px solid #E8E5DF', borderRadius:8, overflow:'hidden', maxWidth:480, margin:'0 auto 56px' }}>
            {[['ground',isAR?'الدور الأرضي':'Ground'],['upper',isAR?'الدور العلوي':'Upper'],['roof',isAR?'السطح':'Rooftop']].map(([id,label],i)=>(
              <button key={id} onClick={()=>setActiveFloor(id)} style={{
                flex:1, padding:'16px 8px', border:'none', borderLeft: i>0 ? '1px solid #E8E5DF' : 'none',
                fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:"'Cairo',sans-serif",
                background: activeFloor===id ? '#F97316' : '#fff',
                color: activeFloor===id ? '#fff' : '#6A6A6A',
                transition:'all 0.3s',
              }}>{label}</button>
            ))}
          </div>

          {/* Floor Panels — magazine layout */}
          {activeFloor === 'ground' && <MagazineFloor isAR={isAR}
            number="01" tag={isAR?'الدور الأرضي':'GROUND FLOOR'}
            title={isAR?'الدور الأرضي':'Ground Floor'}
            subtitle={isAR?'المعيشة والراحة الأساسية':'Living & Core Comfort'}
            desc={isAR?'الدور الأرضي مُجهَّز بالكامل، يضم غرفتي نوم واسعتين ومطبخاً وكل ما تحتاجه عائلتك للاستمتاع براحة تامة.':'Fully equipped ground floor with two spacious bedrooms, a kitchen, and everything your family needs for complete comfort.'}
            features={[
              { icon:'🛏️', title: isAR?'غرفة نوم ١':'Bedroom 1', desc: isAR?'سريران + دولاب + مروحة':'2 beds + wardrobe + fan' },
              { icon:'🛏️', title: isAR?'غرفة نوم ٢':'Bedroom 2', desc: isAR?'سريران + دولاب + مروحة':'2 beds + wardrobe + fan' },
              { icon:'🚿', title: isAR?'حمامان':'2 Bathrooms', desc: isAR?'حمامان كاملان':'2 full bathrooms' },
              { icon:'🍳', title: isAR?'مطبخ':'Kitchen', desc: isAR?'مجهَّز بالكامل':'Fully equipped' },
            ]}
            image={floorImages.ground[0]?.url}
            placeholder={isAR?'صورة الدور الأرضي — قريباً':'Ground floor photo coming soon'}
            color="#FFF7ED"
          />}
          {activeFloor === 'upper' && <MagazineFloor isAR={isAR}
            number="02" tag={isAR?'الدور العلوي':'UPPER FLOOR'}
            title={isAR?'الدور العلوي':'Upper Floor'}
            subtitle={isAR?'الإطلالة والخصوصية':'Views & Privacy'}
            desc={isAR?'الدور العلوي هو قلب الشاليه — ثلاث غرف نوم، بلكونة بحرية، وواي فاي للتواصل مع العالم أثناء استمتاعك بالبحر.':'The upper floor is the heart of the chalet — three bedrooms, a sea-view balcony, and WiFi to stay connected while enjoying the sea.'}
            features={[
              { icon:'👑', title: isAR?'غرفة ماستر':'Master Bedroom', desc: isAR?'سرير كبير + تسريحة + مروحة + دولاب':'Large bed + dressing table + fan + wardrobe' },
              { icon:'🛏️', title: isAR?'غرفة نوم ٢':'Bedroom 2', desc: isAR?'سريران + دولاب + مروحة':'2 beds + wardrobe + fan' },
              { icon:'🛏️', title: isAR?'غرفة نوم ٣':'Bedroom 3', desc: isAR?'سريران + دولاب + مروحة':'2 beds + wardrobe + fan' },
              { icon:'🚿', title: isAR?'حمامان':'2 Bathrooms', desc: isAR?'حمامان كاملان':'2 full bathrooms' },
              { icon:'🌊', title: isAR?'بلكونة بحرية':'Sea Balcony', desc: isAR?'إطلالة مباشرة على البحر':'Direct sea view' },
              { icon:'📶', title: 'WiFi', desc: isAR?'متاح في هذا الدور':'Available on this floor' },
            ]}
            image={floorImages.upper[0]?.url}
            placeholder={isAR?'صورة الدور العلوي — قريباً':'Upper floor photo coming soon'}
            color="#F0F9FF"
          />}
          {activeFloor === 'roof' && <MagazineFloor isAR={isAR}
            number="03" tag={isAR?'السطح':'ROOFTOP'}
            title={isAR?'السطح البانورامي':'Panoramic Rooftop'}
            subtitle={isAR?'تاج الشاليه — ١٨٠ درجة':'Crown of the Chalet — 180°'}
            desc={isAR?'التاج الحقيقي للشاليه — سطح مفتوح بإطلالة بحرية بانورامية ١٨٠ درجة لا مثيل لها. المكان المثالي لجلسات الغروب والسهرات الرائعة مع العائلة.':'The crown jewel — an open rooftop with an unmatched 180° panoramic sea view. The perfect spot for sunset sessions and unforgettable family evenings.'}
            features={[
              { icon:'🌅', title: isAR?'إطلالة ١٨٠ درجة':'180° View', desc: isAR?'البحر الأبيض المتوسط بالكامل أمامك':'Full Mediterranean panorama' },
              { icon:'🌙', title: isAR?'جلسات السهرة':'Evening Sessions', desc: isAR?'مساحة مفتوحة للتجمعات':'Open space for gatherings' },
              { icon:'🌞', title: isAR?'مشاهدة الغروب':'Sunset Watching', desc: isAR?'أجمل غروب في الساحل':'The most beautiful sunset on the coast' },
            ]}
            image={floorImages.roof[0]?.url}
            placeholder={isAR?'صورة السطح — قريباً':'Rooftop photo coming soon'}
            color="#FFF7ED"
          />}
        </div>
      </section>

      {/* ===== GALLERY ===== */}
      <section id="gallery" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#FAFAF8' }}>
        <div className="container">
          <div style={{ textAlign:'center', maxWidth:560, margin:'0 auto 48px' }}>
            <SectionTag label={isAR?'معرض الصور':'GALLERY'} center />
            <h2 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:900, color:'#0F0F0F', fontFamily:"'Tajawal',sans-serif" }}>
              {isAR?'لقطات من الشاليه':'A Glimpse Inside'}
            </h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gridTemplateRows:'280px 280px', gap:12 }}>
            {(galleryImages.length > 0 ? galleryImages : [
              { url:'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80' },
              { url:'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80' },
              { url:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80' },
              { url:'' }, { url:'' },
            ] as any[]).slice(0,5).map((img:any, i:number) => (
              <div key={i} style={{ gridRow:i===0?'span 2':'span 1', overflow:'hidden', borderRadius:8, background:'#f0ece6', position:'relative' }}>
                {img.url ? (
                  <img src={img.url} alt={`gallery ${i}`} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform 0.6s ease' }}
                    onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.05)')}
                    onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')} />
                ) : (
                  <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, background:'linear-gradient(135deg,#f0ece6,#e8e2d8)' }}>
                    <span style={{ fontSize:12, color:'#8A8A8A', fontWeight:600 }}>{isAR?'صور قادمة':'Photos coming soon'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p style={{ textAlign:'center', marginTop:24, fontSize:14, color:'#8A8A8A' }}>
            {isAR?'📸 سيتم إضافة الصور الحقيقية للشاليه قريباً':'📸 Real chalet photos coming very soon'}
          </p>
        </div>
      </section>

      {/* ===== PRICING — REDESIGNED ===== */}
      <section id="pricing" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#0F0F0F' }}>
        <div className="container">
          <div style={{ textAlign:'center', maxWidth:600, margin:'0 auto 64px' }}>
            <SectionTag label={isAR?'الأسعار':'PRICING'} dark center />
            <h2 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:900, color:'#fff', marginBottom:16, fontFamily:"'Tajawal',sans-serif" }}>
              {isAR?'أسعار شفافة بلا مفاجآت':'Transparent Pricing, No Surprises'}
            </h2>
            <p style={{ fontSize:16, color:'rgba(255,255,255,0.6)', lineHeight:1.9 }}>
              {isAR?'الشاليه بالكامل لك طوال فترة إقامتك. الأسعار تختلف بحسب اليوم.':'The full chalet is exclusively yours. Prices vary by day.'}
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:24, marginBottom:40 }}>
            {(pricing.length > 0 ? pricing : [
              { label_ar:'نهاية الأسبوع', label_en:'Weekend', price:2000, period_type:'weekend', id:'1' },
              { label_ar:'أيام الأسبوع', label_en:'Weekdays', price:1750, period_type:'weekday', id:'2' },
            ]).map((p) => (
              <div key={p.id} style={{
                background: p.period_type==='weekend' ? '#F97316' : 'rgba(255,255,255,0.06)',
                border: p.period_type==='weekend' ? 'none' : '1px solid rgba(255,255,255,0.12)',
                borderRadius:16, padding:'40px 36px', position:'relative', overflow:'hidden',
              }}>
                {p.period_type==='weekend' && (
                  <div style={{ position:'absolute', top:20, left:20, background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:700, color:'#fff', letterSpacing:1 }}>
                    {isAR?'الأكثر طلباً':'Most Popular'}
                  </div>
                )}
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:3, textTransform:'uppercase', color: p.period_type==='weekend' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', marginBottom:12, marginTop: p.period_type==='weekend' ? 28 : 0 }}>
                  {p.period_type === 'weekend' ? (isAR?'الجمعة والسبت':'Friday & Saturday') : (isAR?'الأحد — الخميس':'Sunday — Thursday')}
                </div>
                <div style={{ fontSize:22, fontWeight:900, color:'#fff', fontFamily:"'Tajawal',sans-serif", marginBottom:8 }}>
                  {isAR ? p.label_ar : p.label_en}
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:16 }}>
                  <span style={{ fontSize:'clamp(44px,6vw,64px)', fontWeight:900, color:'#fff', fontFamily:"'Tajawal',sans-serif", lineHeight:1 }}>{p.price.toLocaleString()}</span>
                  <span style={{ fontSize:15, color: p.period_type==='weekend' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)', fontWeight:600 }}>{isAR?'جنيه / ليلة':'EGP / night'}</span>
                </div>
                <div style={{ fontSize:14, color: p.period_type==='weekend' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)', lineHeight:1.7 }}>
                  {p.period_type==='weekend' ? (isAR?'الأيام الأكثر طلباً في الموسم — احجز مبكراً':'Most in-demand days — book early') : (isAR?'هدوء أكثر وأسعار أوفر لإقامة مريحة':'Quieter days, better value for a relaxed stay')}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.25)', borderRadius:12, padding:'24px 28px' }}>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.75)', lineHeight:1.9, textAlign:'center' }}>
              <strong style={{ color:'#F97316' }}>{isAR?'ملاحظة: ':'Note: '}</strong>
              {isAR?'الأسعار تقديرية وقابلة للتغيير. الحجز مشروط بإتمام الدفع عبر InstaPay.':'Prices are estimates and subject to change. Booking is confirmed only upon InstaPay payment.'}
            </p>
          </div>
        </div>
      </section>

      {/* ===== BOOKING + CALENDAR ===== */}
      <section id="booking" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#FAFAF8' }}>
        <div className="container">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'clamp(32px,6vw,80px)', alignItems:'start' }}>

            {/* Left: calendar + steps */}
            <div>
              <SectionTag label={isAR?'الحجز':'BOOKING'} />
              <h2 style={{ fontSize:'clamp(32px,4vw,48px)', fontWeight:900, color:'#0F0F0F', marginBottom:20, fontFamily:"'Tajawal',sans-serif" }}>
                {isAR?'تحقق من التوفر واحجز':'Check Availability & Book'}
              </h2>

              {/* Calendar */}
              <div style={{ background:'#fff', border:'1px solid #E8E5DF', borderRadius:16, overflow:'hidden', marginBottom:28, boxShadow:'0 4px 24px rgba(0,0,0,0.06)' }}>
                <div style={{ background:'#F97316', color:'#fff', padding:'20px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <button onClick={()=>{ let m=calMonth-1,y=calYear; if(m<0){m=11;y--;} setCalMonth(m);setCalYear(y); }} style={{ background:'none', border:'none', color:'#fff', fontSize:20, cursor:'pointer', fontWeight:900 }}>›</button>
                  <h4 style={{ fontSize:18, fontWeight:900, fontFamily:"'Tajawal',sans-serif" }}>
                    {(isAR?monthNamesAR:monthNamesEN)[calMonth]} {calYear}
                  </h4>
                  <button onClick={()=>{ let m=calMonth+1,y=calYear; if(m>11){m=0;y++;} setCalMonth(m);setCalYear(y); }} style={{ background:'none', border:'none', color:'#fff', fontSize:20, cursor:'pointer', fontWeight:900 }}>‹</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'12px 12px 0', gap:4 }}>
                  {(isAR?dayNamesAR:dayNamesEN).map(d=><div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:800, color:'#8A8A8A', textTransform:'uppercase', padding:'4px 0' }}>{d}</div>)}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:12, gap:6 }}>
                  {renderCalendar()}
                </div>
              </div>

              {/* Legend — redesigned prominent */}
              <div style={{ display:'flex', gap:16, marginBottom:40, flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'#dcfce7', border:'1px solid #22c55e', borderRadius:8, padding:'10px 18px', flex:1, justifyContent:'center' }}>
                  <span style={{ width:16, height:16, borderRadius:'50%', background:'#22c55e', display:'block', flexShrink:0, boxShadow:'0 2px 8px rgba(34,197,94,0.5)' }} />
                  <span style={{ fontSize:14, fontWeight:800, color:'#15803d' }}>{isAR?'✅ متاح للحجز':'✅ Available'}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fee2e2', border:'1px solid #ef4444', borderRadius:8, padding:'10px 18px', flex:1, justifyContent:'center' }}>
                  <span style={{ width:16, height:16, borderRadius:'50%', background:'#ef4444', display:'block', flexShrink:0, boxShadow:'0 2px 8px rgba(239,68,68,0.5)' }} />
                  <span style={{ fontSize:14, fontWeight:800, color:'#dc2626' }}>{isAR?'🚫 محجوز':'🚫 Booked'}</span>
                </div>
              </div>

              {/* ===== BOOKING STEPS — REDESIGNED ===== */}
              <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', border:'1px solid #E8E5DF', boxShadow:'0 4px 24px rgba(0,0,0,0.06)' }}>
                <div style={{ background:'#0F0F0F', padding:'20px 24px' }}>
                  <h3 style={{ fontSize:17, fontWeight:900, color:'#fff', fontFamily:"'Tajawal',sans-serif", margin:0 }}>
                    {isAR?'كيف تحجز؟ ٤ خطوات بسيطة':'How to Book? 4 Simple Steps'}
                  </h3>
                </div>
                {[
                  { num:'1', icon:'📅', title: isAR?'اختر الفترة':'Choose Dates', desc: isAR?'تحقق من التقويم واختر تواريخ إقامتك من النموذج':'Check the calendar and select your stay dates from the form', color:'#F97316' },
                  { num:'2', icon:'📲', title: isAR?'تواصل عبر واتساب':'Contact via WhatsApp', desc: isAR?'أرسل طلبك وسيتم إرسال تفاصيل الحجز تلقائياً':'Send your request — booking details will be sent automatically', color:'#25D366' },
                  { num:'3', icon:'💸', title: isAR?'ادفع عبر InstaPay':'Pay via InstaPay', desc: isAR?'أرسل المبلغ على رقم 01159710758 وأرسل لقطة الشاشة':'Send amount to 01159710758 then send payment screenshot', color:'#3b82f6' },
                  { num:'4', icon:'✅', title: isAR?'يُؤكَّد حجزك فوراً':'Booking Confirmed Instantly', desc: isAR?'بعد التحقق من الدفع يُثبَّت اسمك في التقويم':'After payment verification your name is locked in the calendar', color:'#8b5cf6' },
                ].map((step, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'stretch', borderBottom: i < 3 ? '1px solid #E8E5DF' : 'none' }}>
                    {/* Color bar */}
                    <div style={{ width:6, background:step.color, flexShrink:0 }} />
                    {/* Number circle */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:64, flexShrink:0, background:'#FAFAF8', borderLeft:'1px solid #E8E5DF', borderRight:'1px solid #E8E5DF' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:step.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#fff', fontFamily:"'Tajawal',sans-serif" }}>{step.num}</div>
                    </div>
                    {/* Content */}
                    <div style={{ padding:'20px 20px', flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <span style={{ fontSize:20 }}>{step.icon}</span>
                        <span style={{ fontSize:16, fontWeight:900, color:'#0F0F0F', fontFamily:"'Tajawal',sans-serif" }}>{step.title}</span>
                      </div>
                      <p style={{ fontSize:13, color:'#6A6A6A', lineHeight:1.7, margin:0 }}>{step.desc}</p>
                    </div>
                    {/* Arrow connector (not on last) */}
                    {i < 3 && (
                      <div style={{ display:'flex', alignItems:'center', paddingLeft:12, paddingRight:12, color:'#E8E5DF', fontSize:20, flexShrink:0 }}>›</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: form */}
            <div style={{ background:'#fff', border:'1px solid #E8E5DF', borderRadius:16, padding:'36px 28px', boxShadow:'0 4px 24px rgba(0,0,0,0.06)', position:'sticky', top:90 }}>
              <h3 style={{ fontSize:22, fontWeight:900, color:'#0F0F0F', marginBottom:28, fontFamily:"'Tajawal',sans-serif" }}>
                {isAR?'احسب تكلفة إقامتك':'Calculate Your Stay Cost'}
              </h3>
              {submitted ? (
                <div style={{ textAlign:'center', padding:'40px 20px' }}>
                  <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
                  <h4 style={{ fontSize:20, fontWeight:900, color:'#0F0F0F', marginBottom:8, fontFamily:"'Tajawal',sans-serif" }}>{isAR?'تم إرسال طلبك!':'Request Sent!'}</h4>
                  <p style={{ fontSize:14, color:'#6A6A6A', lineHeight:1.8, marginBottom:20 }}>{isAR?'انتقل الآن لواتساب وأرسل لقطة شاشة الدفع لتأكيد حجزك.':'Now go to WhatsApp and send your payment screenshot to confirm.'}</p>
                  <a href={buildWALink()} target="_blank" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#25D366', color:'#fff', padding:'14px 28px', borderRadius:8, fontWeight:800, textDecoration:'none', fontSize:15 }}>
                    <WAIcon />{isAR?'فتح واتساب':'Open WhatsApp'}
                  </a>
                </div>
              ) : (
                <>
                  <FormField label={isAR?'تاريخ الوصول':'Check-in Date'}>
                    <input type="date" value={checkIn} onChange={e=>setCheckIn(e.target.value)} style={inputStyle} onFocus={e=>(e.target.style.borderColor='#F97316')} onBlur={e=>(e.target.style.borderColor='#E8E5DF')} />
                  </FormField>
                  <FormField label={isAR?'تاريخ المغادرة':'Check-out Date'}>
                    <input type="date" value={checkOut} onChange={e=>setCheckOut(e.target.value)} style={inputStyle} onFocus={e=>(e.target.style.borderColor='#F97316')} onBlur={e=>(e.target.style.borderColor='#E8E5DF')} />
                  </FormField>
                  {priceCalc && (
                    <div style={{ background:'#FFF7ED', borderRadius:12, padding:20, marginBottom:20, border:'1px solid rgba(249,115,22,0.2)' }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#F97316', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>{isAR?'ملخص التكلفة':'COST SUMMARY'}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#1A1A1A', marginBottom:8 }}><span>{isAR?'الليالي':'Nights'}</span><span style={{ fontWeight:700 }}>{priceCalc.nights}</span></div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#1A1A1A', marginBottom:8 }}><span>{isAR?'أيام الأسبوع':'Weekdays'}</span><span>{priceCalc.weekdays} × {weekdayPrice.toLocaleString()}</span></div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#1A1A1A', marginBottom:8 }}><span>{isAR?'نهاية الأسبوع':'Weekend'}</span><span>{priceCalc.weekend} × {weekendPrice.toLocaleString()}</span></div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:20, fontWeight:900, color:'#F97316', borderTop:'1px solid rgba(249,115,22,0.2)', paddingTop:12, marginTop:4 }}>
                        <span>{isAR?'الإجمالي':'Total'}</span>
                        <span>{priceCalc.total.toLocaleString()} {isAR?'جنيه':'EGP'}</span>
                      </div>
                    </div>
                  )}
                  <FormField label={isAR?'الاسم الكامل':'Full Name'}>
                    <input type="text" value={renterName} onChange={e=>setRenterName(e.target.value)} style={inputStyle} onFocus={e=>(e.target.style.borderColor='#F97316')} onBlur={e=>(e.target.style.borderColor='#E8E5DF')} />
                  </FormField>
                  <FormField label={isAR?'رقم الهاتف / واتساب':'Phone / WhatsApp'}>
                    <input type="tel" value={renterPhone} onChange={e=>setRenterPhone(e.target.value)} placeholder="01XXXXXXXXX" style={inputStyle} onFocus={e=>(e.target.style.borderColor='#F97316')} onBlur={e=>(e.target.style.borderColor='#E8E5DF')} />
                  </FormField>

                  {/* InstaPay reminder */}
                  <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'12px 16px', marginBottom:16, display:'flex', gap:10, alignItems:'flex-start' }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>💡</span>
                    <p style={{ fontSize:13, color:'#166534', lineHeight:1.7, margin:0 }}>
                      {isAR
                        ? 'بعد الإرسال ستنتقل لواتساب — أرسل مبلغ الحجز على InstaPay رقم 01159710758 ثم أرسل لقطة شاشة لتأكيد حجزك.'
                        : 'After sending you\'ll go to WhatsApp — pay via InstaPay to 01159710758 then send a screenshot to confirm your booking.'}
                    </p>
                  </div>

                  <button onClick={submitBooking} disabled={submitting} style={{
                    width:'100%', background:'#25D366', color:'#fff', padding:'16px', border:'none', borderRadius:8,
                    fontSize:16, fontWeight:800, cursor:'pointer', fontFamily:"'Cairo',sans-serif",
                    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    opacity: submitting ? 0.7 : 1,
                    boxShadow:'0 4px 20px rgba(37,211,102,0.4)',
                    transition:'all 0.3s',
                  }}>
                    <WAIcon />{submitting ? (isAR?'جاري الإرسال...':'Sending...') : (isAR?'أرسل طلب الحجز عبر واتساب':'Send Booking Request via WhatsApp')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== PAYMENT ===== */}
      <section id="payment" style={{ position:'relative', height:420, overflow:'hidden' }}>
        <img src="https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1400&q=80" alt="payment" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, background: isAR ? 'linear-gradient(to left,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.5) 55%,rgba(0,0,0,0.15) 100%)' : 'linear-gradient(to right,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.5) 55%,rgba(0,0,0,0.15) 100%)' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center' }}>
          <div className="container">
            <div style={{ maxWidth:540 }}>
              <SectionTag label={isAR?'الدفع':'PAYMENT'} dark />
              <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:900, color:'#fff', marginBottom:16, fontFamily:"'Tajawal',sans-serif" }}>
                {isAR?'الدفع الآمن عبر InstaPay':'Secure Payment via InstaPay'}
              </h2>
              <p style={{ fontSize:15, color:'rgba(255,255,255,0.8)', lineHeight:1.9, marginBottom:28 }}>
                {isAR?'أرسل المبلغ الكامل على الرقم أدناه، ثم أرسل لقطة شاشة لتأكيد الدفع عبر واتساب.':'Transfer the full amount to the number below, then send a payment screenshot via WhatsApp.'}
              </p>
              <div style={{ display:'inline-flex', alignItems:'center', gap:12, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, padding:'16px 24px' }}>
                <span style={{ fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:700, letterSpacing:2, textTransform:'uppercase' }}>{isAR?'رقم InstaPay':'INSTAPAY NUMBER'}</span>
                <span style={{ fontSize:'clamp(20px,3vw,28px)', fontWeight:900, color:'#fff', fontFamily:"'Tajawal',sans-serif", letterSpacing:1 }}>01159710758</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOCATION — REDESIGNED MAGAZINE ===== */}
      <section id="location" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#FFFFFF' }}>
        <div className="container">
          <div style={{ textAlign:'center', maxWidth:600, margin:'0 auto 64px' }}>
            <SectionTag label={isAR?'الموقع':'LOCATION'} center />
            <h2 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:900, color:'#0F0F0F', fontFamily:"'Tajawal',sans-serif" }}>
              {isAR?'في قلب الساحل الشمالي':'In the Heart of the North Coast'}
            </h2>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'clamp(32px,6vw,64px)', alignItems:'start', marginBottom:64 }}>
            {/* Location features — magazine style */}
            {[
              { num:'01', icon:'📍', title: isAR?'الساحل الشمالي، مصر':'Sahel, North Coast, Egypt', desc: isAR?'الصف الثاني على البحر مباشرةً — فتحة مفتوحة أمام الشاليه تمنحك إطلالة بحرية واسعة وواضحة بدون أي عائق.':'Second row directly on shore — an open gap in front ensures a wide, completely unobstructed sea view.', color:'#F97316', bg:'#FFF7ED' },
              { num:'02', icon:'🏊', title: isAR?'حمام سباحة مشترك':'Shared Swimming Pool', desc: isAR?'حمام سباحة مشترك في القرية على بُعد دقيقة واحدة فقط بالسيارة أو ٥ دقائق سيراً على الأقدام.':'Shared pool in the village, just 1 minute by car or 5 minutes walking distance.', color:'#0ea5e9', bg:'#f0f9ff' },
              { num:'03', icon:'📶', title: isAR?'خدمة واي فاي':'WiFi Service', desc: isAR?'خدمة الإنترنت متاحة في الدور العلوي للتواصل مع العالم الخارجي أثناء إقامتك.':'Internet service available on the upper floor to stay connected during your stay.', color:'#8b5cf6', bg:'#f5f3ff' },
            ].map((item, i) => (
              <div key={i} style={{ position:'relative' }}>
                {/* Number tag */}
                <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
                  <div style={{ width:52, height:52, borderRadius:12, background:item.bg, border:`1px solid ${item.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    {item.icon}
                  </div>
                  <div style={{ width:2, height:40, background:`linear-gradient(to bottom, ${item.color}, transparent)` }} />
                  <span style={{ fontSize:11, fontWeight:800, color:item.color, letterSpacing:3, textTransform:'uppercase' }}>{item.num}</span>
                </div>
                <h3 style={{ fontSize:20, fontWeight:900, color:'#0F0F0F', marginBottom:10, fontFamily:"'Tajawal',sans-serif" }}>{item.title}</h3>
                <p style={{ fontSize:15, color:'#6A6A6A', lineHeight:1.9, paddingRight: isAR ? 68 : 0, paddingLeft: !isAR ? 68 : 0 }}>{item.desc}</p>
                {i < 2 && <div style={{ position:'absolute', bottom:-32, right: isAR ? 26 : 'auto', left: !isAR ? 26 : 'auto', fontSize:24, color:'#E8E5DF' }}>↓</div>}
              </div>
            ))}
          </div>

          {/* Map */}
          <div style={{ borderRadius:16, overflow:'hidden', height:420, boxShadow:'0 8px 40px rgba(0,0,0,0.1)', border:'1px solid #E8E5DF' }}>
            <iframe
              src="https://maps.google.com/maps?q=31.1837,29.9553&output=embed&z=15"
              width="100%" height="100%" style={{ border:'none' }} loading="lazy"
            />
          </div>
          <div style={{ textAlign:'center', marginTop:20 }}>
            <a href="https://maps.app.goo.gl/ct4KxCzPYHbvb6UN7" target="_blank" style={{ display:'inline-flex', alignItems:'center', gap:8, color:'#F97316', fontWeight:700, fontSize:15, textDecoration:'none', borderBottom:'2px solid #F97316', paddingBottom:4 }}>
              📍 {isAR?'افتح الموقع في خرائط جوجل':'Open in Google Maps'}
            </a>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#FAFAF8' }}>
        <div className="container">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'clamp(32px,6vw,80px)' }}>
            <div style={{ position:'sticky', top:120 }}>
              <SectionTag label={isAR?'الأسئلة الشائعة':'FAQ'} />
              <h2 style={{ fontSize:'clamp(28px,3vw,44px)', fontWeight:900, color:'#0F0F0F', marginBottom:16, fontFamily:"'Tajawal',sans-serif" }}>
                {isAR?'أجوبة على أكثر الأسئلة شيوعاً':'Answers to Common Questions'}
              </h2>
              <p style={{ fontSize:15, color:'#6A6A6A', lineHeight:1.9 }}>
                {isAR?'لم تجد إجابتك؟ تواصل معنا مباشرةً عبر واتساب.':'Didn\'t find your answer? Contact us via WhatsApp.'}
              </p>
            </div>
            <div>
              {[
                [isAR?'هل يمكنني الحجز بدون دفع مقدم؟':'Can I book without upfront payment?', isAR?'لا — الحجز يُؤكَّد فقط بعد إتمام الدفع الكامل عبر InstaPay وإرسال لقطة الشاشة للمالك.':'No — bookings are confirmed only after full payment via InstaPay and sending the screenshot to the owner.'],
                [isAR?'ما الحد الأقصى لعدد الضيوف؟':'What is the max number of guests?', isAR?'الشاليه يستوعب ما يصل إلى ١٠ أشخاص على ٥ غرف نوم في دورين.':'The chalet comfortably accommodates up to 10 guests across 5 bedrooms on 2 floors.'],
                [isAR?'هل يوجد حمام سباحة خاص؟':'Is there a private pool?', isAR?'لا يوجد حمام سباحة خاص، لكن يوجد مشترك في القرية على بُعد دقيقة بالسيارة.':'No private pool, but a shared pool in the village is just 1 minute by car.'],
                [isAR?'ما موسم الإيجار؟':'What is the rental season?', isAR?'الموسم الرئيسي من يونيو حتى سبتمبر.':'The main season runs from June to September.'],
                [isAR?'هل الواي فاي متاح في كل الشاليه؟':'Is WiFi available throughout?', isAR?'الواي فاي متاح حالياً في الدور العلوي.':'WiFi is currently available on the upper floor.'],
                [isAR?'ما سياسة الإلغاء؟':'What is the cancellation policy?', isAR?'يُرجى التواصل مع المالك مباشرةً عبر واتساب للاستفسار عن شروط الإلغاء.':'Please contact the owner via WhatsApp for cancellation terms.'],
              ].map(([q, a], i) => (
                <FAQItem key={i} num={String(i+1).padStart(2,'0')} question={q} answer={a} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer style={{ background:'#0F0F0F', padding:'clamp(48px,8vw,80px) 0 0' }}>
        <div className="container">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:40, paddingBottom:48, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <h3 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:22, fontWeight:900, color:'#fff', marginBottom:12 }}>
                {isAR?'الجنزوري':'Elganzoury'}<span style={{ color:'#F97316' }}>.</span>
              </h3>
              <p style={{ fontSize:14, color:'rgba(255,255,255,0.5)', lineHeight:1.8 }}>
                {isAR?'شاليه فاخر على خط البحر في الساحل الشمالي.':'Premium beachfront chalet on Egypt\'s North Coast.'}
              </p>
            </div>
            <div>
              <h4 style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:2, textTransform:'uppercase', marginBottom:16 }}>{isAR?'روابط سريعة':'Quick Links'}</h4>
              {[['#about',isAR?'عن الشاليه':'About'],['#floors',isAR?'الطوابق':'Floors'],['#pricing',isAR?'الأسعار':'Pricing'],['#gallery',isAR?'الصور':'Gallery'],['#booking',isAR?'الحجز':'Booking']].map(([href,label])=>(
                <a key={href} href={href} style={{ display:'block', fontSize:14, color:'rgba(255,255,255,0.7)', textDecoration:'none', marginBottom:10 }}
                  onMouseEnter={e=>(e.currentTarget.style.color='#F97316')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,0.7)')}>{label}</a>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:2, textTransform:'uppercase', marginBottom:16 }}>{isAR?'تواصل معنا':'Contact'}</h4>
              <a href="https://wa.me/201159710758" target="_blank" style={{ display:'block', fontSize:14, color:'rgba(255,255,255,0.7)', textDecoration:'none', marginBottom:10 }}>WhatsApp: 01159710758</a>
              <span style={{ display:'block', fontSize:14, color:'rgba(255,255,255,0.7)', marginBottom:10 }}>InstaPay: 01159710758</span>
            </div>
          </div>
          <div style={{ padding:'20px 0', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>© 2025 {isAR?'شاليه الجنزوري':'Elganzoury Chalet'}</p>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>{isAR?'تطوير:':'Built by:'} <a href="#" style={{ color:'#F97316', textDecoration:'none' }}>Abdelrahman Elganzoury</a></p>
          </div>
        </div>
      </footer>

      {/* ===== FLOATING BUTTONS ===== */}
      <a href="https://wa.me/201159710758" target="_blank" style={{
        position:'fixed', bottom:28, right:28, zIndex:999, width:58, height:58,
        background:'#25D366', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 24px rgba(37,211,102,0.5)', textDecoration:'none',
      }}>
        <WAIcon size={28} color="#fff" />
      </a>
      <a href="#booking" style={{
        position:'fixed', bottom:28, left:28, zIndex:999, background:'#F97316', color:'#fff',
        padding:'14px 22px', borderRadius:50, fontSize:13, fontWeight:800, textDecoration:'none',
        boxShadow:'0 4px 24px rgba(249,115,22,0.5)', display:'flex', alignItems:'center', gap:8,
      }}>
        {isAR?'احجز الآن':'Book Now'}
      </a>
    </div>
  )
}

// ===== HELPER COMPONENTS =====

function SectionTag({ label, dark, center }: { label: string; dark?: boolean; center?: boolean }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, justifyContent: center ? 'center' : 'flex-start' }}>
      <div style={{ width:36, height:2, background:'#F97316', flexShrink:0 }} />
      <span style={{ color: dark ? 'rgba(255,255,255,0.7)' : '#F97316', fontSize:11, fontWeight:700, letterSpacing:'3px', textTransform:'uppercase' }}>{label}</span>
    </div>
  )
}

function MagazineFloor({ isAR, number, tag, title, subtitle, desc, features, image, placeholder, color }: {
  isAR: boolean; number: string; tag: string; title: string; subtitle: string; desc: string;
  features: { icon: string; title: string; desc: string }[]; image?: string; placeholder: string; color: string
}) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:48, alignItems:'center' }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:28 }}>
          <div style={{ fontFamily:"'Tajawal',sans-serif", fontSize:64, fontWeight:900, color:'#F97316', opacity:0.15, lineHeight:1 }}>{number}</div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#F97316', letterSpacing:3, textTransform:'uppercase', marginBottom:4 }}>{tag}</div>
            <h3 style={{ fontSize:'clamp(24px,3vw,36px)', fontWeight:900, color:'#0F0F0F', fontFamily:"'Tajawal',sans-serif", lineHeight:1.1 }}>{title}</h3>
            <div style={{ fontSize:15, color:'#8A8A8A', fontWeight:600, marginTop:4 }}>{subtitle}</div>
          </div>
        </div>
        <p style={{ fontSize:16, color:'#6A6A6A', lineHeight:1.9, marginBottom:32, borderRight: isAR ? '3px solid #F97316' : 'none', borderLeft: !isAR ? '3px solid #F97316' : 'none', paddingRight: isAR ? 20 : 0, paddingLeft: !isAR ? 20 : 0 }}>{desc}</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
          {features.map((f, i) => (
            <div key={i} style={{ background:color, borderRadius:10, padding:'16px 18px', display:'flex', gap:12, alignItems:'flex-start' }}>
              <span style={{ fontSize:22, flexShrink:0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:'#0F0F0F', marginBottom:3 }}>{f.title}</div>
                <div style={{ fontSize:13, color:'#6A6A6A', lineHeight:1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderRadius:16, overflow:'hidden', minHeight:400, background:'linear-gradient(135deg,#f0ece6,#e8e2d8)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
        {image ? (
          <img src={image} alt={title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ textAlign:'center', padding:40 }}>
            <div style={{ fontSize:48, marginBottom:12, opacity:0.3 }}>📷</div>
            <span style={{ fontSize:14, color:'#8A8A8A', fontWeight:600 }}>{placeholder}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function FAQItem({ num, question, answer }: { num: string; question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom:'1px solid #E8E5DF' }}>
      <div onClick={()=>setOpen(!open)} style={{ display:'flex', alignItems:'center', gap:20, padding:'28px 0', cursor:'pointer' }}>
        <span style={{ color:'#F97316', opacity:0.5, fontSize:13, fontWeight:700, flexShrink:0 }}>{num}</span>
        <span style={{ flex:1, fontSize:17, fontWeight:800, color:'#0F0F0F' }}>{question}</span>
        <span style={{ color:'#F97316', fontSize:22, transform: open ? 'rotate(45deg)' : 'none', transition:'transform 0.3s', flexShrink:0 }}>+</span>
      </div>
      {open && (
        <div style={{ paddingBottom:28, paddingRight:54 }}>
          <p style={{ color:'#4A4A4A', fontSize:15, lineHeight:1.9, borderRight:'2px solid #F97316', paddingRight:20 }}>{answer}</p>
        </div>
      )}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:20 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#8A8A8A', marginBottom:8, letterSpacing:'1px', textTransform:'uppercase' }}>{label}</label>
      {children}
    </div>
  )
}

function WAIcon({ size=22, color='#fff' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'13px 16px', border:'1.5px solid #E8E5DF', borderRadius:6,
  fontSize:15, fontFamily:"'Cairo',sans-serif", color:'#1A1A1A', background:'#fff',
  outline:'none', transition:'border 0.2s',
}
