import { Heading } from '@astryxdesign/core/Heading'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/Layout'

function namedChange(handleChange, name) {
  return (value) => handleChange({ target: { name, value: value ?? '' } })
}

function ContactEditFields({ formData, handleChange }) {
  return (
    <>
      <TextInput
        label="電話番号"
        htmlName="contact_phone"
        value={formData.contact_phone}
        onChange={namedChange(handleChange, 'contact_phone')}
        width="100%"
        size="sm"
      />
      <TextInput
        label="車種"
        htmlName="car_model"
        value={formData.car_model}
        onChange={namedChange(handleChange, 'car_model')}
        width="100%"
        size="sm"
      />
      <TextInput
        label="ナンバー"
        htmlName="car_plate"
        value={formData.car_plate}
        onChange={namedChange(handleChange, 'car_plate')}
        width="100%"
        size="sm"
      />
      <TextInput
        label="色"
        htmlName="car_color"
        value={formData.car_color}
        onChange={namedChange(handleChange, 'car_color')}
        width="100%"
        size="sm"
      />
      <TextArea
        label="駐車位置メモ"
        htmlName="parking_note"
        value={formData.parking_note}
        onChange={namedChange(handleChange, 'parking_note')}
        rows={3}
        width="100%"
      />
    </>
  )
}

function ContactViewFields({ order }) {
  return (
    <>
      <VStack gap={0.5}>
        <Text size="xsm" color="secondary">
          電話番号
        </Text>
        {order.contact_phone ? (
          <Link href={`tel:${order.contact_phone}`}>{order.contact_phone}</Link>
        ) : (
          <Text>未設定</Text>
        )}
      </VStack>
      <VStack gap={0.5}>
        <Text size="xsm" color="secondary">
          車種
        </Text>
        <Text>{order.car_model || '未設定'}</Text>
      </VStack>
      <VStack gap={0.5}>
        <Text size="xsm" color="secondary">
          ナンバー
        </Text>
        <Text>{order.car_plate || '未設定'}</Text>
      </VStack>
      <VStack gap={0.5}>
        <Text size="xsm" color="secondary">
          色
        </Text>
        <Text>{order.car_color || '未設定'}</Text>
      </VStack>
      {order.parking_note ? (
        <VStack gap={0.5}>
          <Text size="xsm" color="secondary">
            駐車位置メモ
          </Text>
          <Text>{order.parking_note}</Text>
        </VStack>
      ) : null}
    </>
  )
}

export function OrderContactSection({ editing, order, formData, handleChange }) {
  return (
    <VStack gap={2}>
      <Heading level={3}>連絡先・車情報</Heading>
      <VStack gap={2}>
        {editing ? (
          <ContactEditFields formData={formData} handleChange={handleChange} />
        ) : (
          <ContactViewFields order={order} />
        )}
      </VStack>
    </VStack>
  )
}
