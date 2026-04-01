import { supabase } from './lib/supabase'
import ChaletWebsite from './components/ChaletWebsite'

export default async function Home() {
  const { data: pricing } = await supabase.from('pricing').select('*')
  const { data: media } = await supabase.from('media').select('*').order('sort_order')
  const { data: content } = await supabase.from('site_content').select('*')

  return (
    <ChaletWebsite
      pricing={pricing || []}
      media={media || []}
      content={content || []}
    />
  )
}