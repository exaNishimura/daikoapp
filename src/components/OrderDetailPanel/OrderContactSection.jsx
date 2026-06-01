import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'

const sectionTitleSx = {
  fontWeight: 600,
  mb: 2,
  pb: 1.5,
  borderBottom: 1,
  borderColor: 'divider',
}
const labelSx = { display: 'block', mb: 0.5 }

function ContactEditFields({ formData, handleChange }) {
  return (
    <>
      <TextField
        label="電話番号"
        type="tel"
        name="contact_phone"
        value={formData.contact_phone}
        onChange={handleChange}
        fullWidth
        size="small"
      />
      <TextField
        label="車種"
        name="car_model"
        value={formData.car_model}
        onChange={handleChange}
        fullWidth
        size="small"
      />
      <TextField
        label="ナンバー"
        name="car_plate"
        value={formData.car_plate}
        onChange={handleChange}
        fullWidth
        size="small"
      />
      <TextField
        label="色"
        name="car_color"
        value={formData.car_color}
        onChange={handleChange}
        fullWidth
        size="small"
      />
      <TextField
        label="駐車位置メモ"
        name="parking_note"
        value={formData.parking_note}
        onChange={handleChange}
        multiline
        rows={3}
        fullWidth
      />
    </>
  )
}

function ContactViewFields({ order }) {
  return (
    <>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={labelSx}>
          電話番号
        </Typography>
        {order.contact_phone ? (
          <Typography
            variant="body2"
            component="a"
            href={`tel:${order.contact_phone}`}
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {order.contact_phone}
          </Typography>
        ) : (
          <Typography variant="body2">未設定</Typography>
        )}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={labelSx}>
          車種
        </Typography>
        <Typography variant="body2">{order.car_model || '未設定'}</Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={labelSx}>
          ナンバー
        </Typography>
        <Typography variant="body2">{order.car_plate || '未設定'}</Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={labelSx}>
          色
        </Typography>
        <Typography variant="body2">{order.car_color || '未設定'}</Typography>
      </Box>
      {order.parking_note && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={labelSx}>
            駐車位置メモ
          </Typography>
          <Typography variant="body2">{order.parking_note}</Typography>
        </Box>
      )}
    </>
  )
}

export function OrderContactSection({ editing, order, formData, handleChange }) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={sectionTitleSx}>
        連絡先・車情報
      </Typography>
      <Stack spacing={2.5}>
        {editing ? (
          <ContactEditFields formData={formData} handleChange={handleChange} />
        ) : (
          <ContactViewFields order={order} />
        )}
      </Stack>
    </Box>
  )
}
