import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

export default function DataLoadingOverlay({ message = 'Loading records, please wait' }) {
  return <div className="data-loading-overlay" role="status" aria-live="polite"><FontAwesomeIcon icon={faSpinner} className="data-loading-spinner text-2xl" aria-hidden="true" /><span className="data-loading-message">{message}</span></div>
}
