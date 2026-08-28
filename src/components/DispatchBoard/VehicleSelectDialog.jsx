import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'

/**
 * 車両が複数あるときに「どの車両の稼働状況を編集する？」と尋ねるダイアログ。
 */
export function VehicleSelectDialog({ open, vehicles, onClose, onSelect }) {
  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form">
      <Layout
        height="auto"
        padding={4}
        header={<DialogHeader title="車両を選択してください" onOpenChange={handleOpenChange} />}
        content={
          <LayoutContent>
            <List>
              {(vehicles ?? []).map((vehicle) => (
                <ListItem
                  key={vehicle.id}
                  label={vehicle.name}
                  onClick={() => onSelect(vehicle)}
                />
              ))}
            </List>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack hAlign="end">
              <Button label="キャンセル" variant="secondary" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
