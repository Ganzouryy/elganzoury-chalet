'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface Pricing { id: string; label_ar: string; label_en: string; price: number; period_type: string }
interface Media { id: string; url: string; caption_ar: string; caption_en: string; section: string; sort_order: number; media_type: string }
interface Content { key: string; value_ar: string; value_en: string }
interface Booking { check_in: string; check_out: string; floor: string }

interface Props { pricing: Pricing[]; media: Media[]; content: Content[] }

export default function ChaletWebsite({ pricing: ip, media: im, content: ic }: Props) {
  const [isAR, setIsAR] = useState(true)
  const [navScrolled, setNavScrolled] = useState(false)
  const [activeFloor, setActiveFloor] = useState('ground')
  const [heroImg, setHeroImg] = useState(0)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [selectedFloor, setSelectedFloor] = useState<'upper'|'ground'|'full'>('upper')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [renterName, setRenterName] = useState('')
  const [renterPhone, setRenterPhone] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pricing, setPricing] = useState<Pricing[]>(ip)
  const [media, setMedia] = useState<Media[]>(im)
  const [content, setContent] = useState<Content[]>(ic)
  const [lightbox, setLightbox] = useState<{images:string[], index:number}|null>(null)

  useEffect(() => {
    const fetch = async () => {
      const [p, m, c, b] = await Promise.all([
        supabase.from('pricing').select('*'),
        supabase.from('media').select('*').order('sort_order'),
        supabase.from('site_content').select('*'),
        supabase.from('bookings').select('check_in,check_out,floor').eq('status','confirmed'),
      ])
      if (p.data) setPricing(p.data)
      if (m.data) setMedia(m.data)
      if (c.data) setContent(c.data)
      if (b.data) setBookings(b.data)
    }
    fetch()
  }, [])

  useEffect(() => {
    const h = () => setNavScrolled(window.scrollY > 60)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const heroImages = media.filter(m => m.section === 'hero')
  useEffect(() => {
    if (heroImages.length <= 1) return
    const t = setInterval(() => setHeroImg(i => (i + 1) % heroImages.length), 5000)
    return () => clearInterval(t)
  }, [heroImages.length])

  const t = useCallback((key: string, ar: string, en: string) => {
    const item = content.find(c => c.key === key)
    if (!item) return isAR ? ar : en
    return isAR ? (item.value_ar || ar) : (item.value_en || en)
  }, [content, isAR])

  const floorImages: Record<string, Media[]> = {
    ground: media.filter(m => m.section === 'floor_ground'),
    upper: media.filter(m => m.section === 'floor_upper'),
    roof: media.filter(m => m.section === 'roof'),
  }
  const galleryImages = media.filter(m => m.section === 'gallery')

  // Pricing helpers
  const getPrice = (floor: 'upper'|'ground', type: 'weekday'|'weekend') => {
    const key = `${floor}_${type}`
    return pricing.find(p => p.period_type === key)?.price ||
      (floor === 'upper' ? (type === 'weekday' ? 2000 : 2450) : (type === 'weekday' ? 1750 : 2000))
  }

  // Check if a date is booked for a specific floor
  const isDateBooked = (date: Date, floor: 'upper'|'ground'|'full') => {
    return bookings.some(b => {
      const start = new Date(b.check_in), end = new Date(b.check_out)
      const dateInRange = date >= start && date < end
      if (!dateInRange) return false
      if (floor === 'full') return true // any booking blocks full chalet
      return b.floor === floor || b.floor === 'full'
    })
  }

  // Check if full chalet is available (both floors must be free)
  const isFullChaletBooked = (date: Date) => {
    return bookings.some(b => {
      const start = new Date(b.check_in), end = new Date(b.check_out)
      return date >= start && date < end
    })
  }

  // Price calculator
  const calcPrice = (floor: 'upper'|'ground'|'full') => {
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
    let total = 0
    if (floor === 'full') {
      total = weekdays * (getPrice('upper','weekday') + getPrice('ground','weekday')) +
              weekend * (getPrice('upper','weekend') + getPrice('ground','weekend'))
    } else {
      total = weekdays * getPrice(floor,'weekday') + weekend * getPrice(floor,'weekend')
    }
    return { weekdays, weekend, nights: weekdays + weekend, total }
  }

  const priceCalc = calcPrice(selectedFloor)

  // Check if selected period has conflicts
  const hasPeriodConflict = () => {
    if (!checkIn || !checkOut) return false
    const start = new Date(checkIn), end = new Date(checkOut)
    const cur = new Date(start)
    while (cur < end) {
      if (selectedFloor === 'full' ? isFullChaletBooked(cur) : isDateBooked(cur, selectedFloor)) return true
      cur.setDate(cur.getDate() + 1)
    }
    return false
  }

  const buildWALink = () => {
    const floorLabel = selectedFloor === 'upper' ? (isAR?'الدور العلوي':'Upper Floor') :
      selectedFloor === 'ground' ? (isAR?'الدور الأرضي':'Ground Floor') : (isAR?'الشاليه كامل':'Full Chalet')
    let msg = isAR ? `مرحباً، أود حجز شاليه الجنزوري.\n\n` : `Hello, I'd like to book Elganzoury Chalet.\n\n`
    msg += (isAR?'🏠 الوحدة: ':'🏠 Unit: ') + floorLabel + '\n'
    if (renterName) msg += (isAR?'👤 الاسم: ':'👤 Name: ') + renterName + '\n'
    if (renterPhone) msg += (isAR?'📞 الهاتف: ':'📞 Phone: ') + renterPhone + '\n'
    if (checkIn) msg += (isAR?'📅 الوصول: ':'📅 Check-in: ') + checkIn + '\n'
    if (checkOut) msg += (isAR?'📅 المغادرة: ':'📅 Check-out: ') + checkOut + '\n'
    if (priceCalc) {
      msg += (isAR?'🌙 الليالي: ':'🌙 Nights: ') + priceCalc.nights + '\n'
      msg += (isAR?'💰 الإجمالي: ':'💰 Total: ') + priceCalc.total.toLocaleString() + (isAR?' جنيه':' EGP') + '\n'
    }
    msg += isAR ? `\n✅ سأرسل لقطة شاشة الدفع عبر InstaPay.` : `\n✅ I will send InstaPay payment screenshot.`
    return 'https://wa.me/201159710758?text=' + encodeURIComponent(msg)
  }

  const submitBooking = async () => {
    if (!renterName || !renterPhone || !checkIn || !checkOut) {
      alert(isAR ? 'يرجى ملء جميع الحقول' : 'Please fill all fields')
      return
    }
    if (hasPeriodConflict()) {
      alert(isAR ? 'هذه الفترة محجوزة بالفعل. يرجى اختيار فترة أخرى.' : 'This period is already booked. Please choose different dates.')
      return
    }
    setSubmitting(true)
    await supabase.from('bookings').insert({
      renter_name: renterName, renter_phone: renterPhone,
      check_in: checkIn, check_out: checkOut,
      nights: priceCalc?.nights, total_price: priceCalc?.total,
      status: 'pending', floor: selectedFloor,
    })
    setSubmitting(false)
    setSubmitted(true)
    window.open(buildWALink(), '_blank')
  }

  // Calendar
  const monthNamesAR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const monthNamesEN = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const dayNamesAR = ['أحد','إثن','ثلا','أرب','خمي','جمع','سبت']
  const dayNamesEN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const renderCalendar = (floorKey: 'upper'|'ground'|'full') => {
    const first = new Date(calYear, calMonth, 1).getDay()
    const total = new Date(calYear, calMonth + 1, 0).getDate()
    const today = new Date()
    const cells = []
    for (let i = 0; i < first; i++) cells.push(<div key={`e${i}`} />)
    for (let d = 1; d <= total; d++) {
      const date = new Date(calYear, calMonth, d)
      const booked = floorKey === 'full' ? isFullChaletBooked(date) : isDateBooked(date, floorKey)
      const isToday = date.toDateString() === today.toDateString()
      cells.push(
        <div key={d} style={{
          aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
          borderRadius:8, fontSize:12, fontWeight:700,
          background: booked ? '#ef4444' : '#22c55e',
          color:'#fff',
          outline: isToday ? '3px solid #F97316' : 'none',
          outlineOffset:2,
          boxShadow: booked ? '0 2px 6px rgba(239,68,68,0.35)' : '0 2px 6px rgba(34,197,94,0.25)',
          cursor: booked ? 'not-allowed' : 'default',
          transition:'transform 0.15s',
        }}
          onMouseEnter={e=>{ if (!booked)(e.currentTarget as HTMLElement).style.transform='scale(1.12)' }}
          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.transform='scale(1)' }}
        >{d}</div>
      )
    }
    return cells
  }

  const defaultHeroBg = [
    'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1600&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&q=80',
  ]
  const currentHeroBg = heroImages.length > 0 ? heroImages[heroImg]?.url : defaultHeroBg[heroImg % 3]

  const floorOptions = [
    { key:'upper' as const, labelAr:'الدور العلوي', labelEn:'Upper Floor', color:'#F97316', desc: isAR?'٣ غرف نوم + بلكونة + واي فاي':'3 bedrooms + balcony + WiFi' },
    { key:'ground' as const, labelAr:'الدور الأرضي', labelEn:'Ground Floor', color:'#0ea5e9', desc: isAR?'غرفتان + مطبخ':'2 bedrooms + kitchen' },
    { key:'full' as const, labelAr:'الشاليه كامل', labelEn:'Full Chalet', color:'#8b5cf6', desc: isAR?'كلا الدورين معاً (٥ غرف نوم)':'Both floors together (5 bedrooms)' },
  ]

  return (
    <div style={{ direction: isAR?'rtl':'ltr', fontFamily:"'Cairo',sans-serif" }}>

      {/* NAV */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:1000, background: navScrolled?'rgba(255,255,255,0.97)':'transparent', backdropFilter: navScrolled?'blur(12px)':'none', boxShadow: navScrolled?'0 2px 30px rgba(0,0,0,0.08)':'none', transition:'all 0.4s' }}>
        <div className="container" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', height:72 }}>
          <a href="#hero" style={{ fontFamily:"'Tajawal',sans-serif", fontSize:22, fontWeight:900, color: navScrolled?'#0F0F0F':'#fff', textDecoration:'none' }}>
            {isAR?'الجنزوري':'Elganzoury'}<span style={{ color:'#F97316' }}>.</span>
          </a>
          <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
            {[['#about',isAR?'الشاليه':'About'],['#floors',isAR?'الطوابق':'Floors'],['#pricing',isAR?'الأسعار':'Pricing'],['#booking',isAR?'الحجز':'Booking'],['#faq',isAR?'أسئلة':'FAQ']].map(([href,label])=>(
              <a key={href} href={href} style={{ color: navScrolled?'#1A1A1A':'rgba(255,255,255,0.9)', textDecoration:'none', fontSize:14, fontWeight:600 }}
                onMouseEnter={e=>e.currentTarget.style.color='#F97316'}
                onMouseLeave={e=>e.currentTarget.style.color=navScrolled?'#1A1A1A':'rgba(255,255,255,0.9)'}>
                {label}
              </a>
            ))}
            <button onClick={()=>setIsAR(!isAR)} style={{ background: navScrolled?'#FFF7ED':'rgba(255,255,255,0.15)', border:`1px solid ${navScrolled?'#F97316':'rgba(255,255,255,0.35)'}`, color: navScrolled?'#F97316':'#fff', padding:'7px 18px', borderRadius:4, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>
              {isAR?'English':'عربي'}
            </button>
            <a href="#booking" style={{ background:'#F97316', color:'#fff', padding:'10px 24px', borderRadius:4, fontSize:14, fontWeight:800, textDecoration:'none', boxShadow:'0 4px 20px rgba(249,115,22,0.4)' }}>
              {isAR?'احجز الآن':'Book Now'}
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" style={{ position:'relative', height:'100vh', minHeight:600, overflow:'hidden', display:'flex', alignItems:'center' }}>
        <img src={currentHeroBg} alt="hero" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0 }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(100deg,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0.48) 55%,rgba(0,0,0,0.18) 100%)', zIndex:1 }} />
        <div className="container" style={{ position:'relative', zIndex:2, width:'100%' }}>
          <div style={{ maxWidth:700 }}>
            <SecTag label={isAR?'الساحل الشمالي — مصر':'NORTH COAST — EGYPT'} dark />
            <h1 style={{ fontSize:'clamp(44px,7vw,88px)', fontWeight:900, color:'#fff', lineHeight:1.05, marginBottom:20, fontFamily:"'Tajawal',sans-serif" }}>
              {isAR?<>شاليه <span style={{color:'#F97316'}}>الجنزوري</span><br/>إطلالة البحر مباشرةً</>:<><span style={{color:'#F97316'}}>Elganzoury</span><br/>Chalet — Sea View</>}
            </h1>
            <p style={{ fontSize:'clamp(16px,2vw,19px)', color:'rgba(255,255,255,0.82)', lineHeight:1.9, marginBottom:36, maxWidth:520 }}>
              {t('hero_subtitle','شاليه فاخر على خط البحر، بإطلالة ١٨٠ درجة من السطح في قلب الساحل الشمالي.','Premium chalet with direct sea view and 180° rooftop panorama on Egypt\'s North Coast.')}
            </p>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              <a href="#booking" style={{ background:'#F97316', color:'#fff', padding:'15px 36px', borderRadius:4, fontWeight:800, fontSize:15, textDecoration:'none', boxShadow:'0 4px 20px rgba(249,115,22,0.45)' }}>{isAR?'احجز الآن':'Book Now'}</a>
              <a href="#floors" style={{ background:'rgba(255,255,255,0.15)', color:'#fff', padding:'15px 36px', borderRadius:4, fontWeight:700, fontSize:15, border:'1px solid rgba(255,255,255,0.35)', textDecoration:'none' }}>{isAR?'تفاصيل الشاليه':'Explore Chalet'}</a>
            </div>
          </div>
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.15)', marginTop:60, paddingTop:28, display:'grid', gridTemplateColumns:'repeat(4,1fr)' }}>
            {[['5',isAR?'غرف نوم':'Bedrooms'],['4',isAR?'حمامات':'Bathrooms'],['180°',isAR?'إطلالة بحرية':'Sea View'],['3',isAR?'طوابق':'Floors']].map(([n,l])=>(
              <div key={l} style={{ textAlign:'center', padding:'0 12px' }}>
                <div style={{ fontFamily:"'Tajawal',sans-serif", fontSize:'clamp(28px,4vw,44px)', fontWeight:900, color:'#F97316' }}>{n}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', fontWeight:600, marginTop:4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ background:'#FAFAF8' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', minHeight:560 }}>
          <div style={{ padding:'clamp(48px,8vw,100px) clamp(20px,5vw,64px)', display:'flex', flexDirection:'column', justifyContent:'center' }}>
            <SecTag label={isAR?'عن الشاليه':'ABOUT'} />
            <h2 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:900, color:'#0F0F0F', marginBottom:20, fontFamily:"'Tajawal',sans-serif" }}>
              {t('about_title','راحة لا مثيل لها، وإطلالة لا تُنسى','Unmatched Comfort, Unforgettable View')}
            </h2>
            <p style={{ fontSize:16, color:'#6A6A6A', lineHeight:1.9, marginBottom:16 }}>
              {t('about_text','يقع شاليه الجنزوري في الصف الثاني مباشرةً على خط البحر في الساحل الشمالي، وبفضل الفراغ المفتوح أمامه تُبصر البحر الأبيض المتوسط بوضوح تام.','Elganzoury Chalet sits in the second row on the North Coast shoreline. An open gap in front gives you a completely clear Mediterranean view.')}
            </p>
            <p style={{ fontSize:16, color:'#6A6A6A', lineHeight:1.9 }}>
              {t('about_text2','يضم ٣ طوابق — الدور الأرضي، الدور العلوي، والسطح البانورامي ١٨٠ درجة — مع حمام سباحة مشترك على بُعد دقيقة بالسيارة.','3 floors — ground, upper, and a spectacular 180° panoramic rooftop — with a shared pool just 1 minute by car.')}
            </p>
          </div>
          <div style={{ position:'relative', overflow:'hidden', minHeight:400 }}>
            <img src={media.find(m=>m.section==='about')?.url||'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80'} alt="about" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.3),transparent 60%)' }} />
            <div style={{ position:'absolute', bottom:28, right:28, background:'rgba(255,255,255,0.95)', padding:'14px 20px', borderRadius:8, display:'flex', alignItems:'center', gap:10, boxShadow:'0 8px 30px rgba(0,0,0,0.15)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#F97316"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              <span style={{ fontSize:13, fontWeight:700, color:'#0F0F0F' }}>{isAR?'الساحل الشمالي، مصر':'Sahel, North Coast, Egypt'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div style={{ position:'relative', height:280, overflow:'hidden' }}>
        <img src="https://images.unsplash.com/photo-1468581264429-2548ef9eb732?w=1400&q=80" alt="sea" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:32, textAlign:'center' }}>
            {[['10+',isAR?'ضيوف':'Guests'],['5',isAR?'غرف نوم':'Bedrooms'],['1دق',isAR?'للحمام السباحة':'To Pool'],['180°',isAR?'من السطح':'Rooftop']].map(([n,l])=>(
              <div key={l}>
                <div style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#F97316', fontFamily:"'Tajawal',sans-serif" }}>{n}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', fontWeight:600, marginTop:6 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FLOORS — MAGAZINE REDESIGN */}
      <section id="floors" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#fff' }}>
        <div className="container">
          <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto 56px' }}>
            <SecTag label={isAR?'تفاصيل الطوابق':'FLOOR DETAILS'} center />
            <h2 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:900, color:'#0F0F0F', marginBottom:16, fontFamily:"'Tajawal',sans-serif" }}>
              {t('floors_title','اكتشف كل طابق بتفاصيله','Explore Every Floor')}
            </h2>
            <p style={{ fontSize:16, color:'#6A6A6A', lineHeight:1.9 }}>
              {t('floors_subtitle','يمكنك استئجار الدور الأرضي، الدور العلوي، أو الشاليه بالكامل حسب احتياجك.','You can rent the ground floor, upper floor, or the full chalet depending on your needs.')}
            </p>
          </div>

          {/* Floor tabs */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:52 }}>
            <div style={{ display:'inline-flex', border:'1px solid #E8E5DF', borderRadius:10, overflow:'hidden' }}>
              {[['ground',isAR?'الدور الأرضي':'Ground Floor'],['upper',isAR?'الدور العلوي':'Upper Floor'],['roof',isAR?'السطح':'Rooftop']].map(([id,label],i)=>(
                <button key={id} onClick={()=>setActiveFloor(id)} style={{ padding:'14px 28px', border:'none', borderLeft: i>0?'1px solid #E8E5DF':'none', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:"'Cairo',sans-serif", background: activeFloor===id?'#F97316':'#fff', color: activeFloor===id?'#fff':'#6A6A6A', transition:'all 0.25s' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Floor panels — magazine rows */}
          {activeFloor === 'ground' && (
            <MagazineFloor isAR={isAR} number="01"
              tag={isAR?'الدور الأرضي':'GROUND FLOOR'}
              title={isAR?'الدور الأرضي':'Ground Floor'}
              subtitle={isAR?'المعيشة والراحة الأساسية':'Living & Core Comfort'}
              desc={isAR?'الدور الأرضي مُجهَّز بالكامل، يضم غرفتي نوم واسعتين ومطبخاً وكل ما تحتاجه عائلتك.':'Fully equipped ground floor with two spacious bedrooms, a kitchen, and everything your family needs.'}
              features={[
                { title:isAR?'غرفة نوم ١':'Bedroom 1', desc:isAR?'سريران مريحان':'2 comfortable beds' },
                { title:isAR?'غرفة نوم ٢':'Bedroom 2', desc:isAR?'سريران مريحان':'2 comfortable beds' },
                { title:isAR?'الحمامات':'Bathrooms', desc:isAR?'حمامان كاملان':'2 full bathrooms' },
                { title:isAR?'المطبخ':'Kitchen', desc:isAR?'مجهَّز بالكامل':'Fully equipped' },
                { title:isAR?'التجهيزات':'Amenities', desc:isAR?'دولاب ملابس ومروحة في كل غرفة':'Wardrobe & fan in each room' },
              ]}
              price={`${getPrice('ground','weekday').toLocaleString()} — ${getPrice('ground','weekend').toLocaleString()}`}
              priceLabel={isAR?'جنيه / ليلة (أيام عادية — نهاية أسبوع)':'EGP/night (weekday — weekend)'}
              images={floorImages.ground.map(m=>m.url)}
              placeholder={isAR?'صورة الدور الأرضي — قريباً':'Ground floor photo coming soon'}
              accentColor="#0ea5e9"
              onLightbox={imgs=>setLightbox({images:imgs,index:0})}
            />
          )}
          {activeFloor === 'upper' && (
            <MagazineFloor isAR={isAR} number="02"
              tag={isAR?'الدور العلوي':'UPPER FLOOR'}
              title={isAR?'الدور العلوي':'Upper Floor'}
              subtitle={isAR?'الإطلالة والخصوصية':'Views & Privacy'}
              desc={isAR?'الدور العلوي هو قلب الشاليه — ثلاث غرف نوم وغرفة ماستر وبلكونة بحرية وواي فاي.':'The upper floor is the heart of the chalet — three bedrooms, a master suite, sea-view balcony and WiFi.'}
              features={[
                { title:isAR?'غرفة ماستر':'Master Bedroom', desc:isAR?'سرير كبير + طاولة تسريحة + دولاب':'Large bed + dressing table + wardrobe' },
                { title:isAR?'غرفة نوم ٢':'Bedroom 2', desc:isAR?'سريران + دولاب':'2 beds + wardrobe' },
                { title:isAR?'غرفة نوم ٣':'Bedroom 3', desc:isAR?'سريران + دولاب':'2 beds + wardrobe' },
                { title:isAR?'الحمامات':'Bathrooms', desc:isAR?'حمامان كاملان':'2 full bathrooms' },
                { title:isAR?'البلكونة البحرية':'Sea Balcony', desc:isAR?'إطلالة مباشرة على البحر':'Direct unobstructed sea view' },
                { title:'WiFi', desc:isAR?'إنترنت متاح في هذا الدور':'Available on this floor' },
              ]}
              price={`${getPrice('upper','weekday').toLocaleString()} — ${getPrice('upper','weekend').toLocaleString()}`}
              priceLabel={isAR?'جنيه / ليلة (أيام عادية — نهاية أسبوع)':'EGP/night (weekday — weekend)'}
              images={floorImages.upper.map(m=>m.url)}
              placeholder={isAR?'صورة الدور العلوي — قريباً':'Upper floor photo coming soon'}
              accentColor="#F97316"
              onLightbox={imgs=>setLightbox({images:imgs,index:0})}
            />
          )}
          {activeFloor === 'roof' && (
            <MagazineFloor isAR={isAR} number="03"
              tag={isAR?'السطح':'ROOFTOP'}
              title={isAR?'السطح البانورامي':'Panoramic Rooftop'}
              subtitle={isAR?'تاج الشاليه — ١٨٠ درجة':'Crown of the Chalet — 180°'}
              desc={isAR?'سطح مفتوح بإطلالة بحرية بانورامية ١٨٠ درجة. المكان المثالي لجلسات الغروب والسهرات الرائعة.':'Open rooftop with 180° panoramic sea view. Perfect for sunset sessions and unforgettable evenings.'}
              features={[
                { title:isAR?'إطلالة ١٨٠ درجة':'180° Panorama', desc:isAR?'البحر الأبيض المتوسط بالكامل أمامك':'Full Mediterranean in front of you' },
                { title:isAR?'مساحة مفتوحة':'Open Space', desc:isAR?'مثالي للجلسات والتجمعات العائلية':'Perfect for family gatherings' },
                { title:isAR?'جلسات الغروب':'Sunset Sessions', desc:isAR?'أجمل غروب على الساحل':'Most beautiful sunset on the coast' },
              ]}
              price=""
              priceLabel={isAR?'متاح ضمن حجز أي دور':'Available with any floor booking'}
              images={floorImages.roof.map(m=>m.url)}
              placeholder={isAR?'صورة السطح — قريباً':'Rooftop photo coming soon'}
              accentColor="#8b5cf6"
              onLightbox={imgs=>setLightbox({images:imgs,index:0})}
            />
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && <Lightbox images={lightbox.images} startIndex={lightbox.index} onClose={()=>setLightbox(null)} />}

      {/* PRICING — dark redesign */}
      <section id="pricing" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#0F0F0F' }}>
        <div className="container">
          <div style={{ textAlign:'center', maxWidth:680, margin:'0 auto 64px' }}>
            <SecTag label={isAR?'الأسعار':'PRICING'} dark center />
            <h2 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:900, color:'#fff', marginBottom:16, fontFamily:"'Tajawal',sans-serif" }}>
              {t('pricing_title','أسعار شفافة بلا مفاجآت','Transparent Pricing, No Surprises')}
            </h2>
            <p style={{ fontSize:16, color:'rgba(255,255,255,0.5)', lineHeight:1.9 }}>
              {t('pricing_subtitle','يمكنك استئجار الدور الأرضي أو الدور العلوي بشكل مستقل، أو الشاليه بالكامل بسعر مجمَّع.','You can rent the ground floor or upper floor independently, or the full chalet at a combined rate.')}
            </p>
          </div>

          {/* Per-floor pricing cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20, marginBottom:32 }}>
            {/* Upper Floor */}
            <div style={{ background:'#F97316', borderRadius:16, padding:'36px 28px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:16, left:16, background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, color:'#fff', letterSpacing:1 }}>
                {isAR?'الأكثر طلباً':'Most Popular'}
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:700, letterSpacing:3, textTransform:'uppercase', marginBottom:8, marginTop:32 }}>{isAR?'الدور العلوي':'UPPER FLOOR'}</div>
              <div style={{ fontSize:20, fontWeight:900, color:'#fff', fontFamily:"'Tajawal',sans-serif", marginBottom:4 }}>{isAR?'٣ غرف نوم + بلكونة':'3 Bedrooms + Balcony'}</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
                <span style={{ fontSize:48, fontWeight:900, color:'#fff', fontFamily:"'Tajawal',sans-serif", lineHeight:1 }}>{getPrice('upper','weekday').toLocaleString()}</span>
                <span style={{ fontSize:14, color:'rgba(255,255,255,0.75)' }}>{isAR?'جنيه/ليلة (أيام الأسبوع)':'EGP/night (weekdays)'}</span>
              </div>
              <div style={{ fontSize:15, color:'rgba(255,255,255,0.85)', marginBottom:16 }}>
                {getPrice('upper','weekend').toLocaleString()} {isAR?'جنيه/ليلة (نهاية الأسبوع)':'EGP/night (weekends)'}
              </div>
              <button onClick={()=>{ setSelectedFloor('upper'); document.getElementById('booking')?.scrollIntoView({behavior:'smooth'}) }} style={{ display:'inline-block', background:'rgba(255,255,255,0.2)', color:'#fff', padding:'10px 22px', borderRadius:6, fontSize:13, fontWeight:700, border:'none', cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>{isAR?'احجز الدور العلوي':'Book Upper Floor'}</button>
            </div>

            {/* Ground Floor */}
            <div style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'36px 28px' }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:700, letterSpacing:3, textTransform:'uppercase', marginBottom:8 }}>{isAR?'الدور الأرضي':'GROUND FLOOR'}</div>
              <div style={{ fontSize:20, fontWeight:900, color:'#fff', fontFamily:"'Tajawal',sans-serif", marginBottom:4 }}>{isAR?'غرفتان + مطبخ':'2 Bedrooms + Kitchen'}</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
                <span style={{ fontSize:48, fontWeight:900, color:'#F97316', fontFamily:"'Tajawal',sans-serif", lineHeight:1 }}>{getPrice('ground','weekday').toLocaleString()}</span>
                <span style={{ fontSize:14, color:'rgba(255,255,255,0.5)' }}>{isAR?'جنيه/ليلة (أيام الأسبوع)':'EGP/night (weekdays)'}</span>
              </div>
              <div style={{ fontSize:15, color:'rgba(255,255,255,0.6)', marginBottom:16 }}>
                {getPrice('ground','weekend').toLocaleString()} {isAR?'جنيه/ليلة (نهاية الأسبوع)':'EGP/night (weekends)'}
              </div>
              <button onClick={()=>{ setSelectedFloor('ground'); document.getElementById('booking')?.scrollIntoView({behavior:'smooth'}) }} style={{ display:'inline-block', background:'rgba(249,115,22,0.2)', color:'#F97316', padding:'10px 22px', borderRadius:6, fontSize:13, fontWeight:700, textDecoration:'none', border:'1px solid rgba(249,115,22,0.4)', cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>{isAR?'احجز الدور الأرضي':'Book Ground Floor'}</button>
            </div>

            {/* Full Chalet */}
            <div style={{ background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.3)', borderRadius:16, padding:'36px 28px' }}>
              <div style={{ fontSize:11, color:'#a78bfa', fontWeight:700, letterSpacing:3, textTransform:'uppercase', marginBottom:8 }}>{isAR?'الشاليه كامل':'FULL CHALET'}</div>
              <div style={{ fontSize:20, fontWeight:900, color:'#fff', fontFamily:"'Tajawal',sans-serif", marginBottom:4 }}>{isAR?'٥ غرف نوم كاملة':'5 Bedrooms Complete'}</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
                <span style={{ fontSize:48, fontWeight:900, color:'#a78bfa', fontFamily:"'Tajawal',sans-serif", lineHeight:1 }}>{(getPrice('upper','weekday')+getPrice('ground','weekday')).toLocaleString()}</span>
                <span style={{ fontSize:14, color:'rgba(255,255,255,0.5)' }}>{isAR?'جنيه/ليلة (أيام الأسبوع)':'EGP/night (weekdays)'}</span>
              </div>
              <div style={{ fontSize:15, color:'rgba(255,255,255,0.6)', marginBottom:16 }}>
                {(getPrice('upper','weekend')+getPrice('ground','weekend')).toLocaleString()} {isAR?'جنيه/ليلة (نهاية الأسبوع)':'EGP/night (weekends)'}
              </div>
              <button onClick={()=>{ setSelectedFloor('full'); document.getElementById('booking')?.scrollIntoView({behavior:'smooth'}) }} style={{ display:'inline-block', background:'rgba(139,92,246,0.2)', color:'#a78bfa', padding:'10px 22px', borderRadius:6, fontSize:13, fontWeight:700, textDecoration:'none', border:'1px solid rgba(139,92,246,0.4)', cursor:'pointer', fontFamily:"'Cairo',sans-serif" }}>{isAR?'احجز الشاليه كامل':'Book Full Chalet'}</button>
            </div>
          </div>
        </div>
      </section>

      {/* BOOKING */}
      <section id="booking" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#FAFAF8' }}>
        <div className="container">
          <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto 48px' }}>
            <SecTag label={isAR?'الحجز':'BOOKING'} center />
            <h2 style={{ fontSize:'clamp(32px,4vw,48px)', fontWeight:900, color:'#0F0F0F', marginBottom:16, fontFamily:"'Tajawal',sans-serif" }}>
              {t('booking_title','تحقق من التوفر واحجز','Check Availability & Book')}
            </h2>
            <p style={{ fontSize:16, color:'#6A6A6A', lineHeight:1.9 }}>
              {isAR?'اختر الوحدة التي تريد حجزها، تحقق من التقويم، ثم أرسل طلبك.':'Choose your unit, check the calendar, then send your request.'}
            </p>
          </div>

          {/* Floor selector */}
          <div style={{ display:'flex', justifyContent:'center', gap:12, marginBottom:40, flexWrap:'wrap' }}>
            {floorOptions.map(opt => (
              <button key={opt.key} onClick={()=>setSelectedFloor(opt.key)} style={{
                padding:'16px 24px', borderRadius:12, border:`2px solid ${selectedFloor===opt.key?opt.color:'#E8E5DF'}`,
                background: selectedFloor===opt.key ? `${opt.color}15` : '#fff',
                cursor:'pointer', fontFamily:"'Cairo',sans-serif", transition:'all 0.25s', textAlign:'center', minWidth:180,
              }}>
                <div style={{ fontSize:15, fontWeight:900, color: selectedFloor===opt.key?opt.color:'#1A1A1A', marginBottom:4 }}>
                  {isAR?opt.labelAr:opt.labelEn}
                </div>
                <div style={{ fontSize:12, color:'#8A8A8A' }}>{opt.desc}</div>
              </button>
            ))}
          </div>

          {/* Full chalet warning */}
          {selectedFloor === 'full' && (
            <div style={{ background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:12, padding:'16px 20px', marginBottom:32, textAlign:'center', maxWidth:700, margin:'0 auto 32px' }}>
              <p style={{ fontSize:14, color:'#7c3aed', fontWeight:600, lineHeight:1.8 }}>
                {isAR?'⚠️ لحجز الشاليه كامل، يجب أن يكون كلا الدورين متاحَين في نفس الفترة. إذا كان أي دور محجوزاً، لن يمكن حجز الشاليه كاملاً.':'⚠️ To book the full chalet, both floors must be available for the same period. If either floor is booked, the full chalet cannot be reserved.'}
              </p>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:'clamp(32px,6vw,64px)', alignItems:'start' }}>

            {/* Calendar */}
            <div>
              <div style={{ background:'#fff', border:'1px solid #E8E5DF', borderRadius:16, overflow:'hidden', marginBottom:24, boxShadow:'0 4px 24px rgba(0,0,0,0.06)' }}>
                <div style={{ background: selectedFloor==='upper'?'#F97316':selectedFloor==='ground'?'#0ea5e9':'#8b5cf6', color:'#fff', padding:'18px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <button onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);}} style={{ background:'none', border:'none', color:'#fff', fontSize:20, cursor:'pointer', fontWeight:900 }}>›</button>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:11, opacity:0.8, letterSpacing:2, textTransform:'uppercase', marginBottom:2 }}>
                      {selectedFloor==='upper'?(isAR?'الدور العلوي':'Upper Floor'):selectedFloor==='ground'?(isAR?'الدور الأرضي':'Ground Floor'):(isAR?'الشاليه كامل':'Full Chalet')}
                    </div>
                    <div style={{ fontSize:17, fontWeight:900, fontFamily:"'Tajawal',sans-serif" }}>
                      {(isAR?monthNamesAR:monthNamesEN)[calMonth]} {calYear}
                    </div>
                  </div>
                  <button onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);}} style={{ background:'none', border:'none', color:'#fff', fontSize:20, cursor:'pointer', fontWeight:900 }}>‹</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'10px 10px 0', gap:4 }}>
                  {(isAR?dayNamesAR:dayNamesEN).map(d=><div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:800, color:'#8A8A8A', textTransform:'uppercase', padding:'4px 0' }}>{d}</div>)}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:10, gap:5 }}>
                  {renderCalendar(selectedFloor)}
                </div>
              </div>

              {/* Legend */}
              <div style={{ display:'flex', gap:12, marginBottom:32, flexWrap:'wrap' }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#dcfce7', border:'1px solid #22c55e', borderRadius:8, padding:'10px 16px', justifyContent:'center' }}>
                  <span style={{ width:14, height:14, borderRadius:'50%', background:'#22c55e', display:'block' }} />
                  <span style={{ fontSize:13, fontWeight:800, color:'#15803d' }}>{isAR?'✅ متاح':'✅ Available'}</span>
                </div>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'#fee2e2', border:'1px solid #ef4444', borderRadius:8, padding:'10px 16px', justifyContent:'center' }}>
                  <span style={{ width:14, height:14, borderRadius:'50%', background:'#ef4444', display:'block' }} />
                  <span style={{ fontSize:13, fontWeight:800, color:'#dc2626' }}>{isAR?'🚫 محجوز':'🚫 Booked'}</span>
                </div>
              </div>

              {/* Steps — magazine style */}
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#0F0F0F', marginBottom:16, fontFamily:"'Tajawal',sans-serif" }}>{isAR?'كيف تحجز؟':'How to Book?'}</div>
                {[
                  { num:'01', title:isAR?'اختر الوحدة':'Choose Unit', desc:isAR?'الدور الأرضي، العلوي، أو الشاليه كامل':'Ground, upper floor, or full chalet', color:'#F97316', bg:'#FFF7ED' },
                  { num:'02', title:isAR?'تحقق من التوفر':'Check Availability', desc:isAR?'راجع التقويم واختر تواريخ إقامتك':'Review the calendar and pick your dates', color:'#0ea5e9', bg:'#f0f9ff' },
                  { num:'03', title:isAR?'ادفع عبر InstaPay':'Pay via InstaPay', desc:isAR?'أرسل المبلغ على 01159710758 ثم أرسل لقطة الشاشة':'Send amount to 01159710758 then send screenshot', color:'#22c55e', bg:'#f0fdf4' },
                  { num:'04', title:isAR?'يُؤكَّد حجزك':'Booking Confirmed', desc:isAR?'بعد التحقق من الدفع يُثبَّت اسمك فوراً':'After payment check your name is locked instantly', color:'#8b5cf6', bg:'#f5f3ff' },
                ].map((step,i)=>(
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:0, marginBottom: i<3?0:0 }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                      <div style={{ width:44, height:44, borderRadius:12, background:step.bg, border:`1.5px solid ${step.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Tajawal',sans-serif", fontSize:14, fontWeight:900, color:step.color, flexShrink:0 }}>{step.num}</div>
                      {i<3 && <div style={{ width:2, height:28, background:`linear-gradient(to bottom,${step.color}40,transparent)` }} />}
                    </div>
                    <div style={{ padding:'0 0 28px 16px' }}>
                      <div style={{ fontSize:15, fontWeight:900, color:'#0F0F0F', fontFamily:"'Tajawal',sans-serif", marginBottom:4, borderRight: isAR?`3px solid ${step.color}`:'none', borderLeft:!isAR?`3px solid ${step.color}`:'none', paddingRight:isAR?12:0, paddingLeft:!isAR?12:0 }}>{step.title}</div>
                      <div style={{ fontSize:13, color:'#6A6A6A', lineHeight:1.7 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <div style={{ background:'#fff', border:'1px solid #E8E5DF', borderRadius:16, padding:'32px 28px', boxShadow:'0 4px 24px rgba(0,0,0,0.06)', position:'sticky', top:90 }}>
              <h3 style={{ fontSize:20, fontWeight:900, color:'#0F0F0F', marginBottom:24, fontFamily:"'Tajawal',sans-serif" }}>
                {isAR?'احسب تكلفة إقامتك':'Calculate Your Stay'}
              </h3>
              {submitted ? (
                <div style={{ textAlign:'center', padding:'32px 16px' }}>
                  <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
                  <h4 style={{ fontSize:20, fontWeight:900, color:'#0F0F0F', marginBottom:8, fontFamily:"'Tajawal',sans-serif" }}>{isAR?'تم إرسال طلبك!':'Request Sent!'}</h4>
                  <p style={{ fontSize:14, color:'#6A6A6A', lineHeight:1.8, marginBottom:20 }}>{isAR?'أرسل الآن لقطة شاشة الدفع عبر واتساب لتأكيد حجزك.':'Now send your payment screenshot via WhatsApp to confirm.'}</p>
                  <a href={buildWALink()} target="_blank" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#25D366', color:'#fff', padding:'12px 24px', borderRadius:8, fontWeight:800, textDecoration:'none' }}>
                    <WAIcon />{isAR?'فتح واتساب':'Open WhatsApp'}
                  </a>
                </div>
              ):(
                <>
                  <FF label={isAR?'تاريخ الوصول':'Check-in'}>
                    <input type="date" value={checkIn} onChange={e=>setCheckIn(e.target.value)} style={IS} onFocus={e=>e.target.style.borderColor='#F97316'} onBlur={e=>e.target.style.borderColor='#E8E5DF'} />
                  </FF>
                  <FF label={isAR?'تاريخ المغادرة':'Check-out'}>
                    <input type="date" value={checkOut} onChange={e=>setCheckOut(e.target.value)} style={IS} onFocus={e=>e.target.style.borderColor='#F97316'} onBlur={e=>e.target.style.borderColor='#E8E5DF'} />
                  </FF>

                  {/* Conflict warning */}
                  {checkIn && checkOut && hasPeriodConflict() && (
                    <div style={{ background:'#fee2e2', border:'1px solid #ef4444', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
                      <p style={{ fontSize:13, color:'#dc2626', fontWeight:700, margin:0 }}>
                        🚫 {isAR?'هذه الفترة محجوزة. يرجى اختيار فترة أخرى.':'This period is already booked. Please choose different dates.'}
                      </p>
                    </div>
                  )}

                  {priceCalc && !hasPeriodConflict() && (
                    <div style={{ background:'#FFF7ED', borderRadius:12, padding:18, marginBottom:18, border:'1px solid rgba(249,115,22,0.2)' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#F97316', letterSpacing:2, textTransform:'uppercase', marginBottom:10 }}>{isAR?'ملخص التكلفة':'COST SUMMARY'}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#1A1A1A', marginBottom:6 }}><span>{isAR?'الوحدة':'Unit'}</span><span style={{ fontWeight:700, color:'#F97316' }}>{isAR?floorOptions.find(f=>f.key===selectedFloor)?.labelAr:floorOptions.find(f=>f.key===selectedFloor)?.labelEn}</span></div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#1A1A1A', marginBottom:6 }}><span>{isAR?'الليالي':'Nights'}</span><span style={{ fontWeight:700 }}>{priceCalc.nights}</span></div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#1A1A1A', marginBottom:6 }}><span>{isAR?'أيام الأسبوع':'Weekdays'}</span><span>{priceCalc.weekdays} × {selectedFloor==='full'?(getPrice('upper','weekday')+getPrice('ground','weekday')).toLocaleString():getPrice(selectedFloor as 'upper'|'ground','weekday').toLocaleString()}</span></div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#1A1A1A', marginBottom:10 }}><span>{isAR?'نهاية الأسبوع':'Weekend'}</span><span>{priceCalc.weekend} × {selectedFloor==='full'?(getPrice('upper','weekend')+getPrice('ground','weekend')).toLocaleString():getPrice(selectedFloor as 'upper'|'ground','weekend').toLocaleString()}</span></div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:20, fontWeight:900, color:'#F97316', borderTop:'1px solid rgba(249,115,22,0.2)', paddingTop:10 }}>
                        <span>{isAR?'الإجمالي':'Total'}</span>
                        <span>{priceCalc.total.toLocaleString()} {isAR?'جنيه':'EGP'}</span>
                      </div>
                    </div>
                  )}

                  <FF label={isAR?'الاسم الكامل':'Full Name'}>
                    <input type="text" value={renterName} onChange={e=>setRenterName(e.target.value)} style={IS} onFocus={e=>e.target.style.borderColor='#F97316'} onBlur={e=>e.target.style.borderColor='#E8E5DF'} />
                  </FF>
                  <FF label={isAR?'رقم الهاتف / واتساب':'Phone / WhatsApp'}>
                    <input type="tel" value={renterPhone} onChange={e=>setRenterPhone(e.target.value)} placeholder="01XXXXXXXXX" style={IS} onFocus={e=>e.target.style.borderColor='#F97316'} onBlur={e=>e.target.style.borderColor='#E8E5DF'} />
                  </FF>

                  <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'12px 14px', marginBottom:16 }}>
                    <p style={{ fontSize:12, color:'#166534', lineHeight:1.7, margin:0 }}>
                      💡 {isAR?'بعد الإرسال انتقل لواتساب وأرسل مبلغ الحجز على InstaPay رقم 01159710758 ثم أرسل لقطة شاشة لتأكيد الحجز.':'After sending go to WhatsApp and pay via InstaPay to 01159710758 then send a screenshot to confirm.'}
                    </p>
                  </div>

                  <button onClick={submitBooking} disabled={submitting||hasPeriodConflict()} style={{ width:'100%', background: hasPeriodConflict()?'#9CA3AF':'#25D366', color:'#fff', padding:16, border:'none', borderRadius:8, fontSize:15, fontWeight:800, cursor: hasPeriodConflict()?'not-allowed':'pointer', fontFamily:"'Cairo',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:10, boxShadow: hasPeriodConflict()?'none':'0 4px 20px rgba(37,211,102,0.4)', transition:'all 0.3s' }}>
                    <WAIcon />{submitting?(isAR?'جاري الإرسال...':'Sending...'):(isAR?'أرسل طلب الحجز عبر واتساب':'Send Booking Request via WhatsApp')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PAYMENT */}
      <section id="payment" style={{ position:'relative', height:400, overflow:'hidden' }}>
        <img src="https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1400&q=80" alt="payment" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        <div style={{ position:'absolute', inset:0, background: isAR?'linear-gradient(to left,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.5) 55%,rgba(0,0,0,0.15) 100%)':'linear-gradient(to right,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.5) 55%,rgba(0,0,0,0.15) 100%)' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center' }}>
          <div className="container">
            <div style={{ maxWidth:520 }}>
              <SecTag label={isAR?'الدفع':'PAYMENT'} dark />
              <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:900, color:'#fff', marginBottom:14, fontFamily:"'Tajawal',sans-serif" }}>
                {t('payment_title','الدفع الآمن عبر InstaPay','Secure Payment via InstaPay')}
              </h2>
              <p style={{ fontSize:15, color:'rgba(255,255,255,0.75)', lineHeight:1.9, marginBottom:24 }}>
                {t('payment_desc','أرسل المبلغ الكامل على الرقم أدناه، ثم أرسل لقطة شاشة لتأكيد الدفع.','Transfer the full amount to the number below, then send a payment screenshot via WhatsApp.')}
              </p>
              <div style={{ display:'inline-flex', alignItems:'center', gap:16, background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:10, padding:'18px 28px' }}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/InstaPay_logo.svg/320px-InstaPay_logo.svg.png" alt="InstaPay" style={{ height:32, objectFit:'contain', filter:'brightness(0) invert(1)' }} onError={e=>{e.currentTarget.style.display='none'}} />
                <div style={{ width:'1px', height:32, background:'rgba(255,255,255,0.2)' }} />
                <div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', fontWeight:700, letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>{isAR?'رقم InstaPay':'INSTAPAY NUMBER'}</div>
                  <span style={{ fontSize:'clamp(20px,3vw,30px)', fontWeight:900, color:'#fff', fontFamily:"'Tajawal',sans-serif", letterSpacing:1 }}>
                    {t('instapay_number','01159710758','01159710758')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOCATION */}
      <section id="location" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#fff' }}>
        <div className="container">
          <div style={{ textAlign:'center', maxWidth:600, margin:'0 auto 64px' }}>
            <SecTag label={isAR?'الموقع':'LOCATION'} center />
            <h2 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:900, color:'#0F0F0F', fontFamily:"'Tajawal',sans-serif" }}>
              {t('location_title','في قلب الساحل الشمالي','In the Heart of the North Coast')}
            </h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'clamp(32px,6vw,64px)', alignItems:'center', marginBottom:48 }}>
            <div>
              {[
                { num:'01', color:'#F97316', bg:'#FFF7ED', title:isAR?'الساحل الشمالي، مصر':'Sahel, North Coast, Egypt', desc:isAR?'الصف الثاني على البحر مع فتحة مفتوحة أمام الشاليه تمنحك إطلالة بحرية واسعة وواضحة بدون أي عائق.':'Second row on shore with an open gap in front ensuring a wide, completely unobstructed sea view.' },
                { num:'02', color:'#0ea5e9', bg:'#f0f9ff', title:isAR?'حمام سباحة مشترك':'Shared Swimming Pool', desc:isAR?'دقيقة واحدة بالسيارة أو ٥ دقائق سيراً — حمام سباحة في القرية متاح لجميع ضيوف المجمع.':'1 minute by car or 5 min walk — shared pool in the village available to all complex guests.' },
                { num:'03', color:'#8b5cf6', bg:'#f5f3ff', title:'WiFi', desc:isAR?'خدمة الإنترنت متاحة في الدور العلوي للتواصل أثناء إقامتك.':'Internet service available on the upper floor to stay connected during your stay.' },
              ].map((item,i)=>(
                <div key={i} style={{ display:'flex', gap:20, marginBottom: i<2?32:0, paddingBottom: i<2?32:0, borderBottom: i<2?`1px solid #E8E5DF`:'none' }}>
                  <div style={{ width:52, height:52, borderRadius:12, background:item.bg, border:`1px solid ${item.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Tajawal',sans-serif", fontSize:16, fontWeight:900, color:item.color, flexShrink:0 }}>{item.num}</div>
                  <div style={{ borderRight: isAR?`3px solid ${item.color}`:'none', borderLeft: !isAR?`3px solid ${item.color}`:'none', paddingRight: isAR?16:0, paddingLeft: !isAR?16:0 }}>
                    <h3 style={{ fontSize:17, fontWeight:900, color:'#0F0F0F', marginBottom:6, fontFamily:"'Tajawal',sans-serif" }}>{item.title}</h3>
                    <p style={{ fontSize:14, color:'#6A6A6A', lineHeight:1.8, margin:0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderRadius:16, overflow:'hidden', height:420, boxShadow:'0 8px 40px rgba(0,0,0,0.1)', border:'1px solid #E8E5DF' }}>
              <iframe src="https://maps.google.com/maps?q=31.1837,29.9553&output=embed&z=15" width="100%" height="100%" style={{ border:'none' }} loading="lazy" />
            </div>
          </div>
          <div style={{ textAlign:'center' }}>
            <a href="https://maps.app.goo.gl/ct4KxCzPYHbvb6UN7" target="_blank" style={{ display:'inline-flex', alignItems:'center', gap:8, color:'#F97316', fontWeight:700, fontSize:15, textDecoration:'none', borderBottom:'2px solid #F97316', paddingBottom:4 }}>
              📍 {isAR?'افتح الموقع في خرائط جوجل':'Open in Google Maps'}
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding:'clamp(64px,10vw,120px) 0', background:'#FAFAF8' }}>
        <div className="container">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'clamp(32px,6vw,80px)' }}>
            <div style={{ position:'sticky', top:120 }}>
              <SecTag label={isAR?'الأسئلة الشائعة':'FAQ'} />
              <h2 style={{ fontSize:'clamp(28px,3vw,44px)', fontWeight:900, color:'#0F0F0F', marginBottom:16, fontFamily:"'Tajawal',sans-serif" }}>
                {t('faq_title','أجوبة على أكثر الأسئلة شيوعاً','Answers to Common Questions')}
              </h2>
              <p style={{ fontSize:15, color:'#6A6A6A', lineHeight:1.9 }}>
                {t('faq_subtitle','لم تجد إجابتك؟ تواصل معنا مباشرةً عبر واتساب.','Didn\'t find your answer? Contact us via WhatsApp.')}
              </p>
            </div>
            <div>
              {[
                [isAR?'هل يمكنني استئجار دور واحد فقط؟':'Can I rent just one floor?', isAR?'نعم — يمكنك استئجار الدور الأرضي أو الدور العلوي بشكل مستقل، أو الشاليه بالكامل إذا أردت.':'Yes — you can rent the ground floor or upper floor independently, or the full chalet if needed.'],
                [isAR?'هل يمكنني الحجز بدون دفع مقدم؟':'Can I book without upfront payment?', isAR?'لا — الحجز يُؤكَّد فقط بعد إتمام الدفع عبر InstaPay وإرسال لقطة الشاشة.':'No — bookings are confirmed only after full payment via InstaPay and sending the screenshot.'],
                [isAR?'ما الحد الأقصى لعدد الضيوف؟':'What is the max number of guests?', isAR?'الدور الأرضي: ٤ أشخاص. الدور العلوي: ٦ أشخاص. الشاليه كامل: ١٠ أشخاص.':'Ground floor: 4 people. Upper floor: 6 people. Full chalet: 10 people.'],
                [isAR?'هل يوجد حمام سباحة؟':'Is there a pool?', isAR?'يوجد حمام سباحة مشترك في القرية على بُعد دقيقة بالسيارة.':'There is a shared pool in the village just 1 minute by car.'],
                [isAR?'ما موسم الإيجار؟':'What is the rental season?', isAR?'الموسم الرئيسي من يونيو حتى سبتمبر.':'The main season runs from June to September.'],
                [isAR?'ما سياسة الإلغاء؟':'What is the cancellation policy?', isAR?'يُرجى التواصل مع المالك مباشرةً عبر واتساب للاستفسار عن شروط الإلغاء.':'Please contact the owner via WhatsApp for cancellation terms.'],
              ].map(([q,a],i)=>(
                <FAQItem key={i} num={String(i+1).padStart(2,'0')} question={q} answer={a} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:'#0F0F0F', padding:'clamp(48px,8vw,80px) 0 0' }}>
        <div className="container">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:40, paddingBottom:48, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <h3 style={{ fontFamily:"'Tajawal',sans-serif", fontSize:22, fontWeight:900, color:'#fff', marginBottom:12 }}>
                {isAR?'الجنزوري':'Elganzoury'}<span style={{ color:'#F97316' }}>.</span>
              </h3>
              <p style={{ fontSize:14, color:'rgba(255,255,255,0.5)', lineHeight:1.8 }}>
                {t('footer_desc','شاليه فاخر على خط البحر في الساحل الشمالي.','Premium beachfront chalet on Egypt\'s North Coast.')}
              </p>
            </div>
            <div>
              <h4 style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:2, textTransform:'uppercase', marginBottom:16 }}>{isAR?'روابط سريعة':'Quick Links'}</h4>
              {[['#about',isAR?'عن الشاليه':'About'],['#floors',isAR?'الطوابق':'Floors'],['#pricing',isAR?'الأسعار':'Pricing'],['#gallery',isAR?'الصور':'Gallery'],['#booking',isAR?'الحجز':'Booking']].map(([href,label])=>(
                <a key={href} href={href} style={{ display:'block', fontSize:14, color:'rgba(255,255,255,0.7)', textDecoration:'none', marginBottom:10 }}
                  onMouseEnter={e=>e.currentTarget.style.color='#F97316'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.7)'}>{label}</a>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:2, textTransform:'uppercase', marginBottom:16 }}>{isAR?'تواصل معنا':'Contact'}</h4>
              <a href={`https://wa.me/${t('whatsapp_number','201159710758','201159710758')}`} target="_blank" style={{ display:'block', fontSize:14, color:'rgba(255,255,255,0.7)', textDecoration:'none', marginBottom:10 }}>
                WhatsApp: {t('whatsapp_number','01159710758','01159710758')}
              </a>
              <span style={{ display:'block', fontSize:14, color:'rgba(255,255,255,0.7)' }}>
                InstaPay: {t('instapay_number','01159710758','01159710758')}
              </span>
            </div>
          </div>
          <div style={{ padding:'20px 0', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>© 2025 {isAR?'شاليه الجنزوري':'Elganzoury Chalet'}</p>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>{isAR?'تطوير:':'Built by:'} <a href="#" style={{ color:'#F97316', textDecoration:'none' }}>Abdelrahman Elganzoury</a></p>
          </div>
        </div>
      </footer>

      {/* FLOATING BUTTONS */}
      <a href={`https://wa.me/${t('whatsapp_number','201159710758','201159710758')}`} target="_blank" style={{ position:'fixed', bottom:28, right:28, zIndex:999, width:58, height:58, background:'#25D366', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 24px rgba(37,211,102,0.5)', textDecoration:'none' }}>
        <WAIcon size={28} />
      </a>
      <a href="#booking" style={{ position:'fixed', bottom:28, left:28, zIndex:999, background:'#F97316', color:'#fff', padding:'14px 22px', borderRadius:50, fontSize:13, fontWeight:800, textDecoration:'none', boxShadow:'0 4px 24px rgba(249,115,22,0.5)', display:'flex', alignItems:'center', gap:8 }}>
        {isAR?'احجز الآن':'Book Now'}
      </a>
    </div>
  )
}

// ===== HELPERS =====

function SecTag({ label, dark, center }: { label:string; dark?:boolean; center?:boolean }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, justifyContent:center?'center':'flex-start' }}>
      <div style={{ width:36, height:2, background:'#F97316', flexShrink:0 }} />
      <span style={{ color:dark?'rgba(255,255,255,0.7)':'#F97316', fontSize:11, fontWeight:700, letterSpacing:'3px', textTransform:'uppercase' }}>{label}</span>
    </div>
  )
}

function MagazineFloor({ isAR, number, tag, title, subtitle, desc, features, price, priceLabel, images, placeholder, accentColor, onLightbox }: {
  isAR:boolean; number:string; tag:string; title:string; subtitle:string; desc:string;
  features:{title:string;desc:string}[]; price:string; priceLabel:string;
  images:string[]; placeholder:string; accentColor:string;
  onLightbox:(imgs:string[])=>void;
}) {
  const [imgIdx, setImgIdx] = useState(0)
  const [hovered, setHovered] = useState(false)
  const hasImages = images.length > 0
  const currentImg = hasImages ? images[imgIdx] : null

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:48, alignItems:'center' }}>
      <div>
        <div style={{ display:'flex', alignItems:'flex-start', gap:20, marginBottom:28 }}>
          <div style={{ fontFamily:"'Tajawal',sans-serif", fontSize:72, fontWeight:900, color:accentColor, opacity:0.12, lineHeight:1, flexShrink:0 }}>{number}</div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:accentColor, letterSpacing:3, textTransform:'uppercase', marginBottom:6 }}>{tag}</div>
            <h3 style={{ fontSize:'clamp(26px,3vw,38px)', fontWeight:900, color:'#0F0F0F', fontFamily:"'Tajawal',sans-serif", lineHeight:1.1, marginBottom:4 }}>{title}</h3>
            <div style={{ fontSize:15, color:'#8A8A8A', fontWeight:600 }}>{subtitle}</div>
          </div>
        </div>
        <p style={{ fontSize:16, color:'#4A4A4A', lineHeight:1.9, marginBottom:28, borderRight:isAR?`3px solid ${accentColor}`:'none', borderLeft:!isAR?`3px solid ${accentColor}`:'none', paddingRight:isAR?20:0, paddingLeft:!isAR?20:0 }}>{desc}</p>

        {/* Magazine feature rows — bigger fonts */}
        <div style={{ display:'flex', flexDirection:'column', gap:0, marginBottom:28 }}>
          {features.map((f,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:0, borderBottom:'1px solid #F0EDE8' }}>
              <div style={{ width:4, alignSelf:'stretch', background: i%2===0 ? accentColor : `${accentColor}50`, flexShrink:0 }} />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flex:1, padding:'16px 18px' }}>
                <span style={{ fontSize:17, fontWeight:900, color:'#0F0F0F', fontFamily:"'Tajawal',sans-serif" }}>{f.title}</span>
                <span style={{ fontSize:15, color:'#5A5A5A', fontWeight:600 }}>{f.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {price && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:12, background:`${accentColor}10`, border:`1px solid ${accentColor}30`, borderRadius:10, padding:'14px 20px' }}>
            <span style={{ fontSize:22, fontWeight:900, color:accentColor, fontFamily:"'Tajawal',sans-serif" }}>{price}</span>
            <span style={{ fontSize:13, color:'#6A6A6A' }}>{priceLabel}</span>
          </div>
        )}
        {!price && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${accentColor}10`, border:`1px solid ${accentColor}30`, borderRadius:10, padding:'12px 18px' }}>
            <span style={{ fontSize:14, color:accentColor, fontWeight:700 }}>{priceLabel}</span>
          </div>
        )}
      </div>

      {/* Image slider */}
      <div style={{ borderRadius:16, overflow:'hidden', minHeight:400, background:'linear-gradient(135deg,#f0ece6,#e8e2d8)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.08)', position:'relative', cursor: hasImages?'pointer':'default' }}
        onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>

        {currentImg ? (
          <img src={currentImg} alt={title} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'opacity 0.4s' }}
            onClick={()=>onLightbox(images)} />
        ) : (
          <div style={{ textAlign:'center', padding:40 }}>
            <div style={{ fontSize:40, marginBottom:12, opacity:0.2 }}>📷</div>
            <span style={{ fontSize:13, color:'#8A8A8A', fontWeight:600 }}>{placeholder}</span>
          </div>
        )}

        {/* Arrows — shown on hover if multiple images */}
        {hasImages && images.length > 1 && (
          <>
            <button onClick={e=>{ e.stopPropagation(); setImgIdx(i=>i>0?i-1:images.length-1) }}
              style={{ position:'absolute', top:'50%', right:14, transform:'translateY(-50%)', width:42, height:42, borderRadius:'50%', background:'rgba(255,255,255,0.92)', border:'none', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(0,0,0,0.2)', opacity: hovered?1:0.4, transition:'opacity 0.3s', fontWeight:900, color:'#0F0F0F' }}>‹</button>
            <button onClick={e=>{ e.stopPropagation(); setImgIdx(i=>i<images.length-1?i+1:0) }}
              style={{ position:'absolute', top:'50%', left:14, transform:'translateY(-50%)', width:42, height:42, borderRadius:'50%', background:'rgba(255,255,255,0.92)', border:'none', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(0,0,0,0.2)', opacity: hovered?1:0.4, transition:'opacity 0.3s', fontWeight:900, color:'#0F0F0F' }}>›</button>
          </>
        )}

        {/* Photo counter + hint */}
        {hasImages && (
          <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            {/* Dots */}
            {images.length > 1 && (
              <div style={{ display:'flex', gap:5 }}>
                {images.map((_,i)=>(
                  <div key={i} onClick={e=>{ e.stopPropagation(); setImgIdx(i) }} style={{ width: imgIdx===i?20:6, height:6, borderRadius:3, background: imgIdx===i?'#fff':'rgba(255,255,255,0.5)', transition:'all 0.3s', cursor:'pointer' }} />
                ))}
              </div>
            )}
            {/* Click hint */}
            {hovered && (
              <div style={{ background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:20, letterSpacing:0.5 }}>
                {isAR ? `🔍 اضغط لعرض الكل (${images.length} صورة)` : `🔍 Click to view all (${images.length} photos)`}
              </div>
            )}
          </div>
        )}

        {/* Swipe hint badge — always visible if multiple */}
        {hasImages && images.length > 1 && !hovered && (
          <div style={{ position:'absolute', top:14, right:14, background:'rgba(0,0,0,0.55)', color:'#fff', fontSize:11, fontWeight:700, padding:'5px 12px', borderRadius:20, display:'flex', alignItems:'center', gap:5 }}>
            ‹ {images.length} {isAR?'صور':'photos'} ›
          </div>
        )}
      </div>
    </div>
  )
}

function FAQItem({ num, question, answer }: { num:string; question:string; answer:string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom:'1px solid #E8E5DF' }}>
      <div onClick={()=>setOpen(!open)} style={{ display:'flex', alignItems:'center', gap:20, padding:'26px 0', cursor:'pointer' }}>
        <span style={{ color:'#F97316', opacity:0.5, fontSize:13, fontWeight:700, flexShrink:0 }}>{num}</span>
        <span style={{ flex:1, fontSize:16, fontWeight:800, color:'#0F0F0F' }}>{question}</span>
        <span style={{ color:'#F97316', fontSize:22, transform:open?'rotate(45deg)':'none', transition:'transform 0.3s', flexShrink:0 }}>+</span>
      </div>
      {open && (
        <div style={{ paddingBottom:24, paddingRight:54 }}>
          <p style={{ color:'#4A4A4A', fontSize:14, lineHeight:1.9, borderRight:'2px solid #F97316', paddingRight:18 }}>{answer}</p>
        </div>
      )}
    </div>
  )
}

function FF({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:18 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#8A8A8A', marginBottom:7, letterSpacing:'1px', textTransform:'uppercase' }}>{label}</label>
      {children}
    </div>
  )
}

function WAIcon({ size=22, color='#fff' }: { size?:number; color?:string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

const IS: React.CSSProperties = {
  width:'100%', padding:'12px 14px', border:'1.5px solid #E8E5DF', borderRadius:6,
  fontSize:14, fontFamily:"'Cairo',sans-serif", color:'#1A1A1A', background:'#fff', outline:'none', transition:'border 0.2s',
}

function Lightbox({ images, startIndex, onClose }: { images:string[]; startIndex:number; onClose:()=>void }) {
  const [idx, setIdx] = useState(startIndex)
  useEffect(() => {
    const handler = (e:KeyboardEvent) => {
      if (e.key==='Escape') onClose()
      if (e.key==='ArrowLeft') setIdx(i=>i>0?i-1:images.length-1)
      if (e.key==='ArrowRight') setIdx(i=>i<images.length-1?i+1:0)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [images.length, onClose])

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ position:'relative', maxWidth:'90vw', maxHeight:'90vh' }}>
        <img src={images[idx]} alt="" style={{ maxWidth:'90vw', maxHeight:'85vh', objectFit:'contain', borderRadius:8, boxShadow:'0 32px 80px rgba(0,0,0,0.8)' }} />
        {/* Close */}
        <button onClick={onClose} style={{ position:'absolute', top:-16, right:-16, width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        {/* Prev */}
        {images.length>1 && <button onClick={()=>setIdx(i=>i>0?i-1:images.length-1)} style={{ position:'absolute', top:'50%', left:-52, transform:'translateY(-50%)', width:40, height:40, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>}
        {/* Next */}
        {images.length>1 && <button onClick={()=>setIdx(i=>i<images.length-1?i+1:0)} style={{ position:'absolute', top:'50%', right:-52, transform:'translateY(-50%)', width:40, height:40, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>}
        {/* Counter */}
        <div style={{ position:'absolute', bottom:-36, left:'50%', transform:'translateX(-50%)', color:'rgba(255,255,255,0.5)', fontSize:13, fontWeight:600 }}>{idx+1} / {images.length}</div>
      </div>
    </div>
  )
}
