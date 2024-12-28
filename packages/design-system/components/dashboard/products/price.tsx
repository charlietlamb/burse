import { PriceFormSchema } from '@burse/design-system/types/stripe/prices'
import { Button } from '@burse/design-system/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import EditPriceDialog from './edit-price-dialog'

export default function Price({
  price,
  setPrice,
  onDelete,
}: {
  price: PriceFormSchema
  setPrice: (price: PriceFormSchema) => void
  onDelete: () => void
}) {
  return (
    <div className="flex gap-2">
      <div className="flex w-full items-center justify-between border rounded-lg divide-x">
        <div className="flex divide-x h-full">
          <div className="text-sm font-medium text-muted-foreground font-heading px-2 h-full flex items-center truncate">
            {price.title}
          </div>
          <div className="flex gap-2 items-center px-2 h-full">
            <div className="text-sm">{price.price.toFixed(2)}</div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground uppercase px-2 h-full flex items-center">
          {price.currency}
        </div>
      </div>
      <EditPriceDialog price={price} setPrice={setPrice}>
        <Button variant="outline" size="icon" className="p-2">
          <Pencil />
        </Button>
      </EditPriceDialog>
      <Button
        variant="destructive"
        size="icon"
        className="p-2"
        onClick={() => onDelete()}
      >
        <Trash2 />
      </Button>
    </div>
  )
}
