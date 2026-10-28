import { useEffect, useRef, useState } from "react"
import {
  ALL_SYMPTOMS,
  POPULAR_SYMPTOM_FEATURES,
  getSymptomLabel,
  searchSymptoms,
  type SymptomItem,
} from "./data/symptoms"
import {
  clearAuthSession,
  fetchCurrentUser,
  getAuthToken,
  getStoredUser,
  logoutPatient,
  predictSymptoms,
} from "./api"
import { AuthPage } from "./components/AuthPage"
import { WelcomePopup } from "./components/WelcomePopup"
import { LanguageSelector } from "./components/LanguageSelector"
import {
  translations,
  getStoredLanguage,
  setStoredLanguage,
  type Language,
  type Translations,
} from "./translations"
import type {
  ApiError,
  MedicineRecord,
  NotificationItem,
  PatientUser,
  PredictionSuccessResponse,
} from "./types"

type Screen = "dashboard" | "checker" | "results" | "medicines" | "about"
type IconName = "activity" | "alert" | "arrow" | "bell" | "brain" | "chart" | "check" | "chevron" | "close" | "dashboard" | "dots" | "filter" | "heart" | "info" | "logout" | "menu" | "medicine" | "pulse" | "search" | "shield" | "sparkles" | "user"

const navItems: { id: Screen; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "checker", label: "Symptom Checker", icon: "activity" },
  { id: "results", label: "Prediction Results", icon: "chart" },
  { id: "medicines", label: "Medicine Information", icon: "medicine" },
  { id: "about", label: "About the Project", icon: "info" },
]

