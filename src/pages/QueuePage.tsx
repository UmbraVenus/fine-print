import { TablePage } from '../components/AdTable'
import { ViewDrawer } from '../components/ViewDrawer'

export function QueuePage() {
  return (
    <>
      <TablePage title="Queue" view="queue" />
      <ViewDrawer />
    </>
  )
}
