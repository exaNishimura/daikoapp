import { Text } from '@astryxdesign/core/Text'
import { useOperatingHours } from '@/contexts/OperatingHoursProvider'
import { timeToMinutes, minutesToPixels } from '@/lib/shiftEditUtils'
import { getContrastTextColor } from '@/lib/colorContrast'
import { getStaffColorForShift, getStaffDisplayName } from '@/lib/staffFromEmployees'

function ShiftBar({ shift, staffColorByName, employees }) {
  useOperatingHours()
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
    <div
      className="bar"
      title={title}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        backgroundColor: barBg,
        color: textColor,
      }}
    >
      <span
        className="bar-text"
        style={{
          textShadow: textColor === '#fff' ? '0 1px 2px rgba(0,0,0,0.35)' : 'none',
        }}
      >
        {staffName}
      </span>
      <span className="bar-time">
        {shift.start}-{shift.end}
      </span>
    </div>
  )
}

function Lane({ role, shifts, staffColorByName, employees }) {
  return (
    <section className="lane">
      <div className="lane-label">{role}</div>
      {shifts.map((shift, idx) => (
        <ShiftBar
          key={shift.id || idx}
          shift={shift}
          staffColorByName={staffColorByName}
          employees={employees}
        />
      ))}
    </section>
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
    <section className="car-block">
      <header className="car-header">
        <Text weight="bold">{carNum}号車</Text>
      </header>
      <Lane
        role="代行"
        shifts={driverShifts}
        staffColorByName={staffColorByName}
        employees={employees}
      />
      <Lane
        role="随伴"
        shifts={companionShifts}
        staffColorByName={staffColorByName}
        employees={employees}
      />
    </section>
  )
}
