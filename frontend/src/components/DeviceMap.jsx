import { useState, useEffect } from 'react'
import { Wifi, Shield, Network, Monitor, RefreshCw, MapPin } from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL || ''

// Real coordinates for each network location
const NETWORK_LOCATIONS = {
  "Redwood City": { lat: 37.4852, lng: -122.2364, city: "Redwood City, CA", country: "USA" },
  "Korea Office": { lat: 37.5665, lng: 126.9780, city: "Seoul", country: "South Korea" },
  "IN-PUN-ASTP":  { lat: 18.5204, lng: 73.8567,  city: "Pune", country: "India" }
}

const TYPE_ICON = {
  wireless:  { icon: Wifi,    color: '#3B8BDE', label: 'Wireless AP' },
  appliance: { icon: Shield,  color: '#00D46A', label: 'Firewall/SD-WAN' },
  switch:    { icon: Network, color: '#FFB300', label: 'Switch' },
  default:   { icon: Monitor, color: '#8B8FA8', label: 'Device' }
}

function DeviceCard({ device }) {
  const typeInfo = TYPE_ICON[device.productType] || TYPE_ICON.default
  const Icon = typeInfo.icon
  const isOnline = device.status === 'online'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: 'var(--bg-base)',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${isOnline ? 'rgba(0,212,106,0.2)' : 'rgba(255,71,87,0.2)'}`,
      marginBottom: 6
    }}>
      <div style={{
        width: 32, height: 32,
        borderRadius: 8,
        background: `${typeInfo.color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={14} color={typeInfo.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {device.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {device.model} · {typeInfo.label}
        </div>
      </div>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: isOnline ? 'var(--status-ok)' : 'var(--status-critical)',
        flexShrink: 0,
        boxShadow: isOnline ? '0 0 6px rgba(0,212,106,0.6)' : '0 0 6px rgba(255,71,87,0.6)'
      }}/>
    </div>
  )
}

function NetworkPin({ group, selected, onClick, position }) {
  const allOnline = group.offline === 0
  const loc = NETWORK_LOCATIONS[group.networkName] || {}

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        cursor: 'pointer',
        zIndex: selected ? 10 : 5
      }}
    >
      {/* Pulse ring */}
      {allOnline && (
        <div style={{
          position: 'absolute',
          width: 48, height: 48,
          borderRadius: '50%',
          background: 'rgba(0,212,106,0.1)',
          border: '1px solid rgba(0,212,106,0.3)',
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          animation: 'pulse-ring 2s ease-out infinite'
        }}/>
      )}

      {/* Pin */}
      <div style={{
        width: 36, height: 36,
        borderRadius: '50%',
        background: selected ? 'var(--gruve-green)' : 'var(--bg-elevated)',
        border: `2px solid ${allOnline ? 'var(--status-ok)' : 'var(--status-critical)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 12px ${allOnline ? 'rgba(0,212,106,0.4)' : 'rgba(255,71,87,0.4)'}`,
        transition: 'all 0.2s'
      }}>
        <MapPin size={16} color={selected ? '#000' : allOnline ? 'var(--status-ok)' : 'var(--status-critical)'}/>
      </div>

      {/* Label */}
      <div style={{
        position: 'absolute',
        top: 40, left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--bg-border)',
        borderRadius: 6,
        padding: '3px 8px',
        fontSize: 10,
        fontWeight: 500,
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none'
      }}>
        {group.networkName}
        <span style={{ marginLeft: 4, color: allOnline ? 'var(--status-ok)' : 'var(--status-critical)' }}>
          {group.online}/{group.total}
        </span>
      </div>
    </div>
  )
}

// Convert lat/lng to SVG map percentage positions
// Using a simple equirectangular projection
function latLngToPercent(lat, lng) {
  const x = ((lng + 180) / 360) * 100
  const y = ((90 - lat) / 180) * 100
  return { x, y }
}

