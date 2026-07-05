import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { TIMELINE_START, TIMELINE_END, timeToMinutes, minutesToPixels } from '@/lib/shiftEditUtils'
import { getContrastTextColor } from '@/lib/colorContrast'
import { getStaffColorForShift, getStaffDisplayName } from '@/lib/staffFromEmployees'

/**
 * 19:00 -> 翌 06:00 を 12 時間 (960px) に展開する時間軸。
 * 23:00–02:00 はピーク帯としてうっすら色付け。
 */
export function TimeAxis() {
  const markers = []

  const peakStart = minutesToPixels(timeToMinutes('23:00'))
  const peakEnd = minutesToPixels(timeToMinutes('02:00'))

  for (let hour = TIMELINE_START; hour <= 23; hour++) {
    markers.push({
      type: 'major',
      left: minutesToPixels((hour - TIMELINE_START) * 60),
      label: String(hour).padStart(2, '0') + ':00',
    })
  }
  for (let hour = 0; hour <= TIMELINE_END; hour++) {
    markers.push({
      type: 'major',
      left: minutesToPixels((24 - TIMELINE_START + hour) * 60),
      label: String(hour).padStart(2, '0') + ':00',
    })
  }
  for (let hour = TIMELINE_START; hour <= 23; hour++) {
    markers.push({
      type: 'minor',
      left: minutesToPixels((hour - TIMELINE_START) * 60 + 30),
      label: '',
    })
  }
  for (let hour = 0; hour <= TIMELINE_END; hour++) {
    markers.push({
      type: 'minor',
      left: minutesToPixels((24 - TIMELINE_START + hour) * 60 + 30),
      label: '',
    })
  }

  return (
    <Box
      className="time-axis"
      sx={{
        position: 'relative',
        height: '30px',
        borderBottom: '2px solid #ddd',
        mb: 1.25,
        bgcolor: '#ffffff',
      }}
    >
      <Box
        className="peak-zone"
        sx={{
          position: 'absolute',
          top: 0,
          height: '100%',
          background: 'rgba(255, 240, 200, 0.3)',
          borderLeft: '1px solid rgba(255, 200, 0, 0.3)',
          borderRight: '1px solid rgba(255, 200, 0, 0.3)',
          left: `${peakStart}px`,
          width: `${peakEnd - peakStart}px`,
        }}
      />
      {markers.map((marker, idx) => (
        <Box
          key={idx}
          className={`time-marker ${marker.type}`}
          sx={{
            position: 'absolute',
            height: '100%',
            borderLeft: marker.type === 'major' ? '2px solid #ddd' : '1px dashed #ddd',
            fontSize: '11px',
            pl: 0.5,
            color: '#333',
            fontWeight: marker.type === 'major' ? 'bold' : 'normal',
            opacity: marker.type === 'minor' ? 0.5 : 1,
            left: `${marker.left}px`,
          }}
        >
          {marker.label}
        </Box>
      ))}
    </Box>
  )
}

function ShiftBar({ shift, staffColorByName, employees }) {
  const startMinutes = timeToMinutes(shift.start)
  const endMinutes = timeToMinutes(shift.end)
  const left = minutesToPixels(startMinutes)
  const width = minutesToPixels(endMinutes - startMinutes)

  const staffName = getStaffDisplayName(shift, employees)
  const title = shift.note
    ? `${staffName} (${shift.role}) ${shift.start}-${shift.end} - ${shift.note}`
    : `${staffName} (${shift.role}) ${shift.start}-${shift.end}`

  const barBg = getStaffColorForShift(shift, employees, staffColorByName)
  const textColor = getContrastTextColor(barBg)

  return (
    <Box
      className="bar"
      title={title}
      sx={{
        position: 'absolute',
        left: `${left}px`,
        width: `${width}px`,
        height: '32px',
        top: '4px',
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        pl: 0.5,
        fontSize: '11px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        border: '1px solid rgba(0,0,0,0.2)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        bgcolor: barBg,
        color: textColor,
        '&:hover': {
          opacity: 0.8,
          zIndex: 10,
        },
      }}
    >
      <Typography
        component="span"
        className="bar-text"
        sx={{
          whiteSpace: 'nowrap',
          textShadow: textColor === '#fff' ? '0 1px 2px rgba(0,0,0,0.35)' : 'none',
          fontSize: '11px',
        }}
      >
        {staffName}
      </Typography>
      <Typography
        component="span"
        className="bar-time"
        sx={{ fontSize: '10px', ml: 0.5, opacity: 0.9 }}
      >
        {shift.start}-{shift.end}
      </Typography>
    </Box>
  )
}

function Lane({ role, shifts, staffColorByName, employees }) {
  return (
    <Box
      className="lane"
      sx={{
        position: 'relative',
        height: '40px',
        border: '1px solid #e0e0e0',
        borderRadius: 1,
        mb: 0.625,
        bgcolor: '#fafafa',
        overflow: 'hidden',
      }}
    >
      <Box
        className="lane-label"
        sx={{
          position: 'absolute',
          left: '5px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: '#666',
          zIndex: 1,
          bgcolor: 'rgba(255,255,255,0.8)',
          px: 0.75,
          py: 0.25,
          borderRadius: 0.375,
        }}
      >
        {role}
      </Box>
      {shifts.map((shift, idx) => (
        <ShiftBar
          key={shift.id || idx}
          shift={shift}
          staffColorByName={staffColorByName}
          employees={employees}
        />
      ))}
    </Box>
  )
}

/**
 * 1 号車 / 2 号車 など、車両単位のタイムライン。
 * 代行 / 随伴の 2 レーンを縦に並べる。
 */
export function CarBlock({ carNum, shifts, staffColorByName, employees }) {
  const driverShifts = shifts.filter((s) => s.car === carNum && s.role === '代行')
  const companionShifts = shifts.filter((s) => s.car === carNum && s.role === '随伴')

  return (
    <Box className="car-block" sx={{ mb: 2.5, bgcolor: '#ffffff' }}>
      <Box
        className="car-header"
        sx={{ fontWeight: 'bold', mb: 1, fontSize: '14px', color: '#333' }}
      >
        {carNum}号車
      </Box>
      <Lane role="代行" shifts={driverShifts} staffColorByName={staffColorByName} employees={employees} />
      <Lane role="随伴" shifts={companionShifts} staffColorByName={staffColorByName} employees={employees} />
    </Box>
  )
}
