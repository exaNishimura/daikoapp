import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Button from '@mui/material/Button'

/**
 * 車両が複数あるときに「どの車両の稼働状況を編集する？」と尋ねるダイアログ。
 * 1 台選ぶと onSelect(vehicle) が呼ばれてダイアログが閉じる。
 */
export function VehicleSelectDialog({ open, vehicles, onClose, onSelect }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>車両を選択してください</DialogTitle>
      <DialogContent>
        <List>
          {vehicles.map((vehicle) => (
            <ListItem key={vehicle.id} disablePadding>
              <ListItemButton onClick={() => onSelect(vehicle)}>
                <ListItemText primary={vehicle.name} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
      </DialogActions>
    </Dialog>
  )
}
