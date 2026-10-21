import { TablePage } from '../components/AdTable'
import { ViewDrawer } from '../components/ViewDrawer'

export function HistoryPage() {
  return (
    <>
      <TablePage title="History" view="history" />
      <ViewDrawer />
    </>
  )
}
