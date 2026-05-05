// components/MobileControls.tsx
import { useReducer, useCallback, useEffect } from 'react'

type ControlState = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  brake: boolean
  reset: boolean
}

type ControlAction =
  | { type: 'PRESS'; key: keyof ControlState }
  | { type: 'RELEASE'; key: keyof ControlState }

const initialState: ControlState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  brake: false,
  reset: false,
}

function controlReducer(state: ControlState, action: ControlAction): ControlState {
  switch (action.type) {
    case 'PRESS': return { ...state, [action.key]: true }
    case 'RELEASE': return { ...state, [action.key]: false }
    default: return state
  }
}

type Props = {
  onChange: (state: ControlState) => void
}

export const MobileControls = ({ onChange }: Props) => {
  const [state, dispatch] = useReducer(controlReducer, initialState)

  const press = useCallback((key: keyof ControlState) => {
    dispatch({ type: 'PRESS', key })
  }, [])

  const release = useCallback((key: keyof ControlState) => {
    dispatch({ type: 'RELEASE', key })
  }, [])

  // Keep parent in sync from the source of truth (reducer state).
  useEffect(() => {
    onChange(state)
  }, [state, onChange])

  const btn = (key: keyof ControlState, label: string) => (
    <button
      key={key}
      onPointerDown={(e) => {
        e.preventDefault()
        press(key)
      }}
      onPointerUp={(e) => {
        e.preventDefault()
        release(key)
      }}
      onPointerCancel={() => release(key)}
      onPointerLeave={() => release(key)}
      onTouchStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.4)',
        background: state[key]
          ? 'rgba(255,255,255,0.35)'
          : 'rgba(0,0,0,0.35)',
        color: 'white',
        fontSize: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
        backdropFilter: 'blur(4px)',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      position: 'fixed',
      bottom: 32,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      padding: '0 24px',
      pointerEvents: 'none',
      zIndex: 100,
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    }}>
      {/* Left side — steering */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '64px 64px 64px',
        gridTemplateRows: '64px 64px',
        gap: 8,
        pointerEvents: 'all',
      }}>
        <div />
        <div style={{ gridColumn: 2, gridRow: 1 }}>
          {btn('forward', '↑')}
        </div>
        <div />
        <div style={{ gridColumn: 1, gridRow: 2 }}>
          {btn('left', '←')}
        </div>
        <div style={{ gridColumn: 2, gridRow: 2 }}>
          {btn('back', '↓')}
        </div>
        <div style={{ gridColumn: 3, gridRow: 2 }}>
          {btn('right', '→')}
        </div>
      </div>

      {/* Right side — brake + reset */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'all',
      }}>
        {btn('brake', 'B')}
        {btn('reset', 'R')}
      </div>
    </div>
  )
}
