// components/MobileControls.tsx
import { useReducer, useCallback, useEffect } from 'react'
import { Joystick } from 'react-joystick-component'

type ControlState = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  brake: boolean
  reset: boolean
  axisX: number
  axisY: number
}

type ControlAction =
  | { type: 'PRESS'; key: keyof ControlState }
  | { type: 'RELEASE'; key: keyof ControlState }
  | { type: 'JOYSTICK_MOVE'; x: number; y: number }
  | { type: 'JOYSTICK_STOP' }

const initialState: ControlState = {
  forward: false,
  back: false,
  left: false,
  right: false,
  brake: false,
  reset: false,
  axisX: 0,
  axisY: 0
}

function controlReducer(state: ControlState, action: ControlAction): ControlState {
  switch (action.type) {
    case 'PRESS': return { ...state, [action.key]: true }
    case 'RELEASE': return { ...state, [action.key]: false }
    case 'JOYSTICK_MOVE': return { ...state, axisX: action.x, axisY: action.y }
    case 'JOYSTICK_STOP': return { ...state, axisX: 0, axisY: 0 }
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

  const handleJoystickMove = useCallback((e: any) => {
    // Determine if x/y are in pixels (e.g. up to 60) or normalized (up to 1)
    let nx = e.x || 0;
    let ny = e.y || 0;
    if (Math.abs(nx) > 1.5 || Math.abs(ny) > 1.5) {
      nx = nx / 60;
      ny = ny / 60;
    }
    
    // Guarantee correct axis sign based on library's direction string
    if (e.direction === 'FORWARD') ny = Math.abs(ny);
    if (e.direction === 'BACKWARD') ny = -Math.abs(ny);
    if (e.direction === 'LEFT') nx = -Math.abs(nx); // Left is negative stick, but wait!
    if (e.direction === 'RIGHT') nx = Math.abs(nx);

    // ensure within [-1, 1]
    nx = Math.max(-1, Math.min(1, nx));
    ny = Math.max(-1, Math.min(1, ny));
    
    dispatch({ type: 'JOYSTICK_MOVE', x: nx, y: ny })
  }, [])

  const handleJoystickStop = useCallback(() => {
    dispatch({ type: 'JOYSTICK_STOP' })
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
      {/* Left side — analog joystick */}
      <div style={{ pointerEvents: 'all', paddingBottom: 16, touchAction: 'none' }}>
        <Joystick 
          size={120} 
          sticky={false} 
          baseColor="rgba(0,0,0,0.35)" 
          stickColor="rgba(255,255,255,0.6)" 
          move={handleJoystickMove} 
          stop={handleJoystickStop} 
        />
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
