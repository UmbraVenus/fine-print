import { ComingNextButton } from '../components/ComingNext'
import { TablePage } from '../components/AdTable'
import { ViewDrawer } from '../components/ViewDrawer'

export function MyAdsPage() {
  return (
    <>
      <TablePage title="My ads" view="my-ads" action={<ComingNextButton feature="upload" />} />
      <ViewDrawer />
    </>
  )
}