const featureCards: {
  icon: IconName
  title: string
  text: string
  tone: string
}[] = [
  {
    icon: "activity",
    title: "Condition Prediction",
    text: "Explore model-based patterns from selected symptoms.",
    tone: "blue",
  },
  {
    icon: "brain",
    title: "Explainable AI",
    text: "See which inputs influenced the model's output.",
    tone: "violet",
  },
  {
    icon: "medicine",
    title: "Medicine Information",
    text: "Review records available in the connected dataset.",
    tone: "teal",
  },
  {
    icon: "shield",
    title: "Safety Information",
    text: "Read clearly labelled medicine safety information.",
    tone: "amber",
  },
]

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    activity: <path d="M3 12h4l2.2-6 4.2 12 2.3-6H21" />,
    alert: (
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.6 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
    bell: (
      <>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </>
    ),
    brain: (
      <>
        <path d="M9.5 4A3.5 3.5 0 0 0 6 7.5v.3A3.5 3.5 0 0 0 5 14.5 3.5 3.5 0 0 0 9.5 20" />
        <path d="M14.5 4A3.5 3.5 0 0 1 18 7.5v.3a3.5 3.5 0 0 1 1 6.7 3.5 3.5 0 0 1-4.5 5.5" />
        <path d="M12 3v18M8 10h4M12 14h4" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19H2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    dots: (
      <>
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
      </>
    ),
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    heart: (
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    medicine: (
      <>
        <path d="M10.5 6.5 17.5 13.5" />
        <path d="M8.4 19.6a5 5 0 0 1-7-7l9.2-9.2a5 5 0 0 1 7 7Z" />
        <path d="M14 17h7M17.5 13.5v7" />
      </>
    ),
    pulse: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3-1.2 3.8L7 8l3.8 1.2L12 13l1.2-3.8L17 8l-3.8-1.2Z" />
        <path d="m5 15-.7 2.3L2 18l2.3.7L5 21l.7-2.3L8 18l-2.3-.7Z" />
      </>
    ),
    user: (
      <>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  }
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function Brand({
  compact = false,
  title = "AI Medicine",
  subtitle = "Information System",
}: {
  compact?: boolean
  title?: string
  subtitle?: string
}) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <div className="brand-mark">
        <span className="cross-v" />
        <span className="cross-h" />
        <span className="ai-dot dot-a" />
        <span className="ai-dot dot-b" />
        <span className="ai-dot dot-c" />
      </div>
      {!compact && (
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  )
}

function Button({
  children,
  variant = "primary",
  icon,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "text"
  icon?: IconName
  onClick?: () => void
  disabled?: boolean
  type?: "button" | "submit"
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      {icon && <Icon name={icon} size={17} />}
    </button>
  )
}

function getUserInitials(name?: string): string {
  if (!name || !name.trim()) return "PT"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function PageHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">AI-powered decision support</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  )
}

function TopBar({
  screen,
  onOpenMenu,
  currentUser,
  onLogout,
  lang,
  onLanguageChange,
  t,
}: {
  screen: Screen
  onOpenMenu: () => void
  currentUser: PatientUser | null
  onLogout: () => void
  lang: Language
  onLanguageChange: (lang: Language) => void
  t: Translations
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "1",
      title: "Model Pipeline Online",
      message:
        "FastAPI + scikit-learn decision-support model operational with 132 features.",
      timestamp: "10m ago",
      isRead: false,
      type: "system",
    },
    {
      id: "2",
      title: "Clinical Guidance",
      message:
        "Always review contraindications with a healthcare professional before making decisions.",
      timestamp: "1h ago",
      isRead: false,
      type: "guidance",
    },
    {
      id: "3",
      title: "Security Verified",
      message:
        "Your patient account is secured with cryptographic token authentication.",
      timestamp: "Today",
      isRead: true,
      type: "security",
    },
  ])

  const popoverRef = useRef<HTMLDivElement>(null)

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false)
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    )
  }

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  const titles: Record<Screen, { title: string; subtitle: string }> = {
    dashboard: {
      title: t.dashboardTitle,
      subtitle: t.dashboardSubtitle,
    },
    checker: {
      title: t.checkerTitle,
      subtitle: t.checkerSubtitle,
    },
    results: {
      title: t.resultsTitle,
      subtitle: t.resultsSubtitle,
    },
    medicines: {
      title: t.medicinesTitle,
      subtitle: t.medicinesSubtitle,
    },
    about: {
      title: t.aboutTitle,
      subtitle: t.aboutSubtitle,
    },
  }

  const meta = titles[screen] || titles.dashboard
  const initials = getUserInitials(currentUser?.full_name)
  const userName = currentUser?.full_name || "Patient"

  return (
    <header className="top-header">
      <div className="top-header-left">
        <button
          type="button"
          className="mobile-menu-trigger"
          onClick={onOpenMenu}
          aria-label="Open sidebar menu"
        >
          <Icon name="menu" size={22} />
        </button>
        <div>
          <h1 className="screen-title">{meta.title}</h1>
          <p className="screen-subtitle">{meta.subtitle}</p>
        </div>
      </div>

      

      <div className="top-header-right" ref={popoverRef}>
        {/* 3-Language Selector: English, Marathi, Hindi */}
        <LanguageSelector
          currentLang={lang}
          onLanguageChange={onLanguageChange}
        />

        {/* Functional Notification Button */}
        <button
          type="button"
          className={`notification-btn ${notificationsOpen ? "active" : ""}`}
          aria-label="Notifications"
          title={
            unreadCount > 0
              ? `${unreadCount} unread notification(s)`
              : "Notifications"
          }
          onClick={() => {
            setNotificationsOpen(!notificationsOpen)
            setUserMenuOpen(false)
          }}
        >
          <Icon name="bell" size={19} />
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount}</span>
          )}
        </button>

        {/* Notifications Popover Dropdown */}
        {notificationsOpen && (
          <div
            className="notification-popover"
            role="region"
            aria-label="Notifications Panel"
          >
            <div className="notification-header">
              <strong>
                Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
              </strong>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-mark-all"
                  onClick={markAllNotificationsRead}
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="notification-empty">
                  <div className="notification-empty-icon">
                    <Icon name="bell" size={22} />
                  </div>
                  <strong>All caught up!</strong>
                  <p>No notifications available at this time.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    className={`notification-item ${
                      !notif.isRead ? "notification-item--unread" : ""
                    }`}
                    onClick={() => markNotificationRead(notif.id)}
                  >
                    <div
                      className={`notification-icon-wrapper notification-icon-wrapper--${notif.type}`}
                    >
                      <Icon
                        name={
                          notif.type === "security"
                            ? "shield"
                            : notif.type === "guidance"
                              ? "heart"
                              : "activity"
                        }
                        size={16}
                      />
                    </div>
                    <div className="notification-content">
                      <div className="notification-title-row">
                        <strong>{notif.title}</strong>
                        <span className="notification-time">
                          {notif.timestamp}
                        </span>
                      </div>
                      <p>{notif.message}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Dynamic Authenticated User Profile Button */}
        <button
          type="button"
          className={`user-profile-btn ${userMenuOpen ? "active" : ""}`}
          onClick={() => {
            setUserMenuOpen(!userMenuOpen)
            setNotificationsOpen(false)
          }}
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
        >
          <div
            className="user-avatar"
            aria-label="Authenticated patient avatar"
          >
            <span>{initials}</span>
            <span className="online-indicator" />
          </div>
          <div className="user-meta">
            <strong>{userName}</strong>
            <small>{t.patientAccount}</small>
          </div>
          <Icon name="chevron" size={14} />
        </button>

        {/* User Dropdown Menu with Logout */}
        {userMenuOpen && (
          <div className="user-dropdown" role="menu">
            <div className="user-dropdown-info">
              <strong>{userName}</strong>
              <small>{currentUser?.email}</small>
              <div className="user-dropdown-meta">
                {currentUser?.age ? (
                  <span className="user-meta-pill">
                    Age: {currentUser.age} yrs
                  </span>
                ) : null}
                <span className="user-meta-pill">
                  {t.patientAccount} #{currentUser?.id}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="user-dropdown-btn user-dropdown-btn--logout"
              onClick={() => {
                setUserMenuOpen(false)
                onLogout()
              }}
              role="menuitem"
            >
              <Icon name="logout" size={16} />
              <span>{t.signOut}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

function Notice({
  children,
  kind = "info",
}: {
  children: React.ReactNode
  kind?: "info" | "warning" | "error"
}) {
  return (
    <div
      className={`notice notice--${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon name={kind === "info" ? "info" : "alert"} size={19} />
      <div>{children}</div>
    </div>
  )
}

function SymptomPanel({
  selected,
  setSelected,
  onAnalyse,
  disabled = false,
  spacious = false,
}: {
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  onAnalyse: (symptoms?: string[]) => void
  disabled?: boolean
  spacious?: boolean
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close suggestions when user clicks anywhere outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const trimmedQuery = query.trim()

  // Search matches across 132 model features and common synonyms (only when query is typed, top 5)
  const searchMatches: SymptomItem[] = trimmedQuery
    ? searchSymptoms(trimmedQuery, selected).slice(0, 5)
    : []

  // Popular unselected symptoms for quick inline selection
  const popularUnselected = ALL_SYMPTOMS.filter(
    (item) =>
      POPULAR_SYMPTOM_FEATURES.includes(item.feature) &&
      !selected.includes(item.feature),
  ).slice(0, 6)

  const add = (featureKey: string) => {
    if (!selected.includes(featureKey)) {
      setSelected((current) => [...current, featureKey])
    }
    setQuery("")
    setOpen(false)
    setError("")
  }

  const analyse = () => {
    let symptomsToRun = [...selected]
    // If user has typed a recognized symptom but hasn't clicked it, include it automatically
    if (trimmedQuery && searchMatches.length > 0) {
      const match = searchMatches[0]
      if (!symptomsToRun.includes(match.feature)) {
        symptomsToRun = [...symptomsToRun, match.feature]
        setSelected(symptomsToRun)
      }
      setQuery("")
      setOpen(false)
    }

    if (!symptomsToRun.length) {
      setError("Select at least one symptom before continuing.")
      return
    }
    setError("")
    setOpen(false)
    onAnalyse(symptomsToRun)
  }

  const pendingTypedMatch =
    trimmedQuery &&
    searchMatches.length > 0 &&
    !selected.includes(searchMatches[0].feature)
  const effectiveCount = selected.length + (pendingTypedMatch ? 1 : 0)
  const isButtonDisabled = disabled || effectiveCount === 0

  return (
    <section
      className={`card symptom-panel ${
        spacious ? "symptom-panel--spacious" : ""
      }`}
    >
      <div className="section-heading">
        <div>
          <span className="section-kicker">Symptom input</span>
          <h2>Select what you are experiencing</h2>
          <p>
            Search across 132 model-supported symptoms. You can remove symptoms
            at any time.
          </p>
        </div>
        {!!selected.length && (
          <button
            className="text-button"
            onClick={() => setSelected([])}
            disabled={disabled}
            type="button"
          >
            Clear all ({selected.length})
          </button>
        )}
      </div>

      <div className="symptom-search-wrapper" ref={containerRef}>
        <div className="symptom-field">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
              setError("")
            }}
            onFocus={() => {
              if (query.trim()) {
                setOpen(true)
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                if (searchMatches[0]) {
                  add(searchMatches[0].feature)
                } else if (selected.length > 0) {
                  analyse()
                }
              } else if (event.key === "Escape") {
                setOpen(false)
              }
            }}
            placeholder="Search symptoms, e.g. itching, skin rash, mild fever, breathlessness"
            aria-label="Search symptoms"
            aria-expanded={open && !!trimmedQuery}
            disabled={disabled}
          />
          {query && (
            <button
              type="button"
              className="field-clear"
              aria-label="Clear search"
              onClick={() => {
                setQuery("")
                setOpen(false)
              }}
            >
              <Icon name="close" size={16} />
            </button>
          )}

          {open && !!trimmedQuery && (
            <div className="suggestions" role="listbox">
              {searchMatches.length ? (
                searchMatches.map((item) => (
                  <button
                    key={item.feature}
                    onClick={() => add(item.feature)}
                    type="button"
                    role="option"
                  >
                    <span className="suggestion-icon">+</span>
                    <div>
                      <strong>{item.label}</strong>
                    </div>
                    <span>Add symptom</span>
                  </button>
                ))
              ) : (
                <div className="suggestion-empty">
                  <strong>Symptom not recognized</strong>
                  <span>
                    Try another term from the supported 132 symptom features
                    (e.g. mild fever, cough, joint pain).
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {popularUnselected.length > 0 && (
          <div className="quick-suggestions" aria-label="Popular symptoms">
            <span className="quick-suggestions-label">Popular:</span>
            {popularUnselected.map((item) => (
              <button
                key={item.feature}
                type="button"
                className="quick-chip"
                onClick={() => add(item.feature)}
                disabled={disabled}
              >
                + {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="selected-area">
        <div className="selected-area-header">
          <div className="selected-area-title">
            <span className="selected-area-label">Selected Symptoms</span>
            {selected.length > 0 && (
              <span className="selected-count-badge">
                {selected.length}{" "}
                {selected.length === 1 ? "symptom" : "symptoms"}
              </span>
            )}
          </div>
          {!!selected.length && (
            <button
              className="text-button"
              onClick={() => setSelected([])}
              disabled={disabled}
              type="button"
            >
              Clear all
            </button>
          )}
        </div>

        {selected.length ? (
          <div className="chips" aria-label="Selected symptoms">
            {selected.map((featureKey) => (
              <span className="chip" key={featureKey}>
                <Icon name="check" size={14} />
                {getSymptomLabel(featureKey)}
                <button
                  type="button"
                  aria-label={`Remove ${getSymptomLabel(featureKey)}`}
                  onClick={() =>
                    setSelected((current) =>
                      current.filter((value) => value !== featureKey),
                    )
                  }
                  disabled={disabled}
                >
                  <Icon name="close" size={13} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            <div className="empty-icon">
              <Icon name="activity" />
            </div>
            <div>
              <strong>No symptoms selected</strong>
              <span>
                Search above or click popular symptoms to begin your analysis.
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="field-error">
          <Icon name="alert" size={15} />
          {error}
        </p>
      )}

      {/* Action row placed directly below selected-symptoms area */}
      <div className="panel-actions" id="analyse-actions">
        <div className="panel-actions-info">
          <Icon name="shield" size={16} />
          <span>
            {effectiveCount === 0
              ? "Select at least one symptom to analyse."
              : `${effectiveCount} symptom${
                  effectiveCount === 1 ? "" : "s"
                } ready for evaluation.`}
          </span>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--analyse"
          onClick={analyse}
          disabled={isButtonDisabled}
          aria-label={
            effectiveCount > 0
              ? `Analyse Symptoms (${effectiveCount})`
              : "Analyse Symptoms"
          }
        >
          <span>
            {effectiveCount > 0
              ? `Analyse Symptoms (${effectiveCount})`
              : "Analyse Symptoms"}
          </span>
          <Icon name="arrow" size={17} />
        </button>
      </div>
    </section>
  )
}

function Dashboard({
  selected,
  setSelected,
  onAnalyse,
  navigate,
  disabled,
}: {
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  onAnalyse: (symptoms?: string[]) => void
  navigate: (screen: Screen) => void
  disabled: boolean
}) {
  const benchmarkConditions = [
    {
      name: "Fungal Infection",
      category: "Dermatological",
      symptoms: ["itching", "skin_rash", "nodal_skin_eruptions"],
      symptomLabels: ["Itching", "Skin Rash", "Nodal Skin Eruptions"],
      medicines: "3 Formulations",
      status: "Safe with Precaution",
      statusColor: "active",
    },
    {
      name: "Bronchial Asthma",
      category: "Respiratory",
      symptoms: ["fatigue", "cough", "high_fever", "breathlessness"],
      symptomLabels: ["Fatigue", "Cough", "High Fever", "Breathlessness"],
      medicines: "4 Formulations",
      status: "Inhaler Protocol",
      statusColor: "",
    },
    {
      name: "Diabetes",
      category: "Endocrine & Metabolic",
      symptoms: ["fatigue", "weight_loss", "restlessness", "excessive_hunger"],
      symptomLabels: [
        "Fatigue",
        "Weight Loss",
        "Restlessness",
        "Excessive Hunger",
      ],
      medicines: "5 Formulations",
      status: "Chronic Protocol",
      statusColor: "active",
    },
    {
      name: "GERD (Acid Reflux)",
      category: "Gastrointestinal",
      symptoms: ["stomach_pain", "acidity", "ulcers_on_tongue", "vomiting"],
      symptomLabels: ["Stomach Pain", "Acidity", "Tongue Ulcers", "Vomiting"],
      medicines: "2 Formulations",
      status: "OTC / Prescription",
      statusColor: "",
    },
  ]

  const handleTestCondition = (conditionSymptoms: string[]) => {
    setSelected(conditionSymptoms)
    navigate("checker")
  }

  return (
    <>
      {/* Welcome Hero Banner */}
      <section className="dashboard-welcome">
        <div className="welcome-copy">
          <span className="welcome-pill">
            <Icon name="sparkles" size={14} /> Model Inference v2.4 Active
          </span>
          <h2>Clinical AI Decision-Support Platform</h2>
          <p>
            Evaluate multi-symptom presentations across 132 validated clinical
            features using scikit-learn logistic regression, explainable AI
            attribution vectors, and pharmacology safety verification.
          </p>
          <div className="welcome-actions">
            <Button onClick={() => navigate("checker")} icon="arrow">
              Launch Symptom Checker
            </Button>
            <button
              type="button"
              className="btn btn--secondary-blue"
              onClick={() => navigate("about")}
            >
              System Architecture
            </button>
          </div>
        </div>
      </section>

      {/* Row 1: Top Metrics Grid */}
      <section className="dashboard-grid-top">
        {/* Activity Overview Card */}
        <article className="card activity-card">
          <div className="card-header-row">
            <div>
              <span className="section-kicker">Metrics</span>
              <h3>Activity Overview</h3>
            </div>
            <button
              type="button"
              className="card-dots-btn"
              aria-label="Card options"
            >
              <Icon name="dots" size={16} />
            </button>
          </div>
          <div className="activity-stat-grid">
            <div className="stat-box">
              <div className="stat-icon-wrapper stat-icon--blue">
                <Icon name="activity" size={20} />
              </div>
              <div className="stat-details">
                <strong>132</strong>
                <span>Clinical Features</span>
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-icon-wrapper stat-icon--red">
                <Icon name="pulse" size={20} />
              </div>
              <div className="stat-details">
                <strong>41</strong>
                <span>Target Diseases</span>
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-icon-wrapper stat-icon--purple">
                <Icon name="brain" size={20} />
              </div>
              <div className="stat-details">
                <strong>100%</strong>
                <span>XAI Transparency</span>
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-icon-wrapper stat-icon--navy">
                <Icon name="medicine" size={20} />
              </div>
              <div className="stat-details">
                <strong>1,000+</strong>
                <span>Medicine Records</span>
              </div>
            </div>
          </div>
        </article>

        {/* Symptom Architecture Donut Card */}
        <article className="card donut-card">
          <div className="card-header-row">
            <div>
              <span className="section-kicker">Taxonomy</span>
              <h3>Symptom Distribution</h3>
            </div>
            <span className="card-pill-btn">Categories</span>
          </div>
          <div className="donut-layout">
            <div className="donut-chart-container">
              <svg className="donut-svg" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#2563eb"
                  strokeWidth="12"
                  strokeDasharray="83.56 238.76"
                  strokeDashoffset="0"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#ff5138"
                  strokeWidth="12"
                  strokeDasharray="59.69 238.76"
                  strokeDashoffset="-83.56"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#0d9488"
                  strokeWidth="12"
                  strokeDasharray="47.75 238.76"
                  strokeDashoffset="-143.25"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#7c3aed"
                  strokeWidth="12"
                  strokeDasharray="47.75 238.76"
                  strokeDashoffset="-191"
                />
              </svg>
              <div className="donut-center-text">
                <strong>132</strong>
                <span>Symptoms</span>
              </div>
            </div>

            <div className="donut-legend">
              <div className="legend-item">
                <div className="legend-dot-label">
                  <span
                    className="legend-dot"
                    style={{ background: "#2563eb" }}
                  />
                  <span>General</span>
                </div>
                <strong>35%</strong>
              </div>
              <div className="legend-item">
                <div className="legend-dot-label">
                  <span
                    className="legend-dot"
                    style={{ background: "#ff5138" }}
                  />
                  <span>Dermatology</span>
                </div>
                <strong>25%</strong>
              </div>
              <div className="legend-item">
                <div className="legend-dot-label">
                  <span
                    className="legend-dot"
                    style={{ background: "#0d9488" }}
                  />
                  <span>Gastro</span>
                </div>
                <strong>20%</strong>
              </div>
              <div className="legend-item">
                <div className="legend-dot-label">
                  <span
                    className="legend-dot"
                    style={{ background: "#7c3aed" }}
                  />
                  <span>Respiratory</span>
                </div>
                <strong>20%</strong>
              </div>
            </div>
          </div>
        </article>

        {/* Navy Card: Popular Target Conditions */}
        <article className="card navy-card">
          <div className="card-header-row">
            <div>
              <span className="section-kicker" style={{ color: "#ff8a75" }}>
                Target Profiles
              </span>
              <h3>Top Disease Targets</h3>
            </div>
            <button
              type="button"
              className="card-dots-btn"
              aria-label="Card options"
            >
              <Icon name="dots" size={16} />
            </button>
          </div>
          <p className="navy-card-subtitle">
            Validated diagnostic classification benchmarks
          </p>
          <div className="navy-list">
            {[
              {
                name: "Fungal Infection",
                tag: "Dermatology",
                code: "DERM",
                active: true,
              },
              {
                name: "Bronchial Asthma",
                tag: "Pulmonology",
                code: "RESP",
                active: false,
              },
              {
                name: "Hypertension",
                tag: "Cardiology",
                code: "CARD",
                active: false,
              },
              {
                name: "Migraine",
                tag: "Neurology",
                code: "NEUR",
                active: false,
              },
              {
                name: "Diabetes",
                tag: "Endocrinology",
                code: "ENDO",
                active: true,
              },
            ].map((cond) => (
              <div className="navy-item" key={cond.name}>
                <div className="navy-item-left">
                  <div className="navy-item-avatar">{cond.code}</div>
                  <div className="navy-item-title">
                    <strong>{cond.name}</strong>
                    <span>{cond.tag}</span>
                  </div>
                </div>
                <span
                  className={`navy-status-pill ${cond.active ? "active" : ""}`}
                >
                  {cond.active ? "Calibrated" : "Trained"}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      

      {/* Row 3: Supported Disease Explorer Table */}
      <section className="card table-card">
        <div className="card-header-row">
          <div>
            <span className="section-kicker">Clinical Benchmarks</span>
            <h3>Supported Condition Profiles & Dataset Explorer</h3>
          </div>
          <button
            type="button"
            className="btn btn--secondary-blue"
            onClick={() => navigate("checker")}
          >
            Custom Symptom Evaluation
          </button>
        </div>
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Condition & Domain</th>
                <th>Primary Diagnostic Indicators</th>
                <th>Dataset Formulations</th>
                <th>Clinical Safety Priority</th>
                <th>Model Action</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkConditions.map((item) => (
                <tr key={item.name}>
                  <td>
                    <div className="condition-cell">
                      <div className="condition-icon-badge">
                        <Icon name="pulse" size={17} />
                      </div>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.category}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="symptom-tag-list">
                      {item.symptomLabels.map((sym) => (
                        <span className="symptom-tag" key={sym}>
                          {sym}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <strong style={{ color: "var(--navy)", fontSize: "12px" }}>
                      {item.medicines}
                    </strong>
                  </td>
                  <td>
                    <span
                      className={`status-pill-green ${
                        item.statusColor === "active" ? "" : ""
                      }`}
                    >
                      <i /> {item.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action-btn"
                      onClick={() => handleTestCondition(item.symptoms)}
                    >
                      <span>Load In Checker</span>
                      <Icon name="arrow" size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Embedded Live Symptom Panel on Dashboard */}
      <SymptomPanel
        selected={selected}
        setSelected={setSelected}
        onAnalyse={onAnalyse}
        disabled={disabled}
      />
    </>
  )
}

function Checker({
  selected,
  setSelected,
  onAnalyse,
  disabled,
}: {
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  onAnalyse: (symptoms?: string[]) => void
  disabled: boolean
}) {
  return (
    <>
      <PageHeader
        title="Symptom Checker"
        description="Choose symptoms that best match what you are experiencing, then submit them to the real prediction model."
      />
      <div className="stepper" aria-label="Analysis steps">
        <div className="step active">
          <span>1</span>
          <div>
            <strong>Select symptoms</strong>
            <small>Add one or more inputs</small>
          </div>
        </div>
        <i />
        <div className="step">
          <span>2</span>
          <div>
            <strong>Model analysis</strong>
            <small>FastAPI prediction</small>
          </div>
        </div>
        <i />
        <div className="step">
          <span>3</span>
          <div>
            <strong>Review insights</strong>
            <small>Predictions, XAI & medicines</small>
          </div>
        </div>
      </div>
      <SymptomPanel
        selected={selected}
        setSelected={setSelected}
        onAnalyse={onAnalyse}
        disabled={disabled}
        spacious
      />
      <div className="example-note">
        <Icon name="info" size={18} />
        <span>
          <strong>Example combination:</strong> "Itching" and "Skin rash" are
          valid inputs mapped to model features. Add them from search to run a
          real evaluation.
        </span>
      </div>
      <div className="state-preview">
        <h3>System capabilities</h3>
        <p>
          Real-time integration with FastAPI healthcare decision-support
          pipeline.
        </p>
        <div className="state-grid">
          <div>
            <span className="state-icon loading">
              <i />
            </span>
            <strong>Live prediction</strong>
            <small>Scikit-learn logistic regression pipeline.</small>
          </div>
          <div>
            <span className="state-icon error">
              <Icon name="alert" size={18} />
            </span>
            <strong>Validation layer</strong>
            <small>Checks inputs against 132 supported features.</small>
          </div>
          <div>
            <span className="state-icon error">
              <Icon name="shield" size={18} />
            </span>
            <strong>Safety checks</strong>
            <small>Retrieves medicine details and safety labels.</small>
          </div>
        </div>
      </div>
    </>
  )
}

function Results({
  selected,
  prediction,
  error,
  analysing,
  onRetry,
  onModify,
}: {
  selected: string[]
  prediction: PredictionSuccessResponse | null
  error: ApiError | null
  analysing: boolean
  onRetry: () => void
  onModify: () => void
}) {
  const [activeMedicineIndex, setActiveMedicineIndex] = useState(0)

  // If there's an error, show the error alert with retry
  if (error) {
    const isConn = error.type === "connection"
    const isVal = error.type === "validation"

    return (
      <>
        <PageHeader
          title="Prediction Results"
          description="Review the model output, feature contributions, and related information returned by the API."
        />
        <Notice kind="error">
          <strong>
            {isConn
              ? "Connection Error"
              : isVal
                ? "Symptom Validation Error"
                : "Server Error"}
          </strong>
          <span>{error.message}</span>
          {error.invalidSymptoms && error.invalidSymptoms.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span>Unrecognized symptoms: </span>
              <strong>{error.invalidSymptoms.join(", ")}</strong>
            </div>
          )}
          <div className="notice-action">
            <button
              className="notice-retry-btn"
              onClick={onRetry}
              disabled={analysing}
              type="button"
            >
              <Icon name="arrow" size={14} /> Retry Analysis
            </button>
            <button
              className="notice-secondary-btn"
              onClick={onModify}
              type="button"
            >
              <Icon name="activity" size={14} /> Change Symptoms
            </button>
          </div>
        </Notice>
      </>
    )
  }

  // If results are not yet loaded
  if (!prediction) {
    const displaySymptoms = selected.length
      ? selected.map((s) => getSymptomLabel(s))
      : ["No symptoms submitted yet"]

    return (
      <>
        <PageHeader
          title="Prediction Results"
          description="Review the model output, feature contributions, and related information returned by the API."
        />
        <Notice kind="info">
          <strong>Awaiting Analysis</strong>
          <span>
            Select symptoms in the checker and click "Analyse Symptoms" to run
            the real FastAPI prediction pipeline.
          </span>
          <div className="notice-action">
            <button
              className="notice-retry-btn"
              style={{ background: "var(--blue)" }}
              onClick={onRetry}
              disabled={!selected.length || analysing}
              type="button"
            >
              <Icon name="arrow" size={14} /> Run Analysis Now
            </button>
          </div>
        </Notice>

        <section className="results-grid">
          <article className="card summary-card">
            <div className="card-title-row">
              <div>
                <span className="section-kicker">Prediction summary</span>
                <h2>Model output</h2>
              </div>
              <span className="status-badge">
                <i />
                Awaiting API
              </span>
            </div>
            <div className="prediction-placeholder">
              <span>Predicted condition</span>
              <strong>Not available yet</strong>
              <small>
                Run the prediction to evaluate patterns for your selected
                symptoms.
              </small>
            </div>
            <div className="confidence-row">
              <div>
                <span>Model confidence</span>
                <strong>—%</strong>
              </div>
              <div className="confidence-track">
                <span />
              </div>
              <p>
                Confidence is a model probability estimate, not clinical
                certainty.
              </p>
            </div>
            <div className="result-symptoms">
              <span>Selected symptoms</span>
              <div className="chips">
                {displaySymptoms.map((item) => (
                  <span className="chip chip--muted" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="card xai-card">
            <div className="card-title-row">
              <div>
                <span className="section-kicker">Explainable AI</span>
                <h2>Symptom contributions</h2>
              </div>
              <span className="legend">
                <i className="positive" />
                Positive <i className="negative" />
                Negative
              </span>
            </div>
            <div className="chart-empty">
              <div className="chart-axis">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <Icon name="chart" size={28} />
              <strong>Contribution data will appear here</strong>
              <span>
                Calculated feature coefficients will show how each symptom
                influenced the prediction.
              </span>
            </div>
            <p className="chart-caption">
              These values show how the input features contributed to the
              model's prediction. They do not establish medical causation.
            </p>
          </article>
        </section>

        <section className="card medicine-result">
          <div className="card-title-row">
            <div>
              <span className="section-kicker">Dataset records</span>
              <h2>Medicine information</h2>
            </div>
            <span className="neutral-badge">0 records loaded</span>
          </div>
          <div className="empty-block">
            <div className="empty-icon large">
              <Icon name="medicine" size={25} />
            </div>
            <h3>No medicine records to display</h3>
            <p>
              Medicine name, reported uses, composition, side effects,
              directions, and safety will appear when returned by the backend.
            </p>
          </div>
        </section>
      </>
    )
  }

  // --- Handle Emergency Warning Status ---
  if (prediction.prediction_status === "emergency_warning") {
    return (
      <>
        <PageHeader
          title="Prediction Results"
          description="Review the model output, feature contributions, and related information returned by the API."
        />
        <Notice kind="error">
          <strong style={{ fontSize: "16px", color: "var(--red, #ef4444)" }}>
            EMERGENCY ADVISORY: Potential Emergency Symptoms Detected
          </strong>
          <span style={{ fontSize: "14px", marginTop: "6px", display: "block" }}>
            {prediction.message ||
              "Potential emergency symptoms detected. Seek emergency medical care immediately. Do not wait for an AI prediction."}
          </span>
          <div className="notice-action" style={{ marginTop: "14px" }}>
            <button
              className="notice-retry-btn"
              style={{ background: "#ef4444" }}
              onClick={onModify}
              type="button"
            >
              <Icon name="activity" size={14} /> Change Symptoms
            </button>
          </div>
        </Notice>

        <section className="card" style={{ padding: "24px", marginTop: "16px", borderLeft: "4px solid #ef4444" }}>
          <h3 style={{ color: "#b91c1c", marginBottom: "8px" }}>Emergency Protocol Notice</h3>
          <p style={{ color: "#475569", lineHeight: "1.6" }}>
            Symptoms such as chest pain, breathlessness, and profuse sweating can indicate life-threatening conditions requiring acute emergency intervention. In accordance with clinical safety guidelines, machine learning predictions and medicine records are intentionally suppressed to avoid delay in seeking medical attention.
          </p>
          <div className="result-symptoms" style={{ marginTop: "16px" }}>
            <span>Reported symptoms</span>
            <div className="chips">
              {prediction.input_symptoms.map((symptomKey) => (
                <span className="chip chip--muted" key={symptomKey} style={{ borderColor: "#fca5a5" }}>
                  <Icon name="alert" size={13} />
                  {getSymptomLabel(symptomKey)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <Notice kind="warning">
          <strong>Medical safety notice</strong>
          <span>
            {prediction.disclaimer ||
              "Academic decision-support only. This is not a diagnosis or prescription. Consult a qualified healthcare professional."}
          </span>
        </Notice>
      </>
    )
  }

  // --- Handle Insufficient Symptoms Status (< 3 symptoms) ---
  if (prediction.prediction_status === "insufficient_input") {
    return (
      <>
        <PageHeader
          title="Prediction Results"
          description="Review the model output, feature contributions, and related information returned by the API."
        />
        <Notice kind="warning">
          <strong>Insufficient Symptoms For Evaluation</strong>
          <span style={{ display: "block", marginTop: "4px" }}>
            {prediction.message ||
              "Unable to provide a reliable prediction from fewer than 3 symptoms. Please select at least 3 distinct symptoms for evaluation, or consult a qualified healthcare professional."}
          </span>
          <div className="notice-action" style={{ marginTop: "14px" }}>
            <button
              className="notice-retry-btn"
              onClick={onModify}
              type="button"
            >
              <Icon name="activity" size={14} /> Add More Symptoms
            </button>
          </div>
        </Notice>

        <section className="card" style={{ padding: "24px", marginTop: "16px" }}>
          <h3 style={{ marginBottom: "8px" }}>Multi-Symptom Baseline Required</h3>
          <p style={{ color: "#475569", lineHeight: "1.6" }}>
            Our diagnostic classification pipeline requires at least 3 clinical features to safely compute pattern associations across 41 condition profiles. Isolated symptoms yield ambiguous classifications that do not meet system safety thresholds.
          </p>
          <div className="result-symptoms" style={{ marginTop: "16px" }}>
            <span>Currently selected ({prediction.input_symptoms.length})</span>
            <div className="chips">
              {prediction.input_symptoms.map((symptomKey) => (
                <span className="chip chip--muted" key={symptomKey}>
                  <Icon name="check" size={13} />
                  {getSymptomLabel(symptomKey)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <Notice kind="info">
          <strong>Academic decision-support disclaimer</strong>
          <span>
            {prediction.disclaimer ||
              "Academic decision-support only. This is not a diagnosis or prescription. Consult a qualified healthcare professional."}
          </span>
        </Notice>
      </>
    )
  }

  // --- Handle Uncertain Prediction Status (Confidence < 50%) ---
  if (prediction.prediction_status === "uncertain") {
    const confVal = prediction.model_confidence != null ? (prediction.model_confidence * 100).toFixed(1) : null
    return (
      <>
        <PageHeader
          title="Prediction Results"
          description="Review the model output, feature contributions, and related information returned by the API."
        />
        <Notice kind="warning">
          <strong>Uncertain Model Evaluation (Confidence Below 50%)</strong>
          <span style={{ display: "block", marginTop: "4px" }}>
            {prediction.message ||
              "Model confidence is below the provisional safety threshold (50%). Result withheld for safety."}
          </span>
          <div className="notice-action" style={{ marginTop: "14px" }}>
            <button
              className="notice-retry-btn"
              onClick={onModify}
              type="button"
            >
              <Icon name="activity" size={14} /> Review Selected Symptoms
            </button>
          </div>
        </Notice>

        <section className="card" style={{ padding: "24px", marginTop: "16px" }}>
          <h3 style={{ marginBottom: "8px" }}>Safety Threshold Safeguard Active</h3>
          <p style={{ color: "#475569", lineHeight: "1.6" }}>
            The combination of symptoms evaluated yielded a statistical confidence score of{" "}
            {confVal ? <strong>{confVal}%</strong> : "under 50%"}, which falls below our clinical verification cutoff. Condition prediction and medicine records are withheld to prevent misguidance.
          </p>
          <div className="result-symptoms" style={{ marginTop: "16px" }}>
            <span>Evaluated symptoms</span>
            <div className="chips">
              {prediction.input_symptoms.map((symptomKey) => (
                <span className="chip chip--muted" key={symptomKey}>
                  <Icon name="check" size={13} />
                  {getSymptomLabel(symptomKey)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <Notice kind="info">
          <strong>Academic decision-support disclaimer</strong>
          <span>
            {prediction.disclaimer ||
              "Academic decision-support only. This is not a diagnosis or prescription. Consult a qualified healthcare professional."}
          </span>
        </Notice>
      </>
    )
  }

  // --- Real prediction successfully loaded (Status: model_output_available) ---
  const confidencePercent =
    prediction.model_confidence != null
      ? (prediction.model_confidence * 100).toFixed(1)
      : "—" 
  const positiveContributions =
    prediction.xai_explanation?.positive_contributions || []
  const negativeContributions =
    prediction.xai_explanation?.negative_contributions || []

  const allContributions = [
    ...positiveContributions.map((c) => ({ ...c, type: "positive" as const })),
    ...negativeContributions.map((c) => ({ ...c, type: "negative" as const })),
  ].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

  const maxAbsContrib = Math.max(
    ...allContributions.map((c) => Math.abs(c.contribution)),
    0.001,
  )

  const medicines = prediction.medicine_information?.medicines || []
  const activeMedicine: MedicineRecord | undefined =
    medicines[activeMedicineIndex] || medicines[0]

  const safetyFields = [
    { key: "alcohol", label: "Alcohol" },
    { key: "pregnancy", label: "Pregnancy" },
    { key: "breast_feeding", label: "Breastfeeding" },
    { key: "driving", label: "Driving" },
    { key: "kidney", label: "Kidney" },
    { key: "liver", label: "Liver" },
  ]

  const getSafetyBadgeClass = (val: string) => {
    const u = (val || "").toUpperCase()
    if (u.includes("UNSAFE")) return "safety-value--unsafe"
    if (u.includes("CAUTION") || u.includes("CONSULT"))
      return "safety-value--caution"
    if (u.includes("SAFE")) return "safety-value--safe"
    return "safety-value--unknown"
  }

  return (
    <>
      <PageHeader
        title="Prediction Results"
        description="Review the model output, feature contributions, and related information returned by the API."
      />

      <Notice kind="info">
        <strong>Model Analysis Completed</strong>
        <span>
          Real-time condition prediction, explainability weights, and dataset
          safety records loaded from the backend API.
        </span>
      </Notice>

      <section className="results-grid">
        {/* Prediction summary */}
        <article className="card summary-card">
          <div className="card-title-row">
            <div>
              <span className="section-kicker">Prediction summary</span>
              <h2>Model output</h2>
            </div>
            <span className="status-badge status-badge--success">
              <i />
              Model Evaluated
            </span>
          </div>

          <div className="prediction-result-box">
            <span>Predicted condition</span>
            <strong>{prediction.predicted_condition}</strong>
            <small>
              Academic decision-support estimate based on input symptoms.
            </small>
          </div>

          <div className="confidence-row">
            <div>
              <span>Model confidence</span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  className={`confidence-badge ${
                    prediction.model_confidence >= 0.7
                      ? "confidence-badge--high"
                      : prediction.model_confidence >= 0.4
                        ? "confidence-badge--moderate"
                        : "confidence-badge--low"
                  }`}
                >
                  {prediction.model_confidence >= 0.7
                    ? "High confidence"
                    : prediction.model_confidence >= 0.4
                      ? "Moderate confidence"
                      : "Low confidence"}
                </span>
                <strong className="confidence-value">
                  {confidencePercent}%
                </strong>
              </div>
            </div>
            <div className="confidence-track">
              <span
                className="confidence-fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, prediction.model_confidence * 100),
                  )}%`,
                }}
              />
            </div>
            <p>
              Confidence is a model probability estimate, not clinical certainty
              or diagnosis.
            </p>
          </div>

          <div className="result-symptoms">
            <span>Evaluated symptoms</span>
            <div className="chips">
              {prediction.input_symptoms.map((symptomKey) => (
                <span className="chip chip--muted" key={symptomKey}>
                  <Icon name="check" size={13} />
                  {getSymptomLabel(symptomKey)}
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* Explainable AI */}
        <article className="card xai-card">
          <div className="card-title-row">
            <div>
              <span className="section-kicker">Explainable AI</span>
              <h2>Symptom contributions</h2>
            </div>
            <span className="legend">
              <i className="positive" />
              Positive <i className="negative" />
              Negative
            </span>
          </div>

          {allContributions.length > 0 ? (
            <div className="xai-contributions-list">
              {allContributions.map((item) => {
                const widthPercent = Math.min(
                  100,
                  (Math.abs(item.contribution) / maxAbsContrib) * 100,
                )
                const scoreFormatted =
                  item.contribution > 0
                    ? `+${item.contribution.toFixed(3)}`
                    : item.contribution.toFixed(3)

                return (
                  <div className="xai-item" key={item.symptom}>
                    <span
                      className="xai-item-label"
                      title={getSymptomLabel(item.symptom)}
                    >
                      {getSymptomLabel(item.symptom)}
                    </span>
                    <div className="xai-bar-track">
                      <div
                        className={`xai-bar-fill xai-bar-fill--${item.type}`}
                        style={{ width: `${Math.max(6, widthPercent)}%` }}
                      />
                    </div>
                    <span
                      className={`xai-item-score xai-item-score--${item.type}`}
                    >
                      {scoreFormatted}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="chart-empty">
              <Icon name="chart" size={28} />
              <strong>No active symptom contributions</strong>
              <span>Feature weights are not available for this input.</span>
            </div>
          )}

          <p className="chart-caption">
            These values show how the input features contributed to the model's
            prediction. They do not establish medical causation.
          </p>
          <div className="xai-guide">
            <strong>Interpreting feature contributions:</strong> Bars indicate
            relative mathematical weight toward or against the predicted
            condition. Blue represents positive support for this condition,
            while amber indicates dampening or divergent factor influence.
          </div>
        </article>
      </section>

      {/* Medicine information */}
      <section className="card medicine-result">
        <div className="card-title-row">
          <div>
            <span className="section-kicker">Dataset records</span>
            <h2>Medicine information</h2>
          </div>
          <span
            className={
              medicines.length
                ? "status-badge status-badge--success"
                : "neutral-badge"
            }
          >
            {medicines.length} record{medicines.length === 1 ? "" : "s"} loaded
          </span>
        </div>

        {medicines.length > 0 ? (
          <div>
            {medicines.length > 1 && (
              <div className="medicine-tabs" role="tablist">
                {medicines.map((m, idx) => (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={activeMedicineIndex === idx}
                    className={`medicine-tab-btn ${
                      activeMedicineIndex === idx ? "active" : ""
                    }`}
                    onClick={() => setActiveMedicineIndex(idx)}
                  >
                    {m.medicine_information.name || `Medicine ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            {activeMedicine && (
              <div className="medicine-card-item">
                <div className="medicine-card-header">
                  <div>
                    <h3>{activeMedicine.medicine_information.name}</h3>
                  </div>
                  {activeMedicine.medicine_information.manufacturer && (
                    <span className="manufacturer-badge">
                      {activeMedicine.medicine_information.manufacturer}
                    </span>
                  )}
                </div>

                <div className="medicine-card-grid">
                  <div className="medicine-card-detail">
                    <span>Reported Uses</span>
                    <p>
                      {activeMedicine.medicine_information.uses ||
                        "Information not available"}
                    </p>
                  </div>

                  <div className="medicine-card-detail">
                    <span>Composition</span>
                    <p>
                      {activeMedicine.medicine_information.composition ||
                        "Information not available"}
                    </p>
                  </div>

                  <div className="medicine-card-detail">
                    <span>Side Effects</span>
                    <p>
                      {activeMedicine.medicine_information.side_effects ||
                        "Information not available"}
                    </p>
                  </div>

                  <div className="medicine-card-detail">
                    <span>Directions / How to Use</span>
                    <p>
                      {activeMedicine.medicine_information.how_to_use ||
                        "Information not available"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-block">
            <div className="empty-icon large">
              <Icon name="medicine" size={25} />
            </div>
            <h3>No matching medicine records found</h3>
            <p>
              The dataset does not contain matching medicine records for "
              {prediction.predicted_condition}".
            </p>
          </div>
        )}
      </section>

      {/* Safety layer */}
      <section className="card safety-card">
        <div className="card-title-row">
          <div>
            <span className="section-kicker">Safety layer</span>
            <h2>Safety information</h2>
          </div>
          <Icon name="shield" size={23} />
        </div>

        <div className="safety-grid">
          {safetyFields.map(({ key, label }) => {
            const val =
              activeMedicine?.safety?.safety_information?.[key] ||
              "Information not available"

            return (
              <div className="safety-item" key={key}>
                <span>{label}</span>
                <span className={`safety-value ${getSafetyBadgeClass(val)}`}>
                  {val}
                </span>
              </div>
            )
          })}
        </div>

        {activeMedicine?.safety?.warnings &&
          activeMedicine.safety.warnings.length > 0 && (
            <div className="safety-warnings-box">
              <strong>
                <Icon name="alert" size={15} /> Dataset Safety Warnings
              </strong>
              <ul className="safety-warnings-list">
                {activeMedicine.safety.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

        <p className="missing-note">
          <Icon name="info" size={16} />
          Missing information in the dataset does not imply that a medicine is
          safe.
        </p>
      </section>

      <Notice kind="warning">
        <strong>Medical safety notice</strong>
        <span>
          {prediction.disclaimer ||
            "Academic decision-support only. This is not a diagnosis or prescription. Consult a qualified healthcare professional."}
        </span>
      </Notice>
    </>
  )
}

function Medicines({
  prediction,
}: {
  prediction: PredictionSuccessResponse | null
}) {
  const [query, setQuery] = useState("")
  const medicines = prediction?.medicine_information?.medicines || []

  const filteredMedicines = query.trim()
    ? medicines.filter(
        (m) =>
          m.medicine_information.name
            .toLowerCase()
            .includes(query.toLowerCase()) ||
          m.medicine_information.uses
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
    : medicines

  return (
    <>
      <PageHeader
        title="Medicine Information"
        description="Search medicine records and review information available in the connected academic dataset."
      />
      <Notice kind="warning">
        <strong>Information only</strong>
        <span>
          Always consult a qualified healthcare professional before using any
          medicine. This prototype does not prescribe medication.
        </span>
      </Notice>
      <section className="card medicine-search-card">
        <div className="search-label">
          <span className="section-kicker">Dataset search</span>
          <h2>Find medicine information</h2>
          <p>
            Filter retrieved records from your prediction analysis by medicine
            name.
          </p>
        </div>
        <div className="medicine-search">
          <Icon name="search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search medicine name..."
            aria-label="Search medicine information"
          />
          {query && (
            <button
              className="field-clear"
              onClick={() => setQuery("")}
              aria-label="Clear medicine search"
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
      </section>

      {medicines.length > 0 ? (
        <section className="medicine-cards-list" style={{ marginTop: 16 }}>
          {filteredMedicines.map((m, idx) => (
            <article className="card medicine-card-item" key={idx}>
              <div className="medicine-card-header">
                <div>
                  <span className="section-kicker">Retrieved record</span>
                  <h3>{m.medicine_information.name}</h3>
                </div>
                {m.medicine_information.manufacturer && (
                  <span className="manufacturer-badge">
                    {m.medicine_information.manufacturer}
                  </span>
                )}
              </div>
              <div className="medicine-card-grid">
                <div className="medicine-card-detail">
                  <span>Reported Uses</span>
                  <p>{m.medicine_information.uses}</p>
                </div>
                <div className="medicine-card-detail">
                  <span>Composition</span>
                  <p>{m.medicine_information.composition}</p>
                </div>
                <div className="medicine-card-detail">
                  <span>Side Effects</span>
                  <p>{m.medicine_information.side_effects}</p>
                </div>
                <div className="medicine-card-detail">
                  <span>Directions / How to Use</span>
                  <p>{m.medicine_information.how_to_use}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="medicine-layout">
          <article className="card medicine-empty">
            <div className="empty-illustration">
              <Icon name="medicine" size={34} />
              <span />
            </div>
            <h2>No prediction medicines loaded yet</h2>
            <p>
              Run an analysis on the Symptom Checker to retrieve matching
              medicine records and their safety profiles from the dataset.
            </p>
            <div className="data-list">
              {[
                "Reported uses",
                "Composition",
                "Side effects",
                "Directions",
                "Manufacturer",
              ].map((item) => (
                <span key={item}>
                  <Icon name="check" size={14} />
                  {item}
                </span>
              ))}
            </div>
          </article>
          <aside className="card dataset-note">
            <div className="feature-icon feature-icon--teal">
              <Icon name="shield" />
            </div>
            <h3>Responsible information</h3>
            <p>
              Records are presented as stored in the source dataset. Unavailable
              fields are clearly marked and never interpreted as evidence of
              safety.
            </p>
            <hr />
            <strong>Unavailable fields</strong>
            <span>"Information not available in the dataset."</span>
          </aside>
        </section>
      )}
    </>
  )
}

function About() {
  const flow = [
    ["activity", "User Symptoms"],
    ["check", "Input Validation"],
    ["brain", "Machine Learning Prediction"],
    ["chart", "Explainable AI"],
    ["medicine", "Medicine Information Retrieval"],
    ["shield", "Safety Information"],
    ["check", "Healthcare Professional Makes Final Medical Decisions"],
  ] as [IconName, string][]

  return (
    <>
      <PageHeader
        title="About the Project"
        description="An academic exploration of responsible AI-assisted health information and explainable machine learning."
      />
      <section className="about-hero">
        <div>
          <span className="section-kicker light">
            AI Medicine Information System
          </span>
          <h2>Making machine-learning outputs easier to understand</h2>
          <p>
            This project combines symptom input validation, model-based
            prediction, explainability, and structured medicine information in
            one clear decision-support interface.
          </p>
        </div>
        <div className="about-mark">
          <Brand compact />
          <span>
            Academic
            <br />
            Project
          </span>
        </div>
      </section>
      <section className="about-grid">
        <article className="card about-copy">
          <span className="section-kicker">Project purpose</span>
          <h2>Built for learning, designed responsibly</h2>
          <p>
            The system demonstrates how machine learning can support structured
            information discovery while keeping clinical decisions with
            qualified professionals.
          </p>
          <div className="purpose-list">
            {[
              [
                "brain",
                "Machine learning",
                "Condition patterns from validated symptom inputs.",
              ],
              [
                "chart",
                "Explainable AI",
                "Feature contributions that make model outputs more transparent.",
              ],
              [
                "medicine",
                "Medicine retrieval",
                "Structured information sourced from the project dataset.",
              ],
              [
                "shield",
                "Safety layer",
                "Prominent warnings and responsible missing-data states.",
              ],
            ].map(([icon, title, text]) => (
              <div key={title}>
                <span>
                  <Icon name={icon as IconName} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="card architecture">
          <span className="section-kicker">System architecture</span>
          <h2>From input to informed discussion</h2>
          <div className="flow">
            {flow.map(([icon, label], index) => (
              <div key={label}>
                <div
                  className={
                    index === flow.length - 1 ? "flow-item final" : "flow-item"
                  }
                >
                  <span>
                    <Icon name={icon} size={17} />
                  </span>
                  <strong>{label}</strong>
                </div>
                {index < flow.length - 1 && <Icon name="chevron" size={15} />}
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="card tech-card">
        <div>
          <span className="section-kicker">Technology stack</span>
          <h2>Practical, implementation-ready tools</h2>
        </div>
        <div className="tech-list">
          {[
            "Python",
            "Pandas",
            "Scikit-learn",
            "FastAPI",
            "React",
            "TypeScript",
            "Tailwind CSS",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>
      <Notice kind="warning">
        <strong>Academic project disclaimer</strong>
        <span>
          This system is for educational demonstration only. It is not a
          diagnostic tool, medical authority, or prescription generator.
        </span>
      </Notice>
    </>
  )
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<PatientUser | null>(() =>
    getStoredUser(),
  )
  const [authLoading, setAuthLoading] = useState(true)
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [lang, setLang] = useState<Language>(() => getStoredLanguage())
  const t = translations[lang] || translations.en

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang)
    setStoredLanguage(newLang)
  }

  const localizedNavItems: { id: Screen; label: string; icon: IconName }[] = [
    { id: "dashboard", label: t.navDashboard, icon: "dashboard" },
    { id: "checker", label: t.navChecker, icon: "activity" },
    { id: "results", label: t.navResults, icon: "chart" },
    { id: "medicines", label: t.navMedicines, icon: "medicine" },
    { id: "about", label: t.navAbout, icon: "info" },
  ]

  const [screen, setScreen] = useState<Screen>("dashboard")
  const [selected, setSelected] = useState<string[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [prediction, setPrediction] =
    useState<PredictionSuccessResponse | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      fetchCurrentUser()
        .then((user) => {
          setCurrentUser(user)
        })
        .catch((err: any) => {
          if (err?.statusCode === 401) {
            clearAuthSession()
            setCurrentUser(null)
          } else {
            // Keep cached user on network glitch / server startup
            const cachedUser = getStoredUser()
            if (cachedUser) {
              setCurrentUser(cachedUser)
            } else {
              setCurrentUser(null)
            }
          }
        })
        .finally(() => setAuthLoading(false))
    } else {
      clearAuthSession()
      setCurrentUser(null)
      setAuthLoading(false)
    }
  }, [])

  const handleAuthSuccess = (user: PatientUser) => {
    setCurrentUser(user)
    setShowWelcomePopup(true)
    setScreen("dashboard")
  }

  const handleLogout = async () => {
    await logoutPatient()
    setShowWelcomePopup(false)
    setCurrentUser(null)
    setScreen("dashboard")
  }

  const performAnalysis = async (symptomsToEvaluate?: string[]) => {
    const symptoms =
      symptomsToEvaluate && symptomsToEvaluate.length > 0
        ? symptomsToEvaluate
        : selected

    if (!symptoms.length) {
      setError({
        type: "validation",
        message:
          "Please select at least one symptom before running the analysis.",
      })
      setScreen("checker")
      return
    }

    if (
      symptomsToEvaluate &&
      symptomsToEvaluate.length > 0 &&
      symptomsToEvaluate !== selected
    ) {
      setSelected(symptomsToEvaluate)
    }

    setAnalysing(true)
    setError(null)

    try {
      const response = await predictSymptoms(symptoms)
      setPrediction(response)
      setError(null)
      setScreen("results")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err: unknown) {
      const apiErr = err as ApiError
      if (apiErr.statusCode === 401) {
        setCurrentUser(null)
        return
      }
      setError(apiErr)
      setScreen("results")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } finally {
      setAnalysing(false)
    }
  }

  const navigate = (next: Screen) => {
    setScreen(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
    setMobileOpen(false)
  }

  useEffect(() => {
    const close = () => setMobileOpen(false)
    window.addEventListener("resize", close)
    return () => window.removeEventListener("resize", close)
  }, [])

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div className="loader">
            <Icon name="brain" size={28} />
          </div>
          <p style={{ color: "var(--navy)", fontWeight: 700, fontSize: 14 }}>
            Initializing AI Medicine System…
          </p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <AuthPage
        onAuthSuccess={handleAuthSuccess}
        lang={lang}
        onLanguageChange={handleLanguageChange}
      />
    )
  }

  return (
    <div className="app-shell">
      {showWelcomePopup && (
        <WelcomePopup
          userName={currentUser.full_name}
          onClose={() => setShowWelcomePopup(false)}
          lang={lang}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "sidebar--open" : ""} ${
          sidebarCollapsed ? "sidebar--collapsed" : ""
        }`}
      >
        <div className="sidebar-top">
          <Brand
            compact={sidebarCollapsed}
            title={t.brandTitle}
            subtitle={t.brandSubtitle}
          />
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={sidebarCollapsed ? "arrow" : "chevron"} size={16} />
          </button>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Main navigation">
          <span className="nav-label">Workspace</span>
          {localizedNavItems.map((item) => (
            <button
              className={screen === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => navigate(item.id)}
              data-tooltip={item.label}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-support">
          <div className="mini-shield">
            <Icon name="shield" size={18} />
          </div>
          <strong>Responsible AI</strong>
          <p>Educational support, never a clinical diagnosis.</p>
        </div>
        <div className="sidebar-footer">
          <span>Academic Project</span>
          <small>Decision support prototype</small>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="mobile-header">
        <Brand title={t.brandTitle} subtitle={t.brandSubtitle} />
        <button
          type="button"
          className="icon-button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Icon name="menu" />
        </button>
      </div>

      <main className={sidebarCollapsed ? "main--collapsed" : ""}>
        <TopBar
          screen={screen}
          onOpenMenu={() => setMobileOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
          lang={lang}
          onLanguageChange={handleLanguageChange}
          t={t}
        />
        <div className="content">
          {screen === "dashboard" && (
            <Dashboard
              selected={selected}
              setSelected={setSelected}
              onAnalyse={(symptoms) => performAnalysis(symptoms)}
              navigate={navigate}
              disabled={analysing}
            />
          )}
          {screen === "checker" && (
            <Checker
              selected={selected}
              setSelected={setSelected}
              onAnalyse={(symptoms) => performAnalysis(symptoms)}
              disabled={analysing}
            />
          )}
          {screen === "results" && (
            <Results
              selected={selected}
              prediction={prediction}
              error={error}
              analysing={analysing}
              onRetry={() => performAnalysis()}
              onModify={() => navigate("checker")}
            />
          )}
          {screen === "medicines" && <Medicines prediction={prediction} />}
          {screen === "about" && <About />}
        </div>
        <footer className="main-footer">
          <span>AI Medicine Information System</span>
          <span>For academic and educational purposes only</span>
        </footer>
      </main>

      {analysing && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-modal">
            <div className="loader">
              <Icon name="brain" size={24} />
            </div>
            <h2>Analysing symptoms</h2>
            <p>Querying the FastAPI machine learning model and safety layer…</p>
            <div className="loading-bar">
              <span />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
