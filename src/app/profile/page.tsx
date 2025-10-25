'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Edit2,
  Save,
  X,
  IceCream,
  LogOut,
  ShoppingBag,
  Heart,
  MapPin
} from 'lucide-react'
import { useAuth } from '@/lib/auth'

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, signOut, updateProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [isSaving, setIsSaving] = useState(false)

  // Redirect if not authenticated
  if (!user) {
    router.push('/auth?mode=signin')
    return null
  }

  const handleSave = async () => {
    setIsSaving(true)
    const { error } = await updateProfile({ full_name: fullName })
    if (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } else {
      setIsEditing(false)
    }
    setIsSaving(false)
  }

  const handleCancel = () => {
    setFullName(profile?.full_name || '')
    setIsEditing(false)
  }

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      console.error('Error signing out:', error)
    } else {
      router.push('/')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-[#f6f5f4]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#e5e5e5]">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#6b6b6b] hover:text-[#111111] transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </Link>
            </div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111111] text-white">
                <IceCream className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold hidden sm:inline">FrostCart</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-3 py-8 sm:px-4">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl border border-[#e4e4e4] p-6 sm:p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-[#111111] flex items-center justify-center text-white text-2xl font-semibold">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-[#111111]">
                  {profile?.full_name || 'User'}
                </h1>
                <p className="text-[#6b6b6b] mt-1">{user.email}</p>
              </div>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[#111111] px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#111111] hover:text-white"
              >
                <Edit2 className="h-4 w-4" />
                Edit Profile
              </button>
            )}
          </div>

          {/* Account Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#111111] mb-4">Account Details</h2>
            
            {/* Full Name */}
            <div className="flex items-center gap-3 p-4 bg-[#f8f8f8] rounded-xl">
              <User className="h-5 w-5 text-[#6b6b6b]" />
              <div className="flex-1">
                <p className="text-xs text-[#6b6b6b] mb-1">Full Name</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white border border-[#e4e4e4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
                    placeholder="Enter your full name"
                  />
                ) : (
                  <p className="font-medium text-[#111111]">
                    {profile?.full_name || 'Not set'}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 p-4 bg-[#f8f8f8] rounded-xl">
              <Mail className="h-5 w-5 text-[#6b6b6b]" />
              <div className="flex-1">
                <p className="text-xs text-[#6b6b6b] mb-1">Email Address</p>
                <p className="font-medium text-[#111111]">{user.email}</p>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-center gap-3 p-4 bg-[#f8f8f8] rounded-xl">
              <Calendar className="h-5 w-5 text-[#6b6b6b]" />
              <div className="flex-1">
                <p className="text-xs text-[#6b6b6b] mb-1">Member Since</p>
                <p className="font-medium text-[#111111]">
                  {user.created_at ? formatDate(user.created_at) : 'N/A'}
                </p>
              </div>
            </div>

            {/* Edit Actions */}
            {isEditing && (
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-[#111111] text-white px-4 py-3 rounded-xl font-semibold hover:bg-[#222222] transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 border border-[#e4e4e4] px-4 py-3 rounded-xl font-semibold text-[#6b6b6b] hover:bg-[#f8f8f8] transition disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <Link
            href="/cart"
            className="bg-white rounded-2xl border border-[#e4e4e4] p-6 hover:shadow-lg transition group"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-[#f8f8f8] flex items-center justify-center group-hover:bg-[#111111] transition">
                <ShoppingBag className="h-6 w-6 text-[#111111] group-hover:text-white transition" />
              </div>
              <div>
                <h3 className="font-semibold text-[#111111]">My Cart</h3>
                <p className="text-sm text-[#6b6b6b]">View your cart items</p>
              </div>
            </div>
          </Link>

          <div className="bg-white rounded-2xl border border-[#e4e4e4] p-6 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-[#f8f8f8] flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-[#6b6b6b]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#111111]">My Orders</h3>
                <p className="text-sm text-[#6b6b6b]">Coming soon</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e4e4e4] p-6 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-[#f8f8f8] flex items-center justify-center">
                <Heart className="h-6 w-6 text-[#6b6b6b]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#111111]">Wishlist</h3>
                <p className="text-sm text-[#6b6b6b]">Coming soon</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e4e4e4] p-6 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-[#f8f8f8] flex items-center justify-center">
                <MapPin className="h-6 w-6 text-[#6b6b6b]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#111111]">Addresses</h3>
                <p className="text-sm text-[#6b6b6b]">Coming soon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <div className="bg-white rounded-2xl border border-[#e4e4e4] p-6">
          <button
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-red-700 transition"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
