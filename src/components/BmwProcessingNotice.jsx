export default function BmwProcessingNotice({ settings, message = 'Loading BMW System' }) {
  return <div className="bmw-processing-notice" role="status" aria-live="polite"><span className="bmw-processing-logo-frame">{settings?.hospitalLogoUrl ? <img src={settings.hospitalLogoUrl} alt="" className="bmw-processing-logo" /> : <span className="bmw-processing-logo-fallback">BMW</span>}</span><span className="bmw-processing-copy"><strong>{message}</strong><span className="bmw-processing-dots" aria-hidden="true" /></span></div>
}