export default function DeviceMap() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchDevices = async () => {
    try {
      const r = await fetch(`${API}/api/v1/devices`)
      const d = await r.json()
      setData(d)
      setLastRefresh(new Date())
      if (!selected && d.groups?.length > 0) {
        setSelected(d.groups[0].networkId)
      }
    } catch (e) {
      console.error('Failed to fetch devices:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
    const t = setInterval(fetchDevices, 30000)
    return () => clearInterval(t)
  }, [])

  const selectedGroup = data?.groups?.find(g => g.networkId === selected)
  const totalOnline   = data?.groups?.reduce((s, g) => s + g.online, 0) || 0
  const totalOffline  = data?.groups?.reduce((s, g) => s + g.offline, 0) || 0

  // Device type breakdown
  const typeCount = {}
  data?.groups?.forEach(g => g.devices.forEach(d => {
    const t = d.productType || 'unknown'
    typeCount[t] = (typeCount[t] || 0) + 1
  }))

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Network Map</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
            Live device status across all 3 Meraki network locations
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button className="btn btn-secondary" onClick={fetchDevices} style={{ padding: '6px 12px' }}>
            <RefreshCw size={13}/> Refresh
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          padding: '6px 14px', borderRadius: 20,
          background: 'rgba(0,212,106,0.1)', border: '1px solid rgba(0,212,106,0.3)',
          fontSize: 12, color: 'var(--status-ok)', fontWeight: 500
        }}>
          {totalOnline} Online
        </div>
        {totalOffline > 0 && (
          <div style={{
            padding: '6px 14px', borderRadius: 20,
            background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)',
            fontSize: 12, color: 'var(--status-critical)', fontWeight: 500
          }}>
            {totalOffline} Offline
          </div>
        )}
        {Object.entries(typeCount).map(([type, count]) => {
          const info = TYPE_ICON[type] || TYPE_ICON.default
          return (
            <div key={type} style={{
              padding: '6px 14px', borderRadius: 20,
              background: `${info.color}15`,
              border: `1px solid ${info.color}40`,
              fontSize: 12, color: info.color, fontWeight: 500
            }}>
              {count} {info.label}
            </div>
          )
        })}
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', gap: 16 }}>

        {/* World map */}
        <div className="card" style={{
          flex: 2, padding: 0, overflow: 'hidden',
          position: 'relative', minHeight: 400
        }}>
          {/* SVG world map background */}
          <div style={{
            width: '100%', height: 400,
            background: 'linear-gradient(180deg, #0d1117 0%, #0a1628 100%)',
            position: 'relative', overflow: 'hidden'
          }}>
            {/* Grid lines */}
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, opacity: 0.15 }}>
              {/* Longitude lines */}
              {[-120,-90,-60,-30,0,30,60,90,120,150].map(lng => (
                <line key={lng}
                  x1={`${((lng+180)/360)*100}%`} y1="0"
                  x2={`${((lng+180)/360)*100}%`} y2="100%"
                  stroke="#00D46A" strokeWidth="0.5" strokeDasharray="4 8"
                />
              ))}
              {/* Latitude lines */}
              {[-60,-30,0,30,60].map(lat => (
                <line key={lat}
                  x1="0" y1={`${((90-lat)/180)*100}%`}
                  x2="100%" y2={`${((90-lat)/180)*100}%`}
                  stroke="#00D46A" strokeWidth="0.5" strokeDasharray="4 8"
                />
              ))}
            </svg>

            {/* Continent outlines — simplified SVG paths */}
            <svg viewBox="0 0 1000 500" width="100%" height="100%"
              style={{ position: 'absolute', top: 0, left: 0 }}>
              {/* North America */}
              <path d="M 150 80 L 280 70 L 310 130 L 290 200 L 240 230 L 180 210 L 140 160 Z"
                fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.2)" strokeWidth="1"/>
              {/* South America */}
              <path d="M 220 250 L 290 240 L 300 350 L 250 420 L 200 380 L 190 300 Z"
                fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.2)" strokeWidth="1"/>
              {/* Europe */}
              <path d="M 460 60 L 560 55 L 570 120 L 500 140 L 450 120 Z"
                fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.2)" strokeWidth="1"/>
              {/* Africa */}
              <path d="M 470 150 L 560 140 L 580 280 L 520 360 L 460 300 L 450 200 Z"
                fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.2)" strokeWidth="1"/>
              {/* Asia */}
              <path d="M 570 50 L 850 40 L 880 180 L 800 220 L 680 200 L 580 160 L 560 100 Z"
                fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.2)" strokeWidth="1"/>
              {/* Australia */}
              <path d="M 760 280 L 870 270 L 880 360 L 820 390 L 750 350 Z"
                fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.2)" strokeWidth="1"/>
            </svg>

            {/* Network pins */}
            {!loading && data?.groups?.map(group => {
              const loc = NETWORK_LOCATIONS[group.networkName]
              if (!loc) return null
              const pos = latLngToPercent(loc.lat, loc.lng)
              return (
                <NetworkPin
                  key={group.networkId}
                  group={group}
                  selected={selected === group.networkId}
                  onClick={() => setSelected(group.networkId)}
                  position={pos}
                />
              )
            })}

            {/* Connection lines between pins */}
            {!loading && data?.groups?.length > 1 && (() => {
              const positions = data.groups
                .filter(g => NETWORK_LOCATIONS[g.networkName])
                .map(g => {
                  const loc = NETWORK_LOCATIONS[g.networkName]
                  return latLngToPercent(loc.lat, loc.lng)
                })
              return (
                <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                  {positions.map((p1, i) =>
                    positions.slice(i+1).map((p2, j) => (
                      <line key={`${i}-${j}`}
                        x1={`${p1.x}%`} y1={`${p1.y}%`}
                        x2={`${p2.x}%`} y2={`${p2.y}%`}
                        stroke="rgba(0,212,106,0.15)"
                        strokeWidth="1"
                        strokeDasharray="6 4"
                      />
                    ))
                  )}
                </svg>
              )
            })()}

            {loading && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', fontSize: 13
              }}>
                Loading device map...
              </div>
            )}
          </div>
        </div>

        {/* Device panel */}
        <div className="card" style={{ flex: 1, minWidth: 280, maxWidth: 320 }}>
          {selectedGroup ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedGroup.networkName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                  {NETWORK_LOCATIONS[selectedGroup.networkName]?.city} · {NETWORK_LOCATIONS[selectedGroup.networkName]?.country}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--status-ok)' }}>
                    {selectedGroup.online} online
                  </span>
                  {selectedGroup.offline > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--status-critical)' }}>
                      {selectedGroup.offline} offline
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {selectedGroup.total} total
                  </span>
                </div>
              </div>

              <div style={{ overflowY: 'auto', maxHeight: 320 }}>
                {selectedGroup.devices.map(device => (
                  <DeviceCard key={device.serial} device={device}/>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
              <MapPin size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }}/>
              Click a network pin to see devices
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.6; }
          100% { transform: translate(-50%,-50%) scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
