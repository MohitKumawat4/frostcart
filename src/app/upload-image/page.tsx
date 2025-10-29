'use client'

import { FormEvent, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface UploadFeedback {
  type: 'success' | 'error'
  message: string
}

export default function UploadImagePage() {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<UploadFeedback | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      setFeedback({
        type: 'error',
        message: 'You need to be signed in to upload images.'
      })
      return
    }

    const formData = new FormData(event.currentTarget)
    const file = formData.get('image') as File | null

    if (!file) {
      setFeedback({
        type: 'error',
        message: 'Please choose an image file before submitting.'
      })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      // Create a stable storage path so we can reference the uploaded file later.
      const uniqueId = crypto.randomUUID()
      const fileExtension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const baseObjectPath = `${user.id}/${uniqueId}`

      // Paths inside each bucket follow the requested `product image/user-id/image` convention.
      const primaryObjectKey = `${baseObjectPath}.${fileExtension}`
      const thumbnailObjectKey = `${baseObjectPath}_thumb.${fileExtension}`

      // Upload the original asset to the dedicated product image bucket.
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(primaryObjectKey, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream'
        })

      if (uploadError) {
        throw uploadError
      }

      const primaryPublic = supabase.storage
        .from('product-images')
        .getPublicUrl(primaryObjectKey)

      const primaryPublicUrl = primaryPublic.data.publicUrl

      // Attempt to place the same asset into the thumbnail bucket.
      let thumbnailPublicUrl: string | null = null
      let thumbnailStoragePath: string | null = null

      const { error: thumbnailError } = await supabase.storage
        .from('product-image-thumbnails')
        .upload(thumbnailObjectKey, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'application/octet-stream'
        })

      if (!thumbnailError) {
        const thumbnailPublic = supabase.storage
          .from('product-image-thumbnails')
          .getPublicUrl(thumbnailObjectKey)

        thumbnailPublicUrl = thumbnailPublic.data.publicUrl
        thumbnailStoragePath = `product-image-thumbnails/${thumbnailObjectKey}`
      } else {
        // The thumbnail will be generated later by a background job.
        console.warn('Thumbnail upload failed, keeping thumbnail fields nullable', thumbnailError.message)
      }

      // Persist a companion record so the AI pipeline can process it later.
      const { error: insertError } = await supabase
        .from('product_images')
        .insert({
          image_urls: [primaryPublicUrl],
          primary_image_url: primaryPublicUrl,
          thumbnail_url: thumbnailPublicUrl,
          storage_bucket: 'product-images',
          storage_path: `product-images/${primaryObjectKey}`,
          thumbnail_path: thumbnailStoragePath,
          source: 'manual-upload',
          status: 'uploaded'
        })

      if (insertError) {
        throw insertError
      }

      setFeedback({
        type: 'success',
        message: 'Image uploaded successfully. You can now review the AI metadata once generated.'
      })
      event.currentTarget.reset()
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error?.message ?? 'Unexpected error while uploading the image.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold">Upload Product Imagery</h1>
        <p className="text-sm text-muted-foreground">
          Upload raw assets to seed AI-assisted product creation. Accepted formats: JPEG, PNG, WebP.
        </p>
      </header>

      {!user && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Sign in to access the uploader.
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="image">
            Product image
          </label>
          <input
            accept="image/*"
            className="cursor-pointer rounded-md border border-dashed border-muted-foreground px-4 py-8 text-center text-sm"
            id="image"
            name="image"
            type="file"
            disabled={isSubmitting || !user}
          />
        </div>

        <button
          className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || !user}
          type="submit"
        >
          {isSubmitting ? 'Uploading…' : 'Upload image'}
        </button>
      </form>

      {feedback && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <section className="rounded-md border px-4 py-3 text-xs text-muted-foreground">
        <p>
          Uploaded assets are stored under <code>product-images/{`{userId}`}/{`{imageId}`}</code> and mirrored for
          thumbnails. Once AI processing finishes, metadata will populate automatically.
        </p>
      </section>
    </main>
  )
}
