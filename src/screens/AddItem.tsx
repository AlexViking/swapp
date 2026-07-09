import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { X, Camera, Plus } from 'lucide-react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Tag } from '../components/Tag'
import { DesktopNav } from '../components/DesktopNav'
import { useAuthStore } from '../store/auth'
import { getProfile, getR2UploadUrls, insertItem } from '../lib/api'

const CATEGORIES = ['Electronics', 'Books', 'Music', 'Fashion', 'Home', 'Sports', 'Art', 'Collectibles']
const CONDITIONS: { label: string; value: number }[] = [
  { label: 'Like new', value: 5 },
  { label: 'Good', value: 3 },
  { label: 'Well-loved', value: 1 },
]

export function AddItem() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const userId = session?.user?.id

  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState<number | null>(null)
  const [wants, setWants] = useState<string[]>([])
  const [wantInput, setWantInput] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([]) // preview URLs
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addWant = () => {
    if (wantInput.trim()) {
      setWants((prev) => [...prev, wantInput.trim()])
      setWantInput('')
    }
  }

  const removeWant = (i: number) => setWants((prev) => prev.filter((_, idx) => idx !== i))

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setPhotos((prev) => [...prev, ...files].slice(0, 5))
    const urls = files.map((f) => URL.createObjectURL(f))
    setPhotoUrls((prev) => [...prev, ...urls].slice(0, 5))
  }

  async function handleSave() {
    if (!userId || !title) {
      alert('Please add a title')
      return
    }
    setSaving(true)
    try {
      let cdnUrls: string[] = []

      if (photos.length > 0) {
        const { data: uploadData, error: uploadError } = await getR2UploadUrls(photos.length, userId)
        if (uploadError) {
          console.error('Upload URL error:', uploadError)
          // Continue without photos rather than blocking
        } else if (uploadData) {
          const urls = uploadData as Array<{ uploadUrl: string; publicUrl: string }>
          await Promise.all(
            photos.map((file, i) =>
              fetch(urls[i].uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type },
              })
            )
          )
          cdnUrls = urls.map((u) => u.publicUrl)
        }
      }

      // Get user's home city
      const { data: prof } = await getProfile(userId)
      const locationCity = prof?.home_city ?? ''

      const { error } = await insertItem({
        user_id: userId,
        title,
        description: story,
        category,
        condition: condition ?? 3,
        wants_in_return: wants,
        images: cdnUrls,
        location_city: locationCity,
        status: 'active',
      })

      if (error) {
        alert('Failed to save item: ' + error.message)
        return
      }

      navigate('/hunt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--surface-page)', display: 'flex', flexDirection: 'column' }}>
      <DesktopNav />

      {/* Header */}
      <header
        className="mobile-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-card)',
        }}
      >
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={22} />
        </button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px' }}>Add a treasure</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: 'none', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--swapp-green)', opacity: saving ? 0.5 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      {/* Desktop header */}
      <header
        className="desktop-nav"
        style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={22} />
          </button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px' }}>Add a treasure</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: 'none', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--swapp-green)', opacity: saving ? 0.5 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      {/* Body: two-column on desktop, single column on mobile */}
      <div className="add-item-layout" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* Left / mobile: photo upload */}
        <div className="add-item-photos" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>Photos</div>

          {/* Large dropzone */}
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%',
              minHeight: '200px',
              borderRadius: 'var(--radius-card-lg)',
              background: 'var(--parchment-deep)',
              border: '2px dashed var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: 'var(--ink-soft)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            <Camera size={32} />
            Click to add photos
            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>Up to 5 photos</span>
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />

          {/* Thumbnails */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {photoUrls.map((url, i) => (
              <div
                key={i}
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: 'var(--radius-card)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <img src={url} alt={`photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
            {photoUrls.length === 0 && [0, 1].map((i) => (
              <div
                key={i}
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: 'var(--radius-card)',
                  background: 'var(--ink-faint)',
                  border: '1.5px dashed var(--border-subtle)',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Right / mobile: form fields */}
        <div className="add-item-fields" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '480px', width: '100%', margin: '0 auto', overflowY: 'auto', paddingBottom: '32px' }}>
          <Input
            label="Title"
            placeholder="Give it a name"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          />

          <Input
            label="Its story"
            multiline
            placeholder="Where did you get it? Why are you trading it?"
            value={story}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStory(e.target.value)}
          />

          {/* Category chips */}
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', marginBottom: '10px' }}>Category</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {CATEGORIES.map((cat) => (
                <Tag key={cat} selected={category === cat} onSelect={() => setCategory(cat)}>
                  {cat}
                </Tag>
              ))}
            </div>
          </div>

          {/* Condition chips */}
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', marginBottom: '10px' }}>Condition</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {CONDITIONS.map((cond) => (
                <Tag key={cond.value} selected={condition === cond.value} onSelect={() => setCondition(cond.value)}>
                  {cond.label}
                </Tag>
              ))}
            </div>
          </div>

          {/* What do you want for it */}
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', marginBottom: '10px' }}>What do you want for it?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {wants.map((w, i) => (
                <Tag key={i} selected onRemove={() => removeWant(i)}>
                  {w}
                </Tag>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={wantInput}
                onChange={(e) => setWantInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addWant()}
                placeholder="e.g. vinyl records"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'var(--cream)',
                  border: '1.5px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-card)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  outline: 'none',
                }}
              />
              <button
                onClick={addWant}
                style={{
                  padding: '10px 14px',
                  background: 'var(--swapp-green)',
                  color: 'var(--parchment)',
                  border: 'none',
                  borderRadius: 'var(--radius-card)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <Button variant="primary" size="lg" fullWidth disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Put it on the table'}
          </Button>
        </div>
      </div>
    </main>
  )
}
