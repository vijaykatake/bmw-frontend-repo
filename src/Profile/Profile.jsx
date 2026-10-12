const fallbackPhoto = '/assets/images/profile/MyProfile.png'

export default function Profile({ profile }) {
  const photo = profile?.userPhoto && /^[a-zA-Z0-9._-]+$/.test(profile.userPhoto)
    ? `/assets/images/profile/${encodeURIComponent(profile.userPhoto)}`
    : fallbackPhoto

  return (
    <section className="max-w-2xl rounded-2xl p-6 shadow-sm ring-1" style={{ background: 'var(--app-content-bg)', '--tw-ring-color': 'var(--app-border)' }}>
      <div className="flex items-center gap-4">
        <img src={photo} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackPhoto }} className="h-20 w-20 rounded-full border-2 object-cover" style={{ borderColor: 'var(--app-border)' }} alt="User profile" />
        <div>
          <h2 className="text-2xl font-bold">{profile?.userName ?? 'Profile'}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--app-muted-text)' }}>{profile?.roleName ?? 'User'}</p>
        </div>
      </div>
      <dl className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-2" style={{ borderColor: 'var(--app-border)' }}>
        <div><dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--app-muted-text)' }}>Login ID</dt><dd className="mt-1 text-sm">{profile?.loginId}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--app-muted-text)' }}>Email</dt><dd className="mt-1 text-sm">{profile?.email}</dd></div>
      </dl>
    </section>
  )
}
