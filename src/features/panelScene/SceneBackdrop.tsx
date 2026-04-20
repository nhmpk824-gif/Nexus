import type { PetSceneLocation } from '../../types'

type SceneBackdropProps = {
  location: PetSceneLocation
}

/**
 * Bottom layer of the 3-layer pet stage — a static SVG silhouette of the
 * chosen scenery. Weather (middle) and sunlight tint (top) sit above this
 * via siblings in PetView. All color tokens here consume CSS custom
 * properties (--scene-sky-*, --scene-silhouette-*, --scene-accent-*) that
 * the SunlightTint parent re-binds per time-of-day.
 */
export function SceneBackdrop({ location }: SceneBackdropProps) {
  if (location === 'off') return null

  return (
    <div className={`scene-backdrop scene-backdrop--${location}`} aria-hidden="true">
      <svg
        className="scene-backdrop__art"
        viewBox="0 0 600 400"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`scene-sky-${location}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--scene-sky-top)" />
            <stop offset="60%" stopColor="var(--scene-sky-mid)" />
            <stop offset="100%" stopColor="var(--scene-sky-bottom)" />
          </linearGradient>
        </defs>
        <rect width="600" height="400" fill={`url(#scene-sky-${location})`} />
        {renderSceneShapes(location)}
      </svg>
    </div>
  )
}

function renderSceneShapes(location: Exclude<PetSceneLocation, 'off'>) {
  switch (location) {
    case 'city':
      return <CityShapes />
    case 'countryside':
      return <CountrysideShapes />
    case 'seaside':
      return <SeasideShapes />
    case 'fields':
      return <FieldsShapes />
    case 'mountain':
      return <MountainShapes />
  }
}

function CityShapes() {
  return (
    <g>
      {/* Far silhouette (distant buildings) */}
      <polygon
        points="0,280 40,240 60,250 80,220 110,225 130,210 160,215 180,200 210,205 240,220 270,215 300,200 330,210 360,195 400,205 440,195 470,210 510,200 540,215 580,205 600,220 600,400 0,400"
        fill="var(--scene-silhouette-far)"
      />
      {/* Mid silhouette (nearer skyscrapers) */}
      <g fill="var(--scene-silhouette-mid)">
        <rect x="60" y="270" width="45" height="130" />
        <rect x="115" y="250" width="55" height="150" />
        <rect x="180" y="285" width="38" height="115" />
        <rect x="225" y="255" width="60" height="145" />
        <rect x="295" y="240" width="50" height="160" />
        <rect x="355" y="275" width="42" height="125" />
        <rect x="405" y="260" width="55" height="140" />
        <rect x="470" y="280" width="40" height="120" />
        <rect x="520" y="255" width="60" height="145" />
      </g>
      {/* Lit windows (accent) */}
      <g fill="var(--scene-accent)">
        <rect x="70" y="290" width="4" height="6" />
        <rect x="82" y="300" width="4" height="6" />
        <rect x="125" y="270" width="4" height="6" />
        <rect x="145" y="285" width="4" height="6" />
        <rect x="240" y="275" width="4" height="6" />
        <rect x="260" y="290" width="4" height="6" />
        <rect x="305" y="260" width="4" height="6" />
        <rect x="320" y="280" width="4" height="6" />
        <rect x="420" y="280" width="4" height="6" />
        <rect x="440" y="295" width="4" height="6" />
        <rect x="535" y="275" width="4" height="6" />
        <rect x="555" y="290" width="4" height="6" />
      </g>
      {/* Foreground (close buildings / railing) */}
      <rect x="0" y="340" width="600" height="60" fill="var(--scene-silhouette-near)" />
    </g>
  )
}

function CountrysideShapes() {
  return (
    <g>
      {/* Rolling hills */}
      <path
        d="M0,310 Q100,260 200,290 T400,280 T600,300 L600,400 L0,400 Z"
        fill="var(--scene-silhouette-far)"
      />
      <path
        d="M0,340 Q120,300 260,325 T500,330 T600,340 L600,400 L0,400 Z"
        fill="var(--scene-silhouette-mid)"
      />
      {/* Farmhouse silhouette */}
      <g fill="var(--scene-silhouette-near)">
        <rect x="360" y="310" width="60" height="40" />
        <polygon points="355,310 390,285 425,310" />
        <rect x="375" y="325" width="10" height="15" fill="var(--scene-accent)" />
      </g>
      {/* Tree */}
      <g fill="var(--scene-silhouette-near)">
        <rect x="145" y="300" width="5" height="28" />
        <circle cx="147" cy="295" r="16" />
      </g>
      {/* Foreground grass */}
      <rect x="0" y="350" width="600" height="50" fill="var(--scene-silhouette-near)" />
    </g>
  )
}

function SeasideShapes() {
  return (
    <g>
      {/* Horizon line + water */}
      <rect x="0" y="240" width="600" height="100" fill="var(--scene-silhouette-far)" />
      {/* Distant island */}
      <path d="M410,240 Q450,215 490,240 Z" fill="var(--scene-silhouette-mid)" />
      {/* Wave lines */}
      <g stroke="var(--scene-accent)" strokeWidth="1" fill="none" opacity="0.45">
        <path d="M0,260 Q60,255 120,260 T240,260 T360,260 T480,260 T600,260" />
        <path d="M0,280 Q60,276 120,280 T240,280 T360,280 T480,280 T600,280" />
        <path d="M0,305 Q80,300 160,305 T320,305 T480,305 T600,305" />
      </g>
      {/* Foreground beach */}
      <rect x="0" y="340" width="600" height="60" fill="var(--scene-silhouette-near)" />
      {/* Lighthouse */}
      <g fill="var(--scene-silhouette-near)">
        <rect x="85" y="260" width="12" height="80" />
        <polygon points="82,260 91,245 100,260" />
        <rect x="88" y="253" width="6" height="4" fill="var(--scene-accent)" />
      </g>
    </g>
  )
}

function FieldsShapes() {
  return (
    <g>
      {/* Flat far horizon */}
      <rect x="0" y="295" width="600" height="30" fill="var(--scene-silhouette-far)" />
      {/* Fence row */}
      <g fill="var(--scene-silhouette-mid)">
        <rect x="0" y="315" width="600" height="3" />
        <rect x="40" y="308" width="3" height="22" />
        <rect x="110" y="308" width="3" height="22" />
        <rect x="180" y="308" width="3" height="22" />
        <rect x="250" y="308" width="3" height="22" />
        <rect x="320" y="308" width="3" height="22" />
        <rect x="390" y="308" width="3" height="22" />
        <rect x="460" y="308" width="3" height="22" />
        <rect x="530" y="308" width="3" height="22" />
      </g>
      {/* Distant tree */}
      <g fill="var(--scene-silhouette-mid)">
        <rect x="505" y="275" width="4" height="22" />
        <circle cx="507" cy="272" r="11" />
      </g>
      {/* Grass foreground — uneven tufts */}
      <path
        d="M0,335 L0,400 L600,400 L600,335 Q580,328 560,334 T500,330 T440,335 T380,328 T320,334 T260,330 T200,335 T140,328 T80,334 T20,330 Z"
        fill="var(--scene-silhouette-near)"
      />
    </g>
  )
}

function MountainShapes() {
  return (
    <g>
      {/* Far peaks */}
      <polygon
        points="0,290 80,220 160,260 230,210 310,250 390,200 470,240 540,210 600,260 600,400 0,400"
        fill="var(--scene-silhouette-far)"
      />
      {/* Mid peaks */}
      <polygon
        points="0,340 100,270 180,310 260,260 340,300 420,270 510,310 600,290 600,400 0,400"
        fill="var(--scene-silhouette-mid)"
      />
      {/* Near forest */}
      <g fill="var(--scene-silhouette-near)">
        <polygon points="0,360 30,320 60,360" />
        <polygon points="55,365 85,325 115,365" />
        <polygon points="110,360 140,322 170,360" />
        <polygon points="165,365 195,325 225,365" />
        <polygon points="220,360 250,320 280,360" />
        <polygon points="275,365 305,325 335,365" />
        <polygon points="330,360 360,322 390,360" />
        <polygon points="385,365 415,325 445,365" />
        <polygon points="440,360 470,320 500,360" />
        <polygon points="495,365 525,325 555,365" />
        <polygon points="550,360 580,322 600,340 600,360" />
      </g>
      <rect x="0" y="355" width="600" height="45" fill="var(--scene-silhouette-near)" />
    </g>
  )
}
