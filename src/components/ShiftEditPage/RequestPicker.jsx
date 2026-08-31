import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { getPlannedShiftTimes } from '@/lib/billing/shiftTargetAmount'
import {
  countAvailableByLicense,
  computeShiftsLaborCost,
  evaluateDayStaffing,
  findAdoptedShiftsForEmployee,
  formatTimeRange,
  formatYen,
} from '@/lib/shiftRequestEdit'

export function DayAvailabilityTokens({ dayRequests, dateShifts, employees }) {
  const available = countAvailableByLicense(dayRequests)
  const staffing = evaluateDayStaffing(dateShifts, employees)
  const labor = computeShiftsLaborCost(dateShifts, employees)

  return (
    <HStack gap={1} wrap="wrap" vAlign="center">
      <Token size="sm" color="blue" label={`一種 ${available.type1}人可`} />
      <Token size="sm" color="purple" label={`二種 ${available.type2}人可`} />
      {staffing.type1 + staffing.type2 > 0 ? (
        <Token size="sm" color="green" label={`採用 一種${staffing.type1} 二種${staffing.type2}`} />
      ) : null}
      {labor > 0 ? <Token size="sm" color="gray" label={formatYen(labor)} /> : null}
      {available.type2 === 0 && available.type1 > 0 ? (
        <Token size="sm" color="yellow" label="二種の希望なし" />
      ) : null}
    </HStack>
  )
}

export function RequestPicker({
  date,
  status,
  dayRequests,
  dateShifts,
  employees,
  onToggle,
  disabled,
}) {
  if (status) return null

  const staffing = evaluateDayStaffing(dateShifts, employees)
  const requests = dayRequests ?? []

  return (
    <VStack gap={2}>
      <Text weight="semibold">希望から採用</Text>
      {requests.length === 0 ? (
        <Text color="secondary">この日の希望はありません</Text>
      ) : (
        <VStack gap={1}>
          {requests.map((request) => {
            const adopted = findAdoptedShiftsForEmployee(dateShifts, request.employeeId, employees)
            const adoptedShift = adopted[0]
            const adoptedTimes = adoptedShift ? getPlannedShiftTimes(adoptedShift) : null
            const hopeLabel = `希望 ${formatTimeRange(request.start, request.end)}`
            const description =
              adoptedTimes &&
              (adoptedTimes.start !== request.start || adoptedTimes.end !== request.end)
                ? `${hopeLabel} / 採用 ${formatTimeRange(adoptedTimes.start, adoptedTimes.end)}`
                : hopeLabel

            return (
              <CheckboxInput
                key={request.employeeId}
                size="sm"
                label={`${request.name}（${request.licenseType}）`}
                description={description}
                value={adopted.length > 0}
                changeAction={(checked) => onToggle(date, request, checked)}
                isDisabled={disabled}
              />
            )
          })}
        </VStack>
      )}
      {staffing.warnings.length > 0 ? (
        <HStack gap={1} wrap="wrap">
          {staffing.warnings.map((warning) => (
            <Token key={warning} size="sm" color="red" label={warning} />
          ))}
        </HStack>
      ) : null}
    </VStack>
  )
}
